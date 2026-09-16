import { Link } from 'react-router-dom';

/**
 * The mark: two overlapping rounded forms — two families meeting — inside a soft
 * square. Abstract and calm on purpose. A cartoon child or a heart would push the
 * product towards either a toy or a dating app, both of which the brief rules out.
 */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <span className="logo-mark" style={{ width: size, height: size, borderRadius: size * 0.29 }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="9.5" r="5.2" fill="rgba(255,255,255,0.95)" />
        <circle cx="15" cy="14.5" r="5.2" fill="rgba(255,255,255,0.55)" />
      </svg>
    </span>
  );
}

export function Logo({ to = '/', subtitle }: { to?: string; subtitle?: string }) {
  return (
    <Link to={to} className="logo">
      <LogoMark />
      <span>
        PlayDate
        {subtitle && (
          <span
            className="tiny muted"
            style={{ display: 'block', fontWeight: 500, letterSpacing: 0, lineHeight: 1.2 }}
          >
            {subtitle}
          </span>
        )}
      </span>
    </Link>
  );
}
