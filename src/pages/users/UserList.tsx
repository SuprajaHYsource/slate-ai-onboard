import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreVertical, Eye, Edit, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useAllRoles } from "@/hooks/useAllRoles";
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

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  signup_method: string;
  is_active: boolean;
  last_sign_in: string | null;
  created_at: string;
}

interface UserRoleInfo {
  role: string | null;
  custom_role_id: string | null;
}

export default function UserList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission, hasRole } = usePermissions();
  const { allRoles } = useAllRoles();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, UserRoleInfo[]>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  useEffect(() => {
    if (hasPermission("users", "view")) {
      fetchUsers();
    }
  }, [hasPermission]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = users.filter(
        (user) =>
          user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchTerm, users]);

  const fetchUsers = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setUsers(profiles || []);
      setFilteredUsers(profiles || []);

      // Fetch roles for each user (including custom roles)
      if (profiles) {
        const rolesMap: Record<string, UserRoleInfo[]> = {};
        for (const profile of profiles) {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role, custom_role_id")
            .eq("user_id", profile.user_id);
          rolesMap[profile.user_id] = roles || [];
        }
        setUserRoles(rolesMap);
      }
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

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Soft delete - mark as inactive
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: false })
        .eq("user_id", deleteUserId);

      if (error) throw error;

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: deleteUserId,
        performed_by: user?.id,
        action_type: "user_deleted",
        description: "User account deactivated",
      });

      toast({
        title: "Success",
        description: "User deactivated successfully",
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteUserId(null);
    }
  };

  const getRoleBadgeColor = (role: string, isCustom: boolean = false) => {
    if (isCustom) {
      return "bg-indigo-500/10 text-indigo-500";
    }
    const colors: Record<string, string> = {
      super_admin: "bg-purple-500/10 text-purple-500",
      admin: "bg-blue-500/10 text-blue-500",
      hr: "bg-green-500/10 text-green-500",
      manager: "bg-orange-500/10 text-orange-500",
      employee: "bg-gray-500/10 text-gray-500",
    };
    return colors[role] || "bg-gray-500/10 text-gray-500";
  };

  const getRoleLabel = (roleInfo: UserRoleInfo) => {
    if (roleInfo.role) {
      const systemRole = allRoles.find(r => r.value === roleInfo.role);
      return { label: systemRole?.label || roleInfo.role.replace("_", " "), isCustom: false };
    }
    if (roleInfo.custom_role_id) {
      const customRole = allRoles.find(r => r.value === `custom_${roleInfo.custom_role_id}`);
      return { label: customRole?.label || "Custom Role", isCustom: true };
    }
    return { label: "No Role", isCustom: false };
  };

  const getSignupMethodBadge = (method: string) => {
    const colors: Record<string, string> = {
      manual: "bg-blue-500/10 text-blue-500",
      google: "bg-red-500/10 text-red-500",
      microsoft: "bg-cyan-500/10 text-cyan-500",
      github: "bg-gray-900/10 text-gray-900",
      admin_created: "bg-purple-500/10 text-purple-500",
    };
    return colors[method] || colors.manual;
  };

  if (loading) {
    return <div className="animate-pulse">Loading users...</div>;
  }

  if (!hasPermission("users", "view")) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          You don't have permission to view users.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground">Manage system users and their roles</p>
        </div>
        {hasPermission("users", "create") && (
          <Button onClick={() => navigate("/users/add")}>
            <Plus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Signup Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Sign In</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {userRoles[user.user_id]?.map((roleInfo, idx) => {
                        const { label, isCustom } = getRoleLabel(roleInfo);
                        return (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className={getRoleBadgeColor(roleInfo.role || "", isCustom)}
                          >
                            {label}
                            {isCustom && <span className="ml-1 text-xs opacity-70">★</span>}
                          </Badge>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getSignupMethodBadge(user.signup_method)}>
                      {user.signup_method}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? "default" : "secondary"}>
                      {user.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.last_sign_in
                      ? new Date(user.last_sign_in).toLocaleDateString()
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => navigate(`/users/${user.user_id}`)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        {hasPermission("users", "edit") && (
                          <DropdownMenuItem
                            onClick={() => navigate(`/users/edit/${user.user_id}`)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {hasPermission("users", "delete") && (
                          <DropdownMenuItem
                            onClick={() => setDeleteUserId(user.user_id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Deactivate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate this user? This will mark the
              account as inactive but preserve all data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser}>
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
