import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserTranscripts } from "@/lib/db/queries";
import HistoryCard from "@/components/HistoryCard";

export default async function HistoryPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const transcripts = await getUserTranscripts(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Your Transcripts</h1>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium text-muted-foreground">
          {transcripts.length}
        </span>
      </div>

      {transcripts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <p className="text-muted-foreground">
            No saved transcripts yet. Grab a transcript to see it here.
          </p>
          <Link
            href="/"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Back to TranscriptGrab
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {transcripts.map((t) => (
            <HistoryCard key={t.id} transcript={t} />
          ))}
        </div>
      )}
    </div>
  );
}
