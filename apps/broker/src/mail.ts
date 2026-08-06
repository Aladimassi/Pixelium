import nodemailer from 'nodemailer';
import type { MandateChain } from '@pixelium/shared';

let transporter: nodemailer.Transporter | null = null;

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function orderDisplayId(transactionId: string, paymentId: string): string {
  const raw = transactionId || paymentId;
  return `PX-${raw.slice(-8).toUpperCase()}`;
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim());
}

function getTransporter(): nodemailer.Transporter {
  if (!isMailConfigured()) {
    throw new Error('Email is not configured on the server (SMTP_HOST / SMTP_USER missing).');
  }
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST!.trim(),
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER!.trim(),
        pass: process.env.SMTP_PASS ?? '',
      },
    });
  }
  return transporter;
}

export function publicAppUrl(): string {
  const raw = process.env.PUBLIC_APP_URL ?? process.env.PUBLIC_URL ?? 'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const from = process.env.SMTP_FROM?.trim() || 'Pixelium Store <noreply@pixelium.com>';
  const subject = 'Reset your Pixelium Store password';
  const text = [
    'You requested a password reset for your Pixelium Store account.',
    '',
    'Open this link to choose a new password (valid for 1 hour):',
    resetUrl,
    '',
    'If you did not request this, you can ignore this email.',
  ].join('\n');
  const html = `
    <p>You requested a password reset for your <strong>Pixelium Store</strong> account.</p>
    <p><a href="${resetUrl}">Reset your password</a> — link valid for 1 hour.</p>
    <p style="color:#666;font-size:14px;">If you did not request this, ignore this email.</p>
  `;

  await getTransporter().sendMail({ from, to, subject, text, html });
}

export async function trySendPurchaseReceiptEmail(
  to: string,
  displayName: string | undefined,
  chain: MandateChain,
  transactionId: string,
  extras?: { shippingSummary?: string; shippingCents?: number; deliveryLabel?: string },
): Promise<{ sent: boolean; error?: string }> {
  if (!isMailConfigured() || !to.trim()) {
    return { sent: false, error: 'Email is not configured on the server.' };
  }

  const cart = chain.cart.payload;
  const payment = chain.payment.payload;
  const orderId = orderDisplayId(transactionId, payment.paymentId);
  const ordersUrl = `${publicAppUrl()}/orders`;
  const greeting = displayName?.trim() ? `Hi ${displayName.trim()},` : 'Hi,';
  const shippingCents = extras?.shippingCents ?? cart.shippingCents ?? 0;
  const grandTotalCents = payment.amountCents;

  const itemLines = cart.items.map(
    (item) => `  • ${item.quantity}× ${item.name} — ${formatMoney(item.unitPriceCents * item.quantity)}`,
  );

  const from = process.env.SMTP_FROM?.trim() || 'Pixelium Store <noreply@pixelium.com>';
  const boughtSummary =
    cart.items.length === 1
      ? cart.items[0].name
      : `${cart.items.length} items`;
  const subject = `What you bought — ${boughtSummary} (${orderId})`;

  const textParts = [
    greeting,
    '',
    'Here is what you purchased at Pixelium Store:',
    '',
    `Order: ${orderId}`,
    ...itemLines.map((line) => line.trimStart()),
    '',
    `Subtotal: ${formatMoney(cart.subtotalCents)}`,
    `Tax: ${formatMoney(cart.taxCents)}`,
  ];
  if (shippingCents > 0) {
    textParts.push(`Shipping: ${formatMoney(shippingCents)}`);
  } else if (extras?.deliveryLabel) {
    textParts.push(`Shipping: Free (${extras.deliveryLabel})`);
  }
  textParts.push(`Total charged: ${formatMoney(grandTotalCents)}`);
  if (extras?.shippingSummary?.trim()) {
    textParts.push('', 'Delivery:', extras.shippingSummary.trim());
  }
  textParts.push('', `Payment ref: ${transactionId || payment.paymentId}`, '', `View orders: ${ordersUrl}`);

  const text = textParts.join('\n');

  const itemsHtml = cart.items
    .map(
      (item) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid #eee">${item.quantity}× <strong>${item.name}</strong></td>` +
        `<td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right">${formatMoney(item.unitPriceCents * item.quantity)}</td></tr>`,
    )
    .join('');

  const shippingRow =
    shippingCents > 0
      ? `<tr><td style="padding:8px 0">Shipping</td><td style="text-align:right">${formatMoney(shippingCents)}</td></tr>`
      : extras?.deliveryLabel
        ? `<tr><td style="padding:8px 0">Shipping</td><td style="text-align:right">Free (${extras.deliveryLabel})</td></tr>`
        : '';

  const deliveryHtml = extras?.shippingSummary?.trim()
    ? `<p style="margin:16px 0;padding:12px;background:#f4f4f5;border-radius:8px;"><strong>Delivery</strong><br/><span style="color:#444;font-size:14px;white-space:pre-line">${extras.shippingSummary.trim()}</span></p>`
    : '';

  const html = `
    <p>${greeting}</p>
    <p><strong>Here's what you bought</strong> at Pixelium Store:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <thead><tr>
        <th style="text-align:left;padding:8px 0;border-bottom:2px solid #ddd">Product</th>
        <th style="text-align:right;padding:8px 0;border-bottom:2px solid #ddd">Price</th>
      </tr></thead>
      <tbody>${itemsHtml}</tbody>
      <tfoot>
        <tr><td style="padding:8px 0">Subtotal</td><td style="text-align:right">${formatMoney(cart.subtotalCents)}</td></tr>
        <tr><td style="padding:8px 0">Tax</td><td style="text-align:right">${formatMoney(cart.taxCents)}</td></tr>
        ${shippingRow}
        <tr><td style="padding:12px 0;font-weight:bold">Total charged</td><td style="text-align:right;font-weight:bold">${formatMoney(grandTotalCents)}</td></tr>
      </tfoot>
    </table>
    ${deliveryHtml}
    <p style="color:#666;font-size:14px;">Order ${orderId} · Payment ref ${transactionId || payment.paymentId}</p>
    <p><a href="${ordersUrl}">View your orders</a></p>
  `;

  try {
    await getTransporter().sendMail({ from, to: to.trim(), subject, text, html });
    console.info(`[purchase-receipt] Sent to ${to.trim()} — order ${orderId}`);
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[purchase-receipt]', message);
    return { sent: false, error: message };
  }
}

/** @deprecated use trySendPurchaseReceiptEmail */
export async function trySendOrderConfirmationEmail(
  to: string,
  displayName: string | undefined,
  chain: MandateChain,
  transactionId: string,
): Promise<boolean> {
  const result = await trySendPurchaseReceiptEmail(to, displayName, chain, transactionId);
  return result.sent;
}
