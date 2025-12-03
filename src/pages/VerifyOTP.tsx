import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Mail } from "lucide-react";

const VerifyOTP = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const { email, fullName, password } = location.state || {};

  useEffect(() => {
    if (!email || !fullName || !password) {
      toast({
        title: "Error",
        description: "Missing registration data. Please sign up again.",
        variant: "destructive",
      });
      navigate("/auth");
    }
  }, [email, fullName, password, navigate, toast]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otp.length !== 6) {
      toast({
        title: "Error",
        description: "Please enter a valid 6-digit OTP",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: { email, otp, fullName, password },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error("Wrong OTP, please check and re-enter again");
      }

      if (data.success) {
        await (supabase as any).from("activity_logs").insert({
          action_type: "otp_verification",
          description: `Signup OTP verified for ${email}`,
          module: "auth",
          status: "success",
          metadata: { email },
        });
        await (supabase as any).from("activity_logs").insert({
          action_type: "signup",
          description: `User signed up: ${email}`,
          module: "auth",
          status: "success",
          metadata: { email },
        });
        toast({
          title: "Success",
          description: "Account created successfully! Please sign in.",
        });
        navigate("/auth");
      }
      } catch (error: any) {
        console.error("Error verifying OTP:", error);
        const rawMessage = (() => {
          if (error?.context?.body) {
            try {
              const body = JSON.parse(error.context.body);
              if (body?.error) return String(body.error);
            } catch {}
          }
          if (error?.message) return String(error.message);
          return "";
        })();
        const showFriendly = /otp|code/i.test(rawMessage) || rawMessage.length === 0;
        toast({
          title: "Verification Failed",
          description: showFriendly ? "Wrong OTP, please check and re-enter again" : rawMessage,
          variant: "destructive",
        });
      } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;

    try {
      const { error } = await supabase.functions.invoke("send-otp", {
        body: { email },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "New OTP sent to your email",
      });
      await (supabase as any).from("activity_logs").insert({
        action_type: "otp_resend",
        description: `Signup OTP resent for ${email}`,
        module: "auth",
        status: "success",
        metadata: { email },
      });
      setResendCooldown(30);
    } catch (error: any) {
      console.error("Error resending OTP:", error);
      await (supabase as any).from("activity_logs").insert({
        action_type: "otp_resend",
        description: `Signup OTP resend failed for ${email}`,
        module: "auth",
        status: "failed",
        metadata: { email, error: error.message },
      });
      toast({
        title: "Error",
        description: "Failed to resend OTP",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit mb-4"
            onClick={() => navigate("/auth")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sign Up
          </Button>
          <CardTitle className="text-2xl font-bold">Welcome to Slate AI</CardTitle>
          <CardDescription>
            We've sent a 6-digit code to <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otp} onChange={(val) => setOtp(val)}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying..." : "Verify Code"}
            </Button>
          </form>

          <div className="space-y-2">
            <p className="text-center text-sm text-muted-foreground">
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : ""}
            </p>
            <div className="flex justify-between items-center">
              <Button variant="link" className="text-sm" onClick={() => navigate("/auth")}>
                Wrong email? Go back
              </Button>
              <Button variant="ghost" onClick={handleResendOTP} disabled={resendCooldown > 0}>
                Resend OTP
              </Button>
            </div>
          </div>

          <p className="text-sm text-center text-muted-foreground">
            Code expires in 10 minutes. Maximum 5 attempts allowed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyOTP;
