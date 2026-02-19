"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Trash2, Check, Download, Search, ChevronUp, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const showTimestamps = format === "timestamps";

  const handleMatchCountChange = useCallback((count: number) => {
    setMatchCount(count);
    setCurrentMatchIndex(0);
  }, []);

  function handlePrevMatch() {
    if (matchCount === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + matchCount) % matchCount);
  }

  function handleNextMatch() {
    if (matchCount === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % matchCount);
  }

  function handleClearSearch() {
    setSearchQuery("");
    setCurrentMatchIndex(0);
    setMatchCount(0);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        handlePrevMatch();
      } else {
        handleNextMatch();
      }
    }
    if (e.key === "Escape") {
      handleClearSearch();
      searchInputRef.current?.blur();
    }
  }

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

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search in transcript..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {searchQuery.trim() && (
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {matchCount === 0
                ? "No matches"
                : `${currentMatchIndex + 1} of ${matchCount}`}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handlePrevMatch}
              disabled={matchCount === 0}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleNextMatch}
              disabled={matchCount === 0}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <TranscriptViewer
        segments={segments}
        showTimestamps={showTimestamps}
        searchQuery={searchQuery}
        currentMatchIndex={currentMatchIndex}
        onMatchCountChange={handleMatchCountChange}
      />
    </div>
  );
}
