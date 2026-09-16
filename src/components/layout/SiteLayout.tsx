import { Link, NavLink, Outlet } from 'react-router-dom';
import { Logo } from './Logo';
import { useApp } from '../../state/AppContext';
import { useT } from '../../i18n';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';

const NAV = [
  { to: '/how-it-works', key: 'nav.howItWorks' },
  { to: '/safety', key: 'nav.safety' },
  { to: '/privacy', key: 'nav.privacy' },
] as const;

export function SiteLayout() {
  const { session } = useApp();
  const t = useT();

  return (
    <div className="site">
      <a className="skip-link" href="#main">
        {t('nav.skipToContent')}
      </a>

      <header className="site-header">
        <div className="site-header-inner">
          <Logo />
          <nav className="site-nav" aria-label={t('nav.main')}>
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                {t(n.key)}
              </NavLink>
            ))}
          </nav>
          <div className="row row-2">
            <LanguageSwitcher compact />
            {session ? (
              <Link to="/app" className="btn btn-primary btn-sm">
                {t('nav.goToDashboard')}
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm">
                  {t('nav.signIn')}
                </Link>
                <Link to="/signup" className="btn btn-primary btn-sm">
                  {t('nav.createAccount')}
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
              {t('footer.tagline')}
            </p>
          </div>
          <div className="footer-col">
            <h4>{t('footer.product')}</h4>
            <Link to="/how-it-works">{t('nav.howItWorks')}</Link>
            <Link to="/safety">{t('nav.safety')}</Link>
            <Link to="/privacy">{t('nav.privacy')}</Link>
            <Link to="/signup">{t('footer.createAccount')}</Link>
          </div>
          <div className="footer-col">
            <h4>{t('footer.forParents')}</h4>
            <Link to="/safety#meeting">{t('footer.meetingSafely')}</Link>
            <Link to="/safety#reporting">{t('footer.reportingBlocking')}</Link>
            <Link to="/privacy#children">{t('footer.whatWeShow')}</Link>
            <Link to="/privacy#data">{t('footer.whatWeCollect')}</Link>
          </div>
          <div className="footer-col">
            <h4>{t('footer.aboutBuild')}</h4>
            <span className="muted">{t('footer.notLive')}</span>
            <span className="muted">{t('footer.verifSimulated')}</span>
            <span className="muted">{t('footer.mockOnly')}</span>
          </div>
        </div>

        <div className="footer-bottom">
          <span>{t('footer.bottomLeft')}</span>
          <span>{t('footer.bottomRight')}</span>
        </div>
      </footer>
    </div>
  );
}
