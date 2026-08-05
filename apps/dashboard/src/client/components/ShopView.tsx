import { useEffect, useRef } from 'react';
import { useVoiceInput } from '../hooks/useSpeechRecognition';
import type { Product } from '../lib/cart';
import { formatPrice, handleProductImageError, productImageUrl } from '../lib/cart';
import { formatCategoryLabel } from '../lib/product-meta';
import { BrandLogo } from './BrandLogo';
import { ProductRating } from './ProductRating';

export type CatalogSort = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'popular';

interface Category {
  name: string;
  count: number;
}

export type AiChatPick = {
  sku: string;
  name: string;
  priceCents: number;
  category: string;
  reason: string;
};

export type AiChatTurn = {
  role: 'user' | 'assistant';
  content: string;
  picks?: AiChatPick[];
};

interface ShopViewProps {
  catalogTotal: number;
  categories: Category[];
  category: string;
  query: string;
  products: Product[];
  pages: number;
  page: number;
  total: number;
  loading: boolean;
  loadError?: string;
  groqOn?: boolean;
  groqBadge: React.ReactNode;
  voiceLabel?: string;
  brokerUrl: string;
  aiMessage: string;
  aiChatHistory: AiChatTurn[];
  aiBusy?: boolean;
  featuredProducts?: Product[];
  sort?: CatalogSort;
  inStockOnly?: boolean;
  onSortChange?: (sort: CatalogSort) => void;
  onInStockOnlyChange?: (value: boolean) => void;
  onCategoryChange: (cat: string) => void;
  onPageChange: (page: number) => void;
  onProductClick: (sku: string) => void;
  onAddToCart: (sku: string) => void;
  onAiMessageChange: (msg: string) => void;
  onAiChatSend: () => void;
  onClearAiChat: () => void;
  onClearSearch: () => void;
  onSearchAllCategories: () => void;
}

export function ShopView({
  catalogTotal,
  categories,
  category,
  query,
  products,
  pages,
  page,
  total,
  loading,
  loadError,
  groqOn,
  groqBadge,
  voiceLabel = 'Voice input',
  brokerUrl,
  aiMessage,
  aiChatHistory,
  aiBusy = false,
  featuredProducts = [],
  sort = 'popular',
  inStockOnly = false,
  onSortChange,
  onInStockOnlyChange,
  onCategoryChange,
  onPageChange,
  onProductClick,
  onAddToCart,
  onAiMessageChange,
  onAiChatSend,
  onClearAiChat,
  onClearSearch,
  onSearchAllCategories,
}: ShopViewProps) {
  const resultsLabel = query
    ? `${total} results for “${query}”`
    : category === 'all'
      ? `${total.toLocaleString()} products`
      : `${total.toLocaleString()} in ${formatCategoryLabel(category)}`;

  const hasFilters = Boolean(query) || category !== 'all';

  const voice = useVoiceInput({
    brokerUrl,
    value: aiMessage,
    onChange: onAiMessageChange,
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [aiChatHistory.length, aiBusy]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onAiChatSend();
    }
  };

  return (
    <div id="shop-view">
      <section className="shop-hero container">
        <div className="shop-hero__content">
          <p className="shop-hero__eyebrow">New season · Free shipping over €50</p>
          <h1 className="shop-hero__title">
            Discover products you&apos;ll <span className="text-gradient">love</span>
          </h1>
          <p className="shop-hero__lead">
            Curated electronics, apparel, home, and more — with secure checkout and AI-powered shopping help.
          </p>
        </div>
      </section>

      {featuredProducts.length > 0 ? (
        <section className="featured-section container" aria-label="Featured products">
          <div className="section-header">
            <p className="section-header__eyebrow">Featured</p>
            <h2 className="featured-section__title">Trending now</h2>
          </div>
          <div className="featured-grid">
            {featuredProducts.map((p) => (
              <article
                key={p.sku}
                className="product-card product-card--featured"
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

      <div className="container shop-layout">
        <aside className="shop-sidebar" aria-label="Categories">
          <p className="sidebar-title">Categories</p>
          <ul id="category-list" className="category-list">
            <li>
              <button
                type="button"
                className={`cat-btn${category === 'all' ? ' active' : ''}`}
                onClick={() => onCategoryChange('all')}
              >
                All
                <span className="cat-btn__count">{catalogTotal}</span>
              </button>
            </li>
            {categories.map((c) => (
              <li key={c.name}>
                <button
                  type="button"
                  className={`cat-btn${category === c.name ? ' active' : ''}`}
                  onClick={() => onCategoryChange(c.name)}
                >
                  {formatCategoryLabel(c.name)}
                  <span className="cat-btn__count">{c.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="shop-main">
          {hasFilters ? (
            <div className="shop-filters" aria-label="Active filters">
              {query ? (
                <button type="button" className="filter-chip" onClick={onClearSearch}>
                  Search: {query}
                  <span aria-hidden="true">×</span>
                </button>
              ) : null}
              {category !== 'all' ? (
                <button type="button" className="filter-chip" onClick={() => onCategoryChange('all')}>
                  {formatCategoryLabel(category)}
                  <span aria-hidden="true">×</span>
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="shop-toolbar">
            <h1 id="results-label" className="results-label">
              {resultsLabel}
            </h1>
            <div className="shop-toolbar__controls">
              <label className="shop-sort">
                <span className="sr-only">Sort products</span>
                <select
                  value={sort}
                  onChange={(e) => onSortChange?.(e.target.value as CatalogSort)}
                  aria-label="Sort products"
                >
                  <option value="popular">Most popular</option>
                  <option value="name-asc">Name A–Z</option>
                  <option value="name-desc">Name Z–A</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                </select>
              </label>
              <label className="shop-filter-stock">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => onInStockOnlyChange?.(e.target.checked)}
                />
                In stock only
              </label>
              <div id="pagination" className="pagination">
              {pages > 1 ? (
                <>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                  >
                    ← Prev
                  </button>
                  <span className="page-num">
                    {page} / {pages}
                  </span>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    disabled={page >= pages}
                    onClick={() => onPageChange(page + 1)}
                  >
                    Next →
                  </button>
                </>
              ) : null}
            </div>
            </div>
          </div>

          <div id="product-grid" className="product-grid" aria-live="polite">
            {loading ? (
              <p className="loading">Loading…</p>
            ) : loadError ? (
              <p className="form-error">{loadError}</p>
            ) : products.length === 0 ? (
              <div className="empty-state empty-state--panel">
                <p>No products found{query && category !== 'all' ? ` for “${query}” in ${formatCategoryLabel(category)}` : query ? ` for “${query}”` : category !== 'all' ? ` in ${formatCategoryLabel(category)}` : ''}.</p>
                {hasFilters ? (
                  <div className="empty-state__actions">
                    {query && category !== 'all' ? (
                      <button type="button" className="btn-secondary btn-sm" onClick={onSearchAllCategories}>
                        Search all categories
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => {
                        onClearSearch();
                        onCategoryChange('all');
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              products.map((p) => (
                <article
                  key={p.sku}
                  className="product-card"
                  data-sku={p.sku}
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
                    decoding="async"
                    data-sku={p.sku}
                    onError={handleProductImageError}
                  />
                  <p className="product-card__cat">{formatCategoryLabel(p.category)}</p>
                  <h3 className="product-card__name">{p.name}</h3>
                  <ProductRating sku={p.sku} compact />
                  {p.description ? (
                    <p className="product-card__desc">{p.description}</p>
                  ) : null}
                  <p className="product-card__price">{formatPrice(p.priceCents)}</p>
                  <p className="product-card__stock">
                    {p.inStock > 0 ? (
                      p.inStock <= 5 ? (
                        <span className="stock-badge stock-badge--low">Only {p.inStock} left</span>
                      ) : (
                        'In stock'
                      )
                    ) : (
                      <span className="stock-badge stock-badge--out">Out of stock</span>
                    )}
                  </p>
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
              ))
            )}
          </div>
        </div>
      </div>

      <section className="ai-assistant container ai-assistant--bottom" aria-label="AI shopping assistant">
        <div className="ai-assistant__card">
          <div className="ai-assistant__head">
            <div>
              <p className="section-header__eyebrow">Shopping assistant</p>
              <h2 className="ai-assistant__title">Need help choosing?</h2>
              <p className="hint">
                Ask for recommendations, compare products, or say &quot;buy me the shoes&quot; to start checkout.
              </p>
            </div>
            <div className="ai-assistant__head-actions">
              {aiChatHistory.length > 0 ? (
                <button type="button" className="btn-ghost btn-sm" onClick={onClearAiChat} disabled={aiBusy}>
                  Clear chat
                </button>
              ) : null}
              <span id="groq-badge" className={`badge${groqOn ? ' groq-on' : ' groq-off'}`}>
                <span className="live-dot" aria-hidden="true" />
                {groqBadge}
              </span>
            </div>
          </div>
          {aiChatHistory.length > 0 ? (
            <div className="ai-chat" aria-label="Conversation" role="log">
              {aiChatHistory.map((turn, i) => (
                <div key={`${turn.role}-${i}`} className={`ai-chat__turn ai-chat__turn--${turn.role}`}>
                  <div className="ai-chat__bubble">
                    <p className="ai-chat__text">{turn.content}</p>
                    {turn.picks && turn.picks.length > 0 ? (
                      <ul className="ai-result__list ai-chat__picks">
                        {turn.picks.map((p) => (
                          <li key={p.sku} className="ai-result__item">
                            <img className="ai-result__thumb" src={productImageUrl(p)} alt="" loading="lazy" data-sku={p.sku} onError={handleProductImageError} />
                            <div>
                              <strong>{p.name}</strong>
                              <span>{formatPrice(p.priceCents)} · {formatCategoryLabel(p.category)}</span>
                              <p className="hint">{p.reason}</p>
                              <button type="button" className="btn-ghost btn-sm ai-add" onClick={() => onAddToCart(p.sku)}>
                                Add to cart
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              ))}
              {aiBusy ? (
                <div className="ai-chat__turn ai-chat__turn--assistant">
                  <div className="ai-chat__bubble ai-chat__bubble--typing">
                    <span className="ai-chat__typing-dot" aria-hidden="true" />
                    <span className="ai-chat__typing-dot" aria-hidden="true" />
                    <span className="ai-chat__typing-dot" aria-hidden="true" />
                  </div>
                </div>
              ) : null}
              <div ref={chatEndRef} />
            </div>
          ) : null}
          <div className="ai-assistant__input-row">
            <input
              type="text"
              id="ai-message"
              className="ai-assistant__input"
              placeholder='e.g. "Recommend running shoes"'
              value={aiMessage}
              onChange={(e) => onAiMessageChange(e.target.value)}
              onKeyDown={handleInputKeyDown}
              disabled={aiBusy}
            />
            <button type="button" id="btn-ai-send" className="btn-primary ai-send-btn" onClick={onAiChatSend} disabled={aiBusy || !aiMessage.trim()}>
              {aiBusy ? '…' : 'Send'}
            </button>
            <button
              type="button"
              id="btn-ai-voice"
              className={`ai-voice-btn${voice.listening ? ' ai-voice-btn--active' : ''}`}
              onClick={voice.toggleListening}
              disabled={!voice.supported || voice.processing}
            >
              <span className="ai-voice-btn__icon" aria-hidden="true">🎤</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function StoreHeader({
  view,
  cartCount,
  userGreeting,
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  onNavShop,
  onNavOrders,
  onCart,
  onProfile,
  onLogout,
  onLogoHome,
}: {
  view: 'shop' | 'orders';
  cartCount: number;
  userGreeting: React.ReactNode;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onSearchSubmit: () => void;
  onNavShop: () => void;
  onNavOrders: () => void;
  onCart: () => void;
  onProfile: () => void;
  onLogout: () => void;
  onLogoHome: () => void;
}) {
  return (
    <header className="store-header">
      <div className="container store-header__inner">
        <a href="#" className="store-logo" id="logo-home" onClick={(e) => { e.preventDefault(); onLogoHome(); }}>
          <BrandLogo size="sm" />
        </a>

        <form
          id="search-form"
          className="search-bar"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit();
          }}
        >
          <span className="search-bar__icon" aria-hidden="true">
            ⌕
          </span>
          <input
            type="search"
            id="search-input"
            placeholder="Search products…"
            aria-label="Search products"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
          />
        </form>

        <div className="store-header__actions">
          <nav className="store-nav" aria-label="Store sections">
            <button
              type="button"
              id="btn-nav-shop"
              className={`nav-link${view === 'shop' ? ' active' : ''}`}
              aria-current={view === 'shop' ? 'page' : undefined}
              onClick={onNavShop}
            >
              Shop
            </button>
            <button
              type="button"
              id="btn-orders"
              className={`nav-link${view === 'orders' ? ' active' : ''}`}
              aria-current={view === 'orders' ? 'page' : undefined}
              onClick={onNavOrders}
            >
              Orders
            </button>
          </nav>

          <button type="button" id="btn-cart" className="btn-secondary btn-cart" onClick={onCart}>
            <span className="btn-cart__label">Cart</span>
            <span id="cart-count" className="cart-badge">
              {cartCount}
            </span>
          </button>

          <button type="button" id="btn-profile" className="account-chip" aria-label="Open profile" onClick={onProfile}>
            <span id="user-greeting" className="account-chip__user">
              {userGreeting}
            </span>
          </button>

          <button type="button" id="btn-logout" className="btn-logout" aria-label="Sign out" title="Sign out" onClick={onLogout}>
            <span aria-hidden="true">↩</span>
          </button>
        </div>
      </div>
    </header>
  );
}
