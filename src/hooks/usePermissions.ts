import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePermissions() {
  const [permissions, setPermissions] = useState<
    { module: string; action: string }[]
  >([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user roles
      const { data: userRoles } = await (supabase
        .from("user_roles") as any)
        .select("role")
        .eq("user_id", user.id);

      let rolesList = userRoles?.map((r: any) => r.role).filter(Boolean) || [];
      const hasUpgraded = rolesList.some((r: string) => ["super_admin", "admin", "hr", "manager"].includes(r));
      if (hasUpgraded) {
        rolesList = rolesList.filter((r: string) => r !== "employee");
      }
      setRoles(rolesList);

      // Fetch permissions for these roles
      const { data: rolePermissions } = await supabase
        .from("role_permissions")
        .select("permission_id, permissions(module, action)")
        .in("role", rolesList.length > 0 ? rolesList : ["employee"]);

      const perms =
        rolePermissions?.map((rp: any) => ({
          module: rp.permissions.module,
          action: rp.permissions.action,
        })) || [];

      setPermissions(perms);
    } catch (error) {
      console.error("Error fetching permissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (module: string, action: string) => {
    // Super admin has all permissions
    if (roles.includes("super_admin")) {
      return true;
    }
    return permissions.some(
      (p) => p.module === module && p.action === action
    );
  };

  const hasRole = (...requiredRoles: string[]) => {
    return requiredRoles.some((role) => roles.includes(role));
  };

  const isAdmin = () => hasRole("super_admin", "admin");

  return {
    permissions,
    roles,
    loading,
    hasPermission,
    hasRole,
    isAdmin,
  };
}
