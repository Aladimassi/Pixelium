import type { CatalogSort } from '../components/ShopView';
import type { DeliveryOption } from './shipping';

export interface ProfilePrefs {
  avatar: string;
  tagline: string;
  accent: string;
  defaultDelivery: DeliveryOption;
  defaultSort: CatalogSort;
  inStockOnlyDefault: boolean;
  emailReceipts: boolean;
  reduceMotion: boolean;
  compactShop: boolean;
}

export const DEFAULT_PROFILE: ProfilePrefs = {
  avatar: '🙂',
  tagline: '',
  accent: 'orange',
  defaultDelivery: 'standard',
  defaultSort: 'popular',
  inStockOnlyDefault: false,
  emailReceipts: true,
  reduceMotion: false,
  compactShop: false,
};

export const AVATAR_OPTIONS = ['🙂', '⭐', '🛍️', '🌟', '🎯', '💡', '🎨', '🔒'];

export const ACCENT_OPTIONS = [
  { id: 'orange', label: 'Bitcoin Orange', swatch: '#F7931A' },
  { id: 'gold', label: 'Digital Gold', swatch: '#FFD600' },
  { id: 'ember', label: 'Burnt Ember', swatch: '#EA580C' },
];

export const SORT_OPTIONS: Array<{ id: CatalogSort; label: string }> = [
  { id: 'popular', label: 'Most popular' },
  { id: 'name-asc', label: 'Name A → Z' },
  { id: 'name-desc', label: 'Name Z → A' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
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

export function applyDisplaySettings(prefs: Pick<ProfilePrefs, 'reduceMotion' | 'compactShop'>): void {
  document.documentElement.dataset.reduceMotion = prefs.reduceMotion ? 'true' : 'false';
  document.documentElement.dataset.compactShop = prefs.compactShop ? 'true' : 'false';
}
