'use client';

import { useState } from 'react';
import { TranscriptSegment } from '@/lib/types';
import { formatTranscriptText, generateSRT } from '@/lib/format';
import { Button } from '@/components/ui/button';

interface ActionButtonsProps {
  segments: TranscriptSegment[];
  showTimestamps: boolean;
  videoTitle?: string;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]+/g, '').replace(/\s+/g, ' ').trim() || 'transcript';
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ActionButtons({ segments, showTimestamps, videoTitle }: ActionButtonsProps) {
  const [copied, setCopied] = useState(false);

  const baseName = sanitizeFilename(videoTitle || 'transcript');

  function handleCopy() {
    const text = formatTranscriptText(segments, showTimestamps);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownloadTxt() {
    const text = formatTranscriptText(segments, showTimestamps);
    downloadFile(text, `${baseName}.txt`, 'text/plain');
  }

  function handleDownloadSrt() {
    const srt = generateSRT(segments);
    downloadFile(srt, `${baseName}.srt`, 'text/srt');
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={handleCopy}>
        {copied ? 'Copied!' : 'Copy Transcript'}
      </Button>
      <Button variant="outline" onClick={handleDownloadTxt}>
        Download .txt
      </Button>
      <Button variant="outline" onClick={handleDownloadSrt}>
        Download .srt
      </Button>
    </div>
  );
}
