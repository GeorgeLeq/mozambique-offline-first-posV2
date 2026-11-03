/**
 * @file museVoiceClient.ts
 * @description Meta MUSE Voice Transcribe Client Service for SYCOMM POS (Meta Developer Hackathon).
 * Pure speech-to-text audio processing using Meta's MUSE Voice Transcribe endpoint.
 * Zero presets / Zero mock hardcoding:
 * - Online: Transcribes actual spoken audio directly via Meta MUSE Voice Transcribe.
 * - Offline / Missing Key: Explicitly returns offline status (no random preset sentences).
 */

import { transcribeMuseVoiceAudio, isMuseOnline, getMuseApiKey } from './museClient';

export interface TranscribeResult {
  text: string;
  confidence: number;
  durationSeconds?: number;
  isMock?: boolean;
  isOffline?: boolean;
}

export type VoiceContextMode = 'cash_up' | 'petty_cash' | 'pos_search' | 'generic';

/**
 * Sends recorded audio directly to Meta MUSE Voice Transcribe.
 * Zero presets - returns actual transcribed speech only.
 */
export async function transcribeAudio(
  audioBlob: Blob,
  contextMode: VoiceContextMode = 'generic',
  language: string = 'pt'
): Promise<TranscribeResult> {
  const isOnline = isMuseOnline();
  const apiKey = getMuseApiKey();

  // Strict Offline & Missing Key Gate: No presets returned when offline
  if (!isOnline || !apiKey) {
    console.log('[MuseVoiceClient] Meta MUSE Voice is OFFLINE or API key missing. Voice transcription blocked.');
    return {
      text: '',
      confidence: 0,
      durationSeconds: Math.max(1, Math.round(audioBlob.size / 16000)),
      isMock: false,
      isOffline: true,
    };
  }

  try {
    const res = await transcribeMuseVoiceAudio(audioBlob, contextMode, language);
    return {
      text: res.text,
      confidence: res.confidence,
      durationSeconds: res.durationSeconds,
      isMock: false,
      isOffline: res.isOffline
    };
  } catch (err) {
    console.warn('[MuseVoiceClient] Error calling Meta MUSE Voice:', err);
    return {
      text: '',
      confidence: 0,
      isMock: false,
      isOffline: true
    };
  }
}
