import { pipeline } from '@xenova/transformers';

const DEFAULT_MODEL = 'Xenova/whisper-small';

type WhisperResult = { text?: string; chunks?: Array<{ text?: string }> } | string;

type WhisperPipeline = (
  audio: Float32Array | { raw: Float32Array; sampling_rate: number },
  options?: {
    chunk_length_s?: number;
    stride_length_s?: number;
    language?: string;
    task?: string;
    return_timestamps?: boolean;
  }
) => Promise<WhisperResult>;

let transcriber: WhisperPipeline | null = null;
let modelName = DEFAULT_MODEL;

function getModelName(): string {
  return process.env.WHISPER_MODEL?.trim() || DEFAULT_MODEL;
}

export function getWhisperModelName(): string {
  return modelName;
}

export async function initWhisperModel(): Promise<string> {
  modelName = getModelName();
  if (transcriber) return modelName;

  transcriber = (await pipeline('automatic-speech-recognition', modelName, {
    quantized: true,
  })) as WhisperPipeline;
  return modelName;
}

function findWavDataOffset(buffer: Buffer): number {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF') {
    throw new Error('Invalid WAV audio — try recording again');
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === 'data') return offset + 8;
    offset += 8 + chunkSize;
  }

  return 44;
}

function decodeWav(buffer: Buffer): { samples: Float32Array; sampling_rate: number } {
  const sampleRate = buffer.readUInt32LE(24);
  const bitsPerSample = buffer.readUInt16LE(34);
  const dataOffset = findWavDataOffset(buffer);
  const bytesPerSample = bitsPerSample / 8;
  const numSamples = Math.floor((buffer.length - dataOffset) / bytesPerSample);
  const samples = new Float32Array(numSamples);

  if (bitsPerSample === 16) {
    for (let i = 0; i < numSamples; i++) {
      samples[i] = buffer.readInt16LE(dataOffset + i * 2) / 0x8000;
    }
  } else if (bitsPerSample === 32) {
    for (let i = 0; i < numSamples; i++) {
      samples[i] = buffer.readFloatLE(dataOffset + i * 4);
    }
  } else {
    throw new Error('Unsupported WAV format — try recording again');
  }

  return { samples: normalizeSamples(samples), sampling_rate: sampleRate };
}

function normalizeSamples(samples: Float32Array): Float32Array {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    peak = Math.max(peak, Math.abs(samples[i] ?? 0));
  }

  if (peak < 0.002) {
    throw new Error('Recording too quiet — move closer to the mic and speak louder');
  }

  const gain = Math.min(10, 0.9 / peak);
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = Math.max(-1, Math.min(1, (samples[i] ?? 0) * gain));
  }
  return out;
}

function extractText(result: WhisperResult): string {
  if (typeof result === 'string') return result.trim();
  const direct = result.text?.trim();
  if (direct) return direct;
  const fromChunks = result.chunks?.map((c) => c.text?.trim()).filter(Boolean).join(' ').trim();
  return fromChunks ?? '';
}

const WHISPER_LANGUAGES: Record<string, string> = {
  fr: 'french',
  en: 'english',
  es: 'spanish',
  de: 'german',
  it: 'italian',
  pt: 'portuguese',
  ar: 'arabic',
  zh: 'chinese',
  ja: 'japanese',
  nl: 'dutch',
  pl: 'polish',
  ru: 'russian',
};

function resolveLanguageHint(languageHint?: string): string | undefined {
  if (!languageHint?.trim()) return undefined;
  const code = languageHint.trim().toLowerCase();
  return WHISPER_LANGUAGES[code] ?? code;
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

async function runWhisperPass(
  transcriberFn: WhisperPipeline,
  samples: Float32Array,
  sampling_rate: number,
  language?: string
): Promise<string> {
  const durationSec = samples.length / sampling_rate;
  const result = await transcriberFn(
    { raw: samples, sampling_rate },
    {
      chunk_length_s: Math.min(30, Math.max(8, Math.ceil(durationSec) + 2)),
      stride_length_s: 3,
      task: 'transcribe',
      ...(language ? { language } : {}),
    }
  );
  return extractText(result);
}

export async function transcribeWithLocalWhisper(
  buffer: Buffer,
  mimeType: string,
  languageHint?: string
): Promise<string> {
  if (!transcriber) await initWhisperModel();

  const cleanMime = mimeType.split(';')[0]?.trim().toLowerCase() || 'audio/wav';
  if (!cleanMime.includes('wav')) {
    throw new Error('Voice input must be sent as WAV audio');
  }

  const { samples, sampling_rate } = decodeWav(buffer);
  if (samples.length < 8000) {
    throw new Error('Recording too short — speak for at least 1 second');
  }

  const hintedLanguage = languageHint ? resolveLanguageHint(languageHint) : undefined;
  let text = await runWhisperPass(transcriber!, samples, sampling_rate, hintedLanguage);

  if ((!text || isLikelyHallucination(text)) && hintedLanguage) {
    text = await runWhisperPass(transcriber!, samples, sampling_rate);
  }

  if (!text || isLikelyHallucination(text)) {
    throw new Error('Could not understand the audio — speak clearly, closer to the mic, and try again');
  }

  return text;
}
