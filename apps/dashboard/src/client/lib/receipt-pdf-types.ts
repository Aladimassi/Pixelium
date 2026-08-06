export interface ReceiptLine {
  name: string;
  quantity: number;
  unitPriceCents: number;
}

export interface ReceiptData {
  orderId: string;
  date?: string;
  items: ReceiptLine[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  shippingCents?: number;
  deliverySummary?: string;
  paymentRef?: string;
  customerName?: string;
  customerEmail?: string;
}
