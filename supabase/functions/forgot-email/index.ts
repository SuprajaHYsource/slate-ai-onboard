import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ForgotEmailSchema = z.object({
  searchBy: z.enum(['phone', 'name']),
  value: z.string().min(1, "Search value is required").max(255),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate input
    const body = await req.json();
    const parsed = ForgotEmailSchema.safeParse(body);
    
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input', 
          details: parsed.error.issues.map(i => i.message).join(', ')
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { searchBy, value } = parsed.data;

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let query = supabaseClient.from("profiles").select("email");

    if (searchBy === "phone") {
      query = query.eq("contact_number", value);
    } else if (searchBy === "name") {
      query = query.ilike("full_name", `%${value}%`);
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid search type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await query.limit(1).maybeSingle();

    if (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to search for account" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (data && data.email) {
      // Log forgot email activity
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("user_id")
        .eq("email", data.email)
        .maybeSingle();

      if (profile?.user_id) {
        await supabaseClient.from("activity_logs").insert({
          user_id: profile.user_id,
          performed_by: profile.user_id,
          action_type: "forgot_email",
          description: `Email recovered using ${searchBy}: ${value}`,
          metadata: { searchBy, value, email: data.email },
          module: "auth",
          status: "success",
        });
      }

      return new Response(
        JSON.stringify({ email: data.email }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "No account found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
