import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { User, Settings, HelpCircle, LogOut, UserCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProfileData {
  full_name: string;
  email: string;
  profile_picture_url: string | null;
  roles: string[];
}

interface ProfileMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProfileMenu = ({ open, onOpenChange }: ProfileMenuProps) => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();

    // Listen for profile update events
    const handleProfileUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.profile_picture_url !== undefined) {
        // Immediately update the profile picture URL with cache-busting
        setProfile((prev) => prev ? {
          ...prev,
          profile_picture_url: customEvent.detail.profile_picture_url 
            ? `${customEvent.detail.profile_picture_url}?t=${Date.now()}` 
            : null
        } : null);
      }
      // Also refetch full profile
      fetchProfile();
    };

    window.addEventListener('profile-updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate);
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("user-profile-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${userId}` },
        (payload) => {
          const next = payload.new as { full_name?: string; email?: string; profile_picture_url?: string | null };
          setProfile((prev) =>
            prev
              ? {
                  full_name: next.full_name ?? prev.full_name,
                  email: next.email ?? prev.email,
                  profile_picture_url: next.profile_picture_url ?? prev.profile_picture_url,
                  roles: prev.roles,
                }
              : null
          );
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId]);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profileData } = await (supabase
        .from("profiles") as any)
        .select("full_name, email, profile_picture_url")
        .eq("user_id", user.id)
        .single();

      const { data: rolesData } = await (supabase
        .from("user_roles") as any)
        .select("role")
        .eq("user_id", user.id);

      if (profileData) {
        let fetchedRoles: string[] = rolesData?.map((r: any) => r.role as string).filter(Boolean) || [];
        const hasUpgraded = fetchedRoles.some((r) => ["super_admin", "admin", "hr", "manager"].includes(r));
        if (hasUpgraded) {
          fetchedRoles = fetchedRoles.filter((r) => r !== "employee");
        }
        setProfile({
          full_name: profileData.full_name,
          email: profileData.email,
          profile_picture_url: profileData.profile_picture_url 
            ? `${profileData.profile_picture_url}?t=${Date.now()}` 
            : null,
          roles: fetchedRoles,
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        await (supabase.from("activity_logs") as any).insert({
          user_id: user.id,
          performed_by: user.id,
          action_type: "logout",
          description: "User logged out",
        });
      }

      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeColor = (role: string) => {
    const roleColors: Record<string, string> = {
      super_admin: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
      admin: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
      hr: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
      manager: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
      employee: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
    };
    return roleColors[role] || roleColors.employee;
  };

  if (loading || !profile) {
    return (
      <Avatar className="h-9 w-9 cursor-pointer">
        <AvatarFallback className="bg-muted">
          <User className="h-5 w-5 text-muted-foreground" />
        </AvatarFallback>
      </Avatar>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
          <Avatar className="h-9 w-9">
            <AvatarImage src={profile.profile_picture_url || undefined} alt={profile.full_name} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {getInitials(profile.full_name)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-80 p-4 animate-in fade-in-0 zoom-in-95" 
        align="end"
        sideOffset={8}
      >
        {/* Profile Header */}
        <div className="flex flex-col items-center gap-3 pb-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile.profile_picture_url || undefined} alt={profile.full_name} />
            <AvatarFallback className="bg-primary/10 text-primary text-2xl font-medium">
              {getInitials(profile.full_name)}
            </AvatarFallback>
          </Avatar>
          
          <div className="text-center space-y-1 w-full">
            {profile.full_name ? (
              <>
                <h3 className="font-semibold text-lg text-foreground">{profile.full_name}</h3>
                <p className="text-sm text-muted-foreground break-all">{profile.email}</p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground break-all">{profile.email}</p>
                <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                  Complete your profile
                </p>
              </>
            )}
            
            {profile.roles.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {profile.roles.map((role) => (
                  <Badge
                    key={role}
                    variant="outline"
                    className={`text-xs ${getRoleBadgeColor(role)}`}
                  >
                    {role.replace("_", " ")}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Menu Items */}
        <div className="py-2">
          <DropdownMenuItem
            className="cursor-pointer py-3 px-3 rounded-md"
            onClick={() => navigate("/profile")}
          >
            <UserCircle className="mr-3 h-5 w-5 text-muted-foreground" />
            <span className="font-medium">Manage Profile</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="cursor-pointer py-3 px-3 rounded-md"
            onClick={() => navigate("/settings")}
          >
            <Settings className="mr-3 h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{profile.roles.includes("super_admin") ? "System Settings" : "Account Settings"}</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="cursor-pointer py-3 px-3 rounded-md"
            onClick={() => {
              // Placeholder for Help & Support
              console.log("Help & Support clicked");
            }}
          >
            <HelpCircle className="mr-3 h-5 w-5 text-muted-foreground" />
            <span className="font-medium">Help & Support</span>
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator />

        {/* Logout Button */}
        <div className="pt-2">
          <Button
            variant="destructive"
            className="w-full justify-start py-3 px-3"
            onClick={handleLogout}
          >
            <LogOut className="mr-3 h-5 w-5" />
            <span className="font-medium">Logout</span>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
