import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Permission = {
  id: string;
  module: string;
  action: string;
  description: string | null;
};

type AppRole = "admin" | "hr" | "manager" | "employee";

const editableRoles: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "hr", label: "HR" },
  { value: "manager", label: "Manager" },
  { value: "employee", label: "Employee" },
];

export default function PermissionMatrix() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<AppRole, Set<string>>>({
    admin: new Set(),
    hr: new Set(),
    manager: new Set(),
    employee: new Set(),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hasPermission("rbac", "edit")) {
      navigate("/rbac");
      return;
    }
    fetchData();
  }, [hasPermission]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch all permissions
      const { data: allPerms, error: permsError } = await supabase
        .from("permissions")
        .select("*")
        .order("module", { ascending: true })
        .order("action", { ascending: true });

      if (permsError) throw permsError;

      // Fetch all role permissions
      const { data: allRolePerms, error: rolePermsError } = await supabase
        .from("role_permissions")
        .select("role, permission_id")
        .in("role", editableRoles.map(r => r.value));

      if (rolePermsError) throw rolePermsError;

      setPermissions(allPerms || []);

      // Group permissions by role
      const grouped: Record<AppRole, Set<string>> = {
        admin: new Set(),
        hr: new Set(),
        manager: new Set(),
        employee: new Set(),
      };

      allRolePerms?.forEach((rp) => {
        if (rp.role && grouped[rp.role as AppRole]) {
          grouped[rp.role as AppRole].add(rp.permission_id);
        }
      });

      setRolePermissions(grouped);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load permissions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePermission = (role: AppRole, permissionId: string) => {
    setRolePermissions((prev) => {
      const newSet = new Set(prev[role]);
      if (newSet.has(permissionId)) {
        newSet.delete(permissionId);
      } else {
        newSet.add(permissionId);
      }
      return { ...prev, [role]: newSet };
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      for (const role of editableRoles) {
        // Get current permissions for this role
        const { data: currentPerms } = await supabase
          .from("role_permissions")
          .select("id, permission_id")
          .eq("role", role.value);

        const currentPermIds = new Set(currentPerms?.map((p) => p.permission_id) || []);
        const selectedPermissions = rolePermissions[role.value];

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
                role: role.value,
                permission_id: permissionId,
              }))
            );

          if (insertError) throw insertError;
        }
      }

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

  if (loading) {
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
          <h1 className="text-3xl font-bold text-foreground">Permission Matrix</h1>
          <p className="text-muted-foreground">
            Configure permissions for all roles (Super Admin has all permissions by default)
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Permissions by Module</CardTitle>
          <CardDescription>
            Check the boxes to grant permissions to each role
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Module</TableHead>
                <TableHead className="w-[150px]">Action</TableHead>
                {editableRoles.map((role) => (
                  <TableHead key={role.value} className="text-center w-[100px]">
                    {role.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(groupedPermissions).map(([module, perms]) =>
                perms.map((perm, index) => (
                  <TableRow key={perm.id}>
                    {index === 0 && (
                      <TableCell
                        rowSpan={perms.length}
                        className="font-medium capitalize align-top bg-muted/50"
                      >
                        {module}
                      </TableCell>
                    )}
                    <TableCell className="capitalize">{perm.action}</TableCell>
                    {editableRoles.map((role) => (
                      <TableCell key={role.value} className="text-center">
                        <Checkbox
                          checked={rolePermissions[role.value].has(perm.id)}
                          onCheckedChange={() => handleTogglePermission(role.value, perm.id)}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
