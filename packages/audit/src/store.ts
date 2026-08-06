import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AuditRecord, MandateChain } from '@pixelium/shared';
import { cartChargeTotalCents } from '@pixelium/shared';

export interface OrderSummary {
  orderId: string;
  userId: string;
  flowMode: string;
  authorizedAmountCents: number;
  chargedAmountCents: number | null;
  status: 'pending' | 'matched' | 'mismatch' | 'blocked';
  intentSummary: string;
  cartSummary: string;
  createdAt: string;
  updatedAt: string;
}

interface StoreData {
  events: AuditRecord[];
  orders: Record<string, OrderSummary & { mandateChainJson?: string }>;
}

export class AuditStore {
  private dbPath: string;
  private data: StoreData;

  constructor(dbPath: string) {
    this.dbPath = dbPath.endsWith('.json') ? dbPath : `${dbPath}.json`;
    mkdirSync(dirname(this.dbPath), { recursive: true });
    this.data = this.load();
  }

  private load(): StoreData {
    if (!existsSync(this.dbPath)) {
      return { events: [], orders: {} };
    }
    return JSON.parse(readFileSync(this.dbPath, 'utf-8')) as StoreData;
  }

  private persist(): void {
    writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  logEvent(
    eventType: AuditRecord['eventType'],
    details: Record<string, unknown>,
    options: { orderId?: string; mandateId?: string; severity?: AuditRecord['severity'] } = {}
  ): AuditRecord {
    const record: AuditRecord = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      eventType,
      orderId: options.orderId,
      mandateId: options.mandateId,
      details,
      severity: options.severity ?? 'info',
    };

    this.data.events.unshift(record);
    this.persist();
    return record;
  }

  private resolveUserId(
    order: OrderSummary & { mandateChainJson?: string }
  ): string | undefined {
    if (order.userId) return order.userId;
    if (!order.mandateChainJson) return undefined;
    try {
      const chain = JSON.parse(order.mandateChainJson) as MandateChain;
      return chain.intent.payload.userId;
    } catch {
      return undefined;
    }
  }

  upsertOrderFromChain(chain: MandateChain, status: OrderSummary['status'] = 'pending'): OrderSummary {
    const orderId = chain.payment.payload.paymentId;
    const now = new Date().toISOString();
    const cartSummary = chain.cart.payload.items
      .map((i: { quantity: number; name: string }) => `${i.quantity}x ${i.name}`)
      .join(', ');

    const existing = this.data.orders[orderId];
    const summary: OrderSummary = {
      orderId,
      userId: chain.intent.payload.userId,
      flowMode: chain.intent.payload.flowMode,
      authorizedAmountCents: cartChargeTotalCents(chain.cart),
      chargedAmountCents: status === 'matched' ? chain.payment.payload.amountCents : existing?.chargedAmountCents ?? null,
      status,
      intentSummary: chain.intent.payload.naturalLanguageIntent,
      cartSummary,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.data.orders[orderId] = {
      ...summary,
      mandateChainJson: JSON.stringify(chain),
    };
    this.persist();
    return summary;
  }

  markPaymentProcessed(
    orderId: string,
    chargedAmountCents: number,
    authorizedAmountCents: number
  ): OrderSummary | undefined {
    const order = this.data.orders[orderId];
    if (!order) return undefined;

    const status =
      chargedAmountCents === authorizedAmountCents ? 'matched' : 'mismatch';
    const now = new Date().toISOString();

    order.chargedAmountCents = chargedAmountCents;
    order.status = status;
    order.updatedAt = now;
    this.persist();

    if (status === 'mismatch') {
      this.logEvent(
        'reconciliation_mismatch',
        { orderId, authorizedAmountCents, chargedAmountCents },
        { orderId, severity: 'error' }
      );
    }

    return this.getOrder(orderId);
  }

  getOrder(orderId: string): OrderSummary | undefined {
    const order = this.data.orders[orderId];
    if (!order) return undefined;
    const { mandateChainJson: _, ...summary } = order;
    return summary;
  }

  getOrderChain(orderId: string): MandateChain | undefined {
    const order = this.data.orders[orderId];
    if (!order?.mandateChainJson) return undefined;
    return JSON.parse(order.mandateChainJson) as MandateChain;
  }

  listOrders(userId?: string): OrderSummary[] {
    let orders = Object.values(this.data.orders);
    if (userId) {
      orders = orders.filter((order) => this.resolveUserId(order) === userId);
    }
    return orders
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((order) => {
        const { mandateChainJson, ...summary } = order;
        if (mandateChainJson) {
          try {
            const chain = JSON.parse(mandateChainJson) as MandateChain;
            const expected = cartChargeTotalCents(chain.cart);
            const charged = chain.payment.payload.amountCents;
            summary.authorizedAmountCents = expected;
            if (charged != null) {
              summary.chargedAmountCents = charged;
              if (summary.status !== 'blocked') {
                summary.status = charged === expected ? 'matched' : 'mismatch';
              }
            }
          } catch {
            /* keep stored summary */
          }
        }
        return summary;
      });
  }

  getOrderForUser(orderId: string, userId: string): OrderSummary | undefined {
    const order = this.data.orders[orderId];
    if (!order || this.resolveUserId(order) !== userId) return undefined;
    const { mandateChainJson: _, ...summary } = order;
    return summary;
  }

  listEvents(limit = 100): AuditRecord[] {
    return this.data.events.slice(0, limit);
  }

  getMismatches(userId?: string): OrderSummary[] {
    return this.listOrders(userId).filter((o) => o.status === 'mismatch' || o.status === 'blocked');
  }
}
