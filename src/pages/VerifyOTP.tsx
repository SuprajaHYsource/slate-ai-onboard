import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      navigate("/signup");
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

      if (data.success) {
        toast({
          title: "Success",
          description: "Account created successfully! Please sign in.",
        });
        navigate("/signin");
      }
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      toast({
        title: "Error",
        description: error.message || "Invalid OTP. Please try again.",
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
      setResendCooldown(30);
    } catch (error: any) {
      console.error("Error resending OTP:", error);
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
            onClick={() => navigate("/signup")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sign Up
          </Button>
          <CardTitle className="text-2xl font-bold">Verify Your Email</CardTitle>
          <CardDescription>
            We've sent a 6-digit code to <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Enter 6-digit OTP"
                  className="pl-10 text-center text-2xl tracking-widest"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying..." : "Verify OTP"}
            </Button>
          </form>

          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleResendOTP}
              disabled={resendCooldown > 0}
            >
              {resendCooldown > 0
                ? `Resend OTP (${resendCooldown}s)`
                : "Resend OTP"}
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => navigate("/signup")}
            >
              Change Email
            </Button>
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
