import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, loadBrokerConfig } from './lib/api';
import { readSession, clearSession, getToken, getUser, isLoggedIn, saveSession, type User } from './lib/auth';
import {
  addToCart,
  cartCount,
  cartSubtotal,
  clearCart,
  GUEST_CART_USER_ID,
  migrateLegacySharedCart,
  formatPrice,
  loadCart,
  handleProductImageError,
  productImageUrl,
  updateQty,
  type CartItem,
  type Product,
} from './lib/cart';
import { cardDisplayLine, ensureDemoCard, getCardForProfile, getSavedCard, isCardComplete, isDemoUser, saveSavedCard } from './lib/payment';
import { applyAccentTheme, applyDisplaySettings, getProfilePrefs, saveProfilePrefs } from './lib/profile';
import { AdminModal } from './components/AdminModal';
import { HomeView } from './components/HomeView';
import { AssistantView } from './components/AssistantView';
import { AuthScreen } from './components/AuthScreen';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { OrdersView, type Order } from './components/OrdersView';
import { ProductModal } from './components/ProductModal';
import { ProfileModal } from './components/ProfileModal';
import { ShopView, StoreHeader, type AiChatTurn, type CatalogSort } from './components/ShopView';
import { SiteFooter } from './components/SiteFooter';
import { Toast } from './components/Toast';
import { VoidBackground } from './components/VoidBackground';
import { navigateToView, viewFromPath, type AppView } from './lib/routes';
import { downloadReceiptPdf, type ReceiptData } from './lib/receipt-pdf';
import {
  DELIVERY_OPTIONS,
  type DeliveryOption,
  type ShippingAddress,
  formatDeliverySummary,
  isShippingComplete,
  getShippingAddress,
  saveShippingAddress,
  shippingCostCents,
} from './lib/shipping';

interface Category {
  name: string;
  count: number;
}

interface Mandate {
  id: string;
  payload: Record<string, unknown>;
}

interface PendingConsent {
  intent: Mandate;
  cart: Mandate & {
    payload: {
      totalCents: number;
      items: Array<{ sku: string; quantity: number; name: string; unitPriceCents: number }>;
      subtotalCents: number;
      taxCents: number;
      merchantName: string;
    };
  };
  parsed?: Record<string, unknown>;
  source: 'cart' | 'ai';
  agentThinking?: string;
  agentWarnings?: string[];
}

type CheckoutStep = 'shipping' | 'review' | 'processing' | 'success';

function renderCartMandateReview(
  cartMandate: PendingConsent['cart'],
  productsBySku: Record<string, Product>,
  shippingCents: number,
  shippingSummary?: string,
  extra?: React.ReactNode,
  agentThinking?: string,
  agentWarnings?: string[]
) {
  const items = cartMandate.payload.items.map((i, idx) => {
    const product =
      productsBySku[i.sku] ??
      ({
        sku: i.sku,
        name: i.name,
        category: '',
        priceCents: i.unitPriceCents,
        inStock: 0,
      } satisfies Product);
    return (
      <div className="review-line" key={i.sku || idx}>
        <img className="review-line__thumb" src={productImageUrl(product)} alt="" loading="lazy" data-sku={product.sku} onError={handleProductImageError} />
        <div className="review-line__info">
          <span className="review-line__name">
            {i.quantity}× {i.name}
          </span>
        </div>
        <span className="review-line__price">{formatPrice(i.unitPriceCents * i.quantity)}</span>
      </div>
    );
  });
  return (
    <>
      {extra}
      {agentThinking ? (
        <p className="agent-thinking" role="note">
          <strong>Product agent:</strong> {agentThinking}
        </p>
      ) : null}
      {agentWarnings && agentWarnings.length > 0 ? (
        <ul className="agent-warnings">
          {agentWarnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
      {items}
      <div className="review-row">
        <span>Subtotal</span>
        <span>{formatPrice(cartMandate.payload.subtotalCents)}</span>
      </div>
      <div className="review-row">
        <span>Tax</span>
        <span>{formatPrice(cartMandate.payload.taxCents)}</span>
      </div>
      <div className="review-row">
        <span>Shipping</span>
        <span>{shippingCents === 0 ? 'Free' : formatPrice(shippingCents)}</span>
      </div>
      <div className="review-row review-row--total">
        <span>Total</span>
        <span>{formatPrice(cartMandate.payload.totalCents + shippingCents)}</span>
      </div>
      {shippingSummary ? <p className="hint">{shippingSummary}</p> : null}
      <p className="hint">You approve this charge before payment is processed.</p>
    </>
  );
}

function readResetTokenFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/reset-password' || path.endsWith('/reset-password')) {
    return new URLSearchParams(window.location.search).get('token') ?? '';
  }
  return '';
}

export function App() {
  const [authenticated, setAuthenticated] = useState(() => readSession().loggedIn);
  const [user, setUser] = useState<User | null>(() => readSession().user);
  const [authResetToken, setAuthResetToken] = useState(readResetTokenFromUrl);
  const [showAuth, setShowAuth] = useState(() => Boolean(readResetTokenFromUrl()));
  const [brokerUrl, setBrokerUrl] = useState('');
  const [view, setView] = useState<AppView>(() => viewFromPath(window.location.pathname));
  const [toast, setToast] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [category, setCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<Product[]>([]);
  const [searchSuggestionsLoading, setSearchSuggestionsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsBySku, setProductsBySku] = useState<Record<string, Product>>({});
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string>();
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [popularProducts, setPopularProducts] = useState<Product[]>([]);
  const [sort, setSort] = useState<CatalogSort>('popular');
  const [inStockOnly, setInStockOnly] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('shipping');
  const [checkoutReview, setCheckoutReview] = useState<React.ReactNode>(null);
  const [checkoutTotal, setCheckoutTotal] = useState<number>();
  const [checkoutShippingCents, setCheckoutShippingCents] = useState(0);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>(getShippingAddress());
  const [deliveryOption, setDeliveryOption] = useState<DeliveryOption>('standard');
  const [checkoutStatus, setCheckoutStatus] = useState<string>();
  const [processingMessage, setProcessingMessage] = useState('Verifying mandate chain & contacting payment agent…');
  const [pendingConsent, setPendingConsent] = useState<PendingConsent | null>(null);
  const [successAmount, setSuccessAmount] = useState<string>();
  const [successTxn, setSuccessTxn] = useState<string>();
  const [successOrderId, setSuccessOrderId] = useState<string>();
  const [successDelivery, setSuccessDelivery] = useState<string>();
  const [successItems, setSuccessItems] = useState<PendingConsent['cart']['payload']['items']>([]);
  const [successEmailSent, setSuccessEmailSent] = useState(false);
  const [successEmailError, setSuccessEmailError] = useState<string>();
  const [successDeliveryEta, setSuccessDeliveryEta] = useState<string>();
  const [successReceipt, setSuccessReceipt] = useState<ReceiptData | null>(null);
  const [downloadingOrderId, setDownloadingOrderId] = useState<string | null>(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<'identity' | 'settings' | 'appearance' | 'payment' | 'delivery'>('identity');
  const [profileError, setProfileError] = useState<string>();
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileKey, setProfileKey] = useState(0);

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string>();

  const [adminOpen, setAdminOpen] = useState(false);
  const [adminOutput, setAdminOutput] = useState('');
  const [adminEvents, setAdminEvents] = useState<Array<{ timestamp: string; eventType: string; severity: string }>>([]);

  const [groqOn, setGroqOn] = useState(false);
  const [groqLabel, setGroqLabel] = useState('AI');
  const [voiceLabel, setVoiceLabel] = useState('Voice input');

  const [aiMessage, setAiMessage] = useState('');
  const [aiChatHistory, setAiChatHistory] = useState<AiChatTurn[]>([]);
  const [aiBusy, setAiBusy] = useState(false);

  const prefs = useMemo(() => getProfilePrefs(user?.id), [user?.id, profileKey]);
  const cartUserId = user?.id ?? GUEST_CART_USER_ID;
  const savedCard = useMemo(
    () => (user ? getSavedCard(user.id, user.email) : null),
    [user?.id, user?.email, profileKey]
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    const onPopState = () => setView(viewFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const goToShop = useCallback(
    (opts?: { category?: string; query?: string }) => {
      if (opts?.category) {
        setCategory(opts.category);
        setPage(1);
        if (opts.category !== 'all') {
          setActiveQuery('');
          setSearchQuery('');
        }
      }
      if (opts?.query !== undefined) {
        const q = opts.query.trim();
        setActiveQuery(q);
        setSearchQuery(q);
        setPage(1);
        if (q) setCategory('all');
      }
      setView('shop');
      navigateToView('shop');
    },
    []
  );

  const resetSessionUi = useCallback(() => {
    setAiChatHistory([]);
    setAiMessage('');
    setCart([]);
    setCartOpen(false);
    setCheckoutOpen(false);
    setPendingConsent(null);
    setCheckoutStep('review');
    setCheckoutStatus(undefined);
  }, []);

  const refreshCart = useCallback(() => {
    setCart(loadCart(cartUserId));
  }, [cartUserId]);

  useEffect(() => {
    setCart(loadCart(cartUserId));
    if (user?.id) migrateLegacySharedCart(user.id);
  }, [cartUserId, user?.id]);

  useEffect(() => {
    const syncAuthFromUrl = () => {
      const token = readResetTokenFromUrl();
      if (token) {
        setAuthResetToken(token);
        setShowAuth(true);
      }
    };
    syncAuthFromUrl();
    window.addEventListener('popstate', syncAuthFromUrl);
    return () => window.removeEventListener('popstate', syncAuthFromUrl);
  }, []);

  useEffect(() => {
    if (authResetToken && authenticated) {
      clearSession();
      setAuthenticated(false);
      setUser(null);
      setShowAuth(true);
    }
  }, [authResetToken, authenticated]);

  useEffect(() => {
    if (authenticated) setShowAuth(false);
  }, [authenticated]);

  const showAdminConsole = Boolean(user && isDemoUser(user.email));

  const validCart = useMemo(() => {
    return cart.filter((item) => productsBySku[item.sku]);
  }, [cart, productsBySku]);

  const subtotal = useMemo(() => cartSubtotal(validCart, productsBySku), [validCart, productsBySku]);
  const tax = useMemo(() => Math.round(subtotal * 0.08), [subtotal]);
  const cartTotal = subtotal + tax;

  const userGreeting = useMemo(() => {
    if (!authenticated) {
      return <span className="nav-name">Guest</span>;
    }
    const name = user?.displayName ?? user?.email ?? 'Guest';
    const tagline = prefs.tagline?.trim();
    return (
      <>
        <span className="nav-avatar" aria-hidden="true">
          {prefs.avatar}
        </span>
        <span className="nav-user-text">
          <span className="nav-name">{name}</span>
          {tagline ? <span className="nav-tagline">{tagline}</span> : null}
        </span>
      </>
    );
  }, [authenticated, user, prefs]);

  const loadCategories = useCallback(async () => {
    const { ok, data } = await api<{ categories?: Category[]; total?: number }>(brokerUrl, '/api/catalog/categories');
    if (!ok) return;
    setCategories(data.categories ?? []);
    setCatalogTotal(data.total ?? 0);
  }, [brokerUrl]);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError(undefined);
    const params = new URLSearchParams({ page: String(page), limit: '24', sort });
    if (category !== 'all') params.set('category', category);
    if (activeQuery) params.set('q', activeQuery);
    if (inStockOnly) params.set('inStock', '1');

    const { ok, data } = await api<{ products?: Product[]; pages?: number; total?: number; error?: string }>(
      brokerUrl,
      `/api/catalog?${params}`
    );
    setProductsLoading(false);
    if (!ok) {
      setProductsError(data.error ?? 'Could not load products. Is MySQL running?');
      return;
    }
    const list = data.products ?? [];
    setProducts(list);
    setPages(data.pages ?? 1);
    setTotal(data.total ?? 0);
    setProductsBySku((prev) => ({ ...prev, ...Object.fromEntries(list.map((p) => [p.sku, p])) }));
  }, [brokerUrl, page, category, activeQuery, sort, inStockOnly]);

  const loadPopular = useCallback(async () => {
    const { ok, data } = await api<{ products?: Product[] }>(
      brokerUrl,
      '/api/catalog?limit=8&sort=popular&inStock=1'
    );
    if (!ok) return;
    const list = data.products ?? [];
    setPopularProducts(list);
    setProductsBySku((prev) => ({ ...prev, ...Object.fromEntries(list.map((p) => [p.sku, p])) }));
  }, [brokerUrl]);

  const loadFeatured = useCallback(async () => {
    const { ok, data } = await api<{ products?: Product[] }>(brokerUrl, '/api/catalog/featured');
    if (!ok) return;
    const list = data.products ?? [];
    setFeaturedProducts(list);
    setProductsBySku((prev) => ({ ...prev, ...Object.fromEntries(list.map((p) => [p.sku, p])) }));
  }, [brokerUrl]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError(undefined);
    const { ok, data } = await api<{ orders?: Order[]; error?: string }>(brokerUrl, '/api/audit/orders');
    setOrdersLoading(false);
    if (!ok) {
      setOrders([]);
      setOrdersError(data.error ?? 'Could not load your orders. Try again in a moment.');
      return;
    }
    setOrders(data.orders ?? []);
  }, [brokerUrl]);

  const requireSignIn = useCallback(
    (message = 'Sign in to continue') => {
      setShowAuth(true);
      showToast(message);
    },
    [showToast],
  );

  const goToView = useCallback(
    (next: AppView) => {
      if ((next === 'assistant' || next === 'orders') && !authenticated) {
        requireSignIn(next === 'orders' ? 'Sign in to view your orders' : 'Sign in to use the AI assistant');
        return;
      }
      setView(next);
      navigateToView(next);
      if (next === 'orders') loadOrders();
    },
    [authenticated, loadOrders, requireSignIn]
  );

  const loadAiStatus = useCallback(async () => {
    const { ok, data } = await api<{
      configured?: boolean;
      model?: string;
      voiceProvider?: 'groq' | 'local';
      voiceModel?: string;
    }>(brokerUrl, '/api/ai/status');
    if (!ok) {
      setGroqOn(false);
      setGroqLabel('Keyword search');
      setVoiceLabel('Voice input');
      return;
    }
    if (data.configured) {
      setGroqOn(true);
      setGroqLabel(`Groq · ${data.model?.split('-').slice(0, 2).join('-') ?? 'on'}`);
    } else {
      setGroqOn(false);
      setGroqLabel('Keyword only');
    }
    setVoiceLabel(
      data.voiceProvider === 'groq'
        ? 'Groq Whisper (fast)'
        : 'Local Whisper (first use may take ~1 min)'
    );
  }, [brokerUrl]);

  const bootStore = useCallback(async () => {
    refreshCart();
  }, [refreshCart]);

  useEffect(() => {
    loadBrokerConfig()
      .then(setBrokerUrl)
      .catch(() => showToast('Config failed to load'));
  }, [showToast]);

  useEffect(() => {
    if (!brokerUrl) return;
    loadAiStatus();
    loadCategories();
    loadFeatured();
    loadPopular();
  }, [brokerUrl, loadAiStatus, loadCategories, loadFeatured, loadPopular]);

  useEffect(() => {
    if (!brokerUrl) return;
    loadProducts();
  }, [brokerUrl, loadProducts]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!brokerUrl) {
      setSearchSuggestions([]);
      return;
    }
    if (!q || q.length < 2) {
      setSearchSuggestions([]);
      setSearchSuggestionsLoading(false);
      if (!q) setActiveQuery('');
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearchSuggestionsLoading(true);
      const params = new URLSearchParams({ q, limit: '8', sort: 'popular' });
      if (inStockOnly) params.set('inStock', '1');
      const { ok, data } = await api<{ products?: Product[] }>(brokerUrl, `/api/catalog?${params}`);
      setSearchSuggestionsLoading(false);
      if (ok) {
        const list = data.products ?? [];
        setSearchSuggestions(list);
        setProductsBySku((prev) => ({ ...prev, ...Object.fromEntries(list.map((p) => [p.sku, p])) }));
      }
    }, 280);

    return () => window.clearTimeout(timer);
  }, [searchQuery, brokerUrl, inStockOnly]);

  useEffect(() => {
    if (user?.id) {
      applyAccentTheme(prefs.accent);
      applyDisplaySettings(prefs);
      setSort(prefs.defaultSort);
      setInStockOnly(prefs.inStockOnlyDefault);
      setDeliveryOption(prefs.defaultDelivery);
    }
  }, [user?.id, prefs]);

  useEffect(() => {
    async function init() {
      if (!isLoggedIn()) {
        setAuthenticated(false);
        setUser(null);
        return;
      }
      if (!brokerUrl) return;

      const { ok, status, data } = await api<{ user?: User }>(brokerUrl, '/api/auth/me');
      if (!ok) {
        if (status === 401) {
          clearSession();
          setAuthenticated(false);
          setUser(null);
        }
        return;
      }
      const u = data.user ?? getUser();
      if (u && isDemoUser(u.email)) ensureDemoCard(u.id);
      setUser(u);
      setAuthenticated(true);
      await bootStore();
    }
    init();
  }, [bootStore, brokerUrl]);

  const handleLogin = async (email: string, password: string) => {
    if (!brokerUrl) return 'Store is still loading — try again in a moment';
    const { ok, data } = await api<{ token?: string; user?: User; error?: string }>(brokerUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!ok || !data.token || !data.user) return data.error ?? 'Login failed';
    saveSession(data.token, data.user);
    if (isDemoUser(data.user.email)) ensureDemoCard(data.user.id);
    migrateLegacySharedCart(data.user.id);
    const guestItems = loadCart(GUEST_CART_USER_ID);
    if (guestItems.length) {
      for (const item of guestItems) {
        addToCart(data.user.id, item.sku, item.quantity);
      }
      clearCart(GUEST_CART_USER_ID);
    }
    resetSessionUi();
    setUser(data.user);
    setAuthenticated(true);
    await bootStore();
    return null;
  };

  const handleRegister = async (displayName: string, email: string, password: string) => {
    if (!brokerUrl) return 'Store is still loading — try again in a moment';
    const { ok, data } = await api<{ token?: string; user?: User; error?: string }>(brokerUrl, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
    if (!ok || !data.token || !data.user) return data.error ?? 'Registration failed';
    saveSession(data.token, data.user);
    resetSessionUi();
    setUser(data.user);
    setAuthenticated(true);
    await bootStore();
    setProfileTab('payment');
    setProfileOpen(true);
    showToast('Add your own payment card in Profile');
    return null;
  };

  const handleForgotPassword = async (email: string) => {
    if (!brokerUrl) return { error: 'Store is still loading — try again in a moment' };
    const { ok, data } = await api<{ message?: string; error?: string }>(
      brokerUrl,
      '/api/auth/forgot-password',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
    );
    if (!ok) return { error: data.error ?? 'Could not send reset email' };
    return { message: data.message };
  };

  const handleResetPassword = async (token: string, password: string) => {
    if (!brokerUrl) return 'Store is still loading — try again in a moment';
    const { ok, data } = await api<{ message?: string; error?: string }>(
      brokerUrl,
      '/api/auth/reset-password',
      {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      },
    );
    if (!ok) return data.error ?? 'Could not reset password';
    window.history.replaceState({}, '', '/');
    return null;
  };

  const handleAddToCart = (sku: string) => {
    addToCart(cartUserId, sku);
    refreshCart();
    showToast('Added to cart');
  };

  const enrichCartProducts = useCallback(async () => {
    const current = loadCart(cartUserId);
    if (current.length === 0) return;
    const missing = current.filter((i) => !productsBySku[i.sku]).map((i) => i.sku);
    if (missing.length === 0) return;
    const updates: Record<string, Product> = {};
    for (const sku of missing) {
      const { ok, data } = await api<{ product?: Product }>(brokerUrl, `/api/catalog/${encodeURIComponent(sku)}`);
      if (ok && data.product) updates[sku] = data.product;
    }
    if (Object.keys(updates).length) setProductsBySku((prev) => ({ ...prev, ...updates }));
  }, [brokerUrl, productsBySku, cartUserId]);

  useEffect(() => {
    if (cartOpen) enrichCartProducts();
  }, [cartOpen, enrichCartProducts]);

  const openProduct = async (sku: string) => {
    let product = productsBySku[sku];
    if (!product) {
      const { ok, data } = await api<{ product?: Product }>(brokerUrl, `/api/catalog/${encodeURIComponent(sku)}`);
      if (!ok || !data.product) return;
      product = data.product;
      setProductsBySku((prev) => ({ ...prev, [sku]: product! }));
    }
    setSelectedProduct(product);
    setProductModalOpen(true);
  };

  const openCheckout = async () => {
    if (!user?.id) {
      requireSignIn('Sign in to checkout');
      return;
    }
    const current = loadCart(cartUserId);
    if (current.length === 0) {
      showToast('Cart is empty');
      return;
    }
    setCartOpen(false);
    setPendingConsent(null);
    setCheckoutReview(null);
    setCheckoutTotal(undefined);
    setCheckoutShippingCents(shippingCostCents(subtotal, deliveryOption));
    setCheckoutStatus(undefined);
    const addr = getShippingAddress(user.id, user.displayName ?? '');
    setShippingAddress(addr);
    setCheckoutOpen(true);
    if (isShippingComplete(addr)) {
      setCheckoutStep('review');
      await prepareCheckoutReview(addr);
    } else {
      setCheckoutStep('shipping');
    }
  };

  const prepareCheckoutReview = async (addr?: ShippingAddress) => {
    const shipAddr = addr ?? shippingAddress;
    if (!user?.id) return;
    const current = loadCart(cartUserId);
    const items = current.map((i) => ({ sku: i.sku, quantity: i.quantity }));
    const shipCents = shippingCostCents(subtotal, deliveryOption);
    setCheckoutReview(<p className="loading">Preparing your order…</p>);

    const { ok, data } = await api<{
      cartMandate?: PendingConsent['cart'];
      intentMandate?: Mandate;
      agentThinking?: string;
      agentWarnings?: string[];
      error?: string;
    }>(brokerUrl, '/api/checkout/prepare', {
      method: 'POST',
      body: JSON.stringify({ items, shippingCents: shipCents }),
    });

    if (!ok || !data.cartMandate || !data.intentMandate) {
      setCheckoutReview(<p className="form-error">{data.error ?? 'Failed to build cart'}</p>);
      return;
    }

    const shipSummary = formatDeliverySummary(shipAddr, deliveryOption, shipCents);
    setPendingConsent({
      intent: data.intentMandate,
      cart: data.cartMandate,
      source: 'cart',
      agentThinking: data.agentThinking,
      agentWarnings: data.agentWarnings,
    });
    setCheckoutReview(
      renderCartMandateReview(
        data.cartMandate,
        productsBySku,
        shipCents,
        shipSummary,
        undefined,
        data.agentThinking,
        data.agentWarnings
      )
    );
    setCheckoutShippingCents(shipCents);
    setCheckoutTotal(data.cartMandate.payload.totalCents + shipCents);
    setCheckoutStep('review');
  };

  const handleContinueToReview = async () => {
    if (!user?.id) {
      requireSignIn('Sign in to checkout');
      return;
    }
    saveShippingAddress(user.id, shippingAddress);
    if (pendingConsent) {
      const shipCents = shippingCostCents(pendingConsent.cart.payload.subtotalCents, deliveryOption);
      const shipSummary = formatDeliverySummary(shippingAddress, deliveryOption, shipCents);
      const extra =
        pendingConsent.parsed && pendingConsent.source === 'ai' ? (
          <p className="ai-result__summary">{String(pendingConsent.parsed.naturalLanguageIntent ?? '')}</p>
        ) : undefined;
      setCheckoutReview(
        renderCartMandateReview(
          pendingConsent.cart,
          productsBySku,
          shipCents,
          shipSummary,
          extra,
          pendingConsent.agentThinking,
          pendingConsent.agentWarnings
        )
      );
      setCheckoutShippingCents(shipCents);
      setCheckoutTotal(pendingConsent.cart.payload.totalCents + shipCents);
      setCheckoutStep('review');
      return;
    }
    await prepareCheckoutReview();
  };

  const closeCheckout = () => {
    setCheckoutOpen(false);
    setPendingConsent(null);
    setCheckoutStep('shipping');
    setCheckoutStatus(undefined);
    setSuccessItems([]);
    setSuccessOrderId(undefined);
    setSuccessDelivery(undefined);
    setSuccessEmailSent(false);
    setSuccessEmailError(undefined);
    setSuccessDeliveryEta(undefined);
    setSuccessReceipt(null);
  };

  const handleDownloadOrderReceipt = async (orderId: string) => {
    if (!brokerUrl) return;
    setDownloadingOrderId(orderId);
    const { ok, data } = await api<{
      order?: Order & { createdAt?: string };
      mandateChain?: {
        cart: {
          payload: {
            items: Array<{ name: string; quantity: number; unitPriceCents: number }>;
            subtotalCents: number;
            taxCents: number;
            totalCents: number;
          };
        };
        payment: { payload: { paymentId: string; amountCents: number } };
      };
    }>(brokerUrl, `/api/audit/orders/${encodeURIComponent(orderId)}`);
    setDownloadingOrderId(null);
    if (!ok || !data.mandateChain) {
      showToast('Could not load receipt');
      return;
    }
    const chain = data.mandateChain;
    await downloadReceiptPdf({
      orderId: `PX-${orderId.slice(-8).toUpperCase()}`,
      date: data.order?.createdAt,
      items: chain.cart.payload.items,
      subtotalCents: chain.cart.payload.subtotalCents,
      taxCents: chain.cart.payload.taxCents,
      totalCents: chain.payment.payload.amountCents,
      paymentRef: orderId,
      customerName: user?.displayName,
      customerEmail: user?.email,
    });
    showToast('Receipt downloaded');
  };

  const handleConfirmPay = async () => {
    if (!pendingConsent) {
      showToast('Nothing to pay');
      return;
    }
    const saved = getSavedCard(user?.id, user?.email);
    if (!saved || !isCardComplete(saved)) {
      setCheckoutStatus('Add your payment card in Profile before paying.');
      setProfileTab('payment');
      setProfileOpen(true);
      return;
    }
    setCheckoutStep('processing');
    setProcessingMessage('Signing payment mandate…');
    await new Promise((r) => setTimeout(r, 600));
    setProcessingMessage('Payment agent verifying consent chain…');

    const { intent, cart } = pendingConsent;
    const last4 = saved.brand === 'paypal' ? 'PPAL' : saved.last4;

    const { ok: pmOk, data: pmData } = await api<{
      paymentMandate?: Mandate;
      cartMandate?: PendingConsent['cart'];
      intentMandate?: Mandate;
      error?: string;
    }>(
      brokerUrl,
      '/api/payment-mandate',
      {
        method: 'POST',
        body: JSON.stringify({
          intentMandate: intent,
          cartMandate: cart,
          last4,
          shippingCents: checkoutShippingCents,
        }),
      }
    );
    if (!pmOk || !pmData.paymentMandate) {
      setCheckoutStep('review');
      setCheckoutStatus(pmData.error ?? 'Payment mandate failed');
      return;
    }

    const chainIntent = pmData.intentMandate ?? intent;
    const chainCart = pmData.cartMandate ?? cart;
    const paymentMandate = pmData.paymentMandate;

    await new Promise((r) => setTimeout(r, 500));
    setProcessingMessage('Processing charge…');

    const { ok, data } = await api<{
      success?: boolean;
      emailSent?: boolean;
      emailError?: string;
      payment?: { transactionId?: string; amountCents?: number; message?: string };
      errors?: string[];
      error?: string;
      agentThinking?: string;
      agentRiskNotes?: string[];
    }>(brokerUrl, '/api/submit', {
      method: 'POST',
      body: JSON.stringify({
        mandateChain: { intent: chainIntent, cart: chainCart, payment: paymentMandate },
        receipt: {
          shippingSummary: formatDeliverySummary(shippingAddress, deliveryOption, checkoutShippingCents),
          shippingCents: checkoutShippingCents,
          deliveryLabel:
            deliveryOption === 'express' ? 'Express delivery (1–2 days)' : 'Standard delivery (3–5 days)',
          sendEmail: prefs.emailReceipts,
        },
      }),
    });

    await new Promise((r) => setTimeout(r, 400));

    const chargedCents = data.payment?.amountCents ?? chainCart.payload.totalCents + checkoutShippingCents;
    const deliveryEta =
      DELIVERY_OPTIONS.find((o) => o.id === deliveryOption)?.eta ?? '3–5 business days';

    if (ok && data.success) {
      const orderId = `PX-${String(data.payment?.transactionId ?? Date.now()).slice(-8).toUpperCase()}`;
      setSuccessAmount(formatPrice(chargedCents));
      setSuccessTxn(`Payment ref ${data.payment?.transactionId ?? '—'}`);
      setSuccessOrderId(orderId);
      setSuccessDelivery(formatDeliverySummary(shippingAddress, deliveryOption, checkoutShippingCents));
      setSuccessDeliveryEta(`Estimated delivery in ${deliveryEta}.`);
      setSuccessItems(chainCart.payload.items);
      setSuccessEmailSent(Boolean(data.emailSent));
      setSuccessEmailError(data.emailError);
      setSuccessReceipt({
        orderId,
        items: chainCart.payload.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        })),
        subtotalCents: chainCart.payload.subtotalCents,
        taxCents: chainCart.payload.taxCents,
        totalCents: chargedCents,
        shippingCents: checkoutShippingCents,
        deliverySummary: formatDeliverySummary(shippingAddress, deliveryOption, checkoutShippingCents),
        paymentRef: data.payment?.transactionId,
        customerName: user?.displayName,
        customerEmail: user?.email,
      });
      if (pendingConsent.source === 'cart') {
        clearCart(cartUserId);
        refreshCart();
      }
      if (pendingConsent.source === 'ai' && pendingConsent.parsed) {
        const payNote = data.agentThinking ? ` ${data.agentThinking}` : '';
        setAiChatHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Purchase approved — ${String(pendingConsent.parsed?.aiSummary ?? 'Order complete')}. Transaction ${data.payment?.transactionId ?? '—'}, charged ${formatPrice(data.payment?.amountCents ?? 0)}.${payNote}`,
          },
        ]);
      }
      loadOrders();
      setCheckoutStep('success');
      showToast(
        data.emailSent
          ? 'Receipt emailed with what you bought'
          : data.emailError
            ? 'Payment complete — receipt email failed'
            : 'Payment complete',
      );
    } else {
      setCheckoutStep('review');
      setCheckoutStatus(
        data.errors?.join('; ') ?? data.payment?.message ?? data.error ?? 'Payment blocked'
      );
    }
  };

  const openAiCheckout = (
    intentMandate: Mandate,
    cartMandate: PendingConsent['cart'],
    parsed?: Record<string, unknown>
  ) => {
    const addr =
      user?.id ? getShippingAddress(user.id, user.displayName ?? '') : getShippingAddress();
    setShippingAddress(addr);
    const shipCents = shippingCostCents(cartMandate.payload.subtotalCents, deliveryOption);
    const shipSummary = formatDeliverySummary(addr, deliveryOption, shipCents);
    const agentThinking =
      typeof parsed?.agentThinking === 'string' ? parsed.agentThinking : undefined;
    const agentWarnings = Array.isArray(parsed?.agentWarnings)
      ? parsed.agentWarnings.filter((w): w is string => typeof w === 'string')
      : undefined;
    setPendingConsent({
      intent: intentMandate,
      cart: cartMandate,
      parsed,
      source: 'ai',
      agentThinking,
      agentWarnings,
    });
    const extra = parsed ? (
      <p className="ai-result__summary">{String(parsed.naturalLanguageIntent ?? '')}</p>
    ) : undefined;
    setCheckoutReview(
      renderCartMandateReview(
        cartMandate,
        productsBySku,
        shipCents,
        shipSummary,
        extra,
        agentThinking,
        agentWarnings
      )
    );
    setCheckoutShippingCents(shipCents);
    setCheckoutTotal(cartMandate.payload.totalCents + shipCents);
    setCheckoutStep(isShippingComplete(addr) ? 'review' : 'shipping');
    setCheckoutStatus(undefined);
    setCheckoutOpen(true);
  };

  const handleAiChatSend = async (overrideText?: string) => {
    const text = (typeof overrideText === 'string' ? overrideText : aiMessage).trim();
    if (!text || aiBusy) return;
    if (!authenticated) {
      requireSignIn('Sign in to use the AI assistant');
      return;
    }

    const historyForApi = aiChatHistory.map((t) => ({ role: t.role, content: t.content }));
    if (!overrideText) setAiMessage('');
    setAiChatHistory((prev) => [...prev, { role: 'user', content: text }]);
    setAiBusy(true);

    try {
      const { ok, data } = await api<{
        reply?: string;
        action?: 'prepare_checkout';
        picks?: Array<{
          sku: string;
          name: string;
          priceCents: number;
          category: string;
          reason: string;
        }>;
        parsed?: Record<string, unknown>;
        intentMandate?: Mandate;
        cartMandate?: PendingConsent['cart'];
        error?: string;
      }>(brokerUrl, '/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text, history: historyForApi }),
        timeoutMs: 90_000,
      });

      if (!ok) {
        setAiChatHistory((prev) => [
          ...prev,
          { role: 'assistant', content: data.error ?? 'Sorry, something went wrong. Try again.' },
        ]);
        return;
      }

      setAiChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply ?? 'How can I help you shop?',
          picks: data.picks,
        },
      ]);

      if (
        data.action === 'prepare_checkout' &&
        data.intentMandate &&
        data.cartMandate
      ) {
        if (user?.id && data.cartMandate.payload?.items) {
          for (const item of data.cartMandate.payload.items) {
            addToCart(user.id, item.sku, item.quantity);
          }
          refreshCart();
        }
        openAiCheckout(data.intentMandate, data.cartMandate, data.parsed);
        showToast('Checkout opened — review and approve payment');
      }
    } finally {
      setAiBusy(false);
    }
  };

  const handleClearAiChat = () => {
    setAiChatHistory([]);
  };

  const openAdmin = async () => {
    setAdminOpen(true);
    const { ok, data } = await api<{ events?: typeof adminEvents }>(brokerUrl, '/api/audit/events?limit=20');
    if (ok) setAdminEvents(data.events ?? []);
  };

  return (
    <>
      <VoidBackground />
      {showAuth && !authenticated ? (
        <div className="auth-overlay">
          <AuthScreen
            onLogin={handleLogin}
            onRegister={handleRegister}
            onForgotPassword={handleForgotPassword}
            onResetPassword={handleResetPassword}
            initialResetToken={authResetToken}
          />
        </div>
      ) : null}
      <div id="app-shell">
        <div className="promo-bar">
          <div className="container promo-bar__inner">
            <span>Free standard shipping on orders over $50</span>
            <span className="promo-bar__sep">·</span>
            <span>30-day returns on eligible items</span>
            <span className="promo-bar__sep">·</span>
            <span>Secure consent-first checkout</span>
          </div>
        </div>
        <StoreHeader
          view={view}
          cartCount={cartCount(cart)}
          userGreeting={userGreeting}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onSearchSubmit={() => {
            const q = searchQuery.trim();
            goToShop({ query: q });
          }}
          searchResults={searchSuggestions}
          searchLoading={searchSuggestionsLoading}
          appliedSearchQuery={activeQuery}
          onSearchPick={(sku) => {
            void openProduct(sku);
          }}
          onSearchViewAll={() => goToShop({ query: searchQuery.trim() })}
          onNavHome={() => goToView('home')}
          onNavShop={() => goToShop()}
          onNavAssistant={() => goToView('assistant')}
          onNavOrders={() => goToView('orders')}
          isGuest={!authenticated}
          onSignIn={() => setShowAuth(true)}
          onSearchDismiss={() => setSearchQuery(activeQuery)}
          onCart={() => {
            setCartOpen(true);
            refreshCart();
          }}
          onProfile={() => {
            if (!authenticated) {
              requireSignIn('Sign in to open your profile');
              return;
            }
            setProfileTab('identity');
            setProfileError(undefined);
            setProfileSaved(false);
            setProfileKey((k) => k + 1);
            setProfileOpen(true);
          }}
          onLogout={() => {
            clearSession();
            resetSessionUi();
            setAuthenticated(false);
            setUser(null);
            setView('home');
            navigateToView('home');
          }}
          onLogoHome={() => {
            setSearchQuery('');
            setActiveQuery('');
            setCategory('all');
            setPage(1);
            goToView('home');
          }}
        />

        <main id="main">
          {view === 'home' ? (
            <HomeView
              catalogTotal={catalogTotal}
              categories={categories}
              featuredProducts={featuredProducts}
              popularProducts={popularProducts}
              onShopAll={() => goToShop({ category: 'all' })}
              onBrowseCategory={(cat) => goToShop({ category: cat })}
              onOpenAssistant={() => goToView('assistant')}
              onProductClick={openProduct}
              onAddToCart={handleAddToCart}
            />
          ) : view === 'shop' ? (
            <ShopView
              catalogTotal={catalogTotal}
              categories={categories}
              category={category}
              query={activeQuery}
              products={products}
              pages={pages}
              page={page}
              total={total}
              loading={productsLoading}
              loadError={productsError}
              sort={sort}
              inStockOnly={inStockOnly}
              onSortChange={(s) => {
                setSort(s);
                setPage(1);
              }}
              onInStockOnlyChange={(v) => {
                setInStockOnly(v);
                setPage(1);
              }}
              onCategoryChange={(cat) => {
                setCategory(cat);
                setPage(1);
                if (cat !== 'all') {
                  setActiveQuery('');
                  setSearchQuery('');
                }
                loadCategories();
              }}
              onClearSearch={() => {
                setActiveQuery('');
                setSearchQuery('');
                setPage(1);
              }}
              onSearchAllCategories={() => {
                setCategory('all');
                setPage(1);
              }}
              onPageChange={setPage}
              onProductClick={openProduct}
              onAddToCart={handleAddToCart}
            />
          ) : view === 'assistant' ? (
            <AssistantView
              groqOn={groqOn}
              groqBadge={<>{groqLabel}</>}
              voiceLabel={voiceLabel}
              brokerUrl={brokerUrl}
              aiMessage={aiMessage}
              aiChatHistory={aiChatHistory}
              aiBusy={aiBusy}
              onAddToCart={handleAddToCart}
              onAiMessageChange={setAiMessage}
              onAiChatSend={handleAiChatSend}
              onClearAiChat={handleClearAiChat}
            />
          ) : (
            <OrdersView
              orders={orders}
              loading={ordersLoading}
              loadError={ordersError}
              onDownloadReceipt={handleDownloadOrderReceipt}
              downloadingOrderId={downloadingOrderId}
            />
          )}
        </main>

        <SiteFooter onAdmin={showAdminConsole ? openAdmin : undefined} />
      </div>

      <CartDrawer
        open={cartOpen}
        cart={validCart}
        productsBySku={productsBySku}
        subtotal={subtotal}
        tax={tax}
        total={cartTotal}
        onClose={() => setCartOpen(false)}
        onUpdateQty={(sku, qty) => {
          updateQty(cartUserId, sku, qty);
          refreshCart();
        }}
        onCheckout={openCheckout}
      />

      <ProductModal
        open={productModalOpen}
        product={selectedProduct}
        onClose={() => setProductModalOpen(false)}
        onAddToCart={handleAddToCart}
      />

      <CheckoutModal
        open={checkoutOpen}
        step={checkoutStep}
        reviewHtml={checkoutReview}
        totalCents={checkoutTotal}
        subtotalCents={subtotal}
        shippingCents={checkoutShippingCents}
        statusMessage={checkoutStatus}
        savedCard={savedCard}
        shippingAddress={shippingAddress}
        deliveryOption={deliveryOption}
        displayName={user?.displayName ?? ''}
        successAmount={successAmount}
        successTxn={successTxn}
        successOrderId={successOrderId}
        successDelivery={successDelivery}
        successDeliveryEta={successDeliveryEta}
        successItems={successItems}
        successEmailSent={successEmailSent}
        successEmailError={successEmailError}
        userEmail={user?.email}
        productsBySku={productsBySku}
        processingMessage={processingMessage}
        canPay={Boolean(pendingConsent && savedCard && isCardComplete(savedCard))}
        onClose={closeCheckout}
        onReject={() => {
          showToast('Order cancelled');
          setTimeout(closeCheckout, 800);
        }}
        onConfirmPay={handleConfirmPay}
        onEditCard={() => {
          closeCheckout();
          setProfileTab('payment');
          setProfileOpen(true);
        }}
        onEditDelivery={undefined}
        onBackToDelivery={() => {
          setCheckoutStep('shipping');
          setCheckoutStatus(undefined);
        }}
        onShippingChange={setShippingAddress}
        onDeliveryChange={(opt) => {
          setDeliveryOption(opt);
          setCheckoutShippingCents(shippingCostCents(subtotal, opt));
        }}
        onContinueToReview={handleContinueToReview}
        onDownloadReceipt={
          successReceipt
            ? () => {
                void downloadReceiptPdf(successReceipt).then(() => showToast('Receipt downloaded'));
              }
            : undefined
        }
      />

      {user ? (
        <ProfileModal
          key={profileKey}
          open={profileOpen}
          email={user.email}
          displayName={user.displayName ?? ''}
          prefs={prefs}
          card={getCardForProfile(user.id, user.email, user.displayName ?? '')}
          error={profileError}
          saved={profileSaved}
          initialTab={profileTab}
          shippingAddress={getShippingAddress(user.id, user.displayName ?? '')}
          onClose={() => setProfileOpen(false)}
          onChangePassword={async (currentPassword, newPassword) => {
            const { ok, data } = await api<{ message?: string; error?: string }>(
              brokerUrl,
              '/api/auth/change-password',
              {
                method: 'POST',
                body: JSON.stringify({ currentPassword, newPassword }),
              },
            );
            if (!ok) return data.error ?? 'Could not update password';
            return null;
          }}
          onSave={async ({ displayName, prefs: p, card, shippingAddress: addr, activeTab }) => {
            if (!displayName) {
              setProfileError('Display name is required');
              setProfileSaved(false);
              return;
            }
            const hasPartialShipping =
              Boolean(addr.line1.trim() || addr.city.trim() || addr.postalCode.trim()) &&
              !isShippingComplete(addr);
            if (hasPartialShipping) {
              setProfileError('Please complete your delivery address or clear the fields');
              setProfileTab('delivery');
              setProfileSaved(false);
              return;
            }
            if (activeTab === 'payment' && card.last4.length !== 4) {
              setProfileError('Last 4 digits must be exactly 4 numbers');
              setProfileSaved(false);
              return;
            }
            if (activeTab === 'payment') {
              saveSavedCard(user.id, card);
            }
            saveProfilePrefs(user.id, p);
            saveShippingAddress(user.id, addr);
            setShippingAddress(addr);
            setSort(p.defaultSort);
            setInStockOnly(p.inStockOnlyDefault);
            setDeliveryOption(p.defaultDelivery);
            applyDisplaySettings(p);
            const { ok, data } = await api<{ user?: User; token?: string; error?: string }>(
              brokerUrl,
              '/api/auth/profile',
              {
                method: 'PATCH',
                body: JSON.stringify({ displayName }),
              }
            );
            if (!ok) {
              setProfileError(data.error ?? 'Could not save profile to the server');
              setProfileSaved(false);
              return;
            }
            if (data.user) {
              saveSession(data.token ?? getToken()!, data.user);
              setUser(data.user);
            }
            setProfileSaved(true);
            setProfileError(undefined);
            setProfileKey((k) => k + 1);
            applyAccentTheme(p.accent);
            showToast('Settings saved');
            setTimeout(() => setProfileOpen(false), 600);
          }}
        />
      ) : null}

      <AdminModal
        open={adminOpen}
        output={adminOutput}
        events={adminEvents}
        onClose={() => setAdminOpen(false)}
        onRunRealtime={async () => {
          setAdminOutput('Running…');
          const { ok, data } = await api(brokerUrl, '/api/demo/realtime', {
            method: 'POST',
            body: JSON.stringify({
              items: [{ sku: 'SHOE-RED-HIGH', quantity: 1 }],
              maxPriceCents: 20000,
              intentText: 'Buy classic red high-top sneakers',
            }),
          });
          setAdminOutput(JSON.stringify(data, null, 2) + (ok ? '' : '\n\n(blocked)'));
        }}
        onRunDelegated={async () => {
          setAdminOutput('Running…');
          const { ok, data } = await api(brokerUrl, '/api/demo/delegated', {
            method: 'POST',
            body: JSON.stringify({
              items: [{ sku: 'HEADPHONES-NC', quantity: 1 }],
              conditions: {
                maxPriceCents: 50000,
                allowedSkus: ['HEADPHONES-NC'],
                validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
              },
              intentText: 'Buy headphones under $500',
            }),
          });
          setAdminOutput(JSON.stringify(data, null, 2) + (ok ? '' : '\n\n(blocked)'));
        }}
      />

      <Toast message={toast} />
    </>
  );
}
