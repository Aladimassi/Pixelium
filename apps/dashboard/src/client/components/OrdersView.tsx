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
}

export function OrdersView({ orders, loading }: OrdersViewProps) {
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6}>Loading…</td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No orders yet — start shopping!</td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.orderId}>
                      <td>
                        <code>{o.orderId.slice(0, 8)}…</code>
                      </td>
                      <td>{o.flowMode}</td>
                      <td>
                        {o.cartSummary.slice(0, 36)}
                        {o.cartSummary.length > 36 ? '…' : ''}
                      </td>
                      <td>{formatPrice(o.chargedAmountCents)}</td>
                      <td>
                        <span className={`status-${o.status}`}>{o.status}</span>
                      </td>
                      <td></td>
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
