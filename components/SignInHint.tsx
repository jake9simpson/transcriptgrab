"use client";

import { useSession } from "next-auth/react";

export default function SignInHint() {
  const { data: session, status } = useSession();

  if (session || status === "loading") {
    return null;
  }

  return (
    <p className="text-center text-sm text-muted-foreground">
      Sign in to save transcripts to your history
    </p>
  );
}
