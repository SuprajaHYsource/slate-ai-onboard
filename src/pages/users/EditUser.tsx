import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { Badge } from "@/components/ui/badge";

export default function EditUser() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { allRoles, loading: rolesLoading } = useAllRoles();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [currentRole, setCurrentRole] = useState("");
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    role: "",
    is_active: true,
  });

  useEffect(() => {
    if (userId && !rolesLoading) {
      fetchUser();
    }
  }, [userId, rolesLoading]);

  const fetchUser = async () => {
    try {
      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (profileError) throw profileError;

      // Fetch role (system or custom)
      const { data: userRole, error: roleError } = await supabase
        .from("user_roles")
        .select("role, custom_role_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (roleError) throw roleError;

      let roleValue = "employee"; // default
      if (userRole) {
        if (userRole.role) {
          roleValue = userRole.role;
        } else if (userRole.custom_role_id) {
          roleValue = `custom_${userRole.custom_role_id}`;
        }
      }
      
      setCurrentRole(roleValue);

      setFormData({
        full_name: profile.full_name,
        email: profile.email,
        role: roleValue,
        is_active: profile.is_active,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          email: formData.email,
          is_active: formData.is_active,
        })
        .eq("user_id", userId);

      if (profileError) throw profileError;

      // Update role if changed
      if (formData.role !== currentRole) {
        // Delete old role
        await supabase.from("user_roles").delete().eq("user_id", userId);

        // Determine if it's a system role or custom role
        const isCustomRole = formData.role.startsWith("custom_");
        
        if (isCustomRole) {
          const customRoleId = formData.role.replace("custom_", "");
          const { error: roleError } = await supabase.from("user_roles").insert([{
            user_id: userId,
            custom_role_id: customRoleId,
            assigned_by: currentUser?.id,
          }]);
          if (roleError) throw roleError;
        } else {
          const { error: roleError } = await supabase.from("user_roles").insert([{
            user_id: userId,
            role: formData.role as any,
            assigned_by: currentUser?.id,
          }]);
          if (roleError) throw roleError;
        }

        // Get role labels for logging
        const oldRoleLabel = allRoles.find(r => r.value === currentRole)?.label || currentRole;
        const newRoleLabel = allRoles.find(r => r.value === formData.role)?.label || formData.role;

        // Determine if promotion or demotion (for system roles)
        const systemRoleHierarchy = ["employee", "manager", "hr", "admin", "super_admin"];
        const oldIndex = systemRoleHierarchy.indexOf(currentRole);
        const newIndex = systemRoleHierarchy.indexOf(formData.role);
        
        let actionType = "changed";
        if (oldIndex !== -1 && newIndex !== -1) {
          actionType = newIndex > oldIndex ? "promotion" : "demotion";
        }

        // Log role change
        await supabase.from("activity_logs").insert({
          user_id: userId,
          performed_by: currentUser?.id,
          action_type: "role_changed",
          description: `User role ${actionType}: ${oldRoleLabel} → ${newRoleLabel}`,
          metadata: {
            old_role: currentRole,
            new_role: formData.role,
            old_role_label: oldRoleLabel,
            new_role_label: newRoleLabel,
            action: actionType,
          },
        });
        await (supabase as any).from("notifications").insert({
          user_id: userId as string,
          type: "role_changed",
          title: "Role updated",
          message: `Your role changed from ${oldRoleLabel} to ${newRoleLabel}`,
        });
      }

      // Log update activity
      await supabase.from("activity_logs").insert({
        user_id: userId,
        performed_by: currentUser?.id,
        action_type: "user_updated",
        description: `User ${formData.full_name} updated`,
      });
      await (supabase as any).from("notifications").insert({
        user_id: userId as string,
        type: "user_updated",
        title: "Account updated",
        message: `Your account details were updated by an administrator`,
      });

      toast({
        title: "Success",
        description: "User updated successfully",
      });

      navigate("/users");
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading || rolesLoading) {
    return <div className="animate-pulse">Loading user...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/users")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Edit User</h1>
          <p className="text-muted-foreground">Update user information</p>
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
                  {allRoles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex items-center gap-2">
                        {role.label}
                        {role.type === "custom" && (
                          <Badge variant="outline" className="text-xs">Custom</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.role !== currentRole && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Role will be changed from "{allRoles.find(r => r.value === currentRole)?.label}" to "{allRoles.find(r => r.value === formData.role)?.label}"
                </p>
              )}
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
                Update User
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
