import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
 
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Slider } from "@/components/ui/slider";

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
  const [enableCrop, setEnableCrop] = useState(false);
  const [cropScale, setCropScale] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  

  

  

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
      setEnableCrop(true);
      setCropScale(1);
      setCropOffset({ x: 0, y: 0 });
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

      let fileToUpload: File = profileImage;
      // If cropping is enabled and previewUrl set, render crop to canvas and convert to file
      if (enableCrop && previewUrl) {
        const cropped = await cropImage(previewUrl, cropScale, cropOffset);
        if (cropped) {
          fileToUpload = cropped;
        }
      }

      const { error: uploadError } = await supabase.storage
        .from("profile-pictures")
        .upload(filePath, fileToUpload);

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

  const cropImage = (src: string, scale: number, offset: { x: number; y: number }): Promise<File | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const size = 400; // output square size
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        const scaledW = img.width * scale;
        const scaledH = img.height * scale;
        const drawX = (size - scaledW) / 2 + offset.x;
        const drawY = (size - scaledH) / 2 + offset.y;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, drawX, drawY, scaledW, scaledH);
        canvas.toBlob((blob) => {
          if (!blob) return resolve(null);
          const file = new File([blob], `crop_${Date.now()}.png`, { type: "image/png" });
          resolve(file);
        }, "image/png", 0.92);
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
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
        .update({ profile_picture_url })
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
          fields_updated: ["profile_picture_url"],
          image_changed: !!profileImage,
        },
      });
      await (supabase as any).from("notifications").insert({
        user_id: user.id,
        type: "profile_updated",
        title: "Profile updated",
        message: profileImage ? "Your profile picture was updated" : "Your profile information was updated",
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
            {previewUrl && enableCrop && (
              <div className="mt-4">
                <div
                  className="relative w-56 h-56 rounded-lg border overflow-hidden bg-muted"
                  onMouseDown={(e) => {
                    setDragging(true);
                    setDragStart({ x: e.clientX, y: e.clientY });
                  }}
                  onMouseUp={() => {
                    setDragging(false);
                    setDragStart(null);
                  }}
                  onMouseLeave={() => {
                    setDragging(false);
                    setDragStart(null);
                  }}
                  onMouseMove={(e) => {
                    if (!dragging || !dragStart) return;
                    const dx = e.clientX - dragStart.x;
                    const dy = e.clientY - dragStart.y;
                    setCropOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
                    setDragStart({ x: e.clientX, y: e.clientY });
                  }}
                >
                  <img
                    src={previewUrl}
                    alt="Crop"
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      transform: `translate(-50%, -50%) translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${cropScale})`,
                      userSelect: "none",
                      pointerEvents: "none",
                    }}
                  />
                </div>
                <div className="mt-3">
                  <Label>Zoom</Label>
                  <Slider value={[cropScale]} min={0.5} max={3} step={0.01} onValueChange={(v) => setCropScale(v[0])} />
                </div>
              </div>
            )}
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
