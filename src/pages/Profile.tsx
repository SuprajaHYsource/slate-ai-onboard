import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// Badge not used in Profile after removing roles/account sections
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { AlertCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import EditProfileDialog from "@/components/profile/EditProfileDialog";
import SetPasswordDialog from "@/components/profile/SetPasswordDialog";
// ChangeEmailDialog entry moved to Settings; remove from Profile
 

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
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [formData, setFormData] = useState({ full_name: "", contact_number: "", address: "", date_of_birth: "" });
  const [saving, setSaving] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [dobError, setDobError] = useState<string | null>(null);
  const [workForm, setWorkForm] = useState({ employee_id: "", department: "", position: "", join_date: "", location: "" });
  const [savingWork, setSavingWork] = useState(false);

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
      setFormData({
        full_name: profileData.full_name || "",
        contact_number: profileData.contact_number || "",
        address: profileData.address || "",
        date_of_birth: profileData.date_of_birth || "",
      });
      setWorkForm({
        employee_id: (profileData as any).employee_id || "",
        department: (profileData as any).department || "",
        position: (profileData as any).position || "",
        join_date: (profileData as any).join_date || "",
        location: (profileData as any).location || "",
      });

      
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

  const handleSaveWork = async () => {
    if (!profile) return;
    setSavingWork(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("profiles")
        .update({
          employee_id: workForm.employee_id || null,
          department: workForm.department || null,
          position: workForm.position || null,
          join_date: workForm.join_date || null,
          location: workForm.location || null,
        })
        .eq("user_id", user?.id);
      if (error) throw error;
      toast({ title: "Saved", description: "Work details updated" });
      await fetchProfile();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingWork(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      // Validate phone
      const phoneRegex = /^[\d\s\-+()]{7,20}$/;
      const digitsOnly = (formData.contact_number || "").replace(/\D/g, "");
      let phoneError: string | null = null;
      if (formData.contact_number && (!phoneRegex.test(formData.contact_number) || digitsOnly.length < 7 || digitsOnly.length > 15)) {
        phoneError = "Please enter a valid phone number (7-15 digits)";
      }
      setContactError(phoneError);

      // Validate DOB: must be 21+ years old
      let dobValidationError: string | null = null;
      if (formData.date_of_birth) {
        const dob = new Date(formData.date_of_birth);
        const minDate = new Date();
        minDate.setFullYear(minDate.getFullYear() - 21);
        if (dob > minDate) {
          dobValidationError = "You must be at least 21 years old";
        }
      }
      setDobError(dobValidationError);

      if (phoneError || dobValidationError) {
        throw new Error(phoneError || dobValidationError || "Invalid input");
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("profiles")
        .update({
          full_name: formData.full_name,
          contact_number: formData.contact_number || null,
          address: formData.address || null,
          date_of_birth: formData.date_of_birth || null,
        })
        .eq("user_id", user?.id);
      if (error) throw error;
      toast({ title: "Saved", description: "Profile updated successfully" });
      await fetchProfile();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
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
      <div>
        <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
        <p className="text-muted-foreground">View and manage your personal information</p>
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

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile.profile_picture_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-3xl font-bold">
                  {profile.full_name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <p className="font-semibold text-lg">{profile.full_name}</p>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>Edit Profile</Button>
            </div>
          </CardContent>
        </Card>

        {/* Right */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardContent>
              <Tabs defaultValue="personal" className="w-full">
                <TabsList className="w-full max-w-md grid grid-cols-2">
                  <TabsTrigger value="personal">Personal Info</TabsTrigger>
                  <TabsTrigger value="work">Work Details</TabsTrigger>
                </TabsList>
                <TabsContent value="personal" className="pt-4 space-y-4">
                  <div className="grid gap-4">
                    <div>
                      <Label>Full Name</Label>
                      <Input value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input value={profile.email} disabled />
                    </div>
                    <div>
                      <Label>Phone Number</Label>
                      <Input value={formData.contact_number} onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })} className={contactError ? "border-destructive" : ""} />
                      {contactError && <p className="text-sm text-destructive mt-1">{contactError}</p>}
                    </div>
                    <div>
                      <Label>Date of Birth (Must be 21+ years old)</Label>
                      <Input type="date" value={formData.date_of_birth} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} max={new Date(new Date().setFullYear(new Date().getFullYear() - 21)).toISOString().split("T")[0]} />
                      {dobError && <p className="text-sm text-destructive mt-1">{dobError}</p>}
                    </div>
                    <div>
                      <Label>Address</Label>
                      <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                    </div>
                  </div>
                  <Button onClick={handleSave} disabled={saving} className="mt-2">{saving ? "Saving..." : "Save Changes"}</Button>
                </TabsContent>
                <TabsContent value="work" className="pt-4">
                  <div className="grid gap-4">
                    <div>
                      <Label>Employee ID</Label>
                      <Input value={workForm.employee_id} onChange={(e) => setWorkForm({ ...workForm, employee_id: e.target.value })} />
                    </div>
                    <div>
                      <Label>Department</Label>
                      <Input value={workForm.department} onChange={(e) => setWorkForm({ ...workForm, department: e.target.value })} />
                    </div>
                    <div>
                      <Label>Position</Label>
                      <Input value={workForm.position} onChange={(e) => setWorkForm({ ...workForm, position: e.target.value })} />
                    </div>
                    <div>
                      <Label>Join Date</Label>
                      <Input type="date" value={workForm.join_date} onChange={(e) => setWorkForm({ ...workForm, join_date: e.target.value })} />
                    </div>
                    <div>
                      <Label>Location</Label>
                      <Input value={workForm.location} onChange={(e) => setWorkForm({ ...workForm, location: e.target.value })} />
                    </div>
                  </div>
                  <Button onClick={handleSaveWork} disabled={savingWork} className="mt-2">{savingWork ? "Saving..." : "Save Work Details"}</Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          
        </div>
      </div>

      

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
    </div>
  );
}
