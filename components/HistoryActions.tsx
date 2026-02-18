"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, CheckSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

export default function HistoryActions({
  transcripts,
}: {
  transcripts: HistoryTranscript[];
}) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

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
    setSelected(new Set(transcripts.map((t) => t.id)));
  }

  function deselectAll() {
    setSelected(new Set());
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
      <div className="flex items-center justify-between">
        {selectionMode ? (
          <div className="flex items-center gap-2">
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

      {transcripts.map((t) => (
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
            <HistoryCard transcript={t} />
          </div>
        </div>
      ))}
    </div>
  );
}
