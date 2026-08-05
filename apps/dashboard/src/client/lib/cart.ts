import type { SyntheticEvent } from 'react';
import { productImageFallbackUrl, resolveProductImageUrl } from '@pixelium/shared/product-images';

const CART_KEY = 'pixelium_cart';
const LEGACY_CART_KEY = 'pixelium_cart';

export interface CartItem {
  sku: string;
  quantity: number;
}

export interface Product {
  sku: string;
  name: string;
  category: string;
  description?: string;
  priceCents: number;
  inStock: number;
  imageUrl?: string;
}

function cartKey(userId?: string): string | null {
  if (!userId) return null;
  return `${CART_KEY}_${userId}`;
}

/** Drop old shared cart key from before per-user carts. */
export function discardLegacySharedCart(): void {
  try {
    localStorage.removeItem(LEGACY_CART_KEY);
  } catch {
    /* ignore */
  }
}

export function productImageUrl(
  product: Pick<Product, 'sku' | 'imageUrl' | 'name'> & { category?: string; description?: string }
): string {
  return resolveProductImageUrl(product);
}

export function productImageFallback(sku: string): string {
  return productImageFallbackUrl(sku);
}

/** Use on `<img onError={handleProductImageError} />` when a remote photo fails. */
export function handleProductImageError(e: SyntheticEvent<HTMLImageElement>): void {
  const img = e.currentTarget;
  if (img.dataset.fallbackApplied === '1') return;
  img.dataset.fallbackApplied = '1';
  const sku = img.dataset.sku;
  if (sku) img.src = productImageFallbackUrl(sku);
}

export function loadCart(userId?: string): CartItem[] {
  const key = cartKey(userId);
  if (!key) return [];
  try {
    return JSON.parse(localStorage.getItem(key) || '[]') as CartItem[];
  } catch {
    return [];
  }
}

export function saveCart(userId: string, items: CartItem[]): void {
  const key = cartKey(userId);
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(items));
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((n, i) => n + i.quantity, 0);
}

export function cartSubtotal(items: CartItem[], productsBySku: Record<string, Product>): number {
  return items.reduce((sum, i) => {
    const p = productsBySku[i.sku];
    return sum + (p ? p.priceCents * i.quantity : 0);
  }, 0);
}

export function addToCart(userId: string, sku: string, qty = 1): CartItem[] {
  const cart = loadCart(userId);
  const existing = cart.find((i) => i.sku === sku);
  if (existing) existing.quantity += qty;
  else cart.push({ sku, quantity: qty });
  saveCart(userId, cart);
  return cart;
}

export function updateQty(userId: string, sku: string, quantity: number): CartItem[] {
  let cart = loadCart(userId);
  if (quantity <= 0) cart = cart.filter((i) => i.sku !== sku);
  else {
    const item = cart.find((i) => i.sku === sku);
    if (item) item.quantity = quantity;
  }
  saveCart(userId, cart);
  return cart;
}

export function clearCart(userId?: string): void {
  if (!userId) return;
  saveCart(userId, []);
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
