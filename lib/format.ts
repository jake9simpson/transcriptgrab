import type { TranscriptSegment } from './types';

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

/**
 * Decode HTML entities in a string, including named and numeric entities.
 */
export function decodeHtmlEntities(text: string): string {
  // Named entities
  let result = text.replace(
    /&amp;|&lt;|&gt;|&quot;|&#39;|&apos;/g,
    (match) => HTML_ENTITIES[match]
  );

  // Decimal numeric entities: &#123;
  result = result.replace(/&#(\d+);/g, (_, code) =>
    String.fromCodePoint(parseInt(code, 10))
  );

  // Hex numeric entities: &#x1A;
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
    String.fromCodePoint(parseInt(hex, 16))
  );

  return result;
}

/**
 * Format seconds into a human-readable timestamp.
 * Under 1 hour: M:SS (e.g. 5:32)
 * 1 hour+: H:MM:SS (e.g. 1:05:32)
 */
export function formatTimestamp(seconds: number): string {
  const totalSeconds = Math.floor(seconds);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Format transcript segments into plain text, optionally with timestamps.
 */
export function formatTranscriptText(
  segments: TranscriptSegment[],
  showTimestamps: boolean
): string {
  return segments
    .map((seg) => {
      const text = decodeHtmlEntities(seg.text);
      if (showTimestamps) {
        return `[${formatTimestamp(seg.start)}] ${text}`;
      }
      return text;
    })
    .join('\n');
}

/**
 * Format seconds into SRT timestamp format: HH:MM:SS,mmm
 */
function formatSrtTimestamp(seconds: number): string {
  const totalMs = Math.round(seconds * 1000);
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Generate SRT subtitle format from transcript segments.
 */
export function generateSRT(segments: TranscriptSegment[]): string {
  return segments
    .map((seg, i) => {
      const startTs = formatSrtTimestamp(seg.start);
      const endTs = formatSrtTimestamp(seg.start + seg.duration);
      const text = decodeHtmlEntities(seg.text);
      return `${i + 1}\n${startTs} --> ${endTs}\n${text}`;
    })
    .join('\n\n');
}
