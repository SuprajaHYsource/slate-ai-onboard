import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Key, Mail, Activity, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import SetPasswordDialog from "@/components/profile/SetPasswordDialog";
import ChangeEmailDialog from "@/components/profile/ChangeEmailDialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Settings() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [values, setValues] = useState({
    theme: "system",
    email_notifications: true,
    portal_notifications: true,
    language: "en",
    timezone: "UTC",
  });
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [currentEmail, setCurrentEmail] = useState("");
  const [auditLogs, setAuditLogs] = useState<Array<{ action_type: string; description: string; status: string; created_at: string }>>([]);
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [activitySearch, setActivitySearch] = useState<string>("");
  const [activityPage, setActivityPage] = useState<number>(1);
  const [activityPageSize, setActivityPageSize] = useState<number>(100);
  const [activityTotal, setActivityTotal] = useState<number>(0);
  const [activityLoading, setActivityLoading] = useState<boolean>(false);
  const pageRef = useRef<{ activityPage: number; activityPageSize: number }>({ activityPage, activityPageSize });
  const [accountInfo, setAccountInfo] = useState<{ created_at: string; last_sign_in: string | null; password_set: boolean }>({ created_at: "", last_sign_in: null, password_set: false });

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);
        const { data } = await (supabase as any)
          .from("user_settings")
          .select("theme, email_notifications, portal_notifications, language, timezone")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data) {
          setValues({
            theme: data.theme || "system",
            email_notifications: data.email_notifications ?? true,
            portal_notifications: data.portal_notifications ?? true,
            language: data.language || "en",
            timezone: data.timezone || "UTC",
          });
        } else {
          await (supabase as any).from("user_settings").insert({ user_id: user.id });
        }

        const { data: profile } = await (supabase as any)
          .from("profiles")
          .select("email, created_at, last_sign_in, password_set")
          .eq("user_id", user.id)
          .maybeSingle();
        setCurrentEmail(profile?.email || user.email || "");
        if (profile) {
          setAccountInfo({
            created_at: profile.created_at,
            last_sign_in: profile.last_sign_in || null,
            password_set: !!profile.password_set,
          });
        }

        pageRef.current.activityPage = activityPage;
        pageRef.current.activityPageSize = activityPageSize;

        await fetchActivityLogs(user.id, activityPage, activityPageSize, activityFilter, activitySearch);

        // Subscribe to realtime activity logs for this user
        const channel = supabase.channel("activity_logs_changes");
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table: "activity_logs", filter: `user_id=eq.${user.id}` },
          (payload: any) => {
            const row = payload.new || payload.old;
            if (!row) return;
            const currentPage = pageRef.current.activityPage || 1;
            const currentSize = pageRef.current.activityPageSize || 100;
            fetchActivityLogs(user.id, currentPage, currentSize, activityFilter, activitySearch);
          }
        );
        channel.subscribe();
      } catch (e: any) {
        toast({ title: "Error", description: e.message || "Failed to load settings", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const fetchActivityLogs = async (
    uid: string,
    page: number,
    pageSize: number,
    statusFilter: string,
    searchTerm: string
  ) => {
    setActivityLoading(true);
    try {
      let query = (supabase as any)
        .from("activity_logs")
        .select("action_type, description, status, created_at", { count: "exact" })
        .eq("user_id", uid);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (searchTerm) {
        const term = `%${searchTerm}%`;
        query = query.or(`action_type.ilike.${term},description.ilike.${term}`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      setAuditLogs(data || []);
      setActivityTotal(count || 0);
    } catch (e: any) {
      // keep prior list, notify user
      toast({ title: "Error", description: e.message || "Failed to load activity", variant: "destructive" });
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    setActivityPage(1);
    pageRef.current.activityPage = 1;
    pageRef.current.activityPageSize = activityPageSize;
    fetchActivityLogs(userId, 1, activityPageSize, activityFilter, activitySearch);
  }, [activityFilter, activitySearch, userId]);

  useEffect(() => {
    if (!userId) return;
    setActivityPage(1);
    pageRef.current.activityPage = 1;
    pageRef.current.activityPageSize = activityPageSize;
    fetchActivityLogs(userId, 1, activityPageSize, activityFilter, activitySearch);
  }, [activityPageSize]);

  const auditLoadingOrEmpty = (
    logs: Array<{ action_type: string; description: string; status: string; created_at: string }>,
    statusFilter: string,
    searchTerm: string
  ) => {
    const filtered = logs
      .filter((l) => statusFilter === "all" || l.status === statusFilter)
      .filter((l) => (searchTerm ? `${l.action_type} ${l.description}`.toLowerCase().includes(searchTerm.toLowerCase()) : true));
    return activityLoading || filtered.length === 0;
  };

  const renderRangeText = (page: number, pageSize: number, total: number) => {
    if (total === 0) return "Showing 0 to 0 of 0 entries";
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    return `Showing ${start} to ${end} of ${total} entries`;
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await (supabase as any)
        .from("user_settings")
        .upsert({
          user_id: userId,
          theme: values.theme,
          email_notifications: values.email_notifications,
          portal_notifications: values.portal_notifications,
          language: values.language,
          timezone: values.timezone,
          updated_at: new Date().toISOString(),
        });

      setTheme(values.theme as any);

      await (supabase as any).from("activity_logs").insert({
        user_id: userId,
        performed_by: userId,
        action_type: "settings_updated",
        description: "Updated settings",
        module: "settings",
        status: "success",
        metadata: values,
      });
      await (supabase as any).from("notifications").insert({
        user_id: userId,
        type: "settings_updated",
        title: "Settings updated",
        message: "Your preferences were saved",
      });

      toast({ title: "Saved", description: "Settings updated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your application settings</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            <CardTitle>Preferences</CardTitle>
          </div>
          <CardDescription>Customize how the app behaves</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="general" className="w-full">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="regional">Regional</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="activity">My Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="space-y-4 pt-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Theme</Label>
                  <Select value={values.theme} onValueChange={(v) => setValues({ ...values, theme: v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select theme" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="notifications" className="space-y-4 pt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Email notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive updates via email</p>
                  </div>
                  <Switch checked={values.email_notifications} onCheckedChange={(c) => setValues({ ...values, email_notifications: c })} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Portal notifications</Label>
                    <p className="text-sm text-muted-foreground">Show notifications in the app</p>
                  </div>
                  <Switch checked={values.portal_notifications} onCheckedChange={(c) => setValues({ ...values, portal_notifications: c })} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="regional" className="space-y-4 pt-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Language</Label>
                  <Select value={values.language} onValueChange={(v) => setValues({ ...values, language: v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select language" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Timezone</Label>
                  <Input value={values.timezone} onChange={(e) => setValues({ ...values, timezone: e.target.value })} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="account" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    <CardTitle>Account Information</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Account Created</p>
                    <p className="font-medium">{accountInfo.created_at ? new Date(accountInfo.created_at).toLocaleDateString() : ""}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Sign In</p>
                    <p className="font-medium">{accountInfo.last_sign_in ? new Date(accountInfo.last_sign_in).toLocaleString() : "Never"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Password Status</p>
                    <Badge variant={accountInfo.password_set ? "default" : "secondary"}>{accountInfo.password_set ? "Set" : "Not Set"}</Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="security" className="space-y-4 pt-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Key className="h-5 w-5" />
                      <CardTitle>Change Password</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={() => setPasswordDialogOpen(true)}>Change Password</Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      <CardTitle>Change Email</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Current: {currentEmail}</p>
                      <Button variant="outline" onClick={() => setEmailDialogOpen(true)}>Change Email</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="activity" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      <CardTitle>My Activity</CardTitle>
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="Search" value={activitySearch} onChange={(e) => setActivitySearch(e.target.value)} className="w-48" />
                      <Select value={activityFilter} onValueChange={setActivityFilter}>
                        <SelectTrigger className="w-40"><SelectValue placeholder="Filter" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="success">Success</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <CardDescription>Live activity feed in a tabular view</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Action</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLoadingOrEmpty(auditLogs, activityFilter, activitySearch) && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                              {activityLoading ? "Loading..." : "No activity yet"}
                            </TableCell>
                          </TableRow>
                        )}
                        {auditLogs
                          .filter((l) => activityFilter === "all" || l.status === activityFilter)
                          .filter((l) =>
                            activitySearch
                              ? `${l.action_type} ${l.description}`.toLowerCase().includes(activitySearch.toLowerCase())
                              : true
                          )
                          .map((log, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{log.action_type.replace("_", " ")}</TableCell>
                              <TableCell className="text-muted-foreground">{log.description}</TableCell>
                              <TableCell>
                                <Badge variant={log.status === "success" ? "default" : "secondary"}>{log.status}</Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{new Date(log.created_at).toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-sm text-muted-foreground">
                      {renderRangeText(activityPage, activityPageSize, activityTotal)}
                    </p>
                    <div className="flex items-center gap-3">
                      <Select value={String(activityPageSize)} onValueChange={(v) => setActivityPageSize(Number(v))}>
                        <SelectTrigger className="w-24"><SelectValue placeholder="Page size" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const nextPage = Math.max(1, activityPage - 1);
                            setActivityPage(nextPage);
                            pageRef.current.activityPage = nextPage;
                            fetchActivityLogs(userId!, nextPage, activityPageSize, activityFilter, activitySearch);
                          }}
                          disabled={activityPage <= 1 || activityLoading}
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Page {activityPage} of {Math.max(1, Math.ceil(activityTotal / activityPageSize))}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const totalPages = Math.max(1, Math.ceil(activityTotal / activityPageSize));
                            const nextPage = Math.min(totalPages, activityPage + 1);
                            setActivityPage(nextPage);
                            pageRef.current.activityPage = nextPage;
                            fetchActivityLogs(userId!, nextPage, activityPageSize, activityFilter, activitySearch);
                          }}
                          disabled={activityPage >= Math.max(1, Math.ceil(activityTotal / activityPageSize)) || activityLoading}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-6">
            <Button variant="outline" onClick={() => window.history.back()}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </div>
        </CardContent>
      </Card>

      <SetPasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        isFirstTime={false}
        onSuccess={() => {
          toast({ title: "Password Changed", description: "Your password was updated" });
        }}
      />
      <ChangeEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        currentEmail={currentEmail}
        onSuccess={(updatedEmail) => {
          setCurrentEmail(updatedEmail);
          toast({ title: "Email Changed", description: "Your email was updated" });
        }}
      />
    </div>
  );
}
