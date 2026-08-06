import type { ReceiptData } from './receipt-pdf-types';

export type { ReceiptData, ReceiptLine } from './receipt-pdf-types';

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function downloadReceiptPdf(data: ReceiptData): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Pixelium Store', margin, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text('Purchase receipt', margin, y);
  y += 28;

  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Order ${data.orderId}`, margin, y);
  y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const dateStr = data.date ? new Date(data.date).toLocaleString() : new Date().toLocaleString();
  doc.text(`Date: ${dateStr}`, margin, y);
  y += 14;

  if (data.customerName) {
    doc.text(`Customer: ${data.customerName}`, margin, y);
    y += 14;
  }
  if (data.customerEmail) {
    doc.text(`Email: ${data.customerEmail}`, margin, y);
    y += 14;
  }
  if (data.paymentRef) {
    doc.text(`Payment ref: ${data.paymentRef}`, margin, y);
    y += 14;
  }

  y += 10;
  doc.setDrawColor(220);
  doc.line(margin, y, 547, y);
  y += 18;

  doc.setFont('helvetica', 'bold');
  doc.text('Product', margin, y);
  doc.text('Qty', 340, y);
  doc.text('Amount', 480, y, { align: 'right' });
  y += 14;
  doc.setFont('helvetica', 'normal');

  for (const item of data.items) {
    if (y > 720) {
      doc.addPage();
      y = margin;
    }
    const lineTotal = item.unitPriceCents * item.quantity;
    const name = item.name.length > 48 ? `${item.name.slice(0, 46)}…` : item.name;
    doc.text(name, margin, y);
    doc.text(String(item.quantity), 340, y);
    doc.text(money(lineTotal), 480, y, { align: 'right' });
    y += 16;
  }

  y += 8;
  doc.line(margin, y, 547, y);
  y += 18;

  const shippingCents = data.shippingCents ?? 0;
  const grandTotal = data.totalCents + shippingCents;

  doc.text('Subtotal', margin, y);
  doc.text(money(data.subtotalCents), 480, y, { align: 'right' });
  y += 14;
  doc.text('Tax', margin, y);
  doc.text(money(data.taxCents), 480, y, { align: 'right' });
  y += 14;
  if (shippingCents > 0) {
    doc.text('Shipping', margin, y);
    doc.text(money(shippingCents), 480, y, { align: 'right' });
    y += 14;
  }
  doc.setFont('helvetica', 'bold');
  doc.text('Total charged', margin, y);
  doc.text(money(grandTotal), 480, y, { align: 'right' });
  y += 20;

  if (data.deliverySummary?.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.text('Delivery', margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(data.deliverySummary.trim(), 499);
    doc.text(lines, margin, y);
  }

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Thank you for shopping with consent-aware checkout at Pixelium Store.', margin, 780);

  const safeId = data.orderId.replace(/[^\w-]+/g, '_');
  doc.save(`pixelium-receipt-${safeId}.pdf`);
}
