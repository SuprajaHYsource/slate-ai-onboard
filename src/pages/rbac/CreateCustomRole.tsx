import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";

type Permission = {
  id: string;
  module: string;
  action: string;
  description: string | null;
};

export default function CreateCustomRole() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasRole } = usePermissions();
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    responsibilities: "",
    rules: "",
  });

  const isSuperAdmin = hasRole("super_admin");

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate("/rbac");
      return;
    }
    fetchPermissions();
  }, [isSuperAdmin]);

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from("permissions")
        .select("*")
        .order("module", { ascending: true })
        .order("action", { ascending: true });

      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error("Error fetching permissions:", error);
    }
  };

  const handleTogglePermission = (permissionId: string) => {
    setSelectedPermissions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(permissionId)) {
        newSet.delete(permissionId);
      } else {
        newSet.add(permissionId);
      }
      return newSet;
    });
  };

  const handleSelectAllModule = (module: string, checked: boolean) => {
    const modulePerms = permissions.filter((p) => p.module === module);
    setSelectedPermissions((prev) => {
      const newSet = new Set(prev);
      modulePerms.forEach((perm) => {
        if (checked) {
          newSet.add(perm.id);
        } else {
          newSet.delete(perm.id);
        }
      });
      return newSet;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Role name is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Create custom role
      const { data: newRole, error: roleError } = await supabase
        .from("custom_roles")
        .insert({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          responsibilities: formData.responsibilities.trim() || null,
          rules: formData.rules.trim() || null,
          created_by: user?.id,
          is_active: true,
        })
        .select()
        .single();

      if (roleError) throw roleError;

      // Add permissions if selected
      if (selectedPermissions.size > 0) {
        const permissionInserts = Array.from(selectedPermissions).map((permId) => ({
          custom_role_id: newRole.id,
          permission_id: permId,
        }));

        const { error: permError } = await supabase
          .from("role_permissions")
          .insert(permissionInserts);

        if (permError) throw permError;
      }

      // Log activity
      await supabase.from("activity_logs").insert({
        performed_by: user?.id,
        action_type: "role_changed",
        description: `Custom role "${formData.name}" created`,
        metadata: {
          role_id: newRole.id,
          role_name: formData.name,
          permissions_count: selectedPermissions.size,
          action: "created",
        },
      });

      toast({
        title: "Success",
        description: "Custom role created successfully",
      });

      navigate("/rbac");
    } catch (error: any) {
      console.error("Error creating role:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create role",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/rbac")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Create Custom Role</h1>
          <p className="text-muted-foreground">
            Define a new role with specific permissions
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Role Details</CardTitle>
            <CardDescription>Enter the basic information for the new role</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Role Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Content Manager"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this role can do..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="responsibilities">Responsibilities</Label>
              <Textarea
                id="responsibilities"
                value={formData.responsibilities}
                onChange={(e) => setFormData({ ...formData, responsibilities: e.target.value })}
                placeholder="Define the key responsibilities for this role..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rules">Rules</Label>
              <Textarea
                id="rules"
                value={formData.rules}
                onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                placeholder="Specify any rules or restrictions for this role..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assign Permissions</CardTitle>
            <CardDescription>
              Select the permissions this role should have ({selectedPermissions.size} selected)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Object.entries(groupedPermissions).map(([module, perms]) => (
                <div key={module} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`module-${module}`}
                      checked={perms.every((p) => selectedPermissions.has(p.id))}
                      onCheckedChange={(checked) =>
                        handleSelectAllModule(module, checked as boolean)
                      }
                    />
                    <Label
                      htmlFor={`module-${module}`}
                      className="text-base font-semibold capitalize cursor-pointer"
                    >
                      {module.replace(/_/g, " ")}
                    </Label>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 ml-6">
                    {perms.map((perm) => (
                      <div key={perm.id} className="flex items-center gap-2">
                        <Checkbox
                          id={perm.id}
                          checked={selectedPermissions.has(perm.id)}
                          onCheckedChange={() => handleTogglePermission(perm.id)}
                        />
                        <Label
                          htmlFor={perm.id}
                          className="text-sm capitalize cursor-pointer"
                        >
                          {perm.action.replace(/_/g, " ")}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Create Role
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/rbac")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
