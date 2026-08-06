import { formatPrice } from '../lib/cart';

export interface Order {
  orderId: string;
  flowMode: string;
  cartSummary: string;
  chargedAmountCents: number;
  status: string;
}

interface OrdersViewProps {
  orders: Order[];
  loading: boolean;
  loadError?: string;
  onDownloadReceipt?: (orderId: string) => void;
  downloadingOrderId?: string | null;
}

export function OrdersView({ orders, loading, loadError, onDownloadReceipt, downloadingOrderId }: OrdersViewProps) {
  return (
    <div id="orders-view" className="page-view">
      <section className="section section--inverted">
        <div className="container">
          <div className="section-header">
            <p className="section-header__eyebrow">Your account</p>
            <h2>Order History</h2>
          </div>
          <div className="table-wrap">
            <table id="orders-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Flow</th>
                  <th>Items</th>
                  <th>Charged</th>
                  <th>Status</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6}>Loading…</td>
                  </tr>
                ) : loadError ? (
                  <tr>
                    <td colSpan={6} className="form-error">
                      {loadError}
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No orders yet — start shopping!</td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.orderId}>
                      <td>
                        <code title={o.orderId}>{o.orderId.slice(0, 12)}…</code>
                      </td>
                      <td>{o.flowMode}</td>
                      <td title={o.cartSummary}>
                        {o.cartSummary.slice(0, 64)}
                        {o.cartSummary.length > 64 ? '…' : ''}
                      </td>
                      <td>{formatPrice(o.chargedAmountCents)}</td>
                      <td>
                        <span className={`status-${o.status}`}>{o.status}</span>
                      </td>
                      <td>
                        {onDownloadReceipt ? (
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            disabled={downloadingOrderId === o.orderId}
                            onClick={() => onDownloadReceipt(o.orderId)}
                          >
                            {downloadingOrderId === o.orderId ? 'Loading…' : 'PDF ↓'}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
