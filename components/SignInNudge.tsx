"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export default function SignInNudge() {
  const { data: session, status } = useSession();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("signInNudgeDismissed") === "true";
  });

  if (session || status === "loading" || dismissed) {
    return null;
  }

  function handleDismiss() {
    sessionStorage.setItem("signInNudgeDismissed", "true");
    setDismissed(true);
  }

  return (
    <div className="rounded-lg border bg-muted/50 p-4 flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">
        Sign in to automatically save transcripts and build your history
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="default"
          size="sm"
          onClick={() => signIn("google")}
        >
          Sign in
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
