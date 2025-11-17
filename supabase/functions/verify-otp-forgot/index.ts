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
    const { email, otp } = await req.json();

    if (!email || !otp) {
      throw new Error("Email and OTP are required");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch latest OTP record for the email
    const { data: otpRecord, error: fetchError } = await supabaseAdmin
      .from("otp_verifications")
      .select("*")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError || !otpRecord) {
      console.error("No OTP record found for:", email, fetchError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired OTP" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const now = new Date();
    const expiresAt = new Date(otpRecord.expires_at);

    if (expiresAt < now) {
      console.error("OTP expired for:", email);
      return new Response(
        JSON.stringify({ error: "OTP has expired. Please request a new one." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Too many attempts
    if ((otpRecord.attempts ?? 0) >= 5) {
      return new Response(
        JSON.stringify({ error: "Too many failed attempts. Request a new OTP." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Compare codes
    if (otpRecord.otp_code !== String(otp)) {
      await supabaseAdmin
        .from("otp_verifications")
        .update({ attempts: (otpRecord.attempts ?? 0) + 1 })
        .eq("id", otpRecord.id);

      const remaining = Math.max(0, 5 - ((otpRecord.attempts ?? 0) + 1));
      return new Response(
        JSON.stringify({ error: `Incorrect OTP. ${remaining} attempts remaining.` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Mark as verified if not already
    if (!otpRecord.verified) {
      await supabaseAdmin
        .from("otp_verifications")
        .update({ verified: true })
        .eq("id", otpRecord.id);
    }

    console.log(`OTP verified for ${email}`);

    return new Response(
      JSON.stringify({ success: true, message: "OTP verified" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error in verify-otp-forgot function:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
