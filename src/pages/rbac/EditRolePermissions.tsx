import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";

type Permission = {
  id: string;
  module: string;
  action: string;
  description: string | null;
};

export default function EditRolePermissions() {
  const { role } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const roleLabels: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    hr: "HR",
    manager: "Manager",
    employee: "User",
  };

  const canEdit = hasPermission("rbac", "edit");
  const hasFetched = useRef(false);

  useEffect(() => {
    if (permissionsLoading) return;
    
    if (!canEdit) {
      navigate("/rbac");
      return;
    }
    
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchPermissions();
    }
  }, [role, canEdit, permissionsLoading]);

  const fetchPermissions = async () => {
    try {
      setLoading(true);

      // Fetch all permissions
      const { data: allPerms, error: permsError } = await supabase
        .from("permissions")
        .select("*")
        .order("module", { ascending: true })
        .order("action", { ascending: true });

      if (permsError) throw permsError;

      // Fetch current role permissions
      const { data: rolePerms, error: rolePermsError } = await supabase
        .from("role_permissions")
        .select("permission_id")
        .eq("role", role as any);

      if (rolePermsError) throw rolePermsError;

      setPermissions(allPerms || []);
      setSelectedPermissions(new Set(rolePerms?.map((rp) => rp.permission_id) || []));
    } catch (error) {
      console.error("Error fetching permissions:", error);
      toast({
        title: "Error",
        description: "Failed to load permissions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePermission = (permissionId: string) => {
    const newSelected = new Set(selectedPermissions);
    if (newSelected.has(permissionId)) {
      newSelected.delete(permissionId);
    } else {
      newSelected.add(permissionId);
    }
    setSelectedPermissions(newSelected);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();

      // Get current permissions
      const { data: currentPerms } = await supabase
        .from("role_permissions")
        .select("id, permission_id")
        .eq("role", role as any);

      const currentPermIds = new Set(currentPerms?.map((p) => p.permission_id) || []);
      
      // Find permissions to add
      const toAdd = Array.from(selectedPermissions).filter((id) => !currentPermIds.has(id));
      
      // Find permissions to remove
      const toRemove = currentPerms?.filter((p) => !selectedPermissions.has(p.permission_id)) || [];

      // Remove permissions
      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from("role_permissions")
          .delete()
          .in("id", toRemove.map((p) => p.id));

        if (deleteError) throw deleteError;
      }

      // Add permissions
      if (toAdd.length > 0) {
        const { error: insertError } = await supabase
          .from("role_permissions")
          .insert(
            toAdd.map((permissionId) => ({
              role: role as any,
              permission_id: permissionId,
            }))
          );

        if (insertError) throw insertError;
      }

      // Log activity
      await supabase.from("activity_logs").insert({
        performed_by: user?.id,
        action_type: "permission_updated",
        description: `Permissions updated for role "${roleLabels[role || ""] || role}"`,
        metadata: {
          role: role,
          permissions_added: toAdd.length,
          permissions_removed: toRemove.length,
        },
        module: "rbac",
        status: "success",
      });

      toast({
        title: "Success",
        description: "Permissions updated successfully",
      });

      navigate("/rbac");
    } catch (error) {
      console.error("Error saving permissions:", error);
      toast({
        title: "Error",
        description: "Failed to update permissions",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Group permissions by module
  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (loading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading permissions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/rbac")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Edit Permissions: {roleLabels[role || ""] || role}
          </h1>
          <p className="text-muted-foreground">
            Configure permissions for this role
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {Object.entries(groupedPermissions).map(([module, perms]) => (
          <Card key={module}>
            <CardHeader>
              <CardTitle className="text-lg capitalize">{module}</CardTitle>
              <CardDescription>
                Manage {module} module permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {perms.map((perm) => (
                  <div key={perm.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={perm.id}
                      checked={selectedPermissions.has(perm.id)}
                      onCheckedChange={() => handleTogglePermission(perm.id)}
                    />
                    <label
                      htmlFor={perm.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize cursor-pointer"
                    >
                      {perm.action}
                    </label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate("/rbac")}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
