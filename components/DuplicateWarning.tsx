"use client";

import { AlertTriangle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface DuplicateWarningProps {
  transcriptId: string;
}

export default function DuplicateWarning({
  transcriptId,
}: DuplicateWarningProps) {
  return (
    <Alert>
      <AlertTriangle />
      <AlertTitle>Already in your history</AlertTitle>
      <AlertDescription>
        You have already saved a transcript for this video.
        <Button variant="outline" size="sm" className="mt-2" asChild>
          <Link href={`/history/${transcriptId}`}>View saved transcript</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
