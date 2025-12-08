import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useAllRoles, type Role } from "@/hooks/useAllRoles";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function RolesTab() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission, hasRole } = usePermissions();
  const { systemRoles, customRoles, refetch } = useAllRoles();
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isSuperAdmin = hasRole("super_admin");

  useEffect(() => {
    fetchUserCounts();
  }, []);

  const fetchUserCounts = async () => {
    try {
      // Fetch system role counts
      const { data: allUserRoles, error: systemError } = await supabase
        .from("user_roles")
        .select("role, custom_role_id");

      if (systemError) throw systemError;

      const counts: Record<string, number> = {};
      allUserRoles?.forEach((ur: any) => {
        if (ur.role) {
          counts[ur.role] = (counts[ur.role] || 0) + 1;
        } else if (ur.custom_role_id) {
          const customKey = `custom_${ur.custom_role_id}`;
          counts[customKey] = (counts[customKey] || 0) + 1;
        }
      });

      setUserCounts(counts);
    } catch (error) {
      console.error("Error fetching user counts:", error);
    }
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete || roleToDelete.type !== "custom") return;

    setDeleting(true);
    try {
      const customRole = roleToDelete as any;
      
      // Check if any users are assigned to this custom role
      // For now, custom roles don't have direct user assignments in the current schema
      // but we should check role_permissions
      
      // Delete role permissions first
      await supabase
        .from("role_permissions")
        .delete()
        .eq("custom_role_id", customRole.id);

      // Delete the custom role
      const { error } = await supabase
        .from("custom_roles")
        .delete()
        .eq("id", customRole.id);

      if (error) throw error;

      // Log activity
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("activity_logs").insert({
        performed_by: user?.id,
        action_type: "role_changed",
        description: `Custom role "${customRole.label}" deleted`,
        metadata: { role_name: customRole.label, action: "deleted" },
      });

      toast({
        title: "Success",
        description: "Custom role deleted successfully",
      });

      refetch();
    } catch (error: any) {
      console.error("Error deleting role:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete role",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
    }
  };

  const openDeleteDialog = (role: Role) => {
    setRoleToDelete(role);
    setDeleteDialogOpen(true);
  };

  const allRoles: Role[] = [...systemRoles, ...customRoles];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Roles</h2>
          <p className="text-sm text-muted-foreground">
            Manage system roles and their descriptions
          </p>
        </div>
        {(isSuperAdmin || hasPermission("rbac", "create")) && (
          <Button onClick={() => navigate("/rbac/create")}>
            <Plus className="w-4 h-4 mr-2" />
            Add Custom Role
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Role Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-center w-[100px]">Users</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allRoles.map((role) => (
              <TableRow key={role.value}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {role.type === "custom" ? (
                      <Badge variant="outline">{role.label}</Badge>
                    ) : (
                      <span className="font-medium">{role.label}</span>
                    )}
                    {role.type === "system" && (
                      <Badge variant="secondary" className="text-xs">System</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {role.description}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">
                    {userCounts[role.value] || 0}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {hasPermission("rbac", "edit") && role.value !== "super_admin" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (role.type === "custom") {
                            navigate(`/rbac/edit-custom/${(role as any).id}`);
                          } else {
                            navigate(`/rbac/edit/${role.value}`);
                          }
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {isSuperAdmin && role.type === "custom" && role.canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(role)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                    {role.type === "system" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled
                        className="opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role "{roleToDelete?.label}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRole}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
