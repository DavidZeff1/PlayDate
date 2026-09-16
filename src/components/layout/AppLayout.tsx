import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { useApp } from '../../state/AppContext';
import { api } from '../../services';
import { Avatar, LoadingBlock } from '../ui';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { useT } from '../../i18n';
import type { TKey } from '../../i18n/types';
import {
  IconBell,
  IconCalendar,
  IconChildren,
  IconCompass,
  IconFamily,
  IconGavel,
  IconHome,
  IconInbox,
  IconLogout,
  IconMenu,
  IconMessage,
  IconSettings,
  IconShieldCheck,
  IconSparkle,
  IconX,
} from '../ui/Icons';

interface Counts {
  requests: number;
  messages: number;
  notifications: number;
  playdates: number;
}

export function AppLayout() {
  const { session, family, loading, signOut } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Counts>({
    requests: 0,
    messages: 0,
    notifications: 0,
    playdates: 0,
  });

  const loadCounts = useCallback(async () => {
    if (!family) return;
    try {
      const dash = await api.getDashboard();
      setCounts({
        requests: dash.pendingIncomingRequests,
        messages: dash.unreadMessages,
        notifications: dash.unreadNotifications,
        playdates: dash.upcomingPlaydates.length,
      });
    } catch {
      /* counts are decoration — never block the shell on them */
    }
  }, [family]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts, location.pathname]);

  // Close the mobile drawer on navigation.
  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!loading && !session) navigate('/login', { replace: true });
  }, [loading, session, navigate]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <LoadingBlock label={t('nav.loadingFamily')} />
      </div>
    );
  }

  if (!session) return null;

  // A signed-in parent with no family record is mid-onboarding.
  if (!family && !location.pathname.startsWith('/onboarding')) {
    navigate('/onboarding', { replace: true });
    return null;
  }

  const titleKey = TITLE_KEYS[location.pathname];
  const title = titleKey ? t(titleKey) : 'PlayDate';

  return (
    <div className="app-shell">
      <a className="skip-link" href="#app-main">
        {t('nav.skipToContent')}
      </a>

      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside className="sidebar" data-open={open} aria-label={t('nav.main')}>
        <div className="sidebar-head">
          <div className="row row-between">
            <Logo to="/app" />
            <button
              className="btn-icon mobile-nav-toggle"
              onClick={() => setOpen(false)}
              aria-label={t('nav.closeNav')}
            >
              <IconX size={18} />
            </button>
          </div>

          {family && (
            <Link to="/app/family" className="sidebar-family">
              <Avatar name={family.displayName} color="var(--brand-600)" size="sm" square />
              <div className="grow" style={{ minWidth: 0 }}>
                <div
                  className="strong small"
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {family.displayName}
                </div>
                <div className="tiny muted">
                  {family.children.length}{' '}
                  {family.children.length === 1 ? t('common.child') : t('common.children')}
                  {family.verificationStatus === 'verified' && ` · ${t('set.verified')}`}
                </div>
              </div>
            </Link>
          )}
        </div>

        <nav className="sidebar-nav">
          <NavItem to="/app" end icon={<IconHome size={17} />} label={t('nav.dashboard')} />

          <div className="nav-section-label">{t('nav.yourFamily')}</div>
          <NavItem to="/app/family" icon={<IconFamily size={17} />} label={t('nav.myFamily')} />
          <NavItem to="/app/children" icon={<IconChildren size={17} />} label={t('nav.myChildren')} />

          <div className="nav-section-label">{t('nav.connect')}</div>
          <NavItem to="/app/discover" icon={<IconCompass size={17} />} label={t('nav.discover')} />
          <NavItem to="/app/matches" icon={<IconSparkle size={17} />} label={t('nav.matches')} />
          <NavItem
            to="/app/requests"
            icon={<IconInbox size={17} />}
            label={t('nav.requests')}
            count={counts.requests}
          />
          <NavItem
            to="/app/messages"
            icon={<IconMessage size={17} />}
            label={t('nav.messages')}
            count={counts.messages}
          />
          <NavItem
            to="/app/playdates"
            icon={<IconCalendar size={17} />}
            label={t('nav.playdates')}
            count={counts.playdates}
            quiet
          />

          <div className="nav-section-label">{t('nav.account')}</div>
          <NavItem
            to="/app/notifications"
            icon={<IconBell size={17} />}
            label={t('nav.notifications')}
            count={counts.notifications}
            quiet
          />
          <NavItem to="/app/verification" icon={<IconShieldCheck size={17} />} label={t('nav.verification')} />
          <NavItem to="/app/safety" icon={<IconShieldCheck size={17} />} label={t('nav.safetyCentre')} />
          <NavItem to="/app/settings" icon={<IconSettings size={17} />} label={t('nav.settings')} />

          <div className="nav-section-label">{t('nav.staffTools')}</div>
          <NavItem to="/admin" icon={<IconGavel size={17} />} label={t('nav.moderation')} />
        </nav>

        <div className="sidebar-foot stack stack-3">
          <LanguageSwitcher compact />
          <button
            className="btn btn-ghost btn-sm btn-block"
            style={{ justifyContent: 'flex-start' }}
            onClick={async () => {
              await signOut();
              navigate('/');
            }}
          >
            <IconLogout size={16} />
            {t('nav.signOut')}
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="row row-3">
            <button
              className="btn-icon mobile-nav-toggle"
              onClick={() => setOpen(true)}
              aria-label={t('nav.openNav')}
              aria-expanded={open}
            >
              <IconMenu size={20} />
            </button>
            <span className="topbar-title">{title}</span>
          </div>

          <div className="row row-2">
            <Link
              to="/app/notifications"
              className="btn-icon"
              aria-label={t('nav.notifications')}
              style={{ position: 'relative' }}
            >
              <IconBell size={19} />
              {counts.notifications > 0 && (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: 5,
                    insetInlineEnd: 5,
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background: 'var(--accent-500)',
                    boxShadow: '0 0 0 2px var(--bg)',
                  }}
                />
              )}
              {counts.notifications > 0 && (
                <span className="sr-only">
                  {t('nav.unreadNotifications', { n: counts.notifications })}
                </span>
              )}
            </Link>
          </div>
        </header>

        <main className="app-content" id="app-main">
          <Outlet context={{ reloadCounts: loadCounts }} />
        </main>
      </div>
    </div>
  );
}

function NavItem({
  to,
  icon,
  label,
  count,
  end,
  quiet,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
  end?: boolean;
  quiet?: boolean;
}) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
      {icon}
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span className={`nav-count${quiet ? ' nav-count-quiet' : ''}`}>{count}</span>
      )}
    </NavLink>
  );
}

const TITLE_KEYS: Record<string, TKey> = {
  '/app': 'nav.dashboard',
  '/app/family': 'nav.myFamily',
  '/app/children': 'nav.myChildren',
  '/app/discover': 'nav.discover',
  '/app/matches': 'nav.matches',
  '/app/requests': 'nav.requests',
  '/app/messages': 'nav.messages',
  '/app/playdates': 'nav.playdates',
  '/app/notifications': 'nav.notifications',
  '/app/verification': 'nav.verification',
  '/app/safety': 'nav.safetyCentre',
  '/app/settings': 'nav.settings',
};
