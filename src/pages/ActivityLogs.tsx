import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Search } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

interface ActivityLog {
  id: string;
  action_type: string;
  description: string;
  created_at: string;
  metadata: any;
  module: string | null;
  target: string | null;
  status: string | null;
  performed_by: string | null;
  user_id: string | null;
  performer_profile: {
    full_name: string;
    email: string;
    profile_picture_url: string | null;
  } | null;
  performer_roles: string[];
}

const ACTION_TYPES = [
  { value: "all", label: "All actions" },
  { value: "login", label: "User Login" },
  { value: "logout", label: "User Logout" },
  { value: "signup", label: "Signup" },
  { value: "otp_verification", label: "OTP Verification" },
  { value: "otp_resend", label: "OTP Resend" },
  { value: "forgot_email", label: "Forgot Email" },
  { value: "forgot_password", label: "Forgot Password" },
  { value: "password_reset", label: "Password Reset" },
  { value: "password_set", label: "Password Set" },
  { value: "profile_updated", label: "Profile Updated" },
  { value: "email_change", label: "Email Change" },
  { value: "user_created", label: "User Created" },
  { value: "user_updated", label: "User Updated" },
  { value: "user_deleted", label: "User Deleted" },
  { value: "role_changed", label: "Role Changed" },
  { value: "user_role_assigned", label: "Role Assigned" },
  { value: "custom_role_created", label: "Custom Role Created" },
  { value: "custom_role_updated", label: "Custom Role Updated" },
  { value: "custom_role_deleted", label: "Custom Role Deleted" },
  { value: "permission_updated", label: "Permission Updated" },
  { value: "user_status_changed", label: "Status Changed" },
];

const MODULES = [
  { value: "all", label: "All modules" },
  { value: "auth", label: "Auth" },
  { value: "users", label: "Users" },
  { value: "profile", label: "Profile" },
  { value: "rbac", label: "RBAC" },
  { value: "system", label: "System" },
];

const STATUSES = [
  { value: "all", label: "All status" },
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
  { value: "pending", label: "Pending" },
];

export default function ActivityLogs() {
  const { hasPermission, loading: permLoading } = usePermissions();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [pageLoading, setPageLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Check permission once and store result
  const canView = !permLoading && hasPermission("activity_logs", "view");

  // Initial load only
  useEffect(() => {
    if (!permLoading && canView && !initialLoadDone) {
      setInitialLoadDone(true);
      fetchLogs(1, pageSize);
    } else if (!permLoading && !canView) {
      setLoading(false);
    }
  }, [permLoading, canView]);

  // Handle filter changes - only after initial load
  useEffect(() => {
    if (initialLoadDone && canView) {
      fetchLogs(1, pageSize);
    }
  }, [actionFilter, moduleFilter, statusFilter, startDate, endDate, pageSize]);

  const fetchLogs = async (pageArg: number = page, pageSizeArg: number = pageSize) => {
    setPageLoading(true);
    try {
      let query = (supabase as any)
        .from("activity_logs")
        .select("*", { count: "exact" });

      if (actionFilter !== "all") {
        query = query.eq("action_type", actionFilter);
      }
      if (moduleFilter !== "all") {
        query = query.eq("module", moduleFilter);
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (startDate) {
        query = query.gte("created_at", startDate.toISOString());
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }

      if (searchEmail) {
        const { data: profiles } = await (supabase as any)
          .from("profiles")
          .select("user_id")
          .ilike("email", `%${searchEmail}%`);
        const ids = (profiles || [])
          .map((p: any) => p.user_id)
          .filter(Boolean);
        if (ids.length === 0) {
          setLogs([]);
          setTotal(0);
          setPage(1);
          return;
        }
        const idList = ids.join(",");
        query = query.or(`performed_by.in.(${idList}),user_id.in.(${idList})`);
      }

      const from = (pageArg - 1) * pageSizeArg;
      const to = from + pageSizeArg - 1;
      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;

      const logsWithProfiles = await Promise.all(
        (data || []).map(async (log: any) => {
          let performer_profile = null;
          let performer_roles: string[] = [];

          const performerId = log.performed_by || log.user_id;
          if (performerId) {
            const { data: profile } = await (supabase as any)
              .from("profiles")
              .select("full_name, email, profile_picture_url")
              .eq("user_id", performerId)
              .maybeSingle();
            performer_profile = profile;

            const { data: userRoles } = await (supabase as any)
              .from("user_roles")
              .select("role, custom_role_id")
              .eq("user_id", performerId);
            if (userRoles) {
              for (const ur of userRoles) {
                if (ur.role) {
                  performer_roles.push(ur.role.replace("_", " "));
                } else if (ur.custom_role_id) {
                  const { data: customRole } = await (supabase as any)
                    .from("custom_roles")
                    .select("name")
                    .eq("id", ur.custom_role_id)
                    .maybeSingle();
                  if (customRole) {
                    performer_roles.push(customRole.name);
                  }
                }
              }
            }
          }
          return { ...log, performer_profile, performer_roles };
        })
      );

      setLogs(logsWithProfiles);
      setTotal(count || 0);
      setPage(pageArg);
      setPageSize(pageSizeArg);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    // Email search
    if (searchEmail && log.performer_profile) {
      const searchLower = searchEmail.toLowerCase();
      if (!log.performer_profile.email.toLowerCase().includes(searchLower)) {
        return false;
      }
    }

    // Action filter
    if (actionFilter !== "all" && log.action_type !== actionFilter) {
      return false;
    }

    // Module filter
    if (moduleFilter !== "all" && log.module !== moduleFilter) {
      return false;
    }

    // Status filter
    if (statusFilter !== "all" && log.status !== statusFilter) {
      return false;
    }

    // Date filters
    const logDate = new Date(log.created_at);
    if (startDate && logDate < startDate) {
      return false;
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      if (logDate > endOfDay) {
        return false;
      }
    }

    return true;
  });

  const getActionBadgeStyle = (actionType: string) => {
    const styles: Record<string, string> = {
      login: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      logout: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
      failed_login: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
      signup: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      otp_verification: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
      otp_resend: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      forgot_email: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
      forgot_password: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
      password_reset: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
      password_set: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
      user_created: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
      user_updated: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
      user_deleted: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
      role_changed: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      user_role_assigned: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      profile_updated: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
      email_change: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
      custom_role_created: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
      custom_role_updated: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
      custom_role_deleted: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      permission_updated: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/20",
      user_status_changed: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    };
    return styles[actionType] || "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20";
  };

  const getStatusBadge = (status: string | null) => {
    const statusLower = (status || "success").toLowerCase();
    const styles: Record<string, string> = {
      success: "bg-green-500 text-white",
      failed: "bg-red-500 text-white",
      pending: "bg-yellow-500 text-white",
    };
    return (
      <Badge className={`${styles[statusLower] || styles.success} text-xs font-medium`}>
        {statusLower.charAt(0).toUpperCase() + statusLower.slice(1)}
      </Badge>
    );
  };

  const formatActionType = (actionType: string) => {
    return actionType.toUpperCase().replace(/_/g, "_");
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleLabel = (roles: string[]) => {
    if (roles.length === 0) return "User";
    // Capitalize first letter of each word
    return roles[0]
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (loading || permLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Audit Logs</h1>
          <p className="text-muted-foreground">View system activity and security events</p>
        </div>
        <Card>
          <CardContent className="p-8">
            <div className="animate-pulse text-center text-muted-foreground">
              Loading activity logs...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          You don't have permission to view activity logs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Audit Logs</h1>
        <p className="text-muted-foreground">View system activity and security events</p>
      </div>

      <Card>
        <CardContent className="p-6">
          {/* Filters */}
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email..."
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((action) => (
                    <SelectItem key={action.value} value={action.value}>
                      {action.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={moduleFilter} onValueChange={setModuleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All modules" />
                </SelectTrigger>
                <SelectContent>
                  {MODULES.map((module) => (
                    <SelectItem key={module.value} value={module.value}>
                      {module.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Calendar className="h-4 w-4" />
                    {startDate ? format(startDate, "MMM dd, yyyy") : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Calendar className="h-4 w-4" />
                    {endDate ? format(endDate, "MMM dd, yyyy") : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {(startDate || endDate || searchEmail || actionFilter !== "all" || moduleFilter !== "all" || statusFilter !== "all") && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setStartDate(undefined);
                    setEndDate(undefined);
                    setSearchEmail("");
                    setActionFilter("all");
                    setModuleFilter("all");
                    setStatusFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Performed By</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No activity logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`${getActionBadgeStyle(log.action_type)} font-mono text-xs`}
                        >
                          {formatActionType(log.action_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={log.performer_profile?.profile_picture_url || ""}
                              alt={log.performer_profile?.full_name || "User"}
                            />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {getInitials(log.performer_profile?.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {log.performer_profile?.email || "System"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {getRoleLabel(log.performer_roles)}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {log.module || "auth"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {log.target || "-"}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(log.created_at), "MMM dd, yyyy HH:mm:ss")}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              {total === 0
                ? "Showing 0 to 0 of 0 entries"
                : (() => {
                    const start = (page - 1) * pageSize + 1;
                    const end = Math.min(page * pageSize, total);
                    return `Showing ${start} to ${end} of ${total} entries`;
                  })()}
            </div>
            <div className="flex items-center gap-2">
              <Select value={String(pageSize)} onValueChange={(v) => fetchLogs(1, Number(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder={String(pageSize)} />
                </SelectTrigger>
                <SelectContent>
                  {[25, 50, 100].map((s) => (
                    <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => page > 1 && fetchLogs(page - 1, pageSize)}
                disabled={pageLoading || page <= 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {Math.max(1, Math.ceil(total / pageSize))}
              </span>
              <Button
                variant="outline"
                onClick={() => page < Math.ceil(total / pageSize) && fetchLogs(page + 1, pageSize)}
                disabled={pageLoading || page >= Math.ceil(total / pageSize)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
