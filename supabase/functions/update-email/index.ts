import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UpdateEmailSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  newEmail: z.string().email("Invalid email format"),
  oldEmail: z.string().email("Invalid old email format"),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate input
    const body = await req.json();
    const parsed = UpdateEmailSchema.safeParse(body);
    
    if (!parsed.success) {
      console.error("Validation error:", parsed.error.issues);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input', 
          details: parsed.error.issues.map(i => i.message).join(', '),
          success: false
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { userId, newEmail, oldEmail } = parsed.data;
    console.log(`Updating email for user ${userId} from ${oldEmail} to ${newEmail}`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if the new email is already in use by another user
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const emailInUse = existingUser?.users?.find(
      u => u.email?.toLowerCase() === newEmail.toLowerCase() && u.id !== userId
    );

    if (emailInUse) {
      console.log("Email already in use by another account");
      return new Response(
        JSON.stringify({ 
          error: "This email is already in use by another account",
          success: false
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update user email in auth.users using admin API
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { 
        email: newEmail,
        email_confirm: true // Confirm the email immediately
      }
    );

    if (updateError) {
      console.error("Error updating auth user:", updateError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to update email in authentication system",
          details: updateError.message,
          success: false
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Auth user email updated successfully");

    // Update email in profiles table
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ 
        email: newEmail, 
        email_verified: true,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      // Still return success as auth was updated
    }

    // Log activity
    await supabaseAdmin.from("activity_logs").insert({
      user_id: userId,
      performed_by: userId,
      action_type: "email_changed",
      description: `Email changed from ${oldEmail} to ${newEmail}`,
      metadata: {
        old_email: oldEmail,
        new_email: newEmail,
      },
      module: "profile",
      status: "success",
    });

    // Create notification
    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      type: "email_changed",
      title: "Email updated",
      message: `Your email was changed to ${newEmail}`,
    });

    console.log("Email update completed successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email updated successfully",
        user: updatedUser?.user
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in update-email function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage, success: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
