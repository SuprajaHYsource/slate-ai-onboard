import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, ArrowLeft, Eye, EyeOff } from "lucide-react";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "otp" | "password">("email");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { email, flow: "forgot_password" },
      });

      if (error) throw error;

      setStep("otp");
      setResendCooldown(120);
      await (supabase as any).from("activity_logs").insert({
        action_type: "forgot_password",
        description: `OTP sent for password reset to ${email}`,
        module: "auth",
        status: "success",
        metadata: { email },
      });
      toast({
        title: "Success",
        description: "OTP sent to your email!",
      });
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      await (supabase as any).from("activity_logs").insert({
        action_type: "forgot_password",
        description: `Failed to send OTP for ${email}`,
        module: "auth",
        status: "failed",
        metadata: { email, error: error.message },
      });
      toast({
        title: "Unable to send OTP",
        description: "Please check your email address and try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otp.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter a valid 6-digit OTP",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Verify OTP via edge function (avoids RLS issues)
      const { data, error } = await supabase.functions.invoke("verify-otp-forgot", {
        body: { email, otp },
      });

      if (error || !data?.success) {
        throw new Error((data as any)?.error || (error as any)?.message || "Invalid or expired OTP");
      }

      

      setStep("password");
      await (supabase as any).from("activity_logs").insert({
        action_type: "otp_verification",
        description: `OTP verified for ${email}`,
        module: "auth",
        status: "success",
        metadata: { email },
      });
      toast({
        title: "Success",
        description: "OTP verified! Now set your new password.",
      });
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      await (supabase as any).from("activity_logs").insert({
        action_type: "otp_verification",
        description: `OTP verification failed for ${email}`,
        module: "auth",
        status: "failed",
        metadata: { email, error: error.message },
      });
      toast({
        title: "Verification Failed",
        description: "Wrong OTP, please check and re-enter again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Please use at least 8 characters for your password",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("reset-password-otp", {
        body: { email, otp, password },
      });

      if (error) throw error;

      await (supabase as any).from("activity_logs").insert({
        action_type: "password_reset",
        description: `Password reset via OTP for ${email}`,
        module: "auth",
        status: "success",
        metadata: { email },
      });
      toast({
        title: "Success",
        description: "Password updated successfully!",
      });

      navigate("/auth");
    } catch (error: any) {
      console.error("Error updating password:", error);
      await (supabase as any).from("activity_logs").insert({
        action_type: "password_reset",
        description: `Password reset failed for ${email}`,
        module: "auth",
        status: "failed",
        metadata: { email, error: error.message },
      });
      toast({
        title: "Unable to update password",
        description: "Something went wrong. Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("send-otp", {
        body: { email, flow: "forgot_password" },
      });

      if (error) throw error;

      setResendCooldown(120);
      await (supabase as any).from("activity_logs").insert({
        action_type: "otp_resend",
        description: `OTP resent for ${email}`,
        module: "auth",
        status: "success",
        metadata: { email },
      });
      toast({
        title: "Success",
        description: "OTP resent successfully!",
      });
    } catch (error: any) {
      await (supabase as any).from("activity_logs").insert({
        action_type: "otp_resend",
        description: `OTP resend failed for ${email}`,
        module: "auth",
        status: "failed",
        metadata: { email, error: error.message },
      });
      toast({
        title: "Unable to resend OTP",
        description: "Please wait a moment and try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

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
            Back to Sign In
          </Button>
          <CardTitle className="text-2xl font-bold">
            {step === "email" && "Forgot Password?"}
            {step === "otp" && "Verify OTP"}
            {step === "password" && "Set New Password"}
          </CardTitle>
          <CardDescription>
            {step === "email" && "Enter your email address to receive an OTP"}
            {step === "otp" && "Enter the 6-digit OTP sent to your email"}
            {step === "password" && "Create your new password"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" && (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@company.com"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send OTP"}
              </Button>

              <div className="text-center text-sm">
                <Button
                  variant="link"
                  className="text-primary"
                  onClick={() => navigate("/forgot-email")}
                >
                  Forgot your email address?
                </Button>
              </div>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="text-center p-4 bg-muted rounded-lg mb-4">
                <p className="text-sm text-muted-foreground">
                  OTP sent to <strong>{email}</strong>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="otp">Enter OTP</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="text-center text-2xl tracking-widest"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Verifying..." : "Verify OTP"}
              </Button>

              <div className="flex justify-between items-center text-sm">
                <Button
                  type="button"
                  variant="link"
                  className="text-primary p-0"
                  onClick={() => setStep("email")}
                >
                  Change Email
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="text-primary p-0"
                  onClick={handleResendOTP}
                  disabled={resendCooldown > 0 || loading}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                </Button>
              </div>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPassword;
