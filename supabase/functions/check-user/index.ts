import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CheckUserSchema = z.object({
  email: z.string().email("Invalid email format").max(255),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate input
    const body = await req.json();
    const parsed = CheckUserSchema.safeParse(body);
    
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input', 
          details: parsed.error.issues.map(i => i.message).join(', ')
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { email } = parsed.data;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // First check if user exists in profiles table (handles email change case)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email, full_name, signup_method, is_active")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (profile) {
      // User found in profiles - they exist
      return new Response(
        JSON.stringify({ 
          exists: true,
          userId: profile.user_id,
          fullName: profile.full_name || "",
          signupMethod: profile.signup_method || "manual",
          isActive: profile.is_active ?? true
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // If not found in profiles, check auth.users as fallback
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
      throw new Error("Failed to check user");
    }

    const userExists = users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (userExists) {
      // User exists in auth but not in profiles - fetch or create profile info
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, signup_method, is_active")
        .eq("user_id", userExists.id)
        .maybeSingle();

      return new Response(
        JSON.stringify({ 
          exists: true,
          userId: userExists.id,
          fullName: existingProfile?.full_name || "",
          signupMethod: existingProfile?.signup_method || "manual",
          isActive: existingProfile?.is_active ?? true
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } else {
      // User does not exist anywhere
      return new Response(
        JSON.stringify({ 
          exists: false 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }
  } catch (error) {
    console.error("Error in check-user function:", error);
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
