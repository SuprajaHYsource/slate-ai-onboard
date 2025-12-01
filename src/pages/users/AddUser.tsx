import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { useAllRoles } from "@/hooks/useAllRoles";

export default function AddUser() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { systemRoles } = useAllRoles();
  const [loading, setLoading] = useState(false);
  const [autoGeneratePassword, setAutoGeneratePassword] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "employee",
    is_active: true,
  });

  const generatePassword = () => {
    const length = 12;
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  const handleAutoGenerate = (checked: boolean) => {
    setAutoGeneratePassword(checked);
    if (checked) {
      const newPassword = generatePassword();
      setFormData({ ...formData, password: newPassword });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      // Create user via Supabase Auth Admin API (requires service role)
      // Since we can't use service role from client, we'll create via edge function
      const { data: authData, error: authError } = await supabase.functions.invoke(
        "create-user",
        {
          body: {
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name,
          },
        }
      );

      if (authError) {
        throw authError;
      }

      // Check if the response contains an error
      if (authData?.error) {
        throw new Error(authData.error);
      }

      const newUserId = authData.user.id;

      // Create profile
      const { error: profileError } = await supabase.from("profiles").insert({
        user_id: newUserId,
        full_name: formData.full_name,
        email: formData.email,
        signup_method: "admin_created",
        is_active: formData.is_active,
        password_set: true,
      });

      if (profileError) throw profileError;

      // Assign role
      const { error: roleError } = await supabase.from("user_roles").insert([{
        user_id: newUserId,
        role: formData.role as any,
        assigned_by: currentUser?.id,
      }]);

      if (roleError) throw roleError;

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: newUserId,
        performed_by: currentUser?.id,
        action_type: "user_created",
        description: `User ${formData.full_name} created by admin`,
        metadata: { role: formData.role },
      });

      toast({
        title: "Success",
        description: "User created successfully",
      });

      navigate("/users");
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/users")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Add New User</h1>
          <p className="text-muted-foreground">Create a new user account</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) =>
                  setFormData({ ...formData, full_name: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="auto-generate"
                    checked={autoGeneratePassword}
                    onCheckedChange={handleAutoGenerate}
                  />
                  <Label htmlFor="auto-generate" className="text-sm cursor-pointer">
                    Auto-generate
                  </Label>
                </div>
              </div>
              <Input
                id="password"
                type="text"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
                readOnly={autoGeneratePassword}
              />
              {autoGeneratePassword && (
                <p className="text-xs text-muted-foreground">
                  Copy this password and send it to the user securely
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData({ ...formData, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {systemRoles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
              <Label htmlFor="is_active">Active</Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create User
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/users")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
