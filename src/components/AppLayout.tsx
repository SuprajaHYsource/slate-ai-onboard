import { useEffect, useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import {
  LayoutDashboard,
  User as UserIcon,
  Settings,
  Users,
  Shield,
  FileText,
  LogOut,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/signin");
      } else {
        setUser(session.user);
        fetchUserRoles(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/signin");
      } else {
        setUser(session.user);
        fetchUserRoles(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchUserRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) throw error;
      
      setUserRoles(data?.map((r) => r.role) || []);
    } catch (error) {
      console.error("Error fetching roles:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasRole = (...roles: string[]) => {
    return roles.some((role) => userRoles.includes(role));
  };

  const handleLogout = async () => {
    try {
      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: user?.id,
        performed_by: user?.id,
        action_type: "logout",
        description: "User logged out",
      });

      await supabase.auth.signOut();
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
      navigate("/signin");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const menuItems = [
    {
      label: "Main",
      items: [
        { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: [] },
        { title: "Profile", url: "/profile", icon: UserIcon, roles: [] },
        { title: "Settings", url: "/settings", icon: Settings, roles: [] },
      ],
    },
    {
      label: "Management",
      items: [
        {
          title: "User Management",
          url: "/users",
          icon: Users,
          roles: ["super_admin", "admin", "hr"],
        },
        {
          title: "RBAC & Permissions",
          url: "/rbac",
          icon: Shield,
          roles: ["super_admin", "admin"],
        },
        {
          title: "Activity Logs",
          url: "/activity-logs",
          icon: FileText,
          roles: ["super_admin", "admin"],
        },
      ],
    },
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar collapsible="icon">
          <div className="p-4 border-b">
            <h2 className="text-lg font-bold text-primary">SLATE AI</h2>
            <p className="text-xs text-muted-foreground">Hinfinity</p>
          </div>

          <SidebarContent>
            {menuItems.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      // Check if user has required roles
                      if (item.roles.length > 0 && !hasRole(...item.roles)) {
                        return null;
                      }

                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild>
                            <NavLink
                              to={item.url}
                              className="flex items-center gap-2"
                              activeClassName="bg-accent text-accent-foreground font-medium"
                            >
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}

            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={handleLogout}>
                      <LogOut className="h-4 w-4" />
                      <span>Logout</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 overflow-auto">
          <header className="h-14 border-b flex items-center px-4 bg-background sticky top-0 z-10">
            <SidebarTrigger />
          </header>
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
