import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { deleteTranscripts } from "@/lib/db/queries";

export const POST = auth(async function POST(req) {
  if (!req.auth?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Missing or empty ids array" },
        { status: 400 }
      );
    }

    const deleted = await deleteTranscripts(ids, req.auth.user.id);

    return NextResponse.json({ deleted });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete transcripts" },
      { status: 500 }
    );
  }
});
