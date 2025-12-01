import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";

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
      } catch (e: any) {
        toast({ title: "Error", description: e.message || "Failed to load settings", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

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
          </Tabs>

          <div className="flex justify-end gap-2 pt-6">
            <Button variant="outline" onClick={() => window.history.back()}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
