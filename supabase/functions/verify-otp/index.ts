import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, otp, fullName, password } = await req.json();
    
    if (!email || !otp) {
      throw new Error("Email and OTP are required");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the OTP record
    const { data: otpRecord, error: fetchError } = await supabaseAdmin
      .from("otp_verifications")
      .select("*")
      .eq("email", email)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !otpRecord) {
      console.error("OTP not found for email:", email, fetchError);
      return new Response(
        JSON.stringify({ error: "No valid OTP found. Please request a new OTP." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log("OTP Record found:", {
      email: otpRecord.email,
      expires_at: otpRecord.expires_at,
      attempts: otpRecord.attempts,
      verified: otpRecord.verified,
      created_at: otpRecord.created_at
    });

    // Check if OTP is expired
    const now = new Date();
    const expiresAt = new Date(otpRecord.expires_at);
    
    if (expiresAt < now) {
      console.error("OTP expired:", { expiresAt, now });
      return new Response(
        JSON.stringify({ error: "OTP has expired. Please request a new one." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Check attempts
    if (otpRecord.attempts >= 5) {
      return new Response(
        JSON.stringify({ error: "Too many failed attempts. Please request a new OTP." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Verify OTP
    console.log("Comparing OTPs:", { provided: otp, stored: otpRecord.otp_code });
    
    if (otpRecord.otp_code !== otp) {
      // Increment attempts
      await supabaseAdmin
        .from("otp_verifications")
        .update({ attempts: otpRecord.attempts + 1 })
        .eq("id", otpRecord.id);

      const remaining = 5 - (otpRecord.attempts + 1);
      console.error("Incorrect OTP. Attempts remaining:", remaining);
      
      return new Response(
        JSON.stringify({ 
          error: `Incorrect OTP. ${remaining} attempts remaining.`,
          attemptsRemaining: remaining
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // OTP is valid - mark as verified
    await supabaseAdmin
      .from("otp_verifications")
      .update({ verified: true })
      .eq("id", otpRecord.id);

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser?.users?.find((u) => u.email === email);

    let userId: string;

    if (userExists) {
      // User exists - update their password
      console.log("User exists, updating password:", email);
      
      const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        userExists.id,
        {
          password: password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
          },
        }
      );

      if (updateError) {
        console.error("Error updating user:", updateError);
        throw new Error("Failed to update user account");
      }

      userId = userExists.id;
    } else {
      // Create new user account
      const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
        },
      });

      if (signUpError) {
        console.error("Error creating user:", signUpError);
        throw new Error("Failed to create user account");
      }

      userId = authData.user.id;
    }

    // Upsert profile (insert or update if exists)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        user_id: userId,
        full_name: fullName,
        email,
        signup_method: "manual",
        is_active: true,
        password_set: true,
        email_verified: true,
      }, {
        onConflict: "user_id"
      });

    if (profileError) {
      console.error("Error upserting profile:", profileError);
      throw new Error("Failed to create/update profile");
    }

    // Assign default employee role (ignore if already exists)
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({
        user_id: userId,
        role: "employee",
      }, {
        onConflict: "user_id,role",
        ignoreDuplicates: true
      });

    if (roleError) {
      console.error("Error assigning role:", roleError);
    }

    // Log signup activity
    await supabaseAdmin.from("activity_logs").insert({
      user_id: userId,
      performed_by: userId,
      action_type: "signup",
      description: `User signed up manually: ${email}`,
      metadata: { method: "manual", email },
    });

    console.log(`User account ready: ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Account created successfully",
        userId: userId
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in verify-otp function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
