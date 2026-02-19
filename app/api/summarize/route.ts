import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getSummaryByVideoId, saveSummary } from "@/lib/db/queries";
import { generateSummary } from "@/lib/summarize";

export const maxDuration = 30;

export const POST = auth(async function POST(req) {
  if (!req.auth?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { videoId, transcriptText } = body;

    if (!videoId || !transcriptText) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check DB cache first (global, not per-user)
    const cached = await getSummaryByVideoId(videoId);
    if (cached) {
      return NextResponse.json({
        success: true,
        data: { bullets: cached.bullets, paragraph: cached.paragraph },
      });
    }

    // Call Gemini on cache miss
    const { bullets, paragraph } = await generateSummary(transcriptText);

    // Store result in DB for future requests
    await saveSummary({ videoId, bullets, paragraph });

    return NextResponse.json({
      success: true,
      data: { bullets, paragraph },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Handle Gemini rate limit errors
    if (message.includes("429") || message.toLowerCase().includes("quota")) {
      return NextResponse.json(
        { success: false, error: "Summary temporarily unavailable" },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to generate summary" },
      { status: 500 }
    );
  }
});
