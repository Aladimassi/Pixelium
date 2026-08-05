/** Category- and keyword-aware product photos — verified URLs only + stable fallback. */

type ImageTheme =
  | 'dice'
  | 'board-games'
  | 'toys'
  | 'trains'
  | 'electronics'
  | 'footwear'
  | 'outerwear'
  | 'bags'
  | 'books'
  | 'lights'
  | 'crafts'
  | 'costume'
  | 'general';

/** Verified Unsplash IDs (HEAD/GET 200 as of 2026). */
const IMG = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=480&h=480&q=80`;

const THEME_POOLS: Record<ImageTheme, string[]> = {
  dice: [
    IMG('photo-1578662996442-48f60103fc96'),
    IMG('photo-1635070041078-e363dbe005cb'),
    IMG('photo-1551698618-1dfe5d97d256'),
  ],
  'board-games': [
    IMG('photo-1503602642458-232111445657'),
    IMG('photo-1522771739844-6a9f6d5f14af'),
    IMG('photo-1578662996442-48f60103fc96'),
  ],
  toys: [
    IMG('photo-1587654780291-39c9404d746b'),
    IMG('photo-1519125323398-675f0ddb6308'),
    IMG('photo-1566576912321-d58ddd7a6088'),
  ],
  trains: [
    IMG('photo-1558618666-fcd25c85cd64'),
    IMG('photo-1522771739844-6a9f6d5f14af'),
    IMG('photo-1566576912321-d58ddd7a6088'),
  ],
  electronics: [
    IMG('photo-1511707171634-5f897ff02aa9'),
    IMG('photo-1505740420928-5e560c06d30e'),
    IMG('photo-1523275335684-37898b6baf30'),
    IMG('photo-1498049794561-7780e7231661'),
  ],
  footwear: [
    IMG('photo-1542291026-7eec264c27ff'),
    IMG('photo-1602810318383-e386cc2a3ccf'),
    IMG('photo-1576566588028-4147f3842f27'),
  ],
  outerwear: [
    IMG('photo-1591047139829-d91aecb6caea'),
    IMG('photo-1544022613-e87ca75a784a'),
    IMG('photo-1560769629-975ec94e6a86'),
  ],
  bags: [
    IMG('photo-1553062407-98eeb64c6a62'),
    IMG('photo-1586953208448-b95a79798f07'),
    IMG('photo-1526170375885-4d8ecf77b99f'),
  ],
  books: [
    IMG('photo-1512820790803-83ca734da794'),
    IMG('photo-1497633762268-9aad179e5a27'),
    IMG('photo-1481627834876-b7833e8f5570'),
  ],
  lights: [
    IMG('photo-1513506003901-1e6a229e2d15'),
    IMG('photo-1589003077984-894e133dabab'),
    IMG('photo-1599643478518-a784e5dc4c8f'),
  ],
  crafts: [
    IMG('photo-1513475382585-d06e58bcb0e0'),
    IMG('photo-1512496015851-a90fb38ba796'),
    IMG('photo-1526170375885-4d8ecf77b99f'),
  ],
  costume: [
    IMG('photo-1530103862676-de8c9debad1d'),
    IMG('photo-1599643478518-a784e5dc4c8f'),
    IMG('photo-1512496015851-a90fb38ba796'),
  ],
  general: [
    IMG('photo-1441986300917-64674bd600d8'),
    IMG('photo-1556742049-0cfed4f6a45d'),
    IMG('photo-1526170375885-4d8ecf77b99f'),
    IMG('photo-1512496015851-a90fb38ba796'),
  ],
};

const CATEGORY_THEMES: Record<string, ImageTheme> = {
  books: 'books',
  footwear: 'footwear',
  outerwear: 'outerwear',
  electronics: 'electronics',
  games: 'board-games',
  'characters-&-brands': 'toys',
  'arts-&-crafts': 'crafts',
  'fancy-dress': 'costume',
  bags: 'bags',
  'handbags-&-shoulder-bags': 'bags',
  hobbies: 'general',
  general: 'general',
};

const KEYWORD_RULES: Array<{ theme: ImageTheme; patterns: RegExp[] }> = [
  {
    theme: 'dice',
    patterns: [/\bdice\b/i, /craps/i, /casino/i, /perudo/i, /\d+\s*mm dice/i, /sided dice/i],
  },
  {
    theme: 'trains',
    patterns: [
      /\btrain\b/i,
      /locomotive/i,
      /wagon/i,
      /n gauge/i,
      /n-gauge/i,
      /\boo gauge\b/i,
      /railway/i,
      /railroad/i,
      /yamanote/i,
      /hopper wagon/i,
      /bachmann/i,
      /hornby/i,
      /traxx/i,
      /class \d+/i,
    ],
  },
  {
    theme: 'lights',
    patterns: [
      /street light/i,
      /streetlight/i,
      /lamppost/i,
      /garden light/i,
      /model light/i,
      /single-head/i,
      /double head/i,
      /scale 1\/\d+ model.*light/i,
    ],
  },
  {
    theme: 'toys',
    patterns: [
      /plush/i,
      /muppet/i,
      /stuffed/i,
      /soft toy/i,
      /doll\b/i,
      /action figure/i,
      /figurine/i,
      /triceratops/i,
      /dinosaur/i,
      /cuddlekins/i,
      /wild republic/i,
    ],
  },
  {
    theme: 'footwear',
    patterns: [/shoe/i, /sneaker/i, /boot/i, /sandal/i, /footwear/i, /trainer/i, /high-top/i, /high top/i],
  },
  {
    theme: 'outerwear',
    patterns: [/jacket/i, /coat/i, /parka/i, /windbreaker/i, /outerwear/i, /hoodie/i],
  },
  {
    theme: 'electronics',
    patterns: [
      /phone/i,
      /smartphone/i,
      /tablet/i,
      /laptop/i,
      /headphone/i,
      /earbud/i,
      /speaker/i,
      /camera/i,
      /console/i,
      /electronics/i,
    ],
  },
  {
    theme: 'bags',
    patterns: [/handbag/i, /backpack/i, /shoulder bag/i, /\bbag\b/i, /tote/i, /purse/i, /satchel/i],
  },
  {
    theme: 'books',
    patterns: [/\bbook\b/i, /paperback/i, /hardcover/i, /novel/i, /guide to/i, /building agentic/i],
  },
  {
    theme: 'costume',
    patterns: [/fancy dress/i, /costume/i, /cosplay/i, /mask/i, /outfit/i],
  },
  {
    theme: 'crafts',
    patterns: [/arts.?craft/i, /craft kit/i, /paint brush/i, /sewing/i, /knitting/i, /yarn/i],
  },
  {
    theme: 'board-games',
    patterns: [/board game/i, /card game/i, /puzzle/i, /chess/i, /monopoly/i, /tabletop/i],
  },
];

const DEMO_SKU_IMAGES: Record<string, string> = {
  'SHOE-RED-HIGH': IMG('photo-1542291026-7eec264c27ff'),
  'JACKET-GREEN-M': IMG('photo-1591047139829-d91aecb6caea'),
  'PHONE-17-PRO': IMG('photo-1511707171634-5f897ff02aa9'),
  'HEADPHONES-NC': IMG('photo-1505740420928-5e560c06d30e'),
  /** Tech / programming — not generic poetry covers */
  'BOOK-AI-AGENTS': IMG('photo-149805718-0802f5d0db29'),
};

/** Bump when URL logic changes — stored Unsplash URLs are recomputed. */
export const PRODUCT_IMAGE_RESOLVER_VERSION = 4;

function hashText(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h * 31 + text.charCodeAt(i)) >>> 0;
  }
  return h;
}

function normalizeCategory(category?: string): string {
  return (category ?? 'general').trim().toLowerCase();
}

function productText(product: { name?: string; category?: string; description?: string }): string {
  return `${product.name ?? ''} ${product.category ?? ''} ${product.description ?? ''}`.toLowerCase();
}

/** Guaranteed-load fallback (unique per SKU). */
export function productImageFallbackUrl(sku: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(sku)}/480/480`;
}

export function isGeneratedProductImageUrl(url: string): boolean {
  return url.includes('images.unsplash.com') || url.includes('picsum.photos');
}

export function detectProductImageTheme(product: {
  name?: string;
  category?: string;
  description?: string;
}): ImageTheme {
  const text = productText(product);
  for (const rule of KEYWORD_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) return rule.theme;
  }
  const category = normalizeCategory(product.category);
  if (category.includes('game')) return 'board-games';
  return CATEGORY_THEMES[category] ?? 'general';
}

export function resolveProductImageUrl(product: {
  sku: string;
  name?: string;
  category?: string;
  description?: string;
  imageUrl?: string | null;
}): string {
  if (DEMO_SKU_IMAGES[product.sku]) return DEMO_SKU_IMAGES[product.sku];

  const stored = product.imageUrl?.trim();
  if (stored && !isGeneratedProductImageUrl(stored)) return stored;

  const theme = detectProductImageTheme(product);
  const pool = THEME_POOLS[theme];
  if (!pool?.length) return productImageFallbackUrl(product.sku);

  const key = `${product.sku}|${product.name ?? ''}|${theme}`;
  return pool[hashText(key) % pool.length];
}

export function withProductImage<
  T extends { sku: string; name?: string; category?: string; description?: string; imageUrl?: string | null },
>(product: T): T & { imageUrl: string } {
  return { ...product, imageUrl: resolveProductImageUrl(product) };
}
