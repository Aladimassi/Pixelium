import { useCallback, useEffect, useRef, useState } from 'react';
import { transcribeAudio } from '../lib/api';

interface UseVoiceInputOptions {
  brokerUrl: string;
  value: string;
  onChange: (value: string) => void;
}

function pickRecorderMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export function useVoiceInput({ brokerUrl, value, onChange }: UseVoiceInputOptions) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const valueRef = useRef(value);
  const stopTimerRef = useRef<number | null>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    const hasMedia =
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== 'undefined';
    const secure = typeof window !== 'undefined' && window.isSecureContext;
    setSupported(hasMedia && secure);
    if (hasMedia && !secure) {
      setError('Voice input requires HTTPS. Open the store via https:// (not http://).');
    }
    return () => {
      if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stopListening = useCallback(() => {
    if (stopTimerRef.current) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
      return;
    }
    stopStream();
    setListening(false);
  }, [stopStream]);

  const startListening = useCallback(async () => {
    if (processing) return;

    setError(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;

      const mimeType = pickRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        setError('Recording failed. Try again.');
        stopStream();
        setListening(false);
      };

      recorder.onstop = async () => {
        stopStream();
        setListening(false);

        const rawType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, {
          type: rawType.split(';')[0].trim(),
        });

        if (blob.size < 800) {
          setError('Recording too short — tap the mic and speak for at least 1–2 seconds.');
          return;
        }

        setProcessing(true);
        let result: { ok: boolean; data: { text?: string; error?: string } };
        try {
          result = await transcribeAudio(brokerUrl, blob);
        } catch (err) {
          setProcessing(false);
          const msg = err instanceof Error ? err.message : '';
          if (msg.includes('too quiet') || msg.includes('Audio too quiet')) {
            setError('Mic level too low — speak louder, closer to the microphone.');
          } else if (msg.includes('too short')) {
            setError('Recording too short — tap the mic and speak for at least 1 second.');
          } else {
            setError('Could not prepare audio for transcription. Try again.');
          }
          return;
        }
        setProcessing(false);

        const { ok, data } = result;

        if (!ok || !data.text) {
          setError(data.error ?? 'Transcription failed. Try again in a quiet room.');
          return;
        }

        const spoken = data.text.trim();
        const prefix = valueRef.current.trim();
        onChange(prefix ? `${prefix} ${spoken}`.trim() : spoken);
      };

      recorder.start();
      setListening(true);

      stopTimerRef.current = window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, 12_000);
    } catch (err) {
      stopStream();
      setListening(false);
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('Microphone access denied. Allow the mic in browser settings and try again.');
      } else if (name === 'NotFoundError') {
        setError('No microphone found. Connect a mic or type your message instead.');
      } else {
        setError('Could not start recording. Check mic permissions and try again.');
      }
    }
  }, [brokerUrl, onChange, processing, stopStream]);

  const toggleListening = useCallback(() => {
    if (processing) return;
    if (listening) stopListening();
    else void startListening();
  }, [listening, processing, startListening, stopListening]);

  return {
    supported,
    listening,
    processing,
    error,
    toggleListening,
    stopListening,
  };
}
