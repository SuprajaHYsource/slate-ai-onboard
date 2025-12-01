import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SendOTPSchema = z.object({
  email: z.string().email("Invalid email format").max(255),
  flow: z.enum(['signup', 'forgot_password', 'email_change']).optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate input
    const body = await req.json();
    const parsed = SendOTPSchema.safeParse(body);
    
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input', 
          details: parsed.error.issues.map(i => i.message).join(', ')
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { email, flow } = parsed.data;

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP in database
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Delete any existing unverified OTPs for this email
    await supabaseAdmin
      .from("otp_verifications")
      .delete()
      .eq("email", email)
      .eq("verified", false);

    // Set expiration based on flow type
    // Forgot password: 2 minutes (as per requirement)
    // Email change & Signup: 10 minutes (more time needed)
    const expirationMinutes = flow === "forgot_password" ? 2 : 10;
    const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);
    const { error: insertError } = await supabaseAdmin
      .from("otp_verifications")
      .insert({
        email,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
        attempts: 0,
      });

    if (insertError) {
      console.error("Error storing OTP:", insertError);
      throw new Error("Failed to store OTP");
    }

    // Send email via Hostinger SMTP
    const client = new SMTPClient({
      connection: {
        hostname: Deno.env.get("SMTP_HOST") || "",
        port: parseInt(Deno.env.get("SMTP_PORT") || "465"),
        tls: true,
        auth: {
          username: Deno.env.get("SMTP_USER") || "",
          password: Deno.env.get("SMTP_PASSWORD") || "",
        },
      },
    });

    await client.send({
      from: `"SLATE AI" <${Deno.env.get("SMTP_USER")}>`,
      to: email,
      subject: "Your SLATE AI Verification Code",
      content: "auto",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">SLATE AI Verification</h2>
          <p>Hello,</p>
          <p>Your SLATE AI verification code is:</p>
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h1 style="color: #1e40af; font-size: 36px; letter-spacing: 8px; margin: 0;">${otpCode}</h1>
          </div>
          <p>This code is valid for <strong>${expirationMinutes} minutes</strong>.</p>
          <p>If you did not request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #6b7280; font-size: 14px;">
            Regards,<br>
            <strong>Hinfinity Team</strong>
          </p>
        </div>
      `,
    });

    await client.close();

    console.log(`OTP sent successfully to ${email}`);

    // Log OTP send/resend activity
    // Try to find user by email to log activity
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();

    const actionType = flow === "forgot_password" ? "forgot_password" : "otp_resend";
    const description = flow === "forgot_password" 
      ? `Password reset OTP sent to: ${email}`
      : `OTP sent to: ${email} for ${flow || "signup"}`;

    await supabaseAdmin.from("activity_logs").insert({
      user_id: profile?.user_id || null,
      performed_by: profile?.user_id || null,
      action_type: actionType,
      description: description,
      metadata: { email, flow: flow || "signup" },
      module: "auth",
      status: "success",
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "OTP sent successfully",
        expiresAt: expiresAt.toISOString()
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in send-otp function:", error);
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
