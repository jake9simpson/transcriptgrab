import { db } from "@/lib/db";
import { transcripts } from "@/lib/db/schema";
import type { TranscriptSegment } from "@/lib/types";

export async function saveTranscript(data: {
  userId: string;
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  thumbnailUrl: string | null;
  videoDuration: number | null;
  segments: TranscriptSegment[];
}) {
  const rows = await db
    .insert(transcripts)
    .values(data)
    .onConflictDoNothing({
      target: [transcripts.userId, transcripts.videoId],
    })
    .returning({ id: transcripts.id });

  return { inserted: rows.length > 0, id: rows[0]?.id ?? null };
}
