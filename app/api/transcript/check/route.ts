import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getTranscriptByVideoId } from "@/lib/db/queries";

export const GET = auth(async function GET(req) {
  if (!req.auth?.user?.id) {
    return NextResponse.json({ exists: false, transcriptId: null });
  }

  const videoId = new URL(req.url).searchParams.get("videoId");
  if (!videoId) {
    return NextResponse.json({ exists: false, transcriptId: null });
  }

  try {
    const existing = await getTranscriptByVideoId(req.auth.user.id, videoId);
    return NextResponse.json({
      exists: !!existing,
      transcriptId: existing?.id ?? null,
    });
  } catch {
    return NextResponse.json(
      { exists: false, transcriptId: null },
      { status: 500 }
    );
  }
});
