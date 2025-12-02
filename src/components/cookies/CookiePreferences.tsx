import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type Consent = {
  necessary: boolean;
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
};

const STORAGE_KEY = "cookie_consent_v1";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function CookiePreferences({ open, onOpenChange }: Props) {
  const [consent, setConsent] = useState<Consent>({ necessary: true, analytics: false, functional: true, marketing: false });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Consent;
        setConsent({ ...parsed, necessary: true });
      }
    } catch {}
  }, [open]);

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Cookie Preferences</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Necessary</p>
              <p className="text-sm text-muted-foreground">Required for login, security, and core features</p>
            </div>
            <Switch checked disabled />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Analytics</p>
              <p className="text-sm text-muted-foreground">Helps improve performance and reliability</p>
            </div>
            <Switch checked={consent.analytics} onCheckedChange={(v) => setConsent((c) => ({ ...c, analytics: v }))} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Functional</p>
              <p className="text-sm text-muted-foreground">Remembers preferences like theme</p>
            </div>
            <Switch checked={consent.functional} onCheckedChange={(v) => setConsent((c) => ({ ...c, functional: v }))} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Marketing</p>
              <p className="text-sm text-muted-foreground">Used to deliver relevant content</p>
            </div>
            <Switch checked={consent.marketing} onCheckedChange={(v) => setConsent((c) => ({ ...c, marketing: v }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>Save Preferences</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

