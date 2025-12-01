import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: any;
  onSuccess: () => void;
}

export default function EditProfileDialog({
  open,
  onOpenChange,
  profile,
  onSuccess,
}: EditProfileDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    profile?.profile_picture_url || null
  );
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || "",
    contact_number: profile?.contact_number || "",
    gender: profile?.gender || "",
    date_of_birth: profile?.date_of_birth || "",
    address: profile?.address || "",
  });

  // Calculate max date (21 years ago from today)
  const getMaxDate = () => {
    const today = new Date();
    const maxDate = new Date(today.getFullYear() - 21, today.getMonth(), today.getDate());
    return maxDate.toISOString().split('T')[0];
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "Image size must be less than 5MB",
          variant: "destructive",
        });
        return;
      }
      setProfileImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleRemoveImage = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Delete old image from storage if exists
      if (profile?.profile_picture_url) {
        const oldPath = profile.profile_picture_url.split("/").pop();
        if (oldPath) {
          await supabase.storage
            .from("profile-pictures")
            .remove([`${user.id}/${oldPath}`]);
        }
      }

      // Update profile to remove picture URL
      const { error } = await (supabase.from("profiles") as any)
        .update({ profile_picture_url: null })
        .eq("user_id", user.id);

      if (error) throw error;

      setPreviewUrl(null);
      setProfileImage(null);

      toast({
        title: "Success",
        description: "Profile picture removed",
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const uploadProfileImage = async (userId: string): Promise<string | null> => {
    if (!profileImage) return null;

    setUploading(true);
    try {
      // Delete old image if exists
      if (profile?.profile_picture_url) {
        const oldPath = profile.profile_picture_url.split("/").pop();
        if (oldPath) {
          await supabase.storage
            .from("profile-pictures")
            .remove([`${userId}/${oldPath}`]);
        }
      }

      // Upload new image
      const fileExt = profileImage.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-pictures")
        .upload(filePath, profileImage);

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("profile-pictures").getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      toast({
        title: "Error uploading image",
        description: error.message,
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      // Upload profile image if selected
      let profile_picture_url = profile?.profile_picture_url;
      if (profileImage) {
        const uploadedUrl = await uploadProfileImage(user.id);
        if (uploadedUrl) {
          profile_picture_url = uploadedUrl;
        }
      }

      const { error } = await (supabase.from("profiles") as any)
        .update({
          ...formData,
          profile_picture_url,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      // Log activity
      await (supabase.from("activity_logs") as any).insert({
        user_id: user.id,
        performed_by: user.id,
        action_type: "profile_updated",
        description: "Profile information updated",
        module: "profile",
        status: "success",
        metadata: {
          fields_updated: Object.keys(formData),
          image_changed: !!profileImage,
        },
      });

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });

      // Dispatch event to notify other components (like ProfileMenu) to refresh
      window.dispatchEvent(new CustomEvent('profile-updated', { 
        detail: { profile_picture_url } 
      }));

      onSuccess();
      onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update your personal information
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Profile Picture</Label>
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={previewUrl || undefined} />
                <AvatarFallback>
                  {profile?.full_name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex gap-2">
                <Label htmlFor="profile-image" className="cursor-pointer">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload
                    </span>
                  </Button>
                </Label>
                <Input
                  id="profile-image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                {previewUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveImage}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) =>
                setFormData({ ...formData, full_name: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_number">Contact Number</Label>
            <Input
              id="contact_number"
              type="tel"
              value={formData.contact_number}
              onChange={(e) =>
                setFormData({ ...formData, contact_number: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select
              value={formData.gender}
              onValueChange={(value) =>
                setFormData({ ...formData, gender: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date_of_birth">Date of Birth (Must be 21+ years old)</Label>
            <Input
              id="date_of_birth"
              type="date"
              value={formData.date_of_birth}
              max={getMaxDate()}
              onChange={(e) =>
                setFormData({ ...formData, date_of_birth: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || uploading}>
              {(loading || uploading) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
