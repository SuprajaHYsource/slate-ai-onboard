import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield, Activity, UserCheck, KeyRound, Mail } from "lucide-react";
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
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);
  const [signupMethod, setSignupMethod] = useState<string>("");
  const [passwordSet, setPasswordSet] = useState(true);

  useEffect(() => {
    checkWelcomeDialog();
    if (hasRole("super_admin", "admin", "hr")) {
      fetchStats();
    }
  }, [roles]);

  const checkWelcomeDialog = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if welcome dialog has been shown
      const welcomeShown = localStorage.getItem(`welcome_shown_${user.id}`);
      
      if (!welcomeShown) {
        // Fetch user profile to check signup method and password status
        const { data: profile } = await supabase
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
      const { count: activeUsers } = await supabase
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
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
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

      {/* Features section removed as requested */}

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
    </div>
  );
}
