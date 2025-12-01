import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/usePermissions";
import RolesTab from "./components/RolesTab";
import PermissionsTab from "./components/PermissionsTab";

export default function RBACPage() {
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState("roles");

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
      <div>
        <h1 className="text-3xl font-bold text-foreground">Role-Based Access Control</h1>
        <p className="text-muted-foreground">
          Manage roles, permissions, and user access across your application
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="mt-6">
          <RolesTab />
        </TabsContent>

        <TabsContent value="permissions" className="mt-6">
          <PermissionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
