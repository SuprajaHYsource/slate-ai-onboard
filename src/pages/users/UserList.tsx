import { useEffect, useState, useRef } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Search, Edit, Trash2, Mail, MoreVertical, Eye } from "lucide-react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  signup_method: string;
  is_active: boolean;
  last_sign_in: string | null;
  created_at: string;
  profile_picture_url: string | null;
}

interface UserRoleInfo {
  role: string | null;
  custom_role_id: string | null;
}

export default function UserList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission, loading: permLoading } = usePermissions();
  const { allRoles, loading: rolesLoading } = useAllRoles();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [activateUserId, setActivateUserId] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviteTeamName, setInviteTeamName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Stable permission check
  const canView = !permLoading && hasPermission("users", "view");

  // Initial load only - once permissions and roles are ready
  useEffect(() => {
    if (!permLoading && !rolesLoading && canView && !initialLoadDone) {
      setInitialLoadDone(true);
      fetchUsers();
    } else if (!permLoading && !rolesLoading && !canView) {
      setLoading(false);
    }
  }, [permLoading, rolesLoading, canView, initialLoadDone]);

  useEffect(() => {
    let filtered = users;
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Role filter
    if (roleFilter && roleFilter !== "all") {
      filtered = filtered.filter((user) => userRoles[user.user_id] === roleFilter);
    }
    
    // Status filter
    if (statusFilter && statusFilter !== "all") {
      filtered = filtered.filter((user) => 
        statusFilter === "active" ? user.is_active : !user.is_active
      );
    }
    
    setFilteredUsers(filtered);
  }, [searchTerm, users, roleFilter, statusFilter, userRoles]);

  const fetchUsers = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setUsers(profiles || []);
      setFilteredUsers(profiles || []);

      // Fetch roles for each user
      if (profiles) {
        const rolesMap: Record<string, string> = {};
        for (const profile of profiles) {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role, custom_role_id")
            .eq("user_id", profile.user_id)
            .maybeSingle();
          
          if (roles) {
            if (roles.role) {
              rolesMap[profile.user_id] = roles.role;
            } else if (roles.custom_role_id) {
              rolesMap[profile.user_id] = `custom_${roles.custom_role_id}`;
            }
          }
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

  const handleRoleChange = async (userId: string, newRole: string) => {
    const currentRole = userRoles[userId];
    if (currentRole === newRole) return;

    setUpdatingRole(userId);
    
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      // Delete old role
      await supabase.from("user_roles").delete().eq("user_id", userId);

      // Insert new role
      const isCustomRole = newRole.startsWith("custom_");
      
      if (isCustomRole) {
        const customRoleId = newRole.replace("custom_", "");
        const { error } = await supabase.from("user_roles").insert([{
          user_id: userId,
          custom_role_id: customRoleId,
          assigned_by: currentUser?.id,
        }]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").insert([{
          user_id: userId,
          role: newRole as any,
          assigned_by: currentUser?.id,
        }]);
        if (error) throw error;
      }

      // Get role labels for logging
      const oldRoleLabel = allRoles.find(r => r.value === currentRole)?.label || currentRole;
      const newRoleLabel = allRoles.find(r => r.value === newRole)?.label || newRole;

      // Log role change
      await supabase.from("activity_logs").insert({
        user_id: userId,
        performed_by: currentUser?.id,
        action_type: "user_role_assigned",
        description: `User role changed: ${oldRoleLabel} → ${newRoleLabel}`,
        metadata: {
          old_role: currentRole,
          new_role: newRole,
          old_role_label: oldRoleLabel,
          new_role_label: newRoleLabel,
        },
        module: "users",
        target: userId,
        status: "success",
      });
      await (supabase as any).from("notifications").insert({
        user_id: userId,
        type: "role_changed",
        title: "Role updated",
        message: `Your role changed from ${oldRoleLabel} to ${newRoleLabel}`,
      });

      const mapDeptPos = (role: string) => {
        switch (role) {
          case "super_admin":
            return { department: "Administration", position: "Super Admin" };
          case "admin":
            return { department: "Administration", position: "Admin" };
          case "hr":
            return { department: "Human Resources", position: "HR" };
          case "manager":
            return { department: "Management", position: "Manager" };
          default:
            return { department: "Operations", position: "User" };
        }
      };

      const mapped = mapDeptPos(newRole);
      await (supabase as any)
        .from("profiles")
        .update({ department: mapped.department, position: mapped.position })
        .eq("user_id", userId);

      // Update local state
      setUserRoles(prev => ({ ...prev, [userId]: newRole }));

      toast({
        title: "Success",
        description: `Role changed to ${newRoleLabel}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
        variant: "destructive",
      });
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("profiles")
        .update({ is_active: false })
        .eq("user_id", deleteUserId);

      if (error) throw error;

      await supabase.from("activity_logs").insert({
        user_id: deleteUserId,
        performed_by: user?.id,
        action_type: "user_status_changed",
        description: "User account suspended",
        module: "users",
        target: deleteUserId,
        status: "success",
      });

      toast({
        title: "Success",
        description: "User suspended successfully",
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

  const handleActivateUser = async () => {
    if (!activateUserId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("profiles")
        .update({ is_active: true })
        .eq("user_id", activateUserId);

      if (error) throw error;

      await (supabase.from("activity_logs") as any).insert({
        user_id: activateUserId,
        performed_by: user?.id,
        action_type: "user_status_changed",
        description: "User account activated",
        module: "users",
        target: activateUserId,
        status: "success",
      });

      toast({
        title: "Success",
        description: "User activated successfully",
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActivateUserId(null);
    }
  };



  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleLabel = (roleValue: string) => {
    return allRoles.find(r => r.value === roleValue)?.label || roleValue;
  };

  if (loading || rolesLoading || permLoading) {
    return <div className="animate-pulse">Loading users...</div>;
  }

  if (!canView) {
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
          <p className="text-muted-foreground">Manage users and assign roles across your organization</p>
        </div>
        <div className="flex items-center gap-2">
          {hasPermission("users", "create") && (
            <Button onClick={() => navigate("/users/add")}>
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          )}
          {hasPermission("users", "create") && (
            <Button variant="outline" onClick={() => setInviteOpen(true)}>
              <Mail className="w-4 h-4 mr-2" />
              Invite Team
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {allRoles.map((role) => (
              <SelectItem key={role.value} value={role.value}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.profile_picture_url || ""} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.full_name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {hasPermission("users", "edit") ? (
                      <Select
                        value={userRoles[user.user_id] || "employee"}
                        onValueChange={(value) => handleRoleChange(user.user_id, value)}
                        disabled={updatingRole === user.user_id}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue>
                            {updatingRole === user.user_id 
                              ? "Updating..." 
                              : getRoleLabel(userRoles[user.user_id] || "employee")}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {allRoles.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                              {role.type === "custom" && (
                                <span className="ml-1 text-xs opacity-70">★</span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary">
                        {getRoleLabel(userRoles[user.user_id] || "employee")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={user.is_active ? "default" : "secondary"}
                      className={user.is_active 
                        ? "bg-green-500/10 text-green-600 hover:bg-green-500/20" 
                        : "bg-gray-500/10 text-gray-500"
                      }
                    >
                      {user.is_active ? "active" : "inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.last_sign_in
                      ? new Date(user.last_sign_in).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/users/${user.user_id}`)}>
                          <Eye className="mr-2 h-4 w-4" /> View Details
                        </DropdownMenuItem>
                        {hasPermission("users", "edit") && (
                          <DropdownMenuItem onClick={() => navigate(`/users/edit/${user.user_id}`)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit User
                          </DropdownMenuItem>
                        )}

                        {hasPermission("users", "delete") && (
                          <DropdownMenuItem onClick={() => (user.is_active ? setDeleteUserId(user.user_id) : setActivateUserId(user.user_id))}>
                            {user.is_active ? (
                              <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                            ) : (
                              <Edit className="mr-2 h-4 w-4" />
                            )}
                            {user.is_active ? "Suspend" : "Activate"}
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
            <AlertDialogTitle>Suspend User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to suspend this user? This will mark the
              account as inactive and block access with credentials.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser}>
              Suspend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!activateUserId} onOpenChange={() => setActivateUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate User</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the account as active and allow the user to sign in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleActivateUser}>
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Members</DialogTitle>
            <DialogDescription>
              Enter email addresses to invite. Separate multiple emails with commas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Emails</label>
              <Input
                placeholder="alice@example.com, bob@example.com"
                value={inviteEmails}
                onChange={(e) => setInviteEmails(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Team Name (optional)</label>
              <Input
                placeholder="e.g. Marketing"
                value={inviteTeamName}
                onChange={(e) => setInviteTeamName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button disabled={inviting} onClick={async () => {
              const emails = inviteEmails
                .split(",")
                .map((e) => e.trim())
                .filter((e) => e.length > 0);
              if (emails.length === 0) {
                toast({ title: "No emails", description: "Please enter at least one email", variant: "destructive" });
                return;
              }
              setInviting(true);
              try {
                const { data, error } = await supabase.functions.invoke("invite-team", {
                  body: { emails, teamName: inviteTeamName || undefined },
                });
                if (error) throw error;
                toast({ title: "Invitations sent", description: `${data?.results?.filter((r: any) => r.ok).length || emails.length} invitation(s) sent.` });
                setInviteOpen(false);
                setInviteEmails("");
                setInviteTeamName("");
              } catch (err: any) {
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                  // Fallback: insert invitations and portal notifications directly
                  for (const email of emails) {
                    const token = crypto.randomUUID();
                    const { error: insertInviteError } = await (supabase as any)
                      .from("team_invitations")
                      .insert({
                        email,
                        team_name: inviteTeamName || null,
                        invited_by: user?.id || null,
                        invite_token: token,
                        expires_at: expiresAt.toISOString(),
                      });
                    if (insertInviteError) throw insertInviteError;

                    const { data: existingProfile } = await (supabase as any)
                      .from("profiles")
                      .select("user_id")
                      .eq("email", email)
                      .maybeSingle();
                    if (existingProfile?.user_id) {
                      const { data: settings } = await (supabase as any)
                        .from("user_settings")
                        .select("portal_notifications")
                        .eq("user_id", existingProfile.user_id)
                        .maybeSingle();
                      if (!settings || settings.portal_notifications) {
                        await (supabase as any).from("notifications").insert({
                          user_id: existingProfile.user_id,
                          type: "team_invite",
                          title: "Team Invitation",
                          message: `You have been invited${inviteTeamName ? ` to join team "${inviteTeamName}"` : ""}.`,
                        });
                      }
                    }
                  }
                  await (supabase as any).from("activity_logs").insert({
                    user_id: user?.id,
                    performed_by: user?.id,
                    action_type: "user_created",
                    description: `Invited ${emails.length} team member(s) (fallback)`,
                    module: "users",
                    status: "partial",
                  });
                  await (supabase as any).from("notifications").insert({
                    user_id: user?.id,
                    type: "team_invite",
                    title: "Invitations queued",
                    message: `${emails.length} invitation(s) created${inviteTeamName ? ` for team "${inviteTeamName}"` : ""}.`,
                  });
                  toast({ title: "Invitations queued", description: "Portal notifications created. Email sending requires edge function deployment.", });
                  setInviteOpen(false);
                  setInviteEmails("");
                  setInviteTeamName("");
                } catch (e2: any) {
                  toast({ title: "Error", description: e2.message || "Failed to process invitations", variant: "destructive" });
                }
              } finally {
                setInviting(false);
              }
            }}>Send Invites</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
