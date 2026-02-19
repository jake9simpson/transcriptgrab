import { onMessage } from '@/utils/messaging';
import { PROD_URL, DEV_URL } from '@/utils/constants';
import type { TranscriptResponse, TranscriptSegment, SummaryData, SummaryResponse, SaveResult } from '@/utils/types';
import { checkAuthState, updateAuthBadge } from './auth';

const apiBase = import.meta.env.DEV ? DEV_URL : PROD_URL;

/** Auto-save transcript to user history (best-effort, non-blocking) */
async function autoSaveTranscript(
  videoId: string,
  transcript: { segments: TranscriptSegment[]; videoId: string },
  metadata?: { title: string; author: string }
): Promise<SaveResult> {
  try {
    // Check if already saved
    const checkRes = await fetch(
      `${apiBase}/api/transcript/check?videoId=${encodeURIComponent(videoId)}`,
      { credentials: 'include' }
    );
    const checkData = await checkRes.json();
    if (checkData.exists) {
      return { saved: false };
    }

    // Save transcript
    await fetch(`${apiBase}/api/transcript/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        videoId,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        videoTitle: metadata?.title ?? 'Unknown video',
        thumbnailUrl: null,
        videoDuration: null,
        segments: transcript.segments,
      }),
    });
    return { saved: true };
  } catch {
    return { saved: false };
  }
}

export default defineBackground(() => {
  // Handle auth check requests from content script
  onMessage('checkAuth', async () => {
    const isSignedIn = await checkAuthState();
    await updateAuthBadge(isSignedIn);
    return { isSignedIn };
  });

  // Handle transcript fetch requests from content script
  onMessage('getTranscript', async ({ data }): Promise<TranscriptResponse> => {
    const { videoId } = data;
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

    try {
      const [transcriptRes, metadataRes] = await Promise.all([
        fetch(`${apiBase}/api/transcript`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: youtubeUrl }),
        }),
        fetch(`${apiBase}/api/metadata?url=${encodeURIComponent(youtubeUrl)}`).catch(
          () => null
        ),
      ]);

      const transcriptData = await transcriptRes.json();

      if (!transcriptData.success || !transcriptData.data?.segments) {
        return {
          success: false,
          error: transcriptData.error || 'Failed to fetch transcript',
        };
      }

      let metadata: TranscriptResponse['metadata'];
      if (metadataRes) {
        try {
          const metadataData = await metadataRes.json();
          if (metadataData.success) {
            metadata = {
              title: metadataData.data.title,
              author: metadataData.data.author,
            };
          }
        } catch {
          // Metadata parsing failed; continue without it
        }
      }

      const response: TranscriptResponse = {
        success: true,
        transcript: {
          segments: transcriptData.data.segments,
          videoId,
        },
        metadata,
      };

      // Fire auto-save as non-blocking side effect for signed-in users
      checkAuthState().then((isSignedIn) => {
        if (isSignedIn && response.transcript) {
          autoSaveTranscript(videoId, response.transcript, metadata).catch(() => {});
        }
      }).catch(() => {});

      return response;
    } catch {
      return {
        success: false,
        error: 'Network error fetching transcript',
      };
    }
  });

  // In-memory summary cache (persists while service worker is alive)
  const summaryCache = new Map<string, { bullets: string; paragraph: string }>();

  // Handle summarize requests — calls Groq directly (no server round-trip)
  onMessage('summarize', async ({ data }): Promise<SummaryResponse> => {
    const { videoId, transcriptText } = data;

    // Check in-memory cache first
    const cached = summaryCache.get(videoId);
    if (cached) {
      return { success: true, data: cached };
    }

    try {
      const GROQ_KEY = import.meta.env.VITE_GROQ_KEY;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'You are a transcript summarizer. Given a YouTube video transcript, produce TWO summaries:\n\n1. BULLETS: 3-7 key takeaway bullet points. Each bullet should be a single concise sentence. Use "- " prefix.\n\n2. PARAGRAPH: A cohesive 3-5 sentence paragraph summary.\n\nFormat your response EXACTLY as:\nBULLETS:\n- [point 1]\n- [point 2]\n...\n\nPARAGRAPH:\n[paragraph text]',
            },
            { role: 'user', content: transcriptText.slice(0, 120000) },
          ],
          temperature: 0.3,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        return { success: false, error: 'Failed to generate summary' };
      }

      const json = await res.json();
      const text: string = json.choices?.[0]?.message?.content ?? '';

      // Parse BULLETS: and PARAGRAPH: sections
      const bulletMatch = text.match(/BULLETS:\s*([\s\S]*?)(?=PARAGRAPH:|$)/i);
      const paragraphMatch = text.match(/PARAGRAPH:\s*([\s\S]*?)$/i);
      const bullets = bulletMatch?.[1]?.trim() ?? '';
      const paragraph = paragraphMatch?.[1]?.trim() ?? '';

      const summaryData = { bullets: bullets || text, paragraph: paragraph || text };
      summaryCache.set(videoId, summaryData);
      return { success: true, data: summaryData };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { success: false, error: 'Summary timed out — try again' };
      }
      return { success: false, error: 'Failed to generate summary' };
    }
  });

  // Handle auto-save requests from content script
  onMessage('autoSave', async ({ data }): Promise<SaveResult> => {
    return autoSaveTranscript(data.videoId, data.transcript, data.metadata);
  });

  // Listen for cookie changes to update auth state reactively
  chrome.cookies.onChanged.addListener(async (changeInfo) => {
    const { domain, name } = changeInfo.cookie;
    const isRelevantDomain =
      domain.includes('transcriptgrab') || domain.includes('localhost');
    if (isRelevantDomain && name.includes('session-token')) {
      const isSignedIn = await checkAuthState();
      await updateAuthBadge(isSignedIn);
    }
  });

  // Check auth state on service worker startup
  checkAuthState().then(updateAuthBadge);
});
