interface SiteFooterProps {
  onAdmin?: () => void;
}

export function SiteFooter({ onAdmin }: SiteFooterProps) {
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <strong>Pixelium</strong>
          <p className="hint">Secure checkout with explicit approval on every purchase.</p>
        </div>
        <div>
          <p className="site-footer__title">Shop</p>
          <ul className="site-footer__links">
            <li>New arrivals</li>
            <li>Electronics</li>
            <li>Footwear</li>
            <li>Free shipping over $50</li>
          </ul>
        </div>
        <div>
          <p className="site-footer__title">Support</p>
          <ul className="site-footer__links">
            <li>Help center</li>
            <li>Returns &amp; refunds</li>
            <li>Track order</li>
            <li>Contact us</li>
          </ul>
        </div>
        <div>
          <p className="site-footer__title">Trust</p>
          <ul className="site-footer__links">
            <li>🔒 SSL encrypted</li>
            <li>✓ Consent-first payments</li>
            <li>↩ 30-day returns*</li>
          </ul>
        </div>
      </div>
      <div className="container site-footer__bar">
        <p>© {new Date().getFullYear()} Pixelium Store · Prices in USD · Tax calculated at checkout</p>
        {onAdmin ? (
          <button type="button" id="btn-admin" className="btn-ghost btn-sm" onClick={onAdmin}>
            Audit console
          </button>
        ) : null}
      </div>
    </footer>
  );
}
