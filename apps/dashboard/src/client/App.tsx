import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, loadBrokerConfig } from './lib/api';
import {
  clearSession,
  getToken,
  getUser,
  isLoggedIn,
  saveSession,
  type User,
} from './lib/auth';
import {
  addToCart,
  cartCount,
  cartSubtotal,
  clearCart,
  discardLegacySharedCart,
  formatPrice,
  loadCart,
  handleProductImageError,
  productImageUrl,
  updateQty,
  type CartItem,
  type Product,
} from './lib/cart';
import { cardDisplayLine, ensureDemoCard, getCardForProfile, getSavedCard, isCardComplete, isDemoUser, saveSavedCard } from './lib/payment';
import { applyAccentTheme, getProfilePrefs, saveProfilePrefs } from './lib/profile';
import { AdminModal } from './components/AdminModal';
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
import {
  type DeliveryOption,
  type ShippingAddress,
  formatDeliverySummary,
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
}

type View = 'shop' | 'orders';
type CheckoutStep = 'shipping' | 'review' | 'processing' | 'success';

function renderCartMandateReview(
  cartMandate: PendingConsent['cart'],
  productsBySku: Record<string, Product>,
  shippingCents: number,
  shippingSummary?: string,
  extra?: React.ReactNode
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

export function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [brokerUrl, setBrokerUrl] = useState('');
  const [view, setView] = useState<View>('shop');
  const [toast, setToast] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [category, setCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsBySku, setProductsBySku] = useState<Record<string, Product>>({});
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string>();
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
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

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<'identity' | 'appearance' | 'payment'>('identity');
  const [profileError, setProfileError] = useState<string>();
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileKey, setProfileKey] = useState(0);

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

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
  const savedCard = useMemo(
    () => (user ? getSavedCard(user.id, user.email) : null),
    [user?.id, user?.email, profileKey]
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

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
    setCart(user?.id ? loadCart(user.id) : []);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setCart([]);
      return;
    }
    discardLegacySharedCart();
    setCart(loadCart(user.id));
  }, [user?.id]);

  const validCart = useMemo(() => {
    return cart.filter((item) => productsBySku[item.sku]);
  }, [cart, productsBySku]);

  const subtotal = useMemo(() => cartSubtotal(validCart, productsBySku), [validCart, productsBySku]);
  const tax = useMemo(() => Math.round(subtotal * 0.08), [subtotal]);
  const cartTotal = subtotal + tax;

  const userGreeting = useMemo(() => {
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
  }, [user, prefs]);

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

  const loadFeatured = useCallback(async () => {
    const { ok, data } = await api<{ products?: Product[] }>(brokerUrl, '/api/catalog/featured');
    if (!ok) return;
    const list = data.products ?? [];
    setFeaturedProducts(list);
    setProductsBySku((prev) => ({ ...prev, ...Object.fromEntries(list.map((p) => [p.sku, p])) }));
  }, [brokerUrl]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    const { ok, data } = await api<{ orders?: Order[] }>(brokerUrl, '/api/audit/orders');
    setOrdersLoading(false);
    if (ok) setOrders(data.orders ?? []);
  }, [brokerUrl]);

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
    if (!authenticated) return;
    loadAiStatus();
    loadCategories();
    loadFeatured();
  }, [authenticated, brokerUrl, loadAiStatus, loadCategories, loadFeatured]);

  useEffect(() => {
    if (!authenticated) return;
    loadProducts();
  }, [authenticated, loadProducts]);

  useEffect(() => {
    if (user?.id) applyAccentTheme(prefs.accent);
  }, [user?.id, prefs.accent]);

  useEffect(() => {
    async function init() {
      if (!isLoggedIn()) return;
      const { ok, status, data } = await api<{ user?: User }>(brokerUrl, '/api/auth/me');
      if (!ok) {
        if (status === 401) clearSession();
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

  const handleAddToCart = (sku: string) => {
    if (!user?.id) return;
    addToCart(user.id, sku);
    refreshCart();
    showToast('Added to cart');
  };

  const enrichCartProducts = useCallback(async () => {
    if (!user?.id) return;
    const current = loadCart(user.id);
    const missing = current.filter((i) => !productsBySku[i.sku]).map((i) => i.sku);
    if (missing.length === 0) return;
    const updates: Record<string, Product> = {};
    for (const sku of missing) {
      const { ok, data } = await api<{ product?: Product }>(brokerUrl, `/api/catalog/${encodeURIComponent(sku)}`);
      if (ok && data.product) updates[sku] = data.product;
    }
    if (Object.keys(updates).length) setProductsBySku((prev) => ({ ...prev, ...updates }));
  }, [brokerUrl, productsBySku, user?.id]);

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
    if (!user?.id) return;
    const current = loadCart(user.id);
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
    setShippingAddress(getShippingAddress(user.id, user.displayName ?? ''));
    setCheckoutStep('shipping');
    setCheckoutOpen(true);
  };

  const prepareCheckoutReview = async () => {
    if (!user?.id) return;
    const current = loadCart(user.id);
    const items = current.map((i) => ({ sku: i.sku, quantity: i.quantity }));
    setCheckoutReview(<p className="loading">Preparing your order…</p>);

    const { ok, data } = await api<{
      cartMandate?: PendingConsent['cart'];
      intentMandate?: Mandate;
      error?: string;
    }>(brokerUrl, '/api/checkout/prepare', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });

    if (!ok || !data.cartMandate || !data.intentMandate) {
      setCheckoutReview(<p className="form-error">{data.error ?? 'Failed to build cart'}</p>);
      return;
    }

    const shipCents = shippingCostCents(data.cartMandate.payload.subtotalCents, deliveryOption);
    const shipSummary = formatDeliverySummary(shippingAddress, deliveryOption, shipCents);
    setPendingConsent({ intent: data.intentMandate, cart: data.cartMandate, source: 'cart' });
    setCheckoutReview(
      renderCartMandateReview(data.cartMandate, productsBySku, shipCents, shipSummary)
    );
    setCheckoutShippingCents(shipCents);
    setCheckoutTotal(data.cartMandate.payload.totalCents + shipCents);
    setCheckoutStep('review');
  };

  const handleContinueToReview = async () => {
    if (!user?.id) return;
    saveShippingAddress(user.id, shippingAddress);
    if (pendingConsent) {
      const shipCents = shippingCostCents(pendingConsent.cart.payload.subtotalCents, deliveryOption);
      const shipSummary = formatDeliverySummary(shippingAddress, deliveryOption, shipCents);
      const extra =
        pendingConsent.parsed && pendingConsent.source === 'ai' ? (
          <p className="ai-result__summary">{String(pendingConsent.parsed.naturalLanguageIntent ?? '')}</p>
        ) : undefined;
      setCheckoutReview(
        renderCartMandateReview(pendingConsent.cart, productsBySku, shipCents, shipSummary, extra)
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

    const { ok: pmOk, data: pmData } = await api<{ paymentMandate?: Mandate; error?: string }>(
      brokerUrl,
      '/api/payment-mandate',
      {
        method: 'POST',
        body: JSON.stringify({ intentMandate: intent, cartMandate: cart, last4 }),
      }
    );
    if (!pmOk) {
      setCheckoutStep('review');
      setCheckoutStatus(pmData.error ?? 'Payment mandate failed');
      return;
    }

    await new Promise((r) => setTimeout(r, 500));
    setProcessingMessage('Processing charge…');

    const { ok, data } = await api<{
      success?: boolean;
      payment?: { transactionId?: string; amountCents?: number; message?: string };
      errors?: string[];
      error?: string;
    }>(brokerUrl, '/api/submit', {
      method: 'POST',
      body: JSON.stringify({
        mandateChain: { intent, cart, payment: pmData.paymentMandate },
      }),
    });

    await new Promise((r) => setTimeout(r, 400));

    if (ok && data.success) {
      const orderId = `PX-${String(data.payment?.transactionId ?? Date.now()).slice(-8).toUpperCase()}`;
      setSuccessAmount(formatPrice(cart.payload.totalCents + checkoutShippingCents));
      setSuccessTxn(`Payment ref ${data.payment?.transactionId ?? '—'}`);
      setSuccessOrderId(orderId);
      setSuccessDelivery(formatDeliverySummary(shippingAddress, deliveryOption, checkoutShippingCents));
      setSuccessItems(cart.payload.items);
      if (pendingConsent.source === 'cart') {
        clearCart(user?.id);
        refreshCart();
      }
      if (pendingConsent.source === 'ai' && pendingConsent.parsed) {
        setAiChatHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Purchase approved — ${String(pendingConsent.parsed?.aiSummary ?? 'Order complete')}. Transaction ${data.payment?.transactionId ?? '—'}, charged ${formatPrice(data.payment?.amountCents ?? 0)}.`,
          },
        ]);
      }
      loadOrders();
      setCheckoutStep('success');
      showToast('Payment complete');
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
    if (user?.id) {
      setShippingAddress(getShippingAddress(user.id, user.displayName ?? ''));
    }
    const shipCents = shippingCostCents(cartMandate.payload.subtotalCents, deliveryOption);
    const shipSummary = formatDeliverySummary(shippingAddress, deliveryOption, shipCents);
    setPendingConsent({ intent: intentMandate, cart: cartMandate, parsed, source: 'ai' });
    const extra = parsed ? (
      <p className="ai-result__summary">{String(parsed.naturalLanguageIntent ?? '')}</p>
    ) : undefined;
    setCheckoutReview(renderCartMandateReview(cartMandate, productsBySku, shipCents, shipSummary, extra));
    setCheckoutShippingCents(shipCents);
    setCheckoutTotal(cartMandate.payload.totalCents + shipCents);
    setCheckoutStep('shipping');
    setCheckoutStatus(undefined);
    setCheckoutOpen(true);
  };

  const handleAiChatSend = async () => {
    const text = aiMessage.trim();
    if (!text || aiBusy) return;

    const historyForApi = aiChatHistory.map((t) => ({ role: t.role, content: t.content }));
    setAiMessage('');
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
        openAiCheckout(data.intentMandate, data.cartMandate, data.parsed);
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

  if (!authenticated) {
    return (
      <>
        <VoidBackground />
        <AuthScreen onLogin={handleLogin} onRegister={handleRegister} />
        <Toast message={toast} />
      </>
    );
  }

  return (
    <>
      <VoidBackground />
      <div id="app-shell">
        <div className="promo-bar">
          <div className="container promo-bar__inner">
            <span>Free standard shipping on orders over €50</span>
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
            setActiveQuery(q);
            setPage(1);
            if (q) setCategory('all');
          }}
          onNavShop={() => setView('shop')}
          onNavOrders={() => {
            setView('orders');
            loadOrders();
          }}
          onCart={() => {
            setCartOpen(true);
            refreshCart();
          }}
          onProfile={() => {
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
          }}
          onLogoHome={() => {
            setSearchQuery('');
            setActiveQuery('');
            setCategory('all');
            setPage(1);
            setView('shop');
            loadCategories();
          }}
        />

        <main id="main">
          {view === 'shop' ? (
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
              groqOn={groqOn}
              groqBadge={
                <>
                  {groqLabel}
                </>
              }
              voiceLabel={voiceLabel}
              brokerUrl={brokerUrl}
              aiMessage={aiMessage}
              aiChatHistory={aiChatHistory}
              aiBusy={aiBusy}
              featuredProducts={featuredProducts}
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
              onAiMessageChange={setAiMessage}
              onAiChatSend={handleAiChatSend}
              onClearAiChat={handleClearAiChat}
            />
          ) : (
            <OrdersView orders={orders} loading={ordersLoading} onBack={() => setView('shop')} />
          )}
        </main>

        <SiteFooter onAdmin={openAdmin} />
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
          if (!user?.id) return;
          updateQty(user.id, sku, qty);
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
        successItems={successItems}
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
        onShippingChange={setShippingAddress}
        onDeliveryChange={(opt) => {
          setDeliveryOption(opt);
          setCheckoutShippingCents(shippingCostCents(subtotal, opt));
        }}
        onContinueToReview={handleContinueToReview}
      />

      {user ? (
        <ProfileModal
          key={profileKey}
          open={profileOpen}
          email={user.email}
          displayName={user.displayName ?? ''}
          tagline={prefs.tagline}
          avatar={prefs.avatar}
          accent={prefs.accent}
          card={getCardForProfile(user.id, user.email, user.displayName ?? '')}
          error={profileError}
          saved={profileSaved}
          initialTab={profileTab}
          onClose={() => setProfileOpen(false)}
          onSave={async ({ displayName, prefs: p, card }) => {
            if (!displayName) {
              setProfileError('Display name is required');
              return;
            }
            if (card.last4.length !== 4) {
              setProfileError('Last 4 digits must be exactly 4 numbers');
              return;
            }
            saveSavedCard(user.id, card);
            saveProfilePrefs(user.id, p);
            const { ok, data } = await api<{ user?: User; token?: string; error?: string }>(
              brokerUrl,
              '/api/auth/profile',
              {
                method: 'PATCH',
                body: JSON.stringify({ displayName }),
              }
            );
            if (ok && data.user) {
              saveSession(data.token ?? getToken()!, data.user);
              setUser(data.user);
            } else if (!ok) {
              setUser({ ...user, displayName });
            }
            setProfileSaved(true);
            setProfileError(undefined);
            setProfileKey((k) => k + 1);
            applyAccentTheme(p.accent);
            showToast('Profile saved');
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
