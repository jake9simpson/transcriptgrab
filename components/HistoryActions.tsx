"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, CheckSquare, X, Search, Copy, Download } from "lucide-react";
import JSZip from "jszip";
import { formatTranscriptText, decodeHtmlEntities } from "@/lib/format";
import { sanitizeFilename } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import HistoryCard from "@/components/HistoryCard";
import type { HistoryTranscript } from "@/components/HistoryCard";

type SortOption = "newest" | "oldest" | "titleAZ" | "titleZA";

function extractSnippet(segments: { text: string }[], term: string): string {
  const joined = segments.map((s) => decodeHtmlEntities(s.text)).join(" ");
  const lower = joined.toLowerCase();
  const idx = lower.indexOf(term);
  if (idx === -1) return "";
  const start = Math.max(0, idx - 40);
  const end = Math.min(joined.length, idx + term.length + 60);
  return joined.slice(start, end).trim();
}

export default function HistoryActions({
  transcripts,
}: {
  transcripts: HistoryTranscript[];
}) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const router = useRouter();

  const { filtered, snippets } = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const snippetMap = new Map<string, string>();

    const filtered = !term
      ? transcripts
      : transcripts.filter((t) => {
          if (
            t.videoTitle.toLowerCase().includes(term) ||
            t.videoUrl.toLowerCase().includes(term)
          ) {
            return true;
          }
          const joined = t.segments
            .map((s) => s.text)
            .join(" ")
            .toLowerCase();
          if (joined.includes(term)) {
            snippetMap.set(t.id, extractSnippet(t.segments, term));
            return true;
          }
          return false;
        });

    return { filtered, snippets: snippetMap };
  }, [transcripts, searchTerm]);

  const sortedTranscripts = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case "newest":
        return arr.sort(
          (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
        );
      case "oldest":
        return arr.sort(
          (a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime()
        );
      case "titleAZ":
        return arr.sort((a, b) =>
          a.videoTitle.localeCompare(b.videoTitle)
        );
      case "titleZA":
        return arr.sort((a, b) =>
          b.videoTitle.localeCompare(a.videoTitle)
        );
      default:
        return arr;
    }
  }, [filtered, sortBy]);

  function enterSelectionMode() {
    setSelectionMode(true);
    setSelected(new Set());
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelected(new Set());
  }

  function toggleSelection(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(sortedTranscripts.map((t) => t.id)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  async function handleBulkCopy() {
    const selectedTranscripts = sortedTranscripts.filter((t) =>
      selected.has(t.id)
    );
    const combined = selectedTranscripts
      .map((t) => `${t.videoTitle}\n\n${formatTranscriptText(t.segments, false)}`)
      .join("\n\n---\n\n");
    await navigator.clipboard.writeText(combined);
    toast(`Copied ${selected.size} transcript(s) to clipboard`);
  }

  async function handleBulkDownload() {
    const selectedTranscripts = sortedTranscripts.filter((t) =>
      selected.has(t.id)
    );
    const zip = new JSZip();
    const usedNames = new Map<string, number>();

    for (const t of selectedTranscripts) {
      const baseName = sanitizeFilename(t.videoTitle);
      const count = (usedNames.get(baseName) || 0) + 1;
      usedNames.set(baseName, count);
      const filename =
        count === 1 ? `${baseName}.txt` : `${baseName} (${count}).txt`;
      const content = `${t.videoTitle}\n\n${formatTranscriptText(t.segments, false)}`;
      zip.file(filename, content);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcripts.zip";
    a.click();
    URL.revokeObjectURL(url);
    toast(`Downloaded ${selected.size} transcript(s) as ZIP`);
  }

  async function handleBulkDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/transcript/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (res.ok) {
        toast(`Deleted ${selected.size} transcripts`);
        setSelected(new Set());
        setSelectionMode(false);
        router.refresh();
      } else {
        toast("Failed to delete transcripts");
      }
    } catch {
      toast("Failed to delete transcripts");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search transcripts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="titleAZ">Title A-Z</SelectItem>
            <SelectItem value="titleZA">Title Z-A</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between">
        {selectionMode ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">
              {selected.size} selected
            </span>
            <Button variant="outline" size="sm" onClick={selectAll}>
              Select All
            </Button>
            {selected.size > 0 && (
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Deselect All
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={selected.size === 0}
              onClick={handleBulkCopy}
            >
              <Copy className="mr-1.5 h-4 w-4" />
              Copy Selected
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selected.size === 0}
              onClick={handleBulkDownload}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Download Selected
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={selected.size === 0 || deleting}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Delete Selected
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete {selected.size} transcripts?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove {selected.size} transcripts from
                    your history. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleBulkDelete}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <div />
        )}
        {selectionMode ? (
          <Button variant="outline" size="sm" onClick={exitSelectionMode}>
            <X className="mr-1.5 h-4 w-4" />
            Cancel
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={enterSelectionMode}>
            <CheckSquare className="mr-1.5 h-4 w-4" />
            Select
          </Button>
        )}
      </div>

      {sortedTranscripts.length === 0 && searchTerm.trim() ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="text-muted-foreground">
            No transcripts match &ldquo;{searchTerm}&rdquo;
          </p>
          <button
            onClick={() => setSearchTerm("")}
            className="text-sm text-primary underline underline-offset-4"
          >
            Clear search
          </button>
        </div>
      ) : (
        sortedTranscripts.map((t) => (
          <div key={t.id} className="flex items-start gap-3">
            {selectionMode && (
              <Checkbox
                checked={selected.has(t.id)}
                onCheckedChange={(checked) =>
                  toggleSelection(t.id, Boolean(checked))
                }
                className="mt-5"
              />
            )}
            <div className="flex-1 min-w-0">
              <HistoryCard
                transcript={t}
                matchSnippet={snippets.get(t.id)}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
