"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Trash2, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { decodeHtmlEntities, formatTimestamp, formatTranscriptText } from "@/lib/format";
import type { TranscriptSegment } from "@/lib/types";

export interface HistoryTranscript {
  id: string;
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  thumbnailUrl: string | null;
  videoDuration: number | null;
  segments: TranscriptSegment[];
  savedAt: Date;
}

function getTextPreview(segments: TranscriptSegment[]): string {
  const joined = segments
    .map((s) => decodeHtmlEntities(s.text))
    .join(" ");
  if (joined.length <= 150) return joined;
  return joined.slice(0, 150) + "...";
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function HistoryCard({
  transcript,
}: {
  transcript: HistoryTranscript;
}) {
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const text = formatTranscriptText(transcript.segments, false);
    navigator.clipboard.writeText(text).then(() => {
      toast("Copied to clipboard");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/transcript/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [transcript.id] }),
      });
      if (res.ok) {
        toast("Transcript deleted");
        router.refresh();
      } else {
        toast("Failed to delete transcript");
      }
    } catch {
      toast("Failed to delete transcript");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Link href={`/history/${transcript.id}`}>
      <Card className="group hover:bg-accent/50 transition-colors py-4">
        <CardContent className="flex items-start gap-4">
          {transcript.thumbnailUrl ? (
            <Image
              src={transcript.thumbnailUrl}
              alt={transcript.videoTitle}
              width={160}
              height={90}
              unoptimized
              className="shrink-0 rounded-md"
            />
          ) : (
            <div className="shrink-0 rounded-md bg-muted" style={{ width: 160, height: 90 }} />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold line-clamp-1 text-foreground group-hover:text-foreground/90 transition-colors">{transcript.videoTitle}</h3>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {getTextPreview(transcript.segments)}
            </p>
            <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatDate(transcript.savedAt)}</span>
                {transcript.videoDuration != null && (
                  <span className="rounded bg-muted px-1.5 py-0.5">
                    {formatTimestamp(transcript.videoDuration)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete transcript?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove this transcript from your
                        history. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        disabled={deleting}
                      >
                        {deleting ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
