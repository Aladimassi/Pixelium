const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const DEFAULT_MODEL = 'whisper-large-v3-turbo';

export function getGroqWhisperModel(): string {
  return process.env.GROQ_WHISPER_MODEL?.trim() || DEFAULT_MODEL;
}

export function isGroqWhisperConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

function isLikelyHallucination(text: string): boolean {
  const cleaned = text.toLowerCase().replace(/[^a-zàâäéèêëïîôùûüç0-9\s']/gi, '').trim();
  return (
    !cleaned ||
    cleaned === 'you' ||
    cleaned === 'thank you' ||
    cleaned === 'thanks for watching' ||
    cleaned === 'merci' ||
    cleaned === 'silence' ||
    cleaned === 'subtitle'
  );
}

export async function transcribeWithGroqWhisper(
  buffer: Buffer,
  mimeType: string,
  languageHint?: string
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new Error('Groq API key not configured');

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType || 'audio/wav' }), 'voice.wav');
  form.append('model', getGroqWhisperModel());
  form.append('response_format', 'json');
  form.append('temperature', '0');

  const lang = languageHint?.trim().toLowerCase();
  if (lang && lang.length >= 2) {
    form.append('language', lang.slice(0, 2));
  }

  const res = await fetch(GROQ_TRANSCRIBE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Groq Whisper HTTP ${res.status}${body ? `: ${body.slice(0, 160)}` : ''}`);
  }

  const data = (await res.json()) as { text?: string };
  const text = data.text?.trim() ?? '';

  if (!text || isLikelyHallucination(text)) {
    throw new Error('Could not understand the audio — speak clearly, closer to the mic, and try again');
  }

  return text;
}
