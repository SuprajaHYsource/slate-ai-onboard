import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
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

type AppRole = "admin" | "hr" | "manager" | "employee";

const editableRoles: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "hr", label: "HR" },
  { value: "manager", label: "Manager" },
  { value: "employee", label: "Employee" },
];

export default function PermissionsTab() {
  const { toast } = useToast();
  const { hasRole } = usePermissions();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<AppRole, Set<string>>>({
    admin: new Set(),
    hr: new Set(),
    manager: new Set(),
    employee: new Set(),
  });
  const [originalPermissions, setOriginalPermissions] = useState<Record<AppRole, Set<string>>>({
    admin: new Set(),
    hr: new Set(),
    manager: new Set(),
    employee: new Set(),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const isSuperAdmin = hasRole("super_admin");

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Check if there are unsaved changes
    const changed = editableRoles.some((role) => {
      const current = rolePermissions[role.value];
      const original = originalPermissions[role.value];
      if (current.size !== original.size) return true;
      for (const id of current) {
        if (!original.has(id)) return true;
      }
      return false;
    });
    setHasChanges(changed);
  }, [rolePermissions, originalPermissions]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const { data: allPerms, error: permsError } = await supabase
        .from("permissions")
        .select("*")
        .order("module", { ascending: true })
        .order("action", { ascending: true });

      if (permsError) throw permsError;

      const { data: allRolePerms, error: rolePermsError } = await supabase
        .from("role_permissions")
        .select("role, permission_id")
        .in("role", editableRoles.map((r) => r.value));

      if (rolePermsError) throw rolePermsError;

      setPermissions(allPerms || []);

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
      setOriginalPermissions({
        admin: new Set(grouped.admin),
        hr: new Set(grouped.hr),
        manager: new Set(grouped.manager),
        employee: new Set(grouped.employee),
      });
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
    if (!isSuperAdmin) return;

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

  const handleSelectAllModule = (module: string, checked: boolean) => {
    if (!isSuperAdmin) return;

    const modulePerms = permissions.filter((p) => p.module === module);
    
    setRolePermissions((prev) => {
      const newState = { ...prev };
      editableRoles.forEach((role) => {
        const newSet = new Set(prev[role.value]);
        modulePerms.forEach((perm) => {
          if (checked) {
            newSet.add(perm.id);
          } else {
            newSet.delete(perm.id);
          }
        });
        newState[role.value] = newSet;
      });
      return newState;
    });
  };

  const handleSelectAllRole = (role: AppRole, checked: boolean) => {
    if (!isSuperAdmin) return;

    setRolePermissions((prev) => {
      const newSet = new Set<string>();
      if (checked) {
        permissions.forEach((perm) => newSet.add(perm.id));
      }
      return { ...prev, [role]: newSet };
    });
  };

  const handleReset = () => {
    setRolePermissions({
      admin: new Set(originalPermissions.admin),
      hr: new Set(originalPermissions.hr),
      manager: new Set(originalPermissions.manager),
      employee: new Set(originalPermissions.employee),
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();

      for (const role of editableRoles) {
        const { data: currentPerms } = await supabase
          .from("role_permissions")
          .select("id, permission_id")
          .eq("role", role.value);

        const currentPermIds = new Set(currentPerms?.map((p) => p.permission_id) || []);
        const selectedPermissions = rolePermissions[role.value];

        const toAdd = Array.from(selectedPermissions).filter((id) => !currentPermIds.has(id));
        const toRemove = currentPerms?.filter((p) => !selectedPermissions.has(p.permission_id)) || [];

        if (toRemove.length > 0) {
          const { error: deleteError } = await supabase
            .from("role_permissions")
            .delete()
            .in("id", toRemove.map((p) => p.id));

          if (deleteError) throw deleteError;
        }

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

        // Log if there were changes for this role
        if (toAdd.length > 0 || toRemove.length > 0) {
          await supabase.from("activity_logs").insert({
            performed_by: user?.id,
            action_type: "permission_updated",
            description: `Permissions updated for role: ${role.label}`,
            metadata: {
              role: role.value,
              added: toAdd.length,
              removed: toRemove.length,
            },
          });
        }
      }

      toast({
        title: "Success",
        description: "Permissions updated successfully",
      });

      // Update original permissions to match current
      setOriginalPermissions({
        admin: new Set(rolePermissions.admin),
        hr: new Set(rolePermissions.hr),
        manager: new Set(rolePermissions.manager),
        employee: new Set(rolePermissions.employee),
      });
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Permission Matrix</h2>
          <p className="text-sm text-muted-foreground">
            Configure permissions for all roles (Super Admin has all permissions by default)
          </p>
        </div>
        {isSuperAdmin && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={!hasChanges || saving}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges || saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        )}
      </div>

      {hasChanges && (
        <div className="text-sm text-amber-600 dark:text-amber-400">
          You have unsaved changes
        </div>
      )}

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Module</TableHead>
              <TableHead className="w-[140px]">Action</TableHead>
              {editableRoles.map((role) => (
                <TableHead key={role.value} className="text-center w-[100px]">
                  <div className="flex flex-col items-center gap-1">
                    <span>{role.label}</span>
                    {isSuperAdmin && (
                      <Checkbox
                        checked={permissions.every((p) =>
                          rolePermissions[role.value].has(p.id)
                        )}
                        onCheckedChange={(checked) =>
                          handleSelectAllRole(role.value, checked as boolean)
                        }
                        className="mt-1"
                      />
                    )}
                  </div>
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
                      <div className="flex flex-col gap-2">
                        <span>{module.replace(/_/g, " ")}</span>
                        {isSuperAdmin && (
                          <Checkbox
                            checked={perms.every((p) =>
                              editableRoles.every((r) =>
                                rolePermissions[r.value].has(p.id)
                              )
                            )}
                            onCheckedChange={(checked) =>
                              handleSelectAllModule(module, checked as boolean)
                            }
                          />
                        )}
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="capitalize">
                    {perm.action.replace(/_/g, " ")}
                  </TableCell>
                  {editableRoles.map((role) => (
                    <TableCell key={role.value} className="text-center">
                      <Checkbox
                        checked={rolePermissions[role.value].has(perm.id)}
                        onCheckedChange={() =>
                          handleTogglePermission(role.value, perm.id)
                        }
                        disabled={!isSuperAdmin}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
