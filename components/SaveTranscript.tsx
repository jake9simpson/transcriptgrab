"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import type { TranscriptSegment } from "@/lib/types";

interface SaveTranscriptProps {
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  thumbnailUrl: string | null;
  videoDuration: number | null;
  segments: TranscriptSegment[];
}

export default function SaveTranscript({
  videoId,
  videoUrl,
  videoTitle,
  thumbnailUrl,
  videoDuration,
  segments,
}: SaveTranscriptProps) {
  const { data: session } = useSession();
  const savedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    if (savedRef.current === videoId) return;

    const timer = setTimeout(async () => {
      savedRef.current = videoId;

      try {
        const res = await fetch("/api/transcript/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoId,
            videoUrl,
            videoTitle,
            thumbnailUrl,
            videoDuration,
            segments,
          }),
        });

        if (!res.ok) return;

        const data: { inserted: boolean; id: string | null } = await res.json();

        if (data.inserted) {
          toast("Transcript saved to history", {
            action: {
              label: "View",
              onClick: () => {
                window.location.href = "/history";
              },
            },
          });
        } else {
          toast("Already in your history");
        }
      } catch {
        // Save failures are silent
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [session?.user?.id, videoId]);

  return null;
}
