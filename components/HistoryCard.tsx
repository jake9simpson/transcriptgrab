"use client";

import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { decodeHtmlEntities, formatTimestamp } from "@/lib/format";
import type { TranscriptSegment } from "@/lib/types";

interface HistoryTranscript {
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
  return (
    <Link href={`/history/${transcript.id}`}>
      <Card className="hover:bg-accent/50 transition-colors py-4">
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
            <h3 className="font-semibold line-clamp-1">{transcript.videoTitle}</h3>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {getTextPreview(transcript.segments)}
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatDate(transcript.savedAt)}</span>
              {transcript.videoDuration != null && (
                <span className="rounded bg-muted px-1.5 py-0.5">
                  {formatTimestamp(transcript.videoDuration)}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
