"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Trash2, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import TranscriptViewer from "@/components/TranscriptViewer";
import TimestampToggle from "@/components/TimestampToggle";
import { formatTranscriptText, generateSRT } from "@/lib/format";
import { downloadFile, sanitizeFilename } from "@/lib/download";
import type { TranscriptSegment } from "@/lib/types";

type TranscriptFormat = "plain" | "timestamps" | "srt";

interface TranscriptDetailProps {
  transcriptId: string;
  videoTitle: string;
  segments: TranscriptSegment[];
}

export default function TranscriptDetail({
  transcriptId,
  videoTitle,
  segments,
}: TranscriptDetailProps) {
  const [format, setFormat] = useState<TranscriptFormat>("plain");
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const showTimestamps = format === "timestamps";

  function handleCopy() {
    let text: string;
    if (format === "srt") {
      text = generateSRT(segments);
    } else {
      text = formatTranscriptText(segments, format === "timestamps");
    }
    navigator.clipboard.writeText(text).then(() => {
      toast("Copied to clipboard");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    const baseName = sanitizeFilename(videoTitle);
    if (format === "srt") {
      downloadFile(generateSRT(segments), `${baseName}.srt`, "text/srt");
    } else {
      const text = formatTranscriptText(segments, format === "timestamps");
      downloadFile(text, `${baseName}.txt`, "text/plain");
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/transcript/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [transcriptId] }),
      });
      if (res.ok) {
        toast("Transcript deleted");
        router.push("/history");
      } else {
        toast("Failed to delete transcript");
      }
    } catch {
      toast("Failed to delete transcript");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select
          value={format}
          onValueChange={(value) => setFormat(value as TranscriptFormat)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="plain">Plain Text</SelectItem>
            <SelectItem value="timestamps">With Timestamps</SelectItem>
            <SelectItem value="srt">SRT Subtitles</SelectItem>
          </SelectContent>
        </Select>

        <TimestampToggle
          enabled={format === "timestamps"}
          onToggle={(enabled) => setFormat(enabled ? "timestamps" : "plain")}
        />

        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? (
            <Check className="mr-2 h-4 w-4" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>

        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete transcript?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove this transcript from your history.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <TranscriptViewer segments={segments} showTimestamps={showTimestamps} />
    </div>
  );
}
