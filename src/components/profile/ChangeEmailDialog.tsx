import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail } from "lucide-react";

interface ChangeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEmail: string;
  onSuccess: () => void;
}

export default function ChangeEmailDialog({
  open,
  onOpenChange,
  currentEmail,
  onSuccess,
}: ChangeEmailDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"input" | "verify-old" | "verify-new">("input");
  const [newEmail, setNewEmail] = useState("");
  const [oldOtp, setOldOtp] = useState("");
  const [newOtp, setNewOtp] = useState("");

  const handleSendOldEmailOtp = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("send-otp", {
        body: { email: currentEmail },
      });

      if (error) throw error;

      toast({
        title: "OTP Sent",
        description: "Verification code sent to your current email",
      });

      setStep("verify-old");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOldEmail = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: { email: currentEmail, otp: oldOtp },
      });

      if (error) {
        const errorBody = error?.context?.body ? JSON.parse(error.context.body) : null;
        throw new Error(errorBody?.error || error.message || "Invalid OTP. Please check and try again.");
      }

      // Send OTP to new email
      const { error: sendError } = await supabase.functions.invoke("send-otp", {
        body: { email: newEmail },
      });

      if (sendError) throw sendError;

      toast({
        title: "Verified",
        description: "Verification code sent to your new email. Check your inbox!",
      });

      setNewOtp(""); // Clear the new OTP field
      setStep("verify-new");
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid OTP. Please check your email and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyNewEmail = async () => {
    setLoading(true);
    try {
      const { data, error: verifyError } = await supabase.functions.invoke("verify-otp", {
        body: { email: newEmail, otp: newOtp },
      });

      if (verifyError) {
        const errorBody = verifyError?.context?.body ? JSON.parse(verifyError.context.body) : null;
        throw new Error(errorBody?.error || verifyError.message || "Invalid OTP. Please check and try again.");
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      // Update email
      const { error: updateError } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (updateError) throw updateError;

      // Update profile
      await supabase
        .from("profiles")
        .update({ email: newEmail, email_verified: true })
        .eq("user_id", user.id);

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        performed_by: user.id,
        action_type: "email_change",
        description: `Email changed from ${currentEmail} to ${newEmail}`,
        metadata: {
          old_email: currentEmail,
          new_email: newEmail,
        },
        module: "profile",
        status: "success",
      } as any);

      toast({
        title: "Success",
        description: "Email changed successfully",
      });

      onSuccess();
      onOpenChange(false);
      setStep("input");
      setNewEmail("");
      setOldOtp("");
      setNewOtp("");
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid OTP. Please check your email and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Email Address</DialogTitle>
          <DialogDescription>
            Verify both your current and new email addresses
          </DialogDescription>
        </DialogHeader>

        {step === "input" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Current Email</Label>
              <Input value={currentEmail} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newEmail">New Email</Label>
              <Input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter new email address"
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendOldEmailOtp}
                disabled={loading || !newEmail}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Continue
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "verify-old" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Verification code sent to:</p>
                <p className="text-sm text-muted-foreground">{currentEmail}</p>
                <p className="text-xs text-muted-foreground mt-1">Check your inbox and enter the 6-digit code</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="oldOtp">Enter verification code</Label>
              <Input
                id="oldOtp"
                value={oldOtp}
                onChange={(e) => setOldOtp(e.target.value)}
                placeholder="000000"
                maxLength={6}
                required
              />
            </div>

            <Button
              type="button"
              variant="link"
              size="sm"
              className="w-full"
              onClick={async () => {
                setOldOtp("");
                await handleSendOldEmailOtp();
              }}
              disabled={loading}
            >
              Didn't receive code? Resend OTP
            </Button>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("input")}
              >
                Back
              </Button>
              <Button
                onClick={handleVerifyOldEmail}
                disabled={loading || oldOtp.length !== 6}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Verify
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "verify-new" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Verification code sent to:</p>
                <p className="text-sm text-muted-foreground">{newEmail}</p>
                <p className="text-xs text-muted-foreground mt-1">Check your inbox and enter the 6-digit code</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newOtp">Enter verification code</Label>
              <Input
                id="newOtp"
                value={newOtp}
                onChange={(e) => setNewOtp(e.target.value)}
                placeholder="000000"
                maxLength={6}
                required
              />
            </div>

            <Button
              type="button"
              variant="link"
              size="sm"
              className="w-full"
              onClick={async () => {
                setLoading(true);
                setNewOtp("");
                try {
                  const { error } = await supabase.functions.invoke("send-otp", {
                    body: { email: newEmail },
                  });

                  if (error) throw error;

                  toast({
                    title: "OTP Sent",
                    description: "New verification code sent to your email",
                  });
                } catch (error: any) {
                  toast({
                    title: "Error",
                    description: error.message,
                    variant: "destructive",
                  });
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
              Didn't receive code? Resend OTP
            </Button>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("verify-old")}
              >
                Back
              </Button>
              <Button
                onClick={handleVerifyNewEmail}
                disabled={loading || newOtp.length !== 6}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Complete Change
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
