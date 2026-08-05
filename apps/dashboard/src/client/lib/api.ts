import { authHeaders } from './auth';
import { blobToWav, detectSpeechLocale } from './audio-wav';

export interface ApiResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T;
}

export type ApiOptions = RequestInit & { timeoutMs?: number };

export async function api<T = Record<string, unknown>>(
  brokerUrl: string,
  path: string,
  opts: ApiOptions = {}
): Promise<ApiResult<T>> {
  const { timeoutMs = 60_000, ...fetchOpts } = opts;
  let res: Response;
  try {
    res = await fetch(`${brokerUrl}${path}`, {
      ...fetchOpts,
      headers: authHeaders({
        'Content-Type': 'application/json',
        ...(fetchOpts.headers as Record<string, string> | undefined),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const message =
      err instanceof DOMException && err.name === 'TimeoutError'
        ? `Request timed out after ${Math.round(timeoutMs / 1000)}s — ensure the broker is running (port 4000).`
        : err instanceof Error
          ? err.message
          : 'Network error';
    return { ok: false, status: 0, data: { error: message } as T };
  }
  let data: T;
  const body = await res.text();
  try {
    data = (body ? JSON.parse(body) : {}) as T;
  } catch {
    const hint =
      res.status === 404
        ? 'API endpoint not found — is the consent broker running on port 4000?'
        : res.status === 503
          ? 'Service unavailable — start MySQL (XAMPP) and restart the broker.'
          : `Invalid response (${res.status})`;
    data = { error: hint } as T;
  }
  return { ok: res.ok, status: res.status, data };
}

export async function transcribeAudio(
  brokerUrl: string,
  blob: Blob
): Promise<ApiResult<{ text?: string; error?: string }>> {
  const wavBlob = await blobToWav(blob);
  const form = new FormData();
  form.append('audio', wavBlob, 'voice.wav');
  const locale = detectSpeechLocale();
  if (locale) form.append('language', locale);

  let res: Response;
  try {
    res = await fetch(`${brokerUrl}/api/ai/transcribe`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
      signal: AbortSignal.timeout(90_000),
    });
  } catch (err) {
    const message =
      err instanceof DOMException && err.name === 'TimeoutError'
        ? 'Transcription timed out — the speech model may still be loading. Wait a moment and try again.'
        : err instanceof Error
          ? err.message
          : 'Transcription failed';
    return { ok: false, status: 0, data: { error: message } };
  }

  let data: { text?: string; error?: string };
  const body = await res.text();
  try {
    data = (body ? JSON.parse(body) : {}) as { text?: string; error?: string };
  } catch {
    data = {
      error:
        res.status === 404
          ? 'Transcription API not found — is the consent broker running on port 4000?'
          : `Invalid response (${res.status})`,
    };
  }
  return { ok: res.ok, status: res.status, data };
}

export async function loadBrokerConfig(): Promise<string> {
  const config = await fetch('/api/config').then((r) => r.json());
  return config.brokerUrl as string;
}
