'use client';

import { TranscriptSegment } from '@/lib/types';
import { decodeHtmlEntities, formatTimestamp } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  showTimestamps: boolean;
}

export default function TranscriptViewer({ segments, showTimestamps }: TranscriptViewerProps) {
  return (
    <Card className="py-0 overflow-hidden">
      <CardContent className="p-0">
        <ScrollArea className="h-[60vh]">
          <div className="p-4 font-mono text-sm leading-relaxed">
            {segments.map((segment, i) => (
              <p key={i} className="mb-1">
                {showTimestamps && (
                  <span className="mr-2 text-muted-foreground">
                    [{formatTimestamp(segment.start)}]
                  </span>
                )}
                {decodeHtmlEntities(segment.text)}
              </p>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
