import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CreateUserSchema = z.object({
  email: z.string().email("Invalid email format").max(255),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password too long"),
  full_name: z.string()
    .min(1, "Name is required")
    .max(100, "Name too long")
    .regex(/^[a-zA-Z\s'-]+$/, "Name can only contain letters, spaces, hyphens, and apostrophes"),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Extract JWT and verify user is admin
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user: authUser }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    
    if (userError || !authUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: isAdmin, error: adminCheckError } = await supabaseAdmin.rpc('is_admin', { 
      _user_id: authUser.id 
    });
    
    if (adminCheckError || !isAdmin) {
      console.error("Admin check failed:", adminCheckError);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate input
    const body = await req.json();
    const parsed = CreateUserSchema.safeParse(body);
    
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input', 
          details: parsed.error.issues.map(i => i.message).join(', ')
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, password, full_name } = parsed.data;

    // Create user with admin privileges
    const { data: newUser, error: createError } =
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

    console.log("User created successfully:", newUser.user.id);

    return new Response(JSON.stringify({ user: newUser.user }), {
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
