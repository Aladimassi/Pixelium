export interface SavedCard {
  brand: string;
  icon: string;
  label: string;
  nameOnCard: string;
  last4: string;
  exp: string;
  nickname?: string;
  style?: string;
  accent?: string;
}

export const DEMO_EMAIL = 'demo@pixelium.com';

/** Pre-loaded card for the demo account only. */
export const DEMO_CARD: SavedCard = {
  brand: 'mastercard',
  icon: '◆',
  label: 'Mastercard',
  nameOnCard: 'Demo User',
  last4: '4242',
  exp: '12/28',
  nickname: 'Demo card',
  style: 'default',
  accent: 'orange',
};

/** @deprecated Use DEMO_CARD — kept for imports that expect DEFAULT_CARD */
export const DEFAULT_CARD = DEMO_CARD;

const CARD_KEY = 'pixelium_card';

export function isDemoUser(email?: string): boolean {
  return email?.trim().toLowerCase() === DEMO_EMAIL;
}

export function createEmptyCard(displayName = ''): SavedCard {
  return {
    brand: 'visa',
    icon: '▲',
    label: 'Visa',
    nameOnCard: displayName,
    last4: '',
    exp: '',
    nickname: 'My card',
    style: 'default',
    accent: 'orange',
  };
}

export function hasSavedCard(userId: string): boolean {
  try {
    return localStorage.getItem(`${CARD_KEY}_${userId}`) !== null;
  } catch {
    return false;
  }
}

export function ensureDemoCard(userId: string): void {
  if (!hasSavedCard(userId)) {
    saveSavedCard(userId, { ...DEMO_CARD });
  }
}

/** Returns saved card, demo card for demo user, or null if none configured yet. */
export function getSavedCard(userId?: string, userEmail?: string): SavedCard | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(`${CARD_KEY}_${userId}`);
    if (raw) {
      return { ...createEmptyCard(), ...JSON.parse(raw) } as SavedCard;
    }
    if (isDemoUser(userEmail)) {
      ensureDemoCard(userId);
      return { ...DEMO_CARD };
    }
    return null;
  } catch {
    return isDemoUser(userEmail) ? { ...DEMO_CARD } : null;
  }
}

/** Card for profile editor — empty form for new users, saved or demo otherwise. */
export function getCardForProfile(userId: string, userEmail: string, displayName: string): SavedCard {
  const saved = getSavedCard(userId, userEmail);
  if (saved) return saved;
  return createEmptyCard(displayName);
}

export function isCardComplete(card: SavedCard): boolean {
  return card.last4.trim().length === 4 && card.nameOnCard.trim().length > 0 && card.exp.trim().length >= 4;
}

export function saveSavedCard(userId: string, card: SavedCard): void {
  localStorage.setItem(`${CARD_KEY}_${userId}`, JSON.stringify(card));
}

export function cardDisplayLine(card: SavedCard): string {
  return `${card.label} ${card.icon} ·••• ${card.last4}`;
}

export const BRAND_OPTIONS = [
  { id: 'mastercard', label: 'Mastercard', icon: '◆' },
  { id: 'visa', label: 'Visa', icon: '▲' },
  { id: 'amex', label: 'Amex', icon: '●' },
  { id: 'paypal', label: 'PayPal', icon: 'P' },
];
