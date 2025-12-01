import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useAllRoles } from "@/hooks/useAllRoles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Permission = {
  id: string;
  module: string;
  action: string;
  description: string | null;
};

const ACTIONS = ["view", "create", "edit", "delete"];

export default function PermissionsTab() {
  const { toast } = useToast();
  const { hasRole } = usePermissions();
  const { allRoles, loading: rolesLoading } = useAllRoles();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [rolePermissions, setRolePermissions] = useState<Set<string>>(new Set());
  const [originalPermissions, setOriginalPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const isSuperAdmin = hasRole("super_admin");

  // Filter roles - exclude super_admin from editing
  const editableRoles = allRoles.filter((r) => r.value !== "super_admin");

  useEffect(() => {
    fetchPermissions();
  }, []);

  useEffect(() => {
    if (selectedRole) {
      fetchRolePermissions(selectedRole);
    }
  }, [selectedRole]);

  useEffect(() => {
    // Check for unsaved changes
    if (rolePermissions.size !== originalPermissions.size) {
      setHasChanges(true);
      return;
    }
    for (const id of rolePermissions) {
      if (!originalPermissions.has(id)) {
        setHasChanges(true);
        return;
      }
    }
    setHasChanges(false);
  }, [rolePermissions, originalPermissions]);

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from("permissions")
        .select("*")
        .order("module", { ascending: true })
        .order("action", { ascending: true });

      if (error) throw error;
      setPermissions(data || []);
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

  const fetchRolePermissions = async (roleValue: string) => {
    try {
      const isCustomRole = roleValue.startsWith("custom_");
      let query = supabase
        .from("role_permissions")
        .select("permission_id");

      if (isCustomRole) {
        const customRoleId = roleValue.replace("custom_", "");
        query = query.eq("custom_role_id", customRoleId);
      } else {
        query = query.eq("role", roleValue as "admin" | "hr" | "manager" | "employee");
      }

      const { data, error } = await query;

      if (error) throw error;

      const permIds = new Set(data?.map((rp) => rp.permission_id) || []);
      setRolePermissions(permIds);
      setOriginalPermissions(new Set(permIds));
    } catch (error) {
      console.error("Error fetching role permissions:", error);
    }
  };

  const handleTogglePermission = (permissionId: string) => {
    if (!isSuperAdmin) return;

    setRolePermissions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(permissionId)) {
        newSet.delete(permissionId);
      } else {
        newSet.add(permissionId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    if (!selectedRole) return;

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      const isCustomRole = selectedRole.startsWith("custom_");

      // Get current permissions for this role
      let currentQuery = supabase
        .from("role_permissions")
        .select("id, permission_id");

      if (isCustomRole) {
        const customRoleId = selectedRole.replace("custom_", "");
        currentQuery = currentQuery.eq("custom_role_id", customRoleId);
      } else {
        currentQuery = currentQuery.eq("role", selectedRole as "admin" | "hr" | "manager" | "employee");
      }

      const { data: currentPerms } = await currentQuery;
      const currentPermIds = new Set(currentPerms?.map((p) => p.permission_id) || []);

      const toAdd = Array.from(rolePermissions).filter((id) => !currentPermIds.has(id));
      const toRemove = currentPerms?.filter((p) => !rolePermissions.has(p.permission_id)) || [];

      // Delete removed permissions
      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from("role_permissions")
          .delete()
          .in("id", toRemove.map((p) => p.id));

        if (deleteError) throw deleteError;
      }

      // Add new permissions
      if (toAdd.length > 0) {
        if (isCustomRole) {
          const customInsertData = toAdd.map((permissionId) => ({
            custom_role_id: selectedRole.replace("custom_", ""),
            permission_id: permissionId,
          }));
          const { error: insertError } = await supabase
            .from("role_permissions")
            .insert(customInsertData);
          if (insertError) throw insertError;
        } else {
          const roleInsertData = toAdd.map((permissionId) => ({
            role: selectedRole as "admin" | "hr" | "manager" | "employee",
            permission_id: permissionId,
          }));
          const { error: insertError } = await supabase
            .from("role_permissions")
            .insert(roleInsertData);
          if (insertError) throw insertError;
        }
      }

      // Log the change
      if (toAdd.length > 0 || toRemove.length > 0) {
        const roleLabel = editableRoles.find((r) => r.value === selectedRole)?.label || selectedRole;
        await supabase.from("activity_logs").insert({
          performed_by: user?.id,
          action_type: "permission_updated",
          description: `Permissions updated for role: ${roleLabel}`,
          metadata: {
            role: selectedRole,
            added: toAdd.length,
            removed: toRemove.length,
          },
        });
      }

      toast({
        title: "Success",
        description: "Permissions updated successfully",
      });

      setOriginalPermissions(new Set(rolePermissions));
      setHasChanges(false);
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
  const modules = [...new Set(permissions.map((p) => p.module))];

  const getPermissionId = (module: string, action: string) => {
    return permissions.find((p) => p.module === module && p.action === action)?.id;
  };

  if (loading || rolesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading permissions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Permissions</h2>
          <p className="text-sm text-muted-foreground">
            Configure module-level permissions for each role
          </p>
        </div>
        {isSuperAdmin && selectedRole && (
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">Select Role:</span>
        <Select value={selectedRole} onValueChange={setSelectedRole}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Choose a role" />
          </SelectTrigger>
          <SelectContent>
            {editableRoles.map((role) => (
              <SelectItem key={role.value} value={role.value}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasChanges && (
        <div className="text-sm text-amber-600 dark:text-amber-400">
          You have unsaved changes
        </div>
      )}

      {selectedRole ? (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Module</TableHead>
                {ACTIONS.map((action) => (
                  <TableHead key={action} className="text-center capitalize w-[120px]">
                    {action}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.map((module) => (
                <TableRow key={module}>
                  <TableCell className="font-medium capitalize">
                    {module.replace(/_/g, " ")}
                  </TableCell>
                  {ACTIONS.map((action) => {
                    const permId = getPermissionId(module, action);
                    return (
                      <TableCell key={action} className="text-center">
                        {permId ? (
                          <Checkbox
                            checked={rolePermissions.has(permId)}
                            onCheckedChange={() => handleTogglePermission(permId)}
                            disabled={!isSuperAdmin}
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          Select a role to configure its permissions
        </div>
      )}
    </div>
  );
}
