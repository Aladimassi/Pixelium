import type { Request, Response, NextFunction } from 'express';

type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0]?.trim() || 'unknown';
  if (Array.isArray(fwd)) return fwd[0]?.trim() ?? 'unknown';
  return req.socket.remoteAddress ?? 'unknown';
}

/** Simple in-memory rate limiter (per IP + route name). */
export function createRateLimiter(opts: { windowMs: number; max: number; name: string }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${opts.name}:${clientIp(req)}`;
    const now = Date.now();
    let entry = buckets.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > opts.max) {
      res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfterMs: Math.max(0, entry.resetAt - now),
      });
      return;
    }
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now >= entry.resetAt) buckets.delete(key);
  }
}, 60_000).unref?.();

export const loginRateLimit = createRateLimiter({
  name: 'auth-login',
  windowMs: 15 * 60 * 1000,
  max: 8,
});

export const forgotPasswordRateLimit = createRateLimiter({
  name: 'auth-forgot',
  windowMs: 15 * 60 * 1000,
  max: 5,
});

export const registerRateLimit = createRateLimiter({
  name: 'auth-register',
  windowMs: 60 * 60 * 1000,
  max: 10,
});
