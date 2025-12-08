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

      // Fetch user roles including custom_role_id
      const { data: userRoles } = await (supabase
        .from("user_roles") as any)
        .select("role, custom_role_id")
        .eq("user_id", user.id);

      // Build roles list - include both system roles and custom role names
      let rolesList: string[] = [];
      const customRoleIds: string[] = [];

      for (const r of userRoles || []) {
        if (r.role) {
          rolesList.push(r.role);
        }
        if (r.custom_role_id) {
          customRoleIds.push(r.custom_role_id);
        }
      }

      // Fetch custom role names
      if (customRoleIds.length > 0) {
        const { data: customRoles } = await (supabase
          .from("custom_roles") as any)
          .select("id, name")
          .in("id", customRoleIds);
        
        for (const cr of customRoles || []) {
          rolesList.push(cr.name);
        }
      }

      const hasUpgraded = rolesList.some((r: string) => ["super_admin", "admin", "hr", "manager"].includes(r));
      if (hasUpgraded) {
        rolesList = rolesList.filter((r: string) => r !== "employee");
      }
      setRoles(rolesList);

      // Fetch permissions for system roles
      const systemRoles = rolesList.filter(r => ["super_admin", "admin", "hr", "manager", "employee"].includes(r)) as ("super_admin" | "admin" | "hr" | "manager" | "employee")[];
      const { data: rolePermissions } = await supabase
        .from("role_permissions")
        .select("permission_id, permissions(module, action)")
        .in("role", systemRoles.length > 0 ? systemRoles : ["employee"]);

      // Fetch permissions for custom roles
      let customRolePermissions: any[] = [];
      if (customRoleIds.length > 0) {
        const { data: crPerms } = await (supabase
          .from("role_permissions") as any)
          .select("permission_id, permissions(module, action)")
          .in("custom_role_id", customRoleIds);
        customRolePermissions = crPerms || [];
      }

      const allRolePerms = [...(rolePermissions || []), ...customRolePermissions];
      const perms =
        allRolePerms?.map((rp: any) => ({
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
