import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SavedCard } from '../lib/payment';
import { BRAND_OPTIONS } from '../lib/payment';
import { ACCENT_OPTIONS, AVATAR_OPTIONS, SORT_OPTIONS, applyAccentTheme, applyDisplaySettings, type ProfilePrefs } from '../lib/profile';
import { DELIVERY_OPTIONS, type DeliveryOption, type ShippingAddress, isShippingComplete } from '../lib/shipping';
import type { CatalogSort } from './ShopView';
import { SavedCardView } from './SavedCardView';
import { ShippingAddressFields } from './ShippingAddressFields';
import { useDialog } from '../hooks/useDialog';

interface ProfileModalProps {
  open: boolean;
  email: string;
  displayName: string;
  prefs: ProfilePrefs;
  card: SavedCard;
  error?: string;
  saved?: boolean;
  initialTab?: 'identity' | 'settings' | 'appearance' | 'payment' | 'delivery';
  shippingAddress: ShippingAddress;
  onClose: () => void;
  onSave: (data: {
    displayName: string;
    prefs: ProfilePrefs;
    card: SavedCard;
    shippingAddress: ShippingAddress;
    activeTab: 'identity' | 'settings' | 'appearance' | 'payment' | 'delivery';
  }) => void | Promise<void>;
  onChangePassword?: (currentPassword: string, newPassword: string) => Promise<string | null>;
}

const PROFILE_TABS = [
  { id: 'identity', label: 'Profile' },
  { id: 'settings', label: 'Preferences' },
  { id: 'delivery', label: 'Address' },
  { id: 'appearance', label: 'Theme' },
  { id: 'payment', label: 'Payment' },
] as const;

type ProfileTab = (typeof PROFILE_TABS)[number]['id'];

export function ProfileModal({
  open,
  email,
  displayName: initialDisplayName,
  prefs: initialPrefs,
  card: initialCard,
  error,
  saved,
  initialTab = 'identity',
  shippingAddress: initialShippingAddress,
  onClose,
  onSave,
  onChangePassword,
}: ProfileModalProps) {
  const dialogRef = useDialog(open);
  const [tab, setTab] = useState<ProfileTab>(initialTab);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [prefs, setPrefs] = useState<ProfilePrefs>(initialPrefs);
  const [card, setCard] = useState(initialCard);
  const [shippingAddress, setShippingAddress] = useState(initialShippingAddress);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const setPref = <K extends keyof ProfilePrefs>(key: K, value: ProfilePrefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'accent') document.documentElement.dataset.accent = String(value);
      if (key === 'reduceMotion' || key === 'compactShop') {
        document.documentElement.dataset.reduceMotion = next.reduceMotion ? 'true' : 'false';
        document.documentElement.dataset.compactShop = next.compactShop ? 'true' : 'false';
      }
      return next;
    });
  };

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setDisplayName(initialDisplayName);
    setPrefs(initialPrefs);
    setCard(initialCard);
    setShippingAddress(initialShippingAddress);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setPasswordSaved(false);
  }, [open, initialTab, initialDisplayName, initialPrefs, initialCard, initialShippingAddress]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleNativeClose = () => {
      applyAccentTheme(initialPrefs.accent);
      applyDisplaySettings(initialPrefs);
      onClose();
    };
    dialog.addEventListener('close', handleNativeClose);
    return () => dialog.removeEventListener('close', handleNativeClose);
  }, [initialPrefs, onClose, dialogRef]);

  const previewCard = { ...card };

  const handleClose = () => {
    applyAccentTheme(initialPrefs.accent);
    applyDisplaySettings(initialPrefs);
    onClose();
  };

  return createPortal(
    <>
      <div
        className={`overlay profile-overlay${open ? '' : ' hidden'}`}
        aria-hidden="true"
        onClick={handleClose}
      />
      <dialog ref={dialogRef} id="profile-modal" className="checkout-modal profile-modal">
      <header className="profile-modal__header">
        <div className="profile-modal__intro">
          <span className="profile-modal__avatar" aria-hidden="true">
            {prefs.avatar}
          </span>
          <div>
            <h2>Your profile</h2>
            <p id="profile-email" className="profile-modal__email">
              {email}
            </p>
          </div>
        </div>
        <button type="button" id="btn-close-profile" className="modal-close" aria-label="Close" onClick={handleClose}>
          ✕
        </button>
      </header>

      <div className="profile-tabs-wrap">
        <div className="profile-tabs" role="tablist" aria-label="Profile sections">
          {PROFILE_TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`profile-tab${tab === id ? ' active' : ''}`}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="profile-modal__body">
        <div id="profile-panel-identity" className={`profile-panel${tab === 'identity' ? '' : ' hidden'}`} role="tabpanel">
          <section className="profile-section">
            <h3 className="profile-section__title">How you appear in the store</h3>
            <p className="profile-section__desc">Pick an avatar and name shown in the navigation bar.</p>
            <div id="profile-avatar-picker" className="avatar-picker" aria-label="Choose avatar">
              {AVATAR_OPTIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`avatar-pick${a === prefs.avatar ? ' active' : ''}`}
                  aria-label={`Use avatar ${a}`}
                  aria-pressed={a === prefs.avatar}
                  onClick={() => setPref('avatar', a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </section>

          <section className="profile-section">
            <div className="profile-field">
              <label htmlFor="profile-display-name">Display name</label>
              <input
                type="text"
                id="profile-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How should we greet you?"
              />
            </div>
            <div className="profile-field">
              <label htmlFor="profile-tagline">
                Tagline <span className="label-optional">optional</span>
              </label>
              <input
                type="text"
                id="profile-tagline"
                maxLength={48}
                value={prefs.tagline}
                onChange={(e) => setPref('tagline', e.target.value)}
                placeholder="A short note about you"
              />
            </div>
          </section>
        </div>

        <div id="profile-panel-settings" className={`profile-panel${tab === 'settings' ? '' : ' hidden'}`} role="tabpanel">
          <section className="profile-section settings-group">
            <h3 className="profile-section__title">Shopping defaults</h3>
            <p className="profile-section__desc">Set your preferred delivery speed and how products are sorted.</p>
            <div className="profile-field">
              <label htmlFor="settings-default-delivery">Default delivery</label>
              <select
                id="settings-default-delivery"
                value={prefs.defaultDelivery}
                onChange={(e) => setPref('defaultDelivery', e.target.value as DeliveryOption)}
              >
                {DELIVERY_OPTIONS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label} — {d.eta}
                  </option>
                ))}
              </select>
            </div>
            <div className="profile-field">
              <label htmlFor="settings-default-sort">Default sort order</label>
              <select
                id="settings-default-sort"
                value={prefs.defaultSort}
                onChange={(e) => setPref('defaultSort', e.target.value as CatalogSort)}
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={prefs.inStockOnlyDefault}
                onChange={(e) => setPref('inStockOnlyDefault', e.target.checked)}
              />
              <span>Only show in-stock items when I open the shop</span>
            </label>
          </section>

          <section className="profile-section settings-group">
            <h3 className="profile-section__title">Notifications</h3>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={prefs.emailReceipts}
                onChange={(e) => setPref('emailReceipts', e.target.checked)}
              />
              <span>Email me a receipt after each purchase</span>
            </label>
            <p className="profile-section__desc">Receipts go to your account email. Turn this off if you only want the PDF download.</p>
          </section>

          <section className="profile-section settings-group">
            <h3 className="profile-section__title">Display</h3>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={prefs.compactShop}
                onChange={(e) => setPref('compactShop', e.target.checked)}
              />
              <span>Show more products per row in the shop</span>
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={prefs.reduceMotion}
                onChange={(e) => setPref('reduceMotion', e.target.checked)}
              />
              <span>Reduce animations and motion</span>
            </label>
          </section>

          {onChangePassword ? (
            <section className="profile-section settings-group">
              <h3 className="profile-section__title">Password</h3>
              <p className="profile-section__desc">Choose a strong password with at least 6 characters.</p>
              <div className="profile-field">
                <label htmlFor="settings-current-password">Current password</label>
                <input
                  type="password"
                  id="settings-current-password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="profile-field">
                <label htmlFor="settings-new-password">New password</label>
                <input
                  type="password"
                  id="settings-new-password"
                  autoComplete="new-password"
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="profile-field">
                <label htmlFor="settings-confirm-password">Confirm new password</label>
                <input
                  type="password"
                  id="settings-confirm-password"
                  autoComplete="new-password"
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {passwordError ? <p className="form-error">{passwordError}</p> : null}
              {passwordSaved ? <p className="profile-save-msg">Password updated</p> : null}
              {newPassword && confirmPassword && newPassword !== confirmPassword ? (
                <p className="form-error">Passwords do not match</p>
              ) : null}
              <button
                type="button"
                className="btn-secondary btn-full"
                disabled={passwordLoading || !currentPassword || !newPassword}
                onClick={async () => {
                  if (newPassword !== confirmPassword) {
                    setPasswordError('Passwords do not match');
                    return;
                  }
                  setPasswordLoading(true);
                  setPasswordError(null);
                  setPasswordSaved(false);
                  const err = await onChangePassword!(currentPassword, newPassword);
                  setPasswordLoading(false);
                  if (err) {
                    setPasswordError(err);
                  } else {
                    setPasswordSaved(true);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }
                }}
              >
                {passwordLoading ? 'Updating…' : 'Update password'}
              </button>
            </section>
          ) : null}
        </div>

        <div id="profile-panel-delivery" className={`profile-panel${tab === 'delivery' ? '' : ' hidden'}`} role="tabpanel">
          <section className="profile-section">
            <h3 className="profile-section__title">Delivery address</h3>
            <p className="profile-section__desc">
              Saved on this device for your account. Checkout skips the address step when this is complete.
            </p>
            {isShippingComplete(shippingAddress) ? (
              <p className="profile-banner profile-banner--success" role="status">
                Address saved — checkout and AI purchases will use it automatically.
              </p>
            ) : null}
            <div className="shipping-form shipping-form--profile">
              <ShippingAddressFields
                address={shippingAddress}
                onChange={(patch) => setShippingAddress((prev) => ({ ...prev, ...patch }))}
                idPrefix="profile-ship"
              />
            </div>
          </section>
        </div>

        <div
          id="profile-panel-appearance"
          className={`profile-panel${tab === 'appearance' ? '' : ' hidden'}`}
          role="tabpanel"
        >
          <section className="profile-section">
            <h3 className="profile-section__title">Accent color</h3>
            <p className="profile-section__desc">Choose the highlight color for buttons, links, and accents across the store.</p>
            <div id="profile-accent-picker" className="accent-picker">
              {ACCENT_OPTIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`accent-pick${a.id === prefs.accent ? ' active' : ''}`}
                  aria-pressed={a.id === prefs.accent}
                  onClick={() => setPref('accent', a.id)}
                >
                  <span className="accent-pick__swatch" style={{ background: a.swatch }} />
                  <span className="accent-pick__label">{a.label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div id="profile-panel-payment" className={`profile-panel${tab === 'payment' ? '' : ' hidden'}`} role="tabpanel">
          <section className="profile-section">
            <h3 className="profile-section__title">Saved payment method</h3>
            <p className="profile-section__desc">
              Stored on this device for your account only — never shared with other users.
            </p>
            <div id="profile-card-preview">
              <SavedCardView card={previewCard} />
            </div>
            <div className="profile-field">
              <label htmlFor="profile-card-nickname">
                Card label <span className="label-optional">optional</span>
              </label>
              <input
                type="text"
                id="profile-card-nickname"
                maxLength={24}
                value={card.nickname ?? ''}
                onChange={(e) => setCard({ ...card, nickname: e.target.value })}
                placeholder="Primary card"
              />
            </div>
            <div className="profile-field">
              <label htmlFor="profile-card-brand">Card type</label>
              <select
                id="profile-card-brand"
                value={card.brand}
                onChange={(e) => {
                  const opt = BRAND_OPTIONS.find((b) => b.id === e.target.value);
                  setCard({ ...card, brand: e.target.value, icon: opt?.icon ?? card.icon, label: opt?.label ?? card.label });
                }}
              >
                {BRAND_OPTIONS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label} {b.icon}
                  </option>
                ))}
              </select>
            </div>
            <div className="profile-field">
              <label htmlFor="profile-card-icon">Card icon (1–2 characters)</label>
              <input
                type="text"
                id="profile-card-icon"
                maxLength={2}
                value={card.icon}
                onChange={(e) => setCard({ ...card, icon: e.target.value })}
                placeholder="◆"
              />
            </div>
            <div className="profile-field">
              <label htmlFor="profile-card-name">Name on card</label>
              <input
                type="text"
                id="profile-card-name"
                value={card.nameOnCard}
                onChange={(e) => setCard({ ...card, nameOnCard: e.target.value })}
                placeholder="Name as printed on card"
              />
            </div>
            <div className="profile-form-row">
              <div className="profile-field">
                <label htmlFor="profile-card-last4">Last 4 digits</label>
                <input
                  type="text"
                  id="profile-card-last4"
                  inputMode="numeric"
                  maxLength={4}
                  value={card.last4}
                  onChange={(e) => setCard({ ...card, last4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  placeholder="4242"
                />
              </div>
              <div className="profile-field">
                <label htmlFor="profile-card-exp">Expiry</label>
                <input
                  type="text"
                  id="profile-card-exp"
                  maxLength={5}
                  value={card.exp}
                  onChange={(e) => {
                    let v = e.target.value.replace(/\D/g, '').slice(0, 4);
                    if (v.length >= 2) v = v.slice(0, 2) + '/' + v.slice(2);
                    setCard({ ...card, exp: v });
                  }}
                  placeholder="12/28"
                />
              </div>
            </div>
            <div className="profile-field">
              <label htmlFor="profile-card-style">Card style</label>
              <select
                id="profile-card-style"
                value={card.style ?? 'default'}
                onChange={(e) => setCard({ ...card, style: e.target.value })}
              >
                <option value="default">Solid</option>
                <option value="glass">Glass</option>
                <option value="gradient">Gradient</option>
              </select>
            </div>
            <div className="profile-field">
              <label htmlFor="profile-card-accent">Card glow</label>
              <select
                id="profile-card-accent"
                value={card.accent ?? 'orange'}
                onChange={(e) => setCard({ ...card, accent: e.target.value })}
              >
                <option value="orange">Orange</option>
                <option value="gold">Gold</option>
                <option value="slate">Slate</option>
              </select>
            </div>
          </section>
        </div>
      </div>

      <footer className="profile-modal__footer">
        {error ? (
          <p id="profile-error" className="form-error">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p id="profile-saved" className="profile-save-msg" role="status">
            Your changes were saved
          </p>
        ) : null}
        <button
          type="button"
          id="btn-save-profile"
          className="btn-primary btn-full profile-modal__save"
          onClick={() =>
            onSave({
              displayName: displayName.trim(),
              prefs,
              card,
              shippingAddress,
              activeTab: tab,
            })
          }
        >
          Save changes
        </button>
      </footer>
    </dialog>
    </>,
    document.body,
  );
}
