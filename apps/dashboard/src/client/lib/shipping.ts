export interface ShippingAddress {
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  postalCode: string;
  country: string;
}

export type DeliveryOption = 'standard' | 'express';

export const DELIVERY_OPTIONS: Array<{
  id: DeliveryOption;
  label: string;
  eta: string;
  cents: number;
}> = [
  { id: 'standard', label: 'Standard delivery', eta: '3–5 business days', cents: 599 },
  { id: 'express', label: 'Express delivery', eta: '1–2 business days', cents: 1299 },
];

export const FREE_SHIPPING_THRESHOLD_CENTS = 5000;

const SHIPPING_KEY = 'pixelium_shipping';

export function emptyShippingAddress(displayName = ''): ShippingAddress {
  return {
    fullName: displayName,
    line1: '',
    line2: '',
    city: '',
    postalCode: '',
    country: 'France',
  };
}

export function isShippingComplete(addr: ShippingAddress): boolean {
  return (
    addr.fullName.trim().length > 1 &&
    addr.line1.trim().length > 3 &&
    addr.city.trim().length > 1 &&
    addr.postalCode.trim().length >= 4 &&
    addr.country.trim().length > 1
  );
}

export function getShippingAddress(userId?: string, displayName = ''): ShippingAddress {
  if (!userId) return emptyShippingAddress(displayName);
  try {
    const raw = localStorage.getItem(`${SHIPPING_KEY}_${userId}`);
    return raw
      ? { ...emptyShippingAddress(displayName), ...JSON.parse(raw) }
      : emptyShippingAddress(displayName);
  } catch {
    return emptyShippingAddress(displayName);
  }
}

export function saveShippingAddress(userId: string, addr: ShippingAddress): void {
  localStorage.setItem(`${SHIPPING_KEY}_${userId}`, JSON.stringify(addr));
}

export function shippingCostCents(subtotalCents: number, option: DeliveryOption): number {
  const base = DELIVERY_OPTIONS.find((o) => o.id === option)?.cents ?? 599;
  if (subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS) {
    return option === 'express' ? 699 : 0;
  }
  return base;
}

export function formatDeliverySummary(
  addr: ShippingAddress,
  option: DeliveryOption,
  shippingCents: number
): string {
  const opt = DELIVERY_OPTIONS.find((o) => o.id === option);
  const shipLine =
    shippingCents === 0 ? 'Free shipping' : `Shipping ${(shippingCents / 100).toFixed(2)} €`;
  return `${addr.fullName} · ${addr.line1}, ${addr.postalCode} ${addr.city} · ${opt?.label ?? option} (${opt?.eta ?? ''}) · ${shipLine}`;
}
