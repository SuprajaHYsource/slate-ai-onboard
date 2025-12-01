import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Shield,
  Edit,
  Key,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import EditProfileDialog from "@/components/profile/EditProfileDialog";
import SetPasswordDialog from "@/components/profile/SetPasswordDialog";
import ChangeEmailDialog from "@/components/profile/ChangeEmailDialog";
import ProfileTimeline from "@/components/profile/ProfileTimeline";

interface Profile {
  full_name: string;
  email: string;
  contact_number: string | null;
  gender: string | null;
  date_of_birth: string | null;
  address: string | null;
  profile_picture_url: string | null;
  signup_method: string;
  password_set: boolean;
  email_verified: boolean;
  created_at: string;
  last_sign_in: string | null;
}

export default function Profile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [completionPercentage, setCompletionPercentage] = useState(0);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (profile) {
      calculateCompletion();
    }
  }, [profile]);

  const fetchProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: profileData, error } = await (supabase as any)
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      setProfile(profileData);

      // Fetch roles
      const { data: rolesData } = await (supabase as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      setRoles(rolesData?.map((r: any) => r.role).filter(Boolean) || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateCompletion = () => {
    if (!profile) return;

    const fields = [
      profile.profile_picture_url,
      profile.full_name,
      profile.email_verified,
      profile.contact_number,
      profile.gender,
      profile.date_of_birth,
      profile.address,
    ];

    const completed = fields.filter((field) => !!field).length;
    const percentage = Math.round((completed / fields.length) * 100);
    setCompletionPercentage(percentage);
  };

  const getSignupMethodInfo = () => {
    const methods: Record<string, { label: string; icon: string; color: string }> = {
      manual: {
        label: "You signed up manually",
        icon: "✉️",
        color: "bg-blue-500/10 text-blue-500",
      },
      google: {
        label: "You signed up using Google",
        icon: "🔴",
        color: "bg-red-500/10 text-red-500",
      },
      microsoft: {
        label: "You signed up using Microsoft",
        icon: "🔷",
        color: "bg-cyan-500/10 text-cyan-500",
      },
      github: {
        label: "You signed up using GitHub",
        icon: "⚫",
        color: "bg-gray-900/10 text-gray-900",
      },
      admin_created: {
        label: "Your account was created by an administrator",
        icon: "👤",
        color: "bg-purple-500/10 text-purple-500",
      },
    };

    return methods[profile?.signup_method || "manual"] || {
      label: "Account created",
      icon: "✉️",
      color: "bg-blue-500/10 text-blue-500",
    };
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      super_admin: "bg-purple-500/10 text-purple-500",
      admin: "bg-blue-500/10 text-blue-500",
      hr: "bg-green-500/10 text-green-500",
      manager: "bg-orange-500/10 text-orange-500",
      employee: "bg-gray-500/10 text-gray-500",
    };
    return colors[role] || "bg-gray-500/10 text-gray-500";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Profile not found</div>
      </div>
    );
  }

  const signupInfo = getSignupMethodInfo();
  const showPasswordSetup =
    profile.signup_method !== "manual" &&
    profile.signup_method !== "admin_created" &&
    !profile.password_set;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome, {profile.full_name.split(" ")[0]}!
          </h1>
          <p className="text-muted-foreground">Manage your personal information</p>
        </div>
        <Button onClick={() => setEditDialogOpen(true)}>
          <Edit className="w-4 h-4 mr-2" />
          Edit Profile
        </Button>
      </div>

      {/* SSO Password Setup Alert */}
      {showPasswordSetup && (
        <Alert className="border-orange-500/50 bg-orange-500/10">
          <AlertCircle className="h-4 w-4 text-orange-500" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-orange-700 dark:text-orange-300">
              Please set a password for your account to enable email/password login.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPasswordDialogOpen(true)}
            >
              Set Password
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Profile Completion */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Profile Completion</span>
            <span className="text-2xl font-bold">{completionPercentage}%</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={completionPercentage} className="h-2" />
          <p className="text-sm text-muted-foreground mt-2">
            {completionPercentage === 100
              ? "Your profile is complete! 🎉"
              : "Complete your profile to get the most out of SLATE AI"}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Basic Information
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditDialogOpen(true)}
                className="h-8 w-8"
              >
                <Edit className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile.profile_picture_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                  {profile.full_name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-lg">{profile.full_name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={signupInfo.color}>
                    <span className="mr-1">{signupInfo.icon}</span>
                    {signupInfo.label}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{profile.email}</p>
                    {profile.email_verified && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 h-auto"
                    onClick={() => setEmailDialogOpen(true)}
                  >
                    Change Email
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Contact Number</p>
                  <p className="font-medium">{profile.contact_number || "Not set"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Gender</p>
                  <p className="font-medium">{profile.gender || "Not set"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Date of Birth</p>
                  <p className="font-medium">
                    {profile.date_of_birth
                      ? new Date(profile.date_of_birth).toLocaleDateString()
                      : "Not set"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{profile.address || "Not set"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Roles & Account Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Roles & Permissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => (
                  <Badge key={role} className={getRoleBadgeColor(role)}>
                    {role.replace("_", " ").toUpperCase()}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Account Created</p>
                <p className="font-medium">
                  {new Date(profile.created_at).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Sign In</p>
                <p className="font-medium">
                  {profile.last_sign_in
                    ? new Date(profile.last_sign_in).toLocaleString()
                    : "Never"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Password Status</p>
                <Badge variant={profile.password_set ? "default" : "secondary"}>
                  {profile.password_set ? "Set" : "Not Set"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {!showPasswordSetup && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Security
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setPasswordDialogOpen(true)}
                >
                  Change Password
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Profile Timeline */}
      <ProfileTimeline />

      {/* Dialogs */}
      <EditProfileDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        profile={profile}
        onSuccess={fetchProfile}
      />
      <SetPasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        isFirstTime={showPasswordSetup}
        onSuccess={fetchProfile}
      />
      <ChangeEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        currentEmail={profile.email}
        onSuccess={fetchProfile}
      />
    </div>
  );
}
