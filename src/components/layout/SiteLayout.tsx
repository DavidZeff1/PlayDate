import { Link, NavLink, Outlet } from 'react-router-dom';
import { Logo } from './Logo';
import { useApp } from '../../state/AppContext';

const NAV = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/safety', label: 'Safety' },
  { to: '/privacy', label: 'Privacy' },
];

export function SiteLayout() {
  const { session } = useApp();

  return (
    <div className="site">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="site-header">
        <div className="site-header-inner">
          <Logo />
          <nav className="site-nav" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="row row-2">
            {session ? (
              <Link to="/app" className="btn btn-primary btn-sm">
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm">
                  Sign in
                </Link>
                <Link to="/signup" className="btn btn-primary btn-sm">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="site-main" id="main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="footer-col">
            <Logo />
            <p className="small muted" style={{ marginTop: 'var(--sp-4)', maxWidth: '32ch' }}>
              Families discovering families. Verified parents, controlled discovery, and
              nothing shared without consent.
            </p>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <Link to="/how-it-works">How it works</Link>
            <Link to="/safety">Safety</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/signup">Create an account</Link>
          </div>
          <div className="footer-col">
            <h4>For parents</h4>
            <Link to="/safety#meeting">Meeting safely</Link>
            <Link to="/safety#reporting">Reporting &amp; blocking</Link>
            <Link to="/privacy#children">What we show about children</Link>
            <Link to="/privacy#data">What we collect</Link>
          </div>
          <div className="footer-col">
            <h4>About this build</h4>
            <span className="muted">Prototype — not a live service</span>
            <span className="muted">Verification is simulated</span>
            <span className="muted">Mock data only</span>
          </div>
        </div>

        <div className="footer-bottom">
          <span>PlayDate — MVP prototype. Fictional families, simulated verification.</span>
          <span>
            Legal, privacy and child-safety review are production requirements, not
            completed work.
          </span>
        </div>
      </footer>
    </div>
  );
}
