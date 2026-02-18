import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function HistoryPage() {
  const session = await auth();

  if (!session) {
    redirect("/");
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <h1 className="text-2xl font-semibold">History</h1>
      <p className="text-muted-foreground">
        Your saved transcripts will appear here.
      </p>
    </div>
  );
}
