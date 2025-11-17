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
    const { email, password } = await req.json();
    
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user by email
    const { data: { users }, error: getUserError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (getUserError) {
      console.error("Error fetching users:", getUserError);
      throw new Error("Failed to find user");
    }

    const user = users.find(u => u.email === email);
    
    if (!user) {
      throw new Error("User not found");
    }

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
      action_type: "password_changed",
      description: `Password reset via OTP for ${email}`,
      metadata: {
        email,
        reset_method: "otp"
      }
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
