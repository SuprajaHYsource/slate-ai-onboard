import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, Loader2 } from "lucide-react";

type NotificationItem = {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  type: string;
  read: boolean | null;
  created_at: string;
};

interface NotificationsMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationsMenu({ open, onOpenChange }: NotificationsMenuProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (!userId || !enabled) return;
    const channel = supabase
      .channel("portal-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as NotificationItem;
          setItems((prev) => [n, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId, enabled]);

  const init = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id || null;
      setUserId(uid);
      if (!uid) return;

      const { data: settings } = await (supabase as any)
        .from("user_settings")
        .select("portal_notifications")
        .eq("user_id", uid)
        .maybeSingle();
      setEnabled(settings ? !!settings.portal_notifications : true);

      await loadLatest(uid);
    } finally {
      setLoading(false);
    }
  };

  const loadLatest = async (uid: string) => {
    const { data } = await (supabase as any)
      .from("notifications")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems(data || []);
  };

  const markAllRead = async () => {
    if (!userId) return;
    await (supabase as any)
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = async (id: string) => {
    await (supabase as any).from("notifications").update({ read: true }).eq("id", id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-96 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold">Notifications</div>
          <Button variant="ghost" size="sm" onClick={markAllRead} className="gap-2">
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        </div>
        {loading ? (
          <div className="p-6 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No notifications</div>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            {items.map((n) => (
              <div key={n.id} className="px-4 py-3 border-b hover:bg-muted/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      {n.type.replace("_", " ")}
                    </Badge>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="mt-2 font-medium">{n.title}</div>
                {n.message && <div className="text-sm text-muted-foreground mt-1">{n.message}</div>}
                {!n.read && (
                  <div className="mt-2">
                    <Button size="sm" variant="outline" onClick={() => markRead(n.id)}>Mark read</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <DropdownMenuSeparator />
        {!enabled && (
          <div className="p-3 text-xs text-muted-foreground">Portal notifications are disabled in Settings</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

