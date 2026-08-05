import Groq from 'groq-sdk';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isTransientGroqError(msg: string): boolean {
  return /premature close|invalid response body|ECONNRESET|ETIMEDOUT|socket hang up|fetch failed|aborted/i.test(
    msg
  );
}

async function callViaSdk(
  apiKey: string,
  model: string,
  system: string,
  user: string,
  temperature: number
) {
  const groq = new Groq({ apiKey, maxRetries: 2, timeout: 45_000 });
  return groq.chat.completions.create({
    model,
    temperature,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
}

async function callViaFetch(
  apiKey: string,
  model: string,
  system: string,
  user: string,
  temperature: number
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Connection: 'close',
      },
      body: JSON.stringify({
        model,
        temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 120)}` : ''}`);
    }
    return (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
  } finally {
    clearTimeout(timer);
  }
}

export async function requestGroqJsonCompletion(options: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  temperature?: number;
  fallbackModels?: string[];
}): Promise<{ content: string; model: string }> {
  const temperature = options.temperature ?? 0.4;
  const models = [options.model, ...(options.fallbackModels ?? ['llama-3.1-8b-instant'])];
  let lastError = '';

  for (const model of models) {
    const attempts = [
      () => callViaSdk(options.apiKey, model, options.system, options.user, temperature),
      () => callViaFetch(options.apiKey, model, options.system, options.user, temperature),
    ];

    for (let i = 0; i < attempts.length; i++) {
      try {
        const completion = await attempts[i]();
        const content = completion.choices?.[0]?.message?.content ?? '{}';
        return { content, model };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (i < attempts.length - 1 && isTransientGroqError(lastError)) {
          await sleep(400);
        }
      }
    }
    if (isTransientGroqError(lastError)) await sleep(600);
  }

  throw new Error(lastError || 'Groq request failed');
}

export type GroqChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

async function callChatViaSdk(
  apiKey: string,
  model: string,
  messages: GroqChatMessage[],
  temperature: number,
  jsonMode: boolean
) {
  const groq = new Groq({ apiKey, maxRetries: 2, timeout: 45_000 });
  return groq.chat.completions.create({
    model,
    temperature,
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    messages,
  });
}

async function callChatViaFetch(
  apiKey: string,
  model: string,
  messages: GroqChatMessage[],
  temperature: number,
  jsonMode: boolean
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Connection: 'close',
      },
      body: JSON.stringify({
        model,
        temperature,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 120)}` : ''}`);
    }
    return (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
  } finally {
    clearTimeout(timer);
  }
}

export async function requestGroqChatCompletion(options: {
  apiKey: string;
  model: string;
  messages: GroqChatMessage[];
  temperature?: number;
  jsonMode?: boolean;
  fallbackModels?: string[];
}): Promise<{ content: string; model: string }> {
  const temperature = options.temperature ?? 0.45;
  const jsonMode = options.jsonMode ?? false;
  const models = [options.model, ...(options.fallbackModels ?? ['llama-3.1-8b-instant'])];
  let lastError = '';

  for (const model of models) {
    const attempts = [
      () => callChatViaSdk(options.apiKey, model, options.messages, temperature, jsonMode),
      () => callChatViaFetch(options.apiKey, model, options.messages, temperature, jsonMode),
    ];

    for (let i = 0; i < attempts.length; i++) {
      try {
        const completion = await attempts[i]();
        const content = completion.choices?.[0]?.message?.content ?? '';
        return { content, model };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (i < attempts.length - 1 && isTransientGroqError(lastError)) {
          await sleep(400);
        }
      }
    }
    if (isTransientGroqError(lastError)) await sleep(600);
  }

  throw new Error(lastError || 'Groq request failed');
}
