import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Consent = {
  necessary: boolean;
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
};

const STORAGE_KEY = "cookie_consent_v1";

export default function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setOpen(true);
      }
    } catch {}
  }, []);

  const setConsent = (consent: Consent) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">Cookie Policy</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We use cookies to improve your experience, analyze traffic, and personalize content. You can choose to accept or deny.
          </p>
          <a href="/cookie-policy" className="text-sm text-primary underline">Learn More</a>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConsent({ necessary: true, analytics: false, functional: true, marketing: false })}>Deny</Button>
            <Button onClick={() => setConsent({ necessary: true, analytics: true, functional: true, marketing: true })}>Accept</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

