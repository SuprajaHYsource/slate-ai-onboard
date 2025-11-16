import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

interface ActivityLog {
  id: string;
  action_type: string;
  description: string;
  created_at: string;
  metadata: any;
  profiles: {
    full_name: string;
    email: string;
  } | null;
}

export default function ActivityLogs() {
  const { hasPermission } = usePermissions();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hasPermission("activity_logs", "view")) {
      fetchLogs();
    }
  }, [hasPermission]);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch profile details separately for each log
      const logsWithProfiles = await Promise.all(
        (data || []).map(async (log) => {
          if (log.user_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("user_id", log.user_id)
              .single();

            return { ...log, profiles: profile };
          }
          return { ...log, profiles: null };
        })
      );

      setLogs(logsWithProfiles);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadgeColor = (actionType: string) => {
    const colors: Record<string, string> = {
      login: "bg-green-500/10 text-green-500",
      logout: "bg-gray-500/10 text-gray-500",
      failed_login: "bg-red-500/10 text-red-500",
      signup: "bg-blue-500/10 text-blue-500",
      user_created: "bg-blue-500/10 text-blue-500",
      user_updated: "bg-orange-500/10 text-orange-500",
      user_deleted: "bg-red-500/10 text-red-500",
      role_changed: "bg-purple-500/10 text-purple-500",
      profile_updated: "bg-cyan-500/10 text-cyan-500",
    };
    return colors[actionType] || "bg-gray-500/10 text-gray-500";
  };

  if (loading) {
    return <div className="animate-pulse">Loading activity logs...</div>;
  }

  if (!hasPermission("activity_logs", "view")) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          You don't have permission to view activity logs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Activity Logs</h1>
        <p className="text-muted-foreground">View system activity and user actions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-muted-foreground">No activity logs yet</p>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-4 pb-4 border-b last:border-0"
                >
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium">{log.description}</p>
                        {log.profiles && (
                          <p className="text-sm text-muted-foreground">
                            {log.profiles.full_name} ({log.profiles.email})
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge className={getActionBadgeColor(log.action_type)}>
                        {log.action_type.replace("_", " ")}
                      </Badge>
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs">
                        <pre className="overflow-auto">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
