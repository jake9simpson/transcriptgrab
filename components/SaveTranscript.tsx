"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import type { TranscriptSegment } from "@/lib/types";
import DuplicateWarning from "@/components/DuplicateWarning";

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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    transcriptId: string;
  } | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    if (savedRef.current === videoId) return;

    setDuplicateInfo(null);
    let cancelled = false;

    async function checkAndSave() {
      // Pre-check for duplicates
      try {
        const checkRes = await fetch(
          `/api/transcript/check?videoId=${videoId}`
        );
        if (checkRes.ok) {
          const checkData: { exists: boolean; transcriptId: string | null } =
            await checkRes.json();
          if (checkData.exists && checkData.transcriptId) {
            if (!cancelled) {
              setDuplicateInfo({ transcriptId: checkData.transcriptId });
              savedRef.current = videoId;
            }
            return;
          }
        }
      } catch {
        // Fail-open: if check fails, proceed to save
      }

      if (cancelled) return;

      // Wait 2.5s before saving (same delay as before)
      await new Promise<void>((resolve) => {
        timerRef.current = setTimeout(resolve, 2500);
      });

      if (cancelled) return;

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

        const data: { inserted: boolean; id: string | null } =
          await res.json();

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
    }

    checkAndSave();

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [session?.user?.id, videoId]);

  if (duplicateInfo) {
    return <DuplicateWarning transcriptId={duplicateInfo.transcriptId} />;
  }

  return null;
}
