import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ResetPasswordSchema = z.object({
  email: z.string().email("Invalid email format").max(255),
  otp: z.string().regex(/^\d{6}$/, "OTP must be exactly 6 digits"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password too long"),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate input
    const body = await req.json();
    const parsed = ResetPasswordSchema.safeParse(body);
    
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input', 
          details: parsed.error.issues.map(i => i.message).join(', ')
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { email, otp, password } = parsed.data;

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the most recent OTP record for this email
    const { data: otpRecord } = await supabaseAdmin
      .from("otp_verifications")
      .select("*")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRecord) {
      throw new Error("Invalid or expired OTP");
    }

    // Check if OTP was already verified (from verify-otp-forgot step)
    if (!otpRecord.verified) {
      throw new Error("OTP has not been verified. Please verify your OTP first.");
    }

    // Verify the OTP code matches
    if (otpRecord.otp_code !== String(otp)) {
      throw new Error("Invalid OTP");
    }

    // After OTP validation, get user by email from profiles table first
    const { data: profileData, error: profileLookupError } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();

    let userId: string;

    if (profileData?.user_id) {
      userId = profileData.user_id;
      console.log(`Found user in profiles: ${userId}`);
    } else {
      // Fallback: search in auth.users with pagination
      console.log("User not found in profiles, searching auth.users...");
      let foundUser = null;
      let page = 1;
      const perPage = 1000;
      
      while (!foundUser) {
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage
        });
        
        if (listError) {
          console.error("Error listing users:", listError);
          throw new Error("Failed to find user");
        }
        
        if (users.length === 0) break;
        
        foundUser = users.find(u => u.email === email);
        if (foundUser) break;
        
        if (users.length < perPage) break;
        page++;
      }
      
      if (!foundUser) {
        console.error(`User not found for email: ${email}`);
        throw new Error("User not found");
      }
      
      userId = foundUser.id;
    }

    const user = { id: userId };

    // Update user password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      throw new Error("Failed to update password");
    }

    // Update password_set flag in profiles
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ 
        password_set: true,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id);

    if (profileError) {
      console.error("Error updating profile:", profileError);
    }

    // Log the activity
    await supabaseAdmin.from("activity_logs").insert({
      user_id: user.id,
      performed_by: user.id,
      action_type: "password_reset",
      description: `Password reset via OTP for ${email}`,
      metadata: {
        email,
        reset_method: "otp"
      },
      module: "auth",
      status: "success",
    });

    console.log(`Password reset successfully for ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Password updated successfully"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in reset-password-otp function:", error);
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
