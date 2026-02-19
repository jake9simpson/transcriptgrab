// Extension-local types (subset of web app's lib/types.ts)

export interface TranscriptSegment {
  text: string;
  start: number;   // seconds (float)
  duration: number; // seconds (float)
}

export interface VideoMetadata {
  title: string;
  author: string;
}

export interface TranscriptResponse {
  success: boolean;
  transcript?: {
    segments: TranscriptSegment[];
    videoId: string;
  };
  metadata?: VideoMetadata;
  error?: string;
}

export interface SummaryData {
  bullets: string;
  paragraph: string;
}

export interface SummaryResponse {
  success: boolean;
  data?: SummaryData;
  error?: string;
}

export interface SaveResult {
  saved: boolean;
}
