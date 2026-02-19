'use client';

import { useEffect, useRef, useCallback } from 'react';
import { TranscriptSegment } from '@/lib/types';
import { decodeHtmlEntities, formatTimestamp } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  showTimestamps: boolean;
  searchQuery?: string;
  currentMatchIndex?: number;
  onMatchCountChange?: (count: number) => void;
}

export default function TranscriptViewer({
  segments,
  showTimestamps,
  searchQuery = '',
  currentMatchIndex = 0,
  onMatchCountChange,
}: TranscriptViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastReportedCount = useRef(-1);

  const reportMatchCount = useCallback(
    (count: number) => {
      if (count !== lastReportedCount.current) {
        lastReportedCount.current = count;
        onMatchCountChange?.(count);
      }
    },
    [onMatchCountChange]
  );

  // Count total matches across all segments
  const query = searchQuery.trim().toLowerCase();
  let globalMatchIndex = 0;
  const segmentData = segments.map((segment) => {
    const decoded = decodeHtmlEntities(segment.text);
    if (!query) return { decoded, parts: [{ text: decoded, isMatch: false, matchIndex: -1 }] };

    const parts: { text: string; isMatch: boolean; matchIndex: number }[] = [];
    const lower = decoded.toLowerCase();
    let lastIndex = 0;

    let searchFrom = 0;
    while (searchFrom < lower.length) {
      const idx = lower.indexOf(query, searchFrom);
      if (idx === -1) break;
      if (idx > lastIndex) {
        parts.push({ text: decoded.slice(lastIndex, idx), isMatch: false, matchIndex: -1 });
      }
      parts.push({
        text: decoded.slice(idx, idx + query.length),
        isMatch: true,
        matchIndex: globalMatchIndex++,
      });
      lastIndex = idx + query.length;
      searchFrom = lastIndex;
    }

    if (lastIndex < decoded.length) {
      parts.push({ text: decoded.slice(lastIndex), isMatch: false, matchIndex: -1 });
    }

    if (parts.length === 0) {
      parts.push({ text: decoded, isMatch: false, matchIndex: -1 });
    }

    return { decoded, parts };
  });

  const totalMatches = globalMatchIndex;

  useEffect(() => {
    reportMatchCount(totalMatches);
  }, [totalMatches, reportMatchCount]);

  // Scroll the current match into view
  useEffect(() => {
    if (!query || totalMatches === 0) return;
    const el = containerRef.current?.querySelector(`[data-match-index="${currentMatchIndex}"]`);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [currentMatchIndex, query, totalMatches]);

  return (
    <Card className="py-0 overflow-hidden">
      <CardContent className="p-0">
        <ScrollArea className="h-[60vh]">
          <div ref={containerRef} className="p-4 font-mono text-sm leading-relaxed">
            {segments.map((segment, i) => (
              <p key={i} className="mb-1">
                {showTimestamps && (
                  <span className="mr-2 text-muted-foreground">
                    [{formatTimestamp(segment.start)}]
                  </span>
                )}
                {segmentData[i].parts.map((part, j) =>
                  part.isMatch ? (
                    <mark
                      key={j}
                      data-match-index={part.matchIndex}
                      className={
                        part.matchIndex === currentMatchIndex
                          ? 'bg-orange-400 text-foreground rounded-sm px-0.5'
                          : 'bg-yellow-300 dark:bg-yellow-600 text-foreground rounded-sm px-0.5'
                      }
                    >
                      {part.text}
                    </mark>
                  ) : (
                    <span key={j}>{part.text}</span>
                  )
                )}
              </p>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
