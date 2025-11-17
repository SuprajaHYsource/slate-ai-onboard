import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { email, password, full_name } = await req.json();

    // Create user with admin privileges
    const { data: user, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
        },
      });

    if (createError) {
      console.error("Error creating user:", createError);
      throw createError;
    }

    console.log("User created successfully:", user.user.id);

    return new Response(JSON.stringify({ user: user.user }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in create-user function:", error);
    
    // Handle specific error cases
    let statusCode = 400;
    let errorMessage = error.message || "Failed to create user";
    
    // Check if it's a duplicate email error
    if (error.code === "email_exists" || error.message?.includes("already been registered")) {
      statusCode = 409; // Conflict status code
      errorMessage = "A user with this email address already exists";
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage, code: error.code }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: statusCode,
      }
    );
  }
});
