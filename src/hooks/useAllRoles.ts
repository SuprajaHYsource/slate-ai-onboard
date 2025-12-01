import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SystemRole = {
  value: string;
  label: string;
  description: string;
  type: "system";
  canDelete: boolean;
};

export type CustomRole = {
  id: string;
  value: string;
  label: string;
  description: string;
  type: "custom";
  canDelete: boolean;
  is_active: boolean;
  created_at: string;
};

export type Role = SystemRole | CustomRole;

const defaultSystemRoles: SystemRole[] = [
  { value: "super_admin", label: "Super Admin", description: "Full system access with all privileges (CRUD)", type: "system", canDelete: false },
  { value: "admin", label: "Admin", description: "Administrative access to manage users (CRU)", type: "system", canDelete: false },
  { value: "manager", label: "Manager", description: "Can manage team resources and view reports", type: "system", canDelete: false },
  { value: "employee", label: "User", description: "Standard user access", type: "system", canDelete: false },
];

export function useAllRoles() {
  const [systemRoles] = useState<SystemRole[]>(defaultSystemRoles);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCustomRoles = async () => {
    try {
      const { data, error } = await supabase
        .from("custom_roles")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: CustomRole[] = (data || []).map((role) => ({
        id: role.id,
        value: `custom_${role.id}`,
        label: role.name,
        description: role.description || "",
        type: "custom",
        canDelete: true,
        is_active: role.is_active ?? true,
        created_at: role.created_at || "",
      }));

      setCustomRoles(mapped);
    } catch (error) {
      console.error("Error fetching custom roles:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomRoles();
  }, []);

  const allRoles: Role[] = [...systemRoles, ...customRoles];

  return {
    systemRoles,
    customRoles,
    allRoles,
    loading,
    refetch: fetchCustomRoles,
  };
}
