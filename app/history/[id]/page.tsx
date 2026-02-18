import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getTranscriptById } from "@/lib/db/queries";
import TranscriptDetail from "@/components/TranscriptDetail";
import Image from "next/image";
import Link from "next/link";
import { formatTimestamp } from "@/lib/format";
import { ArrowLeft } from "lucide-react";
import type { TranscriptSegment } from "@/lib/types";

export default async function TranscriptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const transcript = await getTranscriptById(id, session.user.id);
  if (!transcript) {
    notFound();
  }

  const segments = transcript.segments as TranscriptSegment[];
  const savedDate = new Date(transcript.savedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      <Link
        href="/history"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to History
      </Link>

      <div className="flex items-start gap-4">
        {transcript.thumbnailUrl && (
          <Image
            src={transcript.thumbnailUrl}
            alt={transcript.videoTitle}
            width={200}
            height={113}
            unoptimized
            className="shrink-0 rounded-lg"
          />
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{transcript.videoTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {savedDate}
            {transcript.videoDuration != null && (
              <>
                {" \u00B7 "}
                {formatTimestamp(transcript.videoDuration)}
              </>
            )}
          </p>
        </div>
      </div>

      <TranscriptDetail
        transcriptId={transcript.id}
        videoTitle={transcript.videoTitle}
        segments={segments}
      />
    </div>
  );
}
