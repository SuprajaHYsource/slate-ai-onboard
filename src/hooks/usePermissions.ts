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
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const rolesList = userRoles?.map((r) => r.role) || [];
      setRoles(rolesList);

      // Fetch permissions for these roles
      const { data: rolePermissions } = await supabase
        .from("role_permissions")
        .select("permission_id, permissions(module, action)")
        .in("role", rolesList);

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
