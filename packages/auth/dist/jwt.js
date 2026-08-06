import jwt from 'jsonwebtoken';

const DEV_SECRET = 'pixelium-dev-jwt-secret-change-in-production';

const PLACEHOLDER_SECRETS = new Set([
  DEV_SECRET,
  'change-me-to-a-long-random-secret',
  'change-to-long-random-string',
  'your-long-random-jwt-secret',
]);

function resolveJwtSecret() {
  const configured = process.env.JWT_SECRET?.trim();

  if (process.env.NODE_ENV === 'production') {
    if (!configured) {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    if (PLACEHOLDER_SECRETS.has(configured)) {
      throw new Error('JWT_SECRET must not use a default or placeholder value in production');
    }
    if (configured.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters in production');
    }
    return configured;
  }

  return configured || DEV_SECRET;
}

const JWT_SECRET = resolveJwtSecret();

export function signToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.displayName,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
