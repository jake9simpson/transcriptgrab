import { defineExtensionMessaging } from '@webext-core/messaging';
import type { TranscriptResponse, TranscriptSegment, SummaryResponse, SaveResult } from './types';

interface ProtocolMap {
  getTranscript(data: { videoId: string; languageCode?: string }): TranscriptResponse;
  checkAuth(): { isSignedIn: boolean };
  summarize(data: { videoId: string; transcriptText: string }): SummaryResponse;
  autoSave(data: { videoId: string; transcript: { segments: TranscriptSegment[]; videoId: string }; metadata?: { title: string; author: string } }): SaveResult;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
