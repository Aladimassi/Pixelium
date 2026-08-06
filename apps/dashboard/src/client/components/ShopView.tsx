import { useEffect, useRef } from 'react';
import type { Product } from '../lib/cart';
import { formatPrice, handleProductImageError, productImageUrl } from '../lib/cart';
import { formatCategoryLabel } from '../lib/product-meta';
import { BrandLogo } from './BrandLogo';
import { ProductRating } from './ProductRating';
import type { AppView } from '../lib/routes';

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
  sort?: CatalogSort;
  inStockOnly?: boolean;
  onSortChange?: (sort: CatalogSort) => void;
  onInStockOnlyChange?: (value: boolean) => void;
  onCategoryChange: (cat: string) => void;
  onPageChange: (page: number) => void;
  onProductClick: (sku: string) => void;
  onAddToCart: (sku: string) => void;
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
  sort = 'popular',
  inStockOnly = false,
  onSortChange,
  onInStockOnlyChange,
  onCategoryChange,
  onPageChange,
  onProductClick,
  onAddToCart,
  onClearSearch,
  onSearchAllCategories,
}: ShopViewProps) {
  const resultsLabel = query
    ? `${total} results for “${query}”`
    : category === 'all'
      ? `${total.toLocaleString()} products`
      : `${total.toLocaleString()} in ${formatCategoryLabel(category)}`;

  const hasFilters = Boolean(query) || category !== 'all';

  return (
    <div id="shop-view" className="page-view">
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
  searchResults = [],
  searchLoading = false,
  appliedSearchQuery = '',
  onSearchPick,
  onSearchViewAll,
  onNavHome,
  onNavShop,
  onNavAssistant,
  onNavOrders,
  onCart,
  onProfile,
  onLogout,
  onLogoHome,
  isGuest = false,
  onSignIn,
  onSearchDismiss,
}: {
  view: AppView;
  cartCount: number;
  userGreeting: React.ReactNode;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onSearchSubmit: () => void;
  searchResults?: Product[];
  searchLoading?: boolean;
  appliedSearchQuery?: string;
  onSearchPick?: (sku: string) => void;
  onSearchViewAll?: () => void;
  onNavHome: () => void;
  onNavShop: () => void;
  onNavAssistant: () => void;
  onNavOrders: () => void;
  onCart: () => void;
  onProfile: () => void;
  onLogout: () => void;
  onLogoHome: () => void;
  isGuest?: boolean;
  onSignIn?: () => void;
  onSearchDismiss?: () => void;
}) {
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const showSearch = true;
  const q = searchQuery.trim();
  const searchPending = q.length >= 2 && q !== appliedSearchQuery.trim();
  const showDropdown = showSearch && searchPending;

  useEffect(() => {
    if (!showDropdown || !onSearchDismiss) return;
    const onDocClick = (e: MouseEvent) => {
      if (!searchWrapRef.current?.contains(e.target as Node)) {
        onSearchDismiss();
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showDropdown, onSearchDismiss]);

  return (
    <header className="store-header">
      <div className={`container store-header__inner${showSearch ? '' : ' store-header__inner--compact'}`}>
        <a href="/" className="store-logo" id="logo-home" onClick={(e) => { e.preventDefault(); onLogoHome(); }}>
          <BrandLogo size="sm" />
        </a>

        <div className="search-bar-wrap" ref={searchWrapRef}>
          <form
            id="search-form"
            className={`search-bar${showSearch ? '' : ' hidden'}`}
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
              aria-expanded={showDropdown}
              aria-controls="search-suggestions"
              autoComplete="off"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
            />
          </form>

          {showDropdown ? (
            <div id="search-suggestions" className="search-dropdown" role="listbox" aria-label="Search suggestions">
              {searchLoading ? (
                <p className="search-dropdown__status">Searching…</p>
              ) : searchResults.length === 0 ? (
                <p className="search-dropdown__status">No products found</p>
              ) : (
                <>
                  <ul className="search-dropdown__list">
                    {searchResults.map((product) => (
                      <li key={product.sku}>
                        <button
                          type="button"
                          className="search-dropdown__item"
                          role="option"
                          onClick={() => onSearchPick?.(product.sku)}
                        >
                          <img
                            className="search-dropdown__thumb"
                            src={productImageUrl(product)}
                            alt=""
                            loading="lazy"
                            data-sku={product.sku}
                            onError={handleProductImageError}
                          />
                          <span className="search-dropdown__info">
                            <span className="search-dropdown__name">{product.name}</span>
                            <span className="search-dropdown__meta">
                              {formatCategoryLabel(product.category)} · {formatPrice(product.priceCents)}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="search-dropdown__all" onClick={onSearchViewAll}>
                    View all results for “{searchQuery.trim()}”
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>

        <div className="store-header__actions">
          <nav className="store-nav" aria-label="Store sections">
            <button
              type="button"
              id="btn-nav-home"
              className={`nav-link${view === 'home' ? ' active' : ''}`}
              aria-current={view === 'home' ? 'page' : undefined}
              onClick={onNavHome}
            >
              <span className="nav-link__full">Home</span>
              <span className="nav-link__short" aria-hidden="true">Home</span>
            </button>
            <button
              type="button"
              id="btn-nav-shop"
              className={`nav-link${view === 'shop' ? ' active' : ''}`}
              aria-current={view === 'shop' ? 'page' : undefined}
              onClick={onNavShop}
            >
              <span className="nav-link__full">Shop</span>
              <span className="nav-link__short" aria-hidden="true">Shop</span>
            </button>
            <button
              type="button"
              id="btn-nav-assistant"
              className={`nav-link${view === 'assistant' ? ' active' : ''}`}
              aria-current={view === 'assistant' ? 'page' : undefined}
              onClick={onNavAssistant}
            >
              <span className="nav-link__full">Assistant</span>
              <span className="nav-link__short" aria-hidden="true">AI</span>
            </button>
            <button
              type="button"
              id="btn-orders"
              className={`nav-link${view === 'orders' ? ' active' : ''}`}
              aria-current={view === 'orders' ? 'page' : undefined}
              onClick={onNavOrders}
            >
              <span className="nav-link__full">Orders</span>
              <span className="nav-link__short" aria-hidden="true">Orders</span>
            </button>
          </nav>

          <button type="button" id="btn-cart" className="btn-secondary btn-cart" onClick={onCart}>
            <span className="btn-cart__label btn-cart__label--full">Cart</span>
            <span className="btn-cart__label btn-cart__label--short" aria-hidden="true">Cart</span>
            <span id="cart-count" className="cart-badge">
              {cartCount}
            </span>
          </button>

          {isGuest ? (
            <button type="button" id="btn-sign-in" className="btn-secondary btn-sm" onClick={onSignIn}>
              Sign in
            </button>
          ) : (
            <>
              <button type="button" id="btn-profile" className="account-chip" aria-label="Open profile" onClick={onProfile}>
                <span id="user-greeting" className="account-chip__user">
                  {userGreeting}
                </span>
              </button>

              <button type="button" id="btn-logout" className="btn-logout" aria-label="Sign out" title="Sign out" onClick={onLogout}>
                <span aria-hidden="true">↩</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
