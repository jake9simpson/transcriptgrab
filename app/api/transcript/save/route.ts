import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { saveTranscript } from "@/lib/db/queries";

export const POST = auth(async function POST(req) {
  if (!req.auth?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Validate required fields
    const { videoId, videoUrl, videoTitle, thumbnailUrl, videoDuration, segments } = body;
    if (!videoId || !videoUrl || !videoTitle || !Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const result = await saveTranscript({
      userId: req.auth.user.id,
      videoId,
      videoUrl,
      videoTitle,
      thumbnailUrl: thumbnailUrl ?? null,
      videoDuration: typeof videoDuration === "number" ? videoDuration : null,
      segments,
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to save transcript" }, { status: 500 });
  }
});
