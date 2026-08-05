import type { SavedCard } from '../lib/payment';

interface SavedCardViewProps {
  card: SavedCard;
  compact?: boolean;
  linkProfile?: boolean;
  onEditCard?: () => void;
}

export function SavedCardView({ card, compact, linkProfile, onEditCard }: SavedCardViewProps) {
  const number = `•••• •••• •••• ${card.last4}`;
  const style = card.style || 'default';
  const accent = card.accent || 'orange';
  const nickname = card.nickname?.trim();

  return (
    <>
      <div
        className={`saved-card saved-card--${style} saved-card--accent-${accent}${compact ? ' saved-card--compact' : ''}`}
      >
        <div className="saved-card__icon" aria-hidden="true">
          {card.icon}
        </div>
        <div className="saved-card__body">
          {nickname ? <p className="saved-card__nickname">{nickname}</p> : null}
          <p className="saved-card__brand">{card.label}</p>
          <p className="saved-card__number">{number}</p>
          <p className="saved-card__meta">
            {card.nameOnCard} · {card.exp}
          </p>
        </div>
      </div>
      {linkProfile ? (
        <p className="hint">
          <button type="button" className="btn-ghost btn-inline" onClick={onEditCard}>
            Customize in profile
          </button>
        </p>
      ) : null}
    </>
  );
}
