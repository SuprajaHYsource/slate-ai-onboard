import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield, Activity, UserCheck, KeyRound, Mail, Plus, ListChecks, Settings, BarChart3 } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const navigate = useNavigate();
  const { roles, hasRole } = usePermissions();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalRoles: 5,
    recentActivities: 0,
  });
  const [quickStats, setQuickStats] = useState({
    adminUsers: 0,
    standardUsers: 0,
    activeToday: 0,
    failedLogins: 0,
  });
  const [recent, setRecent] = useState<Array<{ action_type: string; email?: string; created_at: string; description: string }>>([]);
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);
  const [signupMethod, setSignupMethod] = useState<string>("");
  const [passwordSet, setPasswordSet] = useState(true);
  const [welcomeName, setWelcomeName] = useState<string>("");

  useEffect(() => {
    checkWelcomeDialog();
    if (hasRole("super_admin", "admin", "hr")) {
      fetchStats();
      fetchQuickStatsAndRecent();
    }
    showWelcomeBackIfSignedIn();
  }, [roles]);

  const checkWelcomeDialog = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if welcome dialog has been shown
      const welcomeShown = localStorage.getItem(`welcome_shown_${user.id}`);
      
      if (!welcomeShown) {
        // Fetch user profile to check signup method and password status
        const { data: profile } = await (supabase as any)
          .from("profiles")
          .select("signup_method, password_set")
          .eq("user_id", user.id)
          .single();

        if (profile) {
          setSignupMethod(profile.signup_method || "manual");
          setPasswordSet(profile.password_set || false);
          setShowWelcomeDialog(true);
        }
      }
    } catch (error) {
      console.error("Error checking welcome dialog:", error);
    }
  };

  const handleCloseWelcome = () => {
    // Mark as shown in localStorage
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        localStorage.setItem(`welcome_shown_${user.id}`, "true");
      }
    });
    setShowWelcomeDialog(false);
  };

  const handleGoToProfile = () => {
    handleCloseWelcome();
    navigate("/profile");
  };

  const showWelcomeBackIfSignedIn = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const key = `welcome_back_shown_session_${user.id}`;
      const alreadyShown = sessionStorage.getItem(key);
      if (alreadyShown) return;
      sessionStorage.setItem(key, "true");

      let displayName = "";
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", user.id)
        .maybeSingle();
      displayName = profile?.full_name || profile?.email || user.email || "";
      setWelcomeName(displayName);
    } catch (error) {
      console.error("Error determining welcome back:", error);
    }
  };

  const getSignupMethodInfo = () => {
    const methods: Record<string, { label: string; icon: string; color: string }> = {
      manual: {
        label: "Manual Sign-up (OTP)",
        icon: "✉️",
        color: "bg-blue-500/10 text-blue-500",
      },
      google: {
        label: "Google SSO",
        icon: "🔴",
        color: "bg-red-500/10 text-red-500",
      },
      github: {
        label: "GitHub SSO",
        icon: "⚫",
        color: "bg-gray-900/10 text-gray-900 dark:bg-gray-100/10 dark:text-gray-100",
      },
    };

    return methods[signupMethod] || methods.manual;
  };

  const fetchStats = async () => {
    try {
      // Count total users
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Count active users
      const { count: activeUsers } = await (supabase as any)
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // Count recent activities (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const { count: recentActivities } = await supabase
        .from("activity_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", yesterday.toISOString());

      setStats({
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        totalRoles: 5,
        recentActivities: recentActivities || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchQuickStatsAndRecent = async () => {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { count: adminUsers } = await (supabase as any)
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .in("role", ["super_admin", "admin"]);

      const { count: totalUsers } = await (supabase as any)
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const standardUsers = (totalUsers || 0) - (adminUsers || 0);

      const { count: activeToday } = await (supabase as any)
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("last_sign_in", startOfDay.toISOString());

      const { count: failedLogins } = await (supabase as any)
        .from("activity_logs")
        .select("*", { count: "exact", head: true })
        .eq("action_type", "failed_login")
        .gte("created_at", startOfDay.toISOString());

      const { data: recentLogs } = await (supabase as any)
        .from("activity_logs")
        .select("user_id, action_type, description, created_at")
        .order("created_at", { ascending: false })
        .limit(10);

      const ids = Array.from(new Set((recentLogs || []).map((r: any) => r.user_id).filter(Boolean)));
      let emailMap: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: profiles } = await (supabase as any)
          .from("profiles")
          .select("user_id, email")
          .in("user_id", ids);
        profiles?.forEach((p: any) => { emailMap[p.user_id] = p.email; });
      }

      setQuickStats({
        adminUsers: adminUsers || 0,
        standardUsers: standardUsers || 0,
        activeToday: activeToday || 0,
        failedLogins: failedLogins || 0,
      });

      setRecent((recentLogs || []).map((r: any) => ({
        action_type: r.action_type,
        email: emailMap[r.user_id],
        created_at: r.created_at,
        description: r.description,
      })));
    } catch (error) {
      console.error("Error fetching quick stats/recent:", error);
    }
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `about ${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  };

  const signupInfo = getSignupMethodInfo();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Dialog */}
      <Dialog open={showWelcomeDialog} onOpenChange={setShowWelcomeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Welcome to SLATE AI! 🎉</DialogTitle>
            <DialogDescription className="text-base pt-2">
              Your account has been successfully created.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Sign-up Method</p>
                <Badge className={`${signupInfo.color} mt-1`}>
                  <span className="mr-1.5">{signupInfo.icon}</span>
                  {signupInfo.label}
                </Badge>
              </div>
            </div>

            {!passwordSet && (
              <div className="flex items-start gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <KeyRound className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                    Set a Password
                  </p>
                  <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                    Please set a password in your profile to enable email/password login
                    as a backup authentication method.
                  </p>
                </div>
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              You can complete your profile information and manage your account settings 
              in the Profile section anytime.
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleCloseWelcome} className="w-full sm:w-auto">
              Continue to Dashboard
            </Button>
            <Button onClick={handleGoToProfile} className="w-full sm:w-auto">
              Go to Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      

      <div>
        <h1 className="text-3xl font-bold text-foreground">Welcome{welcomeName ? `, ${welcomeName}` : ""}</h1>
        <p className="text-muted-foreground">
          Welcome to SLATE AI - Workforce & Project Automation
        </p>
      </div>

      {hasRole("super_admin", "admin", "hr") && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="hover-scale">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                Registered users in system
              </p>
            </CardContent>
          </Card>

          <Card className="hover-scale">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeUsers}</div>
              <p className="text-xs text-muted-foreground">
                Currently active accounts
              </p>
            </CardContent>
          </Card>

          <Card className="hover-scale">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Roles</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRoles}</div>
              <p className="text-xs text-muted-foreground">
                Default role types available
              </p>
            </CardContent>
          </Card>

          <Card className="hover-scale">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Recent Activities
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recentActivities}</div>
              <p className="text-xs text-muted-foreground">Last 24 hours</p>
            </CardContent>
          </Card>
        </div>
      )}

      {hasRole("super_admin", "admin") && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => navigate("/users/add")}>
                <Plus className="h-4 w-4 mr-2" /> Add User
              </Button>
              <Button variant="outline" onClick={() => navigate("/rbac")}> 
                <ListChecks className="h-4 w-4 mr-2" /> Manage Roles
              </Button>
              <Button variant="outline" onClick={() => navigate("/activity-logs")}>
                <BarChart3 className="h-4 w-4 mr-2" /> View Activity Logs
              </Button>
              <Button onClick={() => navigate("/settings")}>
                <Settings className="h-4 w-4 mr-2" /> System Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {roles.length > 0 ? (
              roles.map((role) => (
                <span
                  key={role}
                  className="px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary"
                >
                  {role.replace("_", " ").toUpperCase()}
                </span>
              ))
            ) : (
              <p className="text-muted-foreground">No roles assigned yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      {hasRole("super_admin", "admin") && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recent.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <span className={`mt-1 inline-block h-2 w-2 rounded-full ${item.action_type === "failed_login" ? "bg-red-500" : "bg-green-500"}`} />
                    <div>
                      <p className="font-medium uppercase text-sm">{item.action_type.replace("_", " ")}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.email || "Unknown user"} • {timeAgo(item.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
                {recent.length === 0 && (
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Admin Users</span>
                  <span className="font-semibold">{quickStats.adminUsers}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Standard Users</span>
                  <span className="font-semibold">{quickStats.standardUsers}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Active Today</span>
                  <span className="font-semibold">{quickStats.activeToday}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Failed Logins</span>
                  <span className="font-semibold">{quickStats.failedLogins}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
