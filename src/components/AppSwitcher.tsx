import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  Grid3x3,
  User,
  Shield,
} from "lucide-react";
import { LucideIcon } from "lucide-react";

interface AppItem {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  route: string;
  requiredRoles?: string[];
}

interface AppSwitcherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AppSwitcher = ({ open, onOpenChange }: AppSwitcherProps) => {
  const navigate = useNavigate();
  const { hasRole } = usePermissions();

  const apps: AppItem[] = [
    {
      id: "dashboard",
      title: "Dashboard",
      description: "Overview & metrics",
      icon: LayoutDashboard,
      route: "/dashboard",
    },
    {
      id: "profile",
      title: "Profile",
      description: "Manage your account",
      icon: User,
      route: "/profile",
    },
    {
      id: "activity-logs",
      title: "Audit Logs",
      description: "Activity tracking",
      icon: FileText,
      route: "/activity-logs",
      requiredRoles: ["super_admin", "admin"],
    },
    {
      id: "rbac",
      title: "RBAC & Permissions",
      description: "Access control",
      icon: Shield,
      route: "/rbac",
      requiredRoles: ["super_admin", "admin"],
    },
    {
      id: "user-management",
      title: "User Management",
      description: "Manage users",
      icon: Users,
      route: "/users",
      requiredRoles: ["super_admin", "admin", "hr"],
    },
    {
      id: "settings",
      title: "Settings",
      description: "App preferences",
      icon: Settings,
      route: "/settings",
    },
  ];

  const filteredApps = apps.filter((app) => {
    if (!app.requiredRoles || app.requiredRoles.length === 0) {
      return true;
    }
    return hasRole(...app.requiredRoles);
  });

  const handleAppClick = (route: string) => {
    navigate(route);
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-md hover:bg-accent"
          aria-label="App Switcher"
        >
          <Grid3x3 className="h-5 w-5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[400px] p-4 animate-in fade-in-0 zoom-in-95"
        align="end"
        sideOffset={8}
      >
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-foreground">Slate AI Apps</h3>
          <p className="text-xs text-muted-foreground">Quick access to modules</p>
        </div>

        <div className="grid grid-cols-3 gap-2 max-h-[400px] overflow-y-auto">
          {filteredApps.map((app) => {
            const Icon = app.icon;
            return (
              <button
                key={app.id}
                onClick={() => handleAppClick(app.route)}
                className="group flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-accent transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-foreground line-clamp-1">
                    {app.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                    {app.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {filteredApps.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No apps available
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
