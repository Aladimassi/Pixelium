const TOKEN_KEY = 'pixelium_token';
const USER_KEY = 'pixelium_user';

export interface User {
  id: string;
  email: string;
  displayName?: string;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function readSession(): { loggedIn: boolean; user: User | null } {
  try {
    const loggedIn = isLoggedIn();
    const user = loggedIn ? getUser() : null;
    return { loggedIn: loggedIn && Boolean(user), user };
  } catch {
    clearSession();
    return { loggedIn: false, user: null };
  }
}

export function saveSession(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isLoggedIn(): boolean {
  return Boolean(getToken());
}

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getToken();
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
