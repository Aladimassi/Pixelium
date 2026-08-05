export interface ProfilePrefs {
  avatar: string;
  tagline: string;
  accent: string;
}

export const DEFAULT_PROFILE: ProfilePrefs = {
  avatar: '₿',
  tagline: '',
  accent: 'orange',
};

export const AVATAR_OPTIONS = ['₿', '◆', '▲', '●', '★', '⚡', '🔒', '🛒'];

export const ACCENT_OPTIONS = [
  { id: 'orange', label: 'Bitcoin Orange', swatch: '#F7931A' },
  { id: 'gold', label: 'Digital Gold', swatch: '#FFD600' },
  { id: 'ember', label: 'Burnt Ember', swatch: '#EA580C' },
];

const PROFILE_KEY = 'pixelium_profile';

export function getProfilePrefs(userId?: string): ProfilePrefs {
  if (!userId) return { ...DEFAULT_PROFILE };
  try {
    const raw = localStorage.getItem(`${PROFILE_KEY}_${userId}`);
    return raw ? { ...DEFAULT_PROFILE, ...JSON.parse(raw) } : { ...DEFAULT_PROFILE };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveProfilePrefs(userId: string, prefs: ProfilePrefs): void {
  localStorage.setItem(`${PROFILE_KEY}_${userId}`, JSON.stringify(prefs));
}

export function applyAccentTheme(accentId: string): void {
  document.documentElement.dataset.accent = accentId || 'orange';
}
