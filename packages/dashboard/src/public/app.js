let brokerUrl = 'http://localhost:4000';
const state = { intent: null, cart: null, payment: null, products: [], brokerOnline: false };

function showBanner(message, type = 'error') {
  const el = document.getElementById('status-banner');
  el.textContent = message;
  el.className = `status-banner ${type}`;
  el.classList.remove('hidden');
}

function hideBanner() {
  document.getElementById('status-banner').classList.add('hidden');
}

async function api(path, opts = {}) {
  try {
    const res = await fetch(`${brokerUrl}${path}`, opts);
    let data;
    try {
      data = await res.json();
    } catch {
      data = { error: `Invalid response (${res.status})` };
    }
    return { ok: res.ok, data };
  } catch (err) {
    return { ok: false, data: { error: err.message || 'Network error' } };
  }
}

async function checkBroker() {
  const { ok, data } = await api('/health');
  state.brokerOnline = ok;
  if (!ok) {
    showBanner(
      'Consent broker is offline (port 4000). Run: npm run dev — in the project folder.',
      'error'
    );
    return false;
  }
  hideBanner();
  if (data.groq) {
    const badge = document.getElementById('groq-badge');
    const { data: aiStatus } = await api('/api/ai/status');
    if (aiStatus.configured) {
      badge.textContent = `Groq · ${aiStatus.model}`;
      badge.classList.remove('groq-off');
      badge.classList.add('groq-on');
    }
  }
  return true;
}

async function init() {
  try {
    const config = await fetch('/api/config').then((r) => r.json());
    brokerUrl = config.brokerUrl;
  } catch {
    showBanner('Dashboard config failed to load.', 'error');
    return;
  }

  const online = await checkBroker();
  if (!online) {
    document.getElementById('product-select').innerHTML =
      '<option>Broker offline — start services</option>';
    return;
  }

  const { ok, data } = await api('/api/catalog');
  if (!ok || !data.products) {
    showBanner(`Catalog failed: ${data.error ?? 'unknown error'}`, 'error');
    return;
  }

  state.products = data.products;
  document.getElementById('product-select').innerHTML = data.products
    .map((p) => `<option value="${p.sku}">${p.name} — $${(p.priceCents / 100).toFixed(2)}</option>`)
    .join('');

  await refresh();
}

function formatCents(cents) {
  if (cents == null) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

function setStep(n) {
  document.querySelectorAll('.step').forEach((el) => {
    const s = Number(el.dataset.step);
    el.classList.toggle('active', s === n);
    el.classList.toggle('done', s < n);
  });
  document.querySelectorAll('.panel').forEach((el) => el.classList.add('hidden'));
  document.getElementById(`panel-${n}`).classList.remove('hidden');
}

document.getElementById('btn-step1').addEventListener('click', async () => {
  const sku = document.getElementById('product-select').value;
  const maxCents = Math.round(Number(document.getElementById('max-budget').value) * 100);
  const intentText = document.getElementById('intent-text').value;
  const { ok, data } = await api('/api/intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flowMode: 'realtime',
      intentText,
      conditions: {
        maxPriceCents: maxCents,
        validUntil: new Date(Date.now() + 3600000).toISOString(),
      },
    }),
  });
  if (!ok) {
    alert(data.error ?? 'Failed to create intent');
    return;
  }
  state.intent = data.intentMandate;
  state._items = [{ sku, quantity: 1 }];
  document.getElementById('cart-preview').textContent =
    `Intent signed.\nSKU: ${sku}\nBudget: ${formatCents(maxCents)}`;
  setStep(2);
});

document.getElementById('btn-back2').addEventListener('click', () => setStep(1));

document.getElementById('btn-step2').addEventListener('click', async () => {
  const { ok, data } = await api('/api/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intentMandate: state.intent, items: state._items }),
  });
  if (!ok || data.error) {
    alert(data.error ?? 'Failed to build cart');
    return;
  }
  state.cart = data.cartMandate;
  const items = data.cartMandate.payload.items
    .map((i) => `${i.quantity}x ${i.name}`)
    .join(', ');
  document.getElementById('consent-review').innerHTML = `
    <p><strong>Items:</strong> ${items}</p>
    <p><strong>Subtotal:</strong> ${formatCents(data.cartMandate.payload.subtotalCents)}</p>
    <p><strong>Tax:</strong> ${formatCents(data.cartMandate.payload.taxCents)}</p>
    <p><strong>Total:</strong> ${formatCents(data.cartMandate.payload.totalCents)}</p>
    <p><strong>Merchant:</strong> ${data.cartMandate.payload.merchantName}</p>`;
  setStep(3);
});

document.getElementById('btn-reject').addEventListener('click', () => {
  state.intent = state.cart = state.payment = null;
  document.getElementById('wizard-result').textContent = 'Purchase rejected by user.';
  setStep(1);
});

document.getElementById('btn-approve').addEventListener('click', () => {
  document.getElementById('payment-preview').innerHTML =
    `<p>Cart approved. Ready to sign Payment Mandate for ${formatCents(state.cart.payload.totalCents)}.</p>
     <p>Card: ****4242 (mock)</p>`;
  setStep(4);
});

document.getElementById('btn-step4').addEventListener('click', async () => {
  const { data: pm, ok: pmOk } = await api('/api/payment-mandate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intentMandate: state.intent, cartMandate: state.cart }),
  });
  if (!pmOk) {
    alert(pm.error ?? 'Payment mandate failed');
    return;
  }
  state.payment = pm.paymentMandate;
  const { ok, data } = await api('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mandateChain: { intent: state.intent, cart: state.cart, payment: state.payment },
    }),
  });
  document.getElementById('wizard-result').textContent = JSON.stringify(data, null, 2);
  if (ok) setStep(1);
  await refresh();
});

async function refresh() {
  if (!state.brokerOnline) {
    await checkBroker();
    if (!state.brokerOnline) return;
  }

  const [ordersRes, eventsRes, mismatchesRes, jobsRes] = await Promise.all([
    api('/api/audit/orders'),
    api('/api/audit/events?limit=50'),
    api('/api/audit/mismatches'),
    api('/api/delegated/jobs'),
  ]);

  const orders = ordersRes.data.orders ?? [];
  const events = eventsRes.data.events ?? [];
  const mismatches = mismatchesRes.data.mismatches ?? [];
  const jobs = jobsRes.data.jobs ?? [];

  document.querySelector('#orders-table tbody').innerHTML =
    orders.length === 0
      ? '<tr><td colspan="8">No orders yet</td></tr>'
      : orders
          .map(
            (o) => `<tr>
      <td><code>${o.orderId.slice(0, 8)}…</code></td>
      <td>${o.flowMode}</td>
      <td>${o.cartSummary.slice(0, 40)}${o.cartSummary.length > 40 ? '…' : ''}</td>
      <td>${formatCents(o.authorizedAmountCents)}</td>
      <td>${formatCents(o.chargedAmountCents)}</td>
      <td class="status-${o.status}">${o.status}</td>
      <td>${o.intentSummary.slice(0, 40)}${o.intentSummary.length > 40 ? '…' : ''}</td>
      <td><button class="link" data-order="${o.orderId}">chain</button></td>
    </tr>`
          )
          .join('');

  document.querySelectorAll('[data-order]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { data } = await api(`/api/audit/orders/${btn.dataset.order}`);
      document.getElementById('chain-details').classList.remove('hidden');
      document.getElementById('chain-json').textContent = JSON.stringify(
        data.mandateChain,
        null,
        2
      );
    });
  });

  document.querySelector('#jobs-table tbody').innerHTML =
    jobs.length === 0
      ? '<tr><td colspan="4">No watch jobs yet</td></tr>'
      : jobs
          .map(
            (j) => `<tr>
      <td><code>${j.id}</code></td>
      <td class="status-${j.status}">${j.status}</td>
      <td>${j.intentMandate.payload.naturalLanguageIntent.slice(0, 40)}…</td>
      <td>${new Date(j.createdAt).toLocaleString()}</td>
    </tr>`
          )
          .join('');

  document.querySelector('#events-table tbody').innerHTML =
    events.length === 0
      ? '<tr><td colspan="4">No events yet</td></tr>'
      : events
          .map(
            (e) => `<tr>
      <td>${new Date(e.timestamp).toLocaleTimeString()}</td>
      <td>${e.eventType}</td>
      <td class="severity-${e.severity}">${e.severity}</td>
      <td><code>${JSON.stringify(e.details).slice(0, 70)}</code></td>
    </tr>`
          )
          .join('');

  const badge = document.getElementById('mismatch-badge');
  badge.classList.toggle('hidden', !mismatches.length);
  if (mismatches.length) badge.textContent = `${mismatches.length} issue(s)`;
}

async function runDemo(path, body) {
  const out = document.getElementById('demo-output');
  out.textContent = 'Running…';
  const { ok, data } = await api(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (data.error && !data.result) {
    out.textContent = `Error: ${data.error}\n\nRun: npm run dev`;
    return;
  }
  out.textContent = JSON.stringify(data, null, 2);
  if (!ok) out.textContent += '\n\n(blocked by broker)';
  await refresh();
}

document.getElementById('btn-realtime').addEventListener('click', () =>
  runDemo('/api/demo/realtime', {
    items: [{ sku: 'SHOE-RED-HIGH', quantity: 1 }],
    maxPriceCents: 20000,
    intentText: 'Buy classic red high-top sneakers',
  })
);

document.getElementById('btn-delegated').addEventListener('click', () =>
  runDemo('/api/demo/delegated', {
    items: [{ sku: 'HEADPHONES-NC', quantity: 1 }],
    conditions: {
      maxPriceCents: 50000,
      allowedSkus: ['HEADPHONES-NC'],
      validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
    },
    intentText: 'Buy headphones under $500 — delegated',
  })
);

document.getElementById('btn-watch').addEventListener('click', () =>
  runDemo('/api/delegated/watch', {
    items: [{ sku: 'BOOK-AI-AGENTS', quantity: 1 }],
    conditions: {
      maxPriceCents: 10000,
      allowedSkus: ['BOOK-AI-AGENTS'],
      validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
      validFrom: new Date(Date.now() + 3000).toISOString(),
    },
    intentText: 'Auto-buy book in 3 seconds (monitor demo)',
  })
);

document.getElementById('btn-refresh').addEventListener('click', async () => {
  await checkBroker();
  if (state.brokerOnline && state.products.length === 0) await init();
  else await refresh();
});

document.getElementById('btn-ai-parse').addEventListener('click', async () => {
  const message = document.getElementById('ai-message').value.trim();
  const out = document.getElementById('ai-output');
  out.textContent = 'Parsing with Groq...';
  const { ok, data } = await api('/api/ai/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  out.textContent = JSON.stringify(data, null, 2);
  if (!ok) out.textContent += '\n\n(parse failed)';
});

document.getElementById('btn-ai-buy').addEventListener('click', async () => {
  const message = document.getElementById('ai-message').value.trim();
  const out = document.getElementById('ai-output');
  out.textContent = 'AI purchase in progress...';
  const { ok, data } = await api('/api/ai/purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  out.textContent = JSON.stringify(data, null, 2);
  if (!ok) out.textContent += '\n\n(blocked by broker)';
  await refresh();
});

init();
setInterval(refresh, 8000);
