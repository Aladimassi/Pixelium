import { useEffect, useState } from 'react';
import type { SavedCard } from '../lib/payment';
import { BRAND_OPTIONS } from '../lib/payment';
import { ACCENT_OPTIONS, AVATAR_OPTIONS } from '../lib/profile';
import { SavedCardView } from './SavedCardView';
import { useDialog } from '../hooks/useDialog';

interface ProfileModalProps {
  open: boolean;
  email: string;
  displayName: string;
  tagline: string;
  avatar: string;
  accent: string;
  card: SavedCard;
  error?: string;
  saved?: boolean;
  initialTab?: 'identity' | 'appearance' | 'payment';
  onClose: () => void;
  onSave: (data: {
    displayName: string;
    prefs: { avatar: string; tagline: string; accent: string };
    card: SavedCard;
  }) => void;
}

export function ProfileModal({
  open,
  email,
  displayName: initialDisplayName,
  tagline: initialTagline,
  avatar: initialAvatar,
  accent: initialAccent,
  card: initialCard,
  error,
  saved,
  initialTab = 'identity',
  onClose,
  onSave,
}: ProfileModalProps) {
  const dialogRef = useDialog(open);
  const [tab, setTab] = useState(initialTab);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [tagline, setTagline] = useState(initialTagline);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [accent, setAccent] = useState(initialAccent);
  const [card, setCard] = useState(initialCard);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setDisplayName(initialDisplayName);
    setTagline(initialTagline);
    setAvatar(initialAvatar);
    setAccent(initialAccent);
    setCard(initialCard);
  }, [open, initialTab, initialDisplayName, initialTagline, initialAvatar, initialAccent, initialCard]);

  const previewCard = { ...card };

  return (
    <dialog ref={dialogRef} id="profile-modal" className="checkout-modal profile-modal">
      <button type="button" id="btn-close-profile" className="modal-close" aria-label="Close" onClick={onClose}>
        ✕
      </button>
      <p className="consent-label">Your account</p>
      <h2>Profile &amp; preferences</h2>
      <p id="profile-email" className="hint">
        {email}
      </p>

      <div className="profile-tabs" role="tablist" aria-label="Profile sections">
        {(['identity', 'appearance', 'payment'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`profile-tab${tab === t ? ' active' : ''}`}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
          >
            {t === 'identity' ? 'Identity' : t === 'appearance' ? 'Appearance' : 'Payment'}
          </button>
        ))}
      </div>

      <div id="profile-panel-identity" className={`profile-panel${tab === 'identity' ? '' : ' hidden'}`} role="tabpanel">
        <div id="profile-avatar-preview" className="profile-avatar-preview">
          <span className="profile-avatar-preview__icon">{avatar}</span>
          <span className="profile-avatar-preview__name">{displayName.trim() || 'Your name'}</span>
        </div>
        <p className="hint profile-field-hint">Pick an avatar shown in the nav bar</p>
        <div id="profile-avatar-picker" className="avatar-picker">
          {AVATAR_OPTIONS.map((a) => (
            <button
              key={a}
              type="button"
              className={`avatar-pick${a === avatar ? ' active' : ''}`}
              aria-label={`Avatar ${a}`}
              onClick={() => setAvatar(a)}
            >
              {a}
            </button>
          ))}
        </div>
        <label htmlFor="profile-display-name">Display name</label>
        <input
          type="text"
          id="profile-display-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name"
        />
        <label htmlFor="profile-tagline">
          Tagline <span className="label-optional">optional</span>
        </label>
        <input
          type="text"
          id="profile-tagline"
          maxLength={48}
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="e.g. Consent-native shopper"
        />
      </div>

      <div
        id="profile-panel-appearance"
        className={`profile-panel${tab === 'appearance' ? '' : ' hidden'}`}
        role="tabpanel"
      >
        <p className="section-header__eyebrow">Accent theme</p>
        <p className="hint profile-field-hint">Colors buttons, links, and glow effects across the store</p>
        <div id="profile-accent-picker" className="accent-picker">
          {ACCENT_OPTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`accent-pick${a.id === accent ? ' active' : ''}`}
              onClick={() => {
                setAccent(a.id);
                document.documentElement.dataset.accent = a.id;
              }}
            >
              <span className="accent-pick__swatch" style={{ background: a.swatch }} />
              <span className="accent-pick__label">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div id="profile-panel-payment" className={`profile-panel${tab === 'payment' ? '' : ' hidden'}`} role="tabpanel">
        <p className="section-header__eyebrow">Saved payment method</p>
        <p className="hint profile-field-hint">
          Your card is saved on this device only, linked to your account — not shared with other users.
        </p>
        <div id="profile-card-preview">
          <SavedCardView card={previewCard} />
        </div>
        <label htmlFor="profile-card-nickname">
          Card label <span className="label-optional">optional</span>
        </label>
        <input
          type="text"
          id="profile-card-nickname"
          maxLength={24}
          value={card.nickname ?? ''}
          onChange={(e) => setCard({ ...card, nickname: e.target.value })}
          placeholder="Primary"
        />
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
        <label htmlFor="profile-card-icon">Icon (1–2 characters)</label>
        <input
          type="text"
          id="profile-card-icon"
          maxLength={2}
          value={card.icon}
          onChange={(e) => setCard({ ...card, icon: e.target.value })}
          placeholder="◆"
        />
        <label htmlFor="profile-card-name">Name on card</label>
        <input
          type="text"
          id="profile-card-name"
          value={card.nameOnCard}
          onChange={(e) => setCard({ ...card, nameOnCard: e.target.value })}
          placeholder="Name on card"
        />
        <div className="profile-form-row">
          <label htmlFor="profile-card-last4">
            Last 4 digits
            <input
              type="text"
              id="profile-card-last4"
              inputMode="numeric"
              maxLength={4}
              value={card.last4}
              onChange={(e) => setCard({ ...card, last4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              placeholder="4242"
            />
          </label>
          <label htmlFor="profile-card-exp">
            Expiry
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
          </label>
        </div>
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
        <label htmlFor="profile-card-accent">Card glow</label>
        <select
          id="profile-card-accent"
          value={card.accent ?? 'orange'}
          onChange={(e) => setCard({ ...card, accent: e.target.value })}
        >
          <option value="orange">Orange glow</option>
          <option value="gold">Gold glow</option>
          <option value="slate">Slate</option>
        </select>
      </div>

      {error ? (
        <p id="profile-error" className="form-error">
          {error}
        </p>
      ) : (
        <p id="profile-error" className="form-error hidden" />
      )}
      {saved ? (
        <p id="profile-saved" className="hint">
          Saved ✓
        </p>
      ) : (
        <p id="profile-saved" className="hint hidden" />
      )}
      <button
        type="button"
        id="btn-save-profile"
        className="btn-primary btn-full"
        onClick={() =>
          onSave({
            displayName: displayName.trim(),
            prefs: { avatar, tagline: tagline.trim(), accent },
            card,
          })
        }
      >
        Save profile →
      </button>
    </dialog>
  );
}
