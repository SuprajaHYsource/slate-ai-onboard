import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Lock, ArrowLeft, Eye, EyeOff, User, Calendar, ImageIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo } from "@/components/Logo";

type AuthStep = "email" | "password" | "otp" | "profile";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<AuthStep>("email");
  const [userExists, setUserExists] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string>("");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    otp: "",
    fullName: "",
    dateOfBirth: "",
    gender: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getMaxDate = () => {
    const today = new Date();
    const maxDate = new Date(today.getFullYear() - 21, today.getMonth(), today.getDate());
    return maxDate.toISOString().split("T")[0];
  };

  const calculateProfileCompletion = () => {
    let completion = 40; // Email is already filled
    if (formData.fullName) completion += 20;
    if (formData.dateOfBirth) completion += 20;
    if (formData.gender) completion += 10;
    if (profileImage) completion += 10;
    return completion;
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-user", {
        body: { email: formData.email },
      });

      if (error) throw error;

      if (data.exists) {
        // Existing user - show password field
        setUserExists(true);
        setStep("password");
      } else {
        // New user - send OTP
        const { error: otpError } = await supabase.functions.invoke("send-otp", {
          body: { email: formData.email, flow: "signup" },
        });

        if (otpError) throw otpError;

        toast({
          title: "OTP Sent",
          description: "Please check your email for the verification code.",
        });
        setUserExists(false);
        setStep("otp");
        setResendCooldown(60);
      }
    } catch (error: any) {
      console.error("Error checking user:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to process. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) throw error;

      // Update last sign in and log activity
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        await (supabase as any).from("profiles").update({
          last_sign_in: new Date().toISOString(),
        }).eq("user_id", user.id);

        await (supabase as any).from("activity_logs").insert({
          user_id: user.id,
          performed_by: user.id,
          action_type: "login",
          description: "User logged in",
          module: "auth",
          status: "success",
        });
      }

      toast({
        title: "Success",
        description: "Signed in successfully!",
      });
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Error signing in:", error);
      
      await (supabase as any).from("activity_logs").insert({
        action_type: "failed_login",
        description: `Failed login attempt for ${formData.email}`,
        metadata: { email: formData.email, error: error.message },
        module: "auth",
        status: "failed",
      });

      toast({
        title: "Error",
        description: error.message || "Incorrect password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.otp.length !== 6) {
      toast({
        title: "Error",
        description: "Please enter a valid 6-digit OTP",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Create user account with OTP verification in a single call
      const tempPassword = `Temp${Math.random().toString(36).slice(-8)}@${Date.now()}`;
      
      const { data: createData, error: createError } = await supabase.functions.invoke("verify-otp", {
        body: { 
          email: formData.email,
          otp: formData.otp,
          fullName: formData.email.split('@')[0], // Use email prefix as temporary name
          password: tempPassword,
        },
      });

      if (createError) throw createError;
      if (!createData.success) throw new Error("Failed to create account");

      // Sign in the user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: tempPassword,
      });

      if (signInError) throw signInError;

      toast({
        title: "Welcome!",
        description: "You can complete your profile in the Profile section.",
      });

      navigate("/dashboard");
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

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.fullName.trim()) {
      toast({
        title: "Error",
        description: "Full name is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Create a temporary password for the user
      const tempPassword = `Temp${Math.random().toString(36).slice(-8)}@123`;
      
      // Call verify-otp with fullName and password to create the user
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke("verify-otp", {
        body: { 
          email: formData.email,
          otp: formData.otp,
          fullName: formData.fullName,
          password: tempPassword,
        },
      });

      if (verifyError) throw verifyError;
      if (!verifyData.success) throw new Error("Failed to create account");

      const userId = verifyData.userId;

      // Upload profile picture if provided
      let profilePictureUrl = null;
      if (profileImage) {
        const fileExt = profileImage.name.split('.').pop();
        const fileName = `${userId}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('profile-pictures')
          .upload(fileName, profileImage, { upsert: true });

        if (uploadError) {
          console.error("Error uploading profile picture:", uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('profile-pictures')
            .getPublicUrl(fileName);
          profilePictureUrl = publicUrl;
        }
      }

      // Update profile with additional info
      const { error: profileError } = await (supabase as any)
        .from("profiles")
        .update({
          date_of_birth: formData.dateOfBirth || null,
          gender: formData.gender || null,
          profile_picture_url: profilePictureUrl,
        })
        .eq("user_id", userId);

      if (profileError) {
        console.error("Error updating profile:", profileError);
      }

      // Sign in the user with the temporary password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: tempPassword,
      });

      if (signInError) {
        console.error("Error signing in:", signInError);
        // Even if sign-in fails, account is created, redirect to signin
        toast({
          title: "Account Created",
          description: "Please sign in with your new account.",
        });
        navigate("/auth");
        return;
      }

      toast({
        title: "Account Created!",
        description: "Welcome to SLATE AI!",
      });

      navigate("/dashboard");
    } catch (error: any) {
      console.error("Error creating account:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create account. Please try again.",
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
        body: { email: formData.email, flow: "signup" },
      });

      if (error) throw error;

      toast({
        title: "OTP Sent",
        description: "A new OTP has been sent to your email.",
      });
      setResendCooldown(60);
    } catch (error: any) {
      console.error("Error resending OTP:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to resend OTP. Please try again.",
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

  const handleBack = () => {
    if (step === "password" || step === "otp") {
      setStep("email");
      setFormData({ ...formData, password: "", otp: "" });
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <Logo className="h-12" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-fit mb-4"
            onClick={handleBack}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <CardTitle className="text-2xl font-bold">
            {step === "email" && "Welcome to SLATE AI"}
            {step === "password" && "Welcome Back"}
            {step === "otp" && "Verify Your Email"}
            {step === "profile" && "Complete Your Profile"}
          </CardTitle>
          <CardDescription>
            {step === "email" && "Enter your email to continue"}
            {step === "password" && "Enter your password to sign in"}
            {step === "otp" && "Enter the 6-digit code sent to your email"}
            {step === "profile" && "Tell us a bit about yourself"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email Step */}
          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="pl-10"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Processing..." : "Continue"}
              </Button>
            </form>
          )}

          {/* Password Step */}
          {step === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {/* Non-editable email display */}
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 pl-10 text-sm text-muted-foreground">
                    {formData.email}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="pl-10 pr-10"
                    required
                    disabled={loading}
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => navigate("/forgot-password")}
                  className="text-sm"
                >
                  Forgot password?
                </Button>
              </div>
            </form>
          )}

          {/* OTP Step */}
          {step === "otp" && (
            <form onSubmit={handleOTPSubmit} className="space-y-4">
              {/* Non-editable email display */}
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 pl-10 text-sm text-muted-foreground">
                    {formData.email}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="otp">6-Digit OTP</Label>
                <Input
                  id="otp"
                  name="otp"
                  type="text"
                  placeholder="000000"
                  value={formData.otp}
                  onChange={handleInputChange}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                  required
                  disabled={loading}
                />
                <p className="text-sm text-muted-foreground text-center">
                  OTP sent to the above email
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Verifying..." : "Verify OTP"}
              </Button>
              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  onClick={handleResendOTP}
                  disabled={resendCooldown > 0 || loading}
                  className="text-sm"
                >
                  {resendCooldown > 0
                    ? `Resend OTP in ${resendCooldown}s`
                    : "Resend OTP"}
                </Button>
              </div>
            </form>
          )}

          {/* Profile Setup Step */}
          {step === "profile" && (
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Profile Completion</Label>
                <Progress value={calculateProfileCompletion()} className="h-2" />
                <p className="text-sm text-muted-foreground text-center">
                  {calculateProfileCompletion()}% Complete
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className="pl-10"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth (Optional)</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="dateOfBirth"
                    name="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    max={getMaxDate()}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">Gender (Optional)</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => setFormData({ ...formData, gender: value })}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profileImage">Profile Picture (Optional)</Label>
                <div className="flex items-center gap-4">
                  {profileImagePreview && (
                    <img
                      src={profileImagePreview}
                      alt="Profile preview"
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <Input
                      id="profileImage"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating Account..." : "Complete Setup"}
              </Button>

              <p className="text-sm text-muted-foreground text-center">
                You can skip optional fields and complete them later in your profile
              </p>
            </form>
          )}

          {/* SSO Options (only on email step) */}
          {step === "email" && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant="outline"
                  type="button"
                  disabled={loading}
                  onClick={async () => {
                    try {
                      const { error } = await supabase.auth.signInWithOAuth({
                        provider: "google",
                        options: {
                          redirectTo: `${window.location.origin}/dashboard`,
                        },
                      });
                      if (error) throw error;
                    } catch (error: any) {
                      toast({
                        title: "Error",
                        description: "Failed to sign in with Google",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  disabled={loading}
                  onClick={async () => {
                    try {
                      const { error } = await supabase.auth.signInWithOAuth({
                        provider: "azure",
                        options: {
                          redirectTo: `${window.location.origin}/dashboard`,
                        },
                      });
                      if (error) throw error;
                    } catch (error: any) {
                      toast({
                        title: "Error",
                        description: "Failed to sign in with Microsoft",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#f25022" d="M1 1h10v10H1z" />
                    <path fill="#00a4ef" d="M13 1h10v10H13z" />
                    <path fill="#7fba00" d="M1 13h10v10H1z" />
                    <path fill="#ffb900" d="M13 13h10v10H13z" />
                  </svg>
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  disabled={loading}
                  onClick={async () => {
                    try {
                      const { error } = await supabase.auth.signInWithOAuth({
                        provider: "github",
                        options: {
                          redirectTo: `${window.location.origin}/dashboard`,
                        },
                      });
                      if (error) throw error;
                    } catch (error: any) {
                      toast({
                        title: "Error",
                        description: "Failed to sign in with GitHub",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
