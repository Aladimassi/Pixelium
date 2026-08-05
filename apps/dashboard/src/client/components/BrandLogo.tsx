const ICON_SRC = '/brand/pixulium-icon.png';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  subtitle?: string;
  className?: string;
}

const SIZES = {
  sm: 32,
  md: 40,
  lg: 48,
} as const;

export function BrandLogo({ size = 'md', showText = true, subtitle = 'Store', className = '' }: BrandLogoProps) {
  const px = SIZES[size];

  return (
    <span className={`brand-logo brand-logo--${size}${className ? ` ${className}` : ''}`}>
      <img
        className="brand-logo__icon"
        src={ICON_SRC}
        alt="Pixulium"
        width={px}
        height={px}
        decoding="async"
      />
      {showText ? (
        <span className="brand-logo__text">
          <span className="brand-logo__name">Pixulium</span>
          {subtitle ? <span className="brand-logo__sub">{subtitle}</span> : null}
        </span>
      ) : null}
    </span>
  );
}

export { ICON_SRC as PIXULIUM_ICON_SRC };
