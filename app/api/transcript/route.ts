import { NextRequest, NextResponse } from 'next/server';
import { extractVideoId, fetchTranscript } from '@/lib/youtube';
import type { TranscriptAPIResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, languageCode } = body as { url: string; languageCode?: string };

    if (!url || typeof url !== 'string') {
      return NextResponse.json<TranscriptAPIResponse>(
        { success: false, error: 'Please enter a valid YouTube URL', errorType: 'INVALID_URL' },
        { status: 400 },
      );
    }

    const videoId = extractVideoId(url);

    if (!videoId) {
      return NextResponse.json<TranscriptAPIResponse>(
        { success: false, error: 'Please enter a valid YouTube URL', errorType: 'INVALID_URL' },
        { status: 400 },
      );
    }

    const data = await fetchTranscript(videoId, languageCode);

    return NextResponse.json<TranscriptAPIResponse>({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const lower = message.toLowerCase();

    let errorType: 'NO_CAPTIONS' | 'VIDEO_UNAVAILABLE' | 'RATE_LIMITED' | 'NETWORK_ERROR';

    if (lower.includes('disabled') || lower.includes('login_required') || lower.includes('login required')) {
      errorType = 'NO_CAPTIONS';
    } else if (lower.includes('unavailable')) {
      errorType = 'VIDEO_UNAVAILABLE';
    } else if (lower.includes('too many') || lower.includes('rate limit')) {
      errorType = 'RATE_LIMITED';
    } else {
      errorType = 'NETWORK_ERROR';
    }

    return NextResponse.json<TranscriptAPIResponse>(
      { success: false, error: message, errorType },
      { status: errorType === 'RATE_LIMITED' ? 429 : 400 },
    );
  }
}
