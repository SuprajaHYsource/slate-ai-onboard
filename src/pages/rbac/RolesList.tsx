import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Plus, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";

const defaultRoles = [
  { value: "super_admin", label: "Super Admin", description: "Full system access", color: "bg-purple-500/10 text-purple-500" },
  { value: "admin", label: "Admin", description: "Administrative access", color: "bg-blue-500/10 text-blue-500" },
  { value: "hr", label: "HR", description: "HR management access", color: "bg-green-500/10 text-green-500" },
  { value: "manager", label: "Manager", description: "Team management access", color: "bg-orange-500/10 text-orange-500" },
  { value: "employee", label: "Employee", description: "Basic user access", color: "bg-gray-500/10 text-gray-500" },
];

export default function RolesList() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [customRoles, setCustomRoles] = useState<any[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, number>>({});

  useEffect(() => {
    if (hasPermission("rbac", "view")) {
      fetchCustomRoles();
      fetchRolePermissions();
    }
  }, [hasPermission]);

  const fetchCustomRoles = async () => {
    try {
      const { data, error } = await supabase
        .from("custom_roles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCustomRoles(data || []);
    } catch (error) {
      console.error("Error fetching custom roles:", error);
    }
  };

  const fetchRolePermissions = async () => {
    try {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("role, permission_id");

      if (error) throw error;

      const counts: Record<string, number> = {};
      data?.forEach((rp) => {
        if (rp.role) {
          counts[rp.role] = (counts[rp.role] || 0) + 1;
        }
      });

      setRolePermissions(counts);
    } catch (error) {
      console.error("Error fetching role permissions:", error);
    }
  };

  if (!hasPermission("rbac", "view")) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          You don't have permission to view roles and permissions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">RBAC & Permissions</h1>
          <p className="text-muted-foreground">Manage roles and permissions</p>
        </div>
        {hasPermission("rbac", "create") && (
          <Button onClick={() => navigate("/rbac/create")}>
            <Plus className="w-4 h-4 mr-2" />
            Create Custom Role
          </Button>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Default System Roles</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {defaultRoles.map((role) => (
            <Card key={role.value} className="hover-scale">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <Badge className={role.color}>{role.label}</Badge>
                </div>
                <CardTitle className="text-lg">{role.label}</CardTitle>
                <CardDescription>{role.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {rolePermissions[role.value] || 0} permissions
                  </span>
                  {hasPermission("rbac", "edit") && role.value !== "super_admin" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/rbac/edit/${role.value}`)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {customRoles.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Custom Roles</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {customRoles.map((role) => (
              <Card key={role.id} className="hover-scale">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    <Badge variant={role.is_active ? "default" : "secondary"}>
                      {role.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg">{role.name}</CardTitle>
                  <CardDescription>{role.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Custom role
                    </span>
                    {hasPermission("rbac", "edit") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/rbac/edit-custom/${role.id}`)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
