import { eq, desc, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { transcripts, summaries } from "@/lib/db/schema";
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

export async function getUserTranscripts(userId: string) {
  return db
    .select()
    .from(transcripts)
    .where(eq(transcripts.userId, userId))
    .orderBy(desc(transcripts.savedAt));
}

export async function getTranscriptById(id: string, userId: string) {
  const rows = await db
    .select()
    .from(transcripts)
    .where(and(eq(transcripts.id, id), eq(transcripts.userId, userId)))
    .limit(1);

  return rows[0] ?? null;
}

export async function getTranscriptByVideoId(userId: string, videoId: string) {
  const rows = await db
    .select({ id: transcripts.id, savedAt: transcripts.savedAt })
    .from(transcripts)
    .where(and(eq(transcripts.userId, userId), eq(transcripts.videoId, videoId)))
    .limit(1);

  return rows[0] ?? null;
}

export async function deleteTranscripts(
  ids: string[],
  userId: string
): Promise<number> {
  const rows = await db
    .delete(transcripts)
    .where(and(inArray(transcripts.id, ids), eq(transcripts.userId, userId)))
    .returning({ id: transcripts.id });

  return rows.length;
}

export async function getSummaryByVideoId(videoId: string) {
  const rows = await db
    .select()
    .from(summaries)
    .where(eq(summaries.videoId, videoId))
    .limit(1);
  return rows[0] ?? null;
}

export async function saveSummary(data: {
  videoId: string;
  bullets: string;
  paragraph: string;
}) {
  return db
    .insert(summaries)
    .values(data)
    .onConflictDoNothing({ target: [summaries.videoId] })
    .returning({ id: summaries.id });
}
