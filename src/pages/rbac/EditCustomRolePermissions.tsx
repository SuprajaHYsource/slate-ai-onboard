import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";

type Permission = {
  id: string;
  module: string;
  action: string;
  description: string | null;
};

type CustomRole = {
  id: string;
  name: string;
  description: string | null;
  responsibilities: string | null;
  rules: string | null;
};

export default function EditCustomRolePermissions() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    responsibilities: "",
    rules: "",
  });

  const canEdit = hasPermission("rbac", "edit");
  const hasFetched = useRef(false);

  useEffect(() => {
    if (permissionsLoading) return;
    
    if (!canEdit) {
      navigate("/rbac");
      return;
    }
    
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchData();
    }
  }, [id, canEdit, permissionsLoading]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch custom role details
      const { data: roleData, error: roleError } = await supabase
        .from("custom_roles")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (roleError) throw roleError;
      
      if (!roleData) {
        toast({
          title: "Error",
          description: "Role not found",
          variant: "destructive",
        });
        navigate("/rbac");
        return;
      }

      setFormData({
        name: roleData.name || "",
        description: roleData.description || "",
        responsibilities: (roleData as any).responsibilities || "",
        rules: (roleData as any).rules || "",
      });

      // Fetch all permissions
      const { data: allPerms, error: permsError } = await supabase
        .from("permissions")
        .select("*")
        .order("module", { ascending: true })
        .order("action", { ascending: true });

      if (permsError) throw permsError;

      // Fetch current custom role permissions
      const { data: rolePerms, error: rolePermsError } = await supabase
        .from("role_permissions")
        .select("permission_id")
        .eq("custom_role_id", id);

      if (rolePermsError) throw rolePermsError;

      setPermissions(allPerms || []);
      setSelectedPermissions(new Set(rolePerms?.map((rp) => rp.permission_id) || []));
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load role data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePermission = (permissionId: string) => {
    const newSelected = new Set(selectedPermissions);
    if (newSelected.has(permissionId)) {
      newSelected.delete(permissionId);
    } else {
      newSelected.add(permissionId);
    }
    setSelectedPermissions(newSelected);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Role name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();

      // Update custom role details
      const { error: updateError } = await supabase
        .from("custom_roles")
        .update({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          responsibilities: formData.responsibilities.trim() || null,
          rules: formData.rules.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // Get current permissions
      const { data: currentPerms } = await supabase
        .from("role_permissions")
        .select("id, permission_id")
        .eq("custom_role_id", id);

      const currentPermIds = new Set(currentPerms?.map((p) => p.permission_id) || []);
      
      // Find permissions to add
      const toAdd = Array.from(selectedPermissions).filter((permId) => !currentPermIds.has(permId));
      
      // Find permissions to remove
      const toRemove = currentPerms?.filter((p) => !selectedPermissions.has(p.permission_id)) || [];

      // Remove permissions
      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from("role_permissions")
          .delete()
          .in("id", toRemove.map((p) => p.id));

        if (deleteError) throw deleteError;
      }

      // Add permissions
      if (toAdd.length > 0) {
        const { error: insertError } = await supabase
          .from("role_permissions")
          .insert(
            toAdd.map((permissionId) => ({
              custom_role_id: id,
              permission_id: permissionId,
            }))
          );

        if (insertError) throw insertError;
      }

      // Log activity
      await supabase.from("activity_logs").insert({
        performed_by: user?.id,
        action_type: "role_changed",
        description: `Custom role "${formData.name}" updated`,
        metadata: {
          role_id: id,
          role_name: formData.name,
          permissions_added: toAdd.length,
          permissions_removed: toRemove.length,
          action: "updated",
        },
      });

      toast({
        title: "Success",
        description: "Role updated successfully",
      });

      navigate("/rbac");
    } catch (error) {
      console.error("Error saving role:", error);
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Group permissions by module
  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (loading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/rbac")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Edit Custom Role</h1>
          <p className="text-muted-foreground">
            Update role details and permissions
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Role Details</CardTitle>
          <CardDescription>Update the basic information for this role</CardDescription>
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
          <CardTitle>Permissions</CardTitle>
          <CardDescription>
            Configure what this role can access ({selectedPermissions.size} selected)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(groupedPermissions).map(([module, perms]) => (
              <div key={module} className="space-y-3">
                <h4 className="font-semibold capitalize">{module.replace(/_/g, " ")}</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 ml-4">
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
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        <Button variant="outline" onClick={() => navigate("/rbac")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}