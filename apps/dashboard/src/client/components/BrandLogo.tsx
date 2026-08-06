interface BrandLogoProps {
  size?: 'sm' | 'lg';
  subtitle?: string;
}

export function BrandLogo({ size = 'sm', subtitle }: BrandLogoProps) {
  const large = size === 'lg';
  return (
    <span className={`brand-logo${large ? ' brand-logo--lg' : ''}`}>
      <img
        className="brand-logo__mark"
        src="/brand/pixelium-mark.svg"
        width={large ? 44 : 32}
        height={large ? 44 : 32}
        alt=""
        aria-hidden="true"
        decoding="async"
      />
      <span className="brand-logo__text">
        <span className="brand-logo__name">Pixelium</span>
        {subtitle ? <span className="brand-logo__sub">{subtitle}</span> : null}
      </span>
    </span>
  );
}
