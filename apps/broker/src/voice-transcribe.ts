import { getGroqWhisperModel, isGroqWhisperConfigured, transcribeWithGroqWhisper } from './groq-whisper.js';
import { getWhisperModelName, initWhisperModel, transcribeWithLocalWhisper } from './local-whisper.js';

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

export function isVoiceTranscribeConfigured(): boolean {
  return isGroqWhisperConfigured() || true;
}

export function getVoiceTranscribeModel(): string {
  if (isGroqWhisperConfigured()) {
    return `${getGroqWhisperModel()} (Groq)`;
  }
  return getWhisperModelName();
}

export function usesGroqWhisper(): boolean {
  return isGroqWhisperConfigured();
}

export async function warmWhisperModel(): Promise<string> {
  if (isGroqWhisperConfigured()) return getGroqWhisperModel();
  return initWhisperModel();
}

export async function transcribeAudioBuffer(
  buffer: Buffer,
  mimeType: string,
  languageHint?: string
): Promise<string> {
  if (buffer.length === 0) throw new Error('Empty audio recording');
  if (buffer.length > MAX_AUDIO_BYTES) throw new Error('Recording too long — try a shorter phrase');

  if (isGroqWhisperConfigured()) {
    try {
      return await transcribeWithGroqWhisper(buffer, mimeType, languageHint);
    } catch (err) {
      console.warn(
        '[voice] Groq Whisper failed, falling back to local model:',
        err instanceof Error ? err.message : err
      );
    }
  }

  return transcribeWithLocalWhisper(buffer, mimeType, languageHint);
}
