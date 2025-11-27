import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, TrendingDown } from "lucide-react";

interface TimelineEvent {
  id: string;
  action_type: string;
  description: string;
  created_at: string;
  metadata: any;
}

export default function ProfileTimeline() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTimeline();
  }, []);

  const fetchTimeline = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("user_id", user.id)
        .in("action_type", [
          "role_changed",
          "signup",
          "password_set",
          "email_changed",
        ])
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      setEvents(data || []);
    } catch (error) {
      console.error("Error fetching timeline:", error);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (event: TimelineEvent) => {
    if (event.action_type === "role_changed") {
      const isPromotion =
        event.metadata?.action === "promotion";
      return isPromotion ? (
        <TrendingUp className="h-4 w-4 text-green-500" />
      ) : (
        <TrendingDown className="h-4 w-4 text-red-500" />
      );
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getEventBadge = (event: TimelineEvent) => {
    if (event.action_type === "role_changed") {
      const isPromotion = event.metadata?.action === "promotion";
      return (
        <Badge
          className={
            isPromotion
              ? "bg-green-500/10 text-green-500"
              : "bg-red-500/10 text-red-500"
          }
        >
          {isPromotion ? "Promotion" : "Demotion"}
        </Badge>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Profile Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">Loading timeline...</div>
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Profile Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No timeline events yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Audit Log</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.map((event, index) => (
            <div
              key={event.id}
              className="flex gap-4 pb-4 border-b last:border-0 relative"
            >
              {index !== events.length - 1 && (
                <div className="absolute left-2 top-8 bottom-0 w-px bg-border" />
              )}
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted shrink-0 relative z-10">
                {getEventIcon(event)}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{event.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(event.created_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  {getEventBadge(event)}
                </div>
                {event.metadata && Object.keys(event.metadata).length > 0 && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {event.metadata.old_role && event.metadata.new_role && (
                      <span>
                        {event.metadata.old_role.replace("_", " ")} →{" "}
                        {event.metadata.new_role.replace("_", " ")}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
