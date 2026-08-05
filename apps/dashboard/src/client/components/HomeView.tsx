import type { Product } from '../lib/cart';
import { formatPrice, handleProductImageError, productImageUrl } from '../lib/cart';
import { formatCategoryLabel } from '../lib/product-meta';
import { ProductRating } from './ProductRating';

interface Category {
  name: string;
  count: number;
}

interface HomeViewProps {
  catalogTotal: number;
  categories: Category[];
  featuredProducts: Product[];
  popularProducts: Product[];
  onShopAll: () => void;
  onBrowseCategory: (category: string) => void;
  onOpenAssistant: () => void;
  onProductClick: (sku: string) => void;
  onAddToCart: (sku: string) => void;
}

const PROMO_TILES = [
  {
    eyebrow: 'New arrivals',
    title: 'Spring collection is here',
    detail: 'Fresh apparel & footwear · Free shipping over €50',
    cta: 'Shop new in',
    tone: 'promo-tile--accent',
  },
  {
    eyebrow: 'Electronics',
    title: 'Upgrade your everyday tech',
    detail: 'Phones, audio, wearables & more',
    cta: 'Browse electronics',
    tone: 'promo-tile--cool',
    category: 'electronics',
  },
  {
    eyebrow: 'AI shopping',
    title: 'Not sure what to buy?',
    detail: 'Ask the assistant for picks tailored to you',
    cta: 'Open assistant',
    action: 'assistant' as const,
  },
];

export function HomeView({
  catalogTotal,
  categories,
  featuredProducts,
  popularProducts,
  onShopAll,
  onBrowseCategory,
  onOpenAssistant,
  onProductClick,
  onAddToCart,
}: HomeViewProps) {
  const dealProducts = featuredProducts.slice(0, 4);
  const picks = popularProducts.length > 0 ? popularProducts.slice(0, 8) : featuredProducts.slice(0, 8);

  return (
    <div id="home-view" className="page-view">
      <section className="home-hero container" aria-label="Welcome">
        <div className="home-hero__copy">
          <p className="home-hero__eyebrow">Pixelium Store</p>
          <h1 className="home-hero__title">
            Everything you need, <span className="text-gradient">one secure checkout</span>
          </h1>
          <p className="home-hero__lead">
            Browse {catalogTotal.toLocaleString()}+ products across electronics, fashion, home, and more — with
            consent-first payments and AI shopping help.
          </p>
          <div className="home-hero__actions">
            <button type="button" className="btn-primary" onClick={onShopAll}>
              Shop all products
            </button>
            <button type="button" className="btn-secondary" onClick={onOpenAssistant}>
              Ask the assistant
            </button>
          </div>
        </div>
        <div className="home-hero__promos" aria-label="Promotions">
          {PROMO_TILES.map((tile) => (
            <article key={tile.title} className={`promo-tile ${tile.tone}`}>
              <p className="promo-tile__eyebrow">{tile.eyebrow}</p>
              <h2 className="promo-tile__title">{tile.title}</h2>
              <p className="promo-tile__detail">{tile.detail}</p>
              <button
                type="button"
                className="promo-tile__cta"
                onClick={() => {
                  if (tile.action === 'assistant') onOpenAssistant();
                  else if (tile.category) onBrowseCategory(tile.category);
                  else onShopAll();
                }}
              >
                {tile.cta} →
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="home-categories container" aria-label="Shop by category">
        <div className="section-header">
          <p className="section-header__eyebrow">Departments</p>
          <h2 className="home-section__title">Shop by category</h2>
        </div>
        <div className="home-category-grid">
          <button type="button" className="home-category-card home-category-card--all" onClick={onShopAll}>
            <span className="home-category-card__icon" aria-hidden="true">
              ✦
            </span>
            <span className="home-category-card__name">All products</span>
            <span className="home-category-card__count">{catalogTotal} items</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.name}
              type="button"
              className="home-category-card"
              onClick={() => onBrowseCategory(c.name)}
            >
              <span className="home-category-card__icon" aria-hidden="true">
                {categoryIcon(c.name)}
              </span>
              <span className="home-category-card__name">{formatCategoryLabel(c.name)}</span>
              <span className="home-category-card__count">{c.count} items</span>
            </button>
          ))}
        </div>
      </section>

      {dealProducts.length > 0 ? (
        <section className="home-deals container" aria-label="Today's deals">
          <div className="section-header home-section-header">
            <div>
              <p className="section-header__eyebrow">Limited time</p>
              <h2 className="home-section__title">Today&apos;s deals</h2>
            </div>
            <button type="button" className="btn-ghost btn-sm" onClick={onShopAll}>
              See all deals →
            </button>
          </div>
          <div className="home-deals-grid">
            {dealProducts.map((p, i) => (
              <article
                key={p.sku}
                className={`deal-card${i === 0 ? ' deal-card--hero' : ''}`}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('.btn-add')) return;
                  onProductClick(p.sku);
                }}
              >
                {i === 0 ? <span className="deal-card__badge">Top deal</span> : null}
                <img
                  className="deal-card__img"
                  src={productImageUrl(p)}
                  alt={p.name}
                  loading="lazy"
                  data-sku={p.sku}
                  onError={handleProductImageError}
                />
                <div className="deal-card__body">
                  <p className="deal-card__cat">{formatCategoryLabel(p.category)}</p>
                  <h3 className="deal-card__name">{p.name}</h3>
                  <ProductRating sku={p.sku} compact />
                  <p className="deal-card__price">{formatPrice(p.priceCents)}</p>
                  <button
                    type="button"
                    className="btn-secondary btn-sm btn-add"
                    disabled={p.inStock < 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToCart(p.sku);
                    }}
                  >
                    Add to cart
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {picks.length > 0 ? (
        <section className="home-carousel container" aria-label="Popular products">
          <div className="section-header home-section-header">
            <div>
              <p className="section-header__eyebrow">Best sellers</p>
              <h2 className="home-section__title">Popular right now</h2>
            </div>
            <button type="button" className="btn-ghost btn-sm" onClick={onShopAll}>
              View catalog →
            </button>
          </div>
          <div className="home-product-row">
            {picks.map((p) => (
              <article
                key={p.sku}
                className="product-card product-card--row"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('.btn-add')) return;
                  onProductClick(p.sku);
                }}
              >
                <img
                  className="product-card__img"
                  src={productImageUrl(p)}
                  alt={p.name}
                  loading="lazy"
                  data-sku={p.sku}
                  onError={handleProductImageError}
                />
                <p className="product-card__cat">{formatCategoryLabel(p.category)}</p>
                <h3 className="product-card__name">{p.name}</h3>
                <ProductRating sku={p.sku} compact />
                <p className="product-card__price">{formatPrice(p.priceCents)}</p>
                <button
                  type="button"
                  className="btn-secondary btn-sm btn-add"
                  disabled={p.inStock < 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToCart(p.sku);
                  }}
                >
                  Add to cart
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="home-trust container" aria-label="Store benefits">
        <div className="home-trust-grid">
          <div className="home-trust-item">
            <span className="home-trust-item__icon" aria-hidden="true">
              🚚
            </span>
            <strong>Free shipping</strong>
            <p className="hint">On orders over €50</p>
          </div>
          <div className="home-trust-item">
            <span className="home-trust-item__icon" aria-hidden="true">
              ↩
            </span>
            <strong>Easy returns</strong>
            <p className="hint">30-day return window</p>
          </div>
          <div className="home-trust-item">
            <span className="home-trust-item__icon" aria-hidden="true">
              🔒
            </span>
            <strong>Secure checkout</strong>
            <p className="hint">Consent-first payments</p>
          </div>
          <div className="home-trust-item">
            <span className="home-trust-item__icon" aria-hidden="true">
              ✦
            </span>
            <strong>AI assistant</strong>
            <p className="hint">Personalized recommendations</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function categoryIcon(category: string): string {
  const c = category.toLowerCase();
  if (c.includes('electronic')) return '⌁';
  if (c.includes('apparel') || c.includes('footwear') || c.includes('outer')) return '◈';
  if (c.includes('home')) return '⌂';
  if (c.includes('book')) return '▤';
  if (c.includes('beauty')) return '◌';
  if (c.includes('access')) return '◆';
  if (c.includes('sport') || c.includes('fitness')) return '◎';
  if (c.includes('food') || c.includes('coffee') || c.includes('tea')) return '◉';
  return '•';
}
