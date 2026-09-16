import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type DashboardSummary } from '../../services';
import { Alert, Avatar, Badge, LoadingBlock, PrototypeNote } from '../../components/ui';
import { TrustSignals, VerificationBadge } from '../../components/family/FamilyBits';
import { useT } from '../../i18n';
import { useI18n } from '../../i18n';
import {
  IconArrowForward,
  IconCalendar,
  IconCheck,
  IconClock,
  IconCompass,
  IconInbox,
  IconMapPin,
  IconMessage,
  IconShieldCheck,
  IconSparkle,
  IconUsers,
} from '../../components/ui/Icons';

/**
 * The dashboard answers one question: what can I do now?
 *
 * Next steps come first, because a parent who cannot yet browse needs to be told why
 * rather than shown an empty discovery feed. Stats come second. Everything else is
 * context.
 */
export function Dashboard() {
  const t = useT();
  const { d } = useI18n();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getDashboard()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t('dash.loadError')));
  }, []);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data) return <LoadingBlock />;

  const { family, parent, account } = data;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t('dash.morning') : hour < 18 ? t('dash.afternoon') : t('dash.evening');
  const surname = family.displayName.replace(/^The\s+/, '').replace(/\s+Family$/, '');

  return (
    <div className="stack stack-8">
      <div>
        <h1 className="greeting">
          {t('dash.greeting', { greeting, name: surname })} <span aria-hidden="true">👋</span>
        </h1>
        <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
          {data.nextSteps.length > 0 ? t('dash.attention') : t('dash.allSet')}
        </p>
      </div>

      {/* ---- What to do now ---------------------------------------------- */}
      {data.nextSteps.length > 0 && (
        <section className="stack stack-4">
          <h2 style={{ fontSize: 'var(--text-lg)' }}>{t('dash.whatNow')}</h2>
          <div className="stack stack-3">
            {data.nextSteps.map((s) => (
              <div key={s.id} className="next-step">
                <div className={`next-step-icon ${s.tone}`}>
                  {s.tone === 'safety' ? (
                    <IconShieldCheck size={17} />
                  ) : s.tone === 'info' ? (
                    <IconSparkle size={17} />
                  ) : (
                    <IconCheck size={17} />
                  )}
                </div>
                <div className="grow">
                  <div className="strong">{t(s.titleKey as never, s.titleVars)}</div>
                  <p className="small muted" style={{ marginTop: 2 }}>
                    {t(s.descKey as never)}
                  </p>
                </div>
                <Link to={s.href} className="btn btn-secondary btn-sm">
                  {t(s.ctaKey as never)}
                  <IconArrowForward size={14} />
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- Stats -------------------------------------------------------- */}
      <section className="stat-row">
        <Link to="/app/discover" className="stat">
          <div className="row row-2 small muted" style={{ marginBottom: 'var(--sp-2)' }}>
            <IconCompass size={14} />
            {t('dash.potentialFamilies')}
          </div>
          <div className="stat-value">{data.matchCount}</div>
          <div className="stat-label">{t('dash.matchPrefs')}</div>
        </Link>

        <Link to="/app/requests" className="stat">
          <div className="row row-2 small muted" style={{ marginBottom: 'var(--sp-2)' }}>
            <IconInbox size={14} />
            {t('nav.requests')}
          </div>
          <div className="stat-value">{data.pendingIncomingRequests}</div>
          <div className="stat-label">
            {t('dash.waitingForYou')}
            {data.pendingOutgoingRequests > 0 &&
              ` · ${t('dash.andSent', { n: data.pendingOutgoingRequests })}`}
          </div>
        </Link>

        <Link to="/app/messages" className="stat">
          <div className="row row-2 small muted" style={{ marginBottom: 'var(--sp-2)' }}>
            <IconMessage size={14} />
            {t('nav.messages')}
          </div>
          <div className="stat-value">{data.unreadMessages}</div>
          <div className="stat-label">{t('dash.unread')}</div>
        </Link>

        <Link to="/app/playdates" className="stat">
          <div className="row row-2 small muted" style={{ marginBottom: 'var(--sp-2)' }}>
            <IconCalendar size={14} />
            {t('nav.playdates')}
          </div>
          <div className="stat-value">{data.upcomingPlaydates.length}</div>
          <div className="stat-label">{t('dash.comingUp')}</div>
        </Link>
      </section>

      <div className="dash-grid">
        <div className="stack stack-6">
          {/* ---- Upcoming ------------------------------------------------- */}
          <section className="card">
            <div className="card-header">
              <span className="card-title">{t('dash.upcoming')}</span>
              <Link to="/app/playdates" className="small">
                {t('dash.allPlaydates')}
              </Link>
            </div>
            <div className="card-body">
              {data.upcomingPlaydates.length === 0 ? (
                <p className="muted small">{t('dash.nothingPlanned')}</p>
              ) : (
                <div className="stack stack-4">
                  {data.upcomingPlaydates.slice(0, 3).map((p) => {
                    const date = new Date(p.startsAt);
                    return (
                      <div key={p.id} className="row row-4">
                        <div className="date-block" style={{ minWidth: 70 }}>
                          <div className="dow">{d(date, { weekday: 'short' })}</div>
                          <div className="dom">{date.getDate()}</div>
                          <div className="time">
                            {d(date, { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div className="grow">
                          <div className="strong small">{p.place.label}</div>
                          <div className="tiny muted row row-2" style={{ marginTop: 2 }}>
                            <IconMapPin size={11} />
                            {p.place.area}
                            {p.place.isPublic && ` · ${t('dash.publicPlace')}`}
                          </div>
                          <div style={{ marginTop: 6 }}>
                            <Badge tone={p.status === 'confirmed' ? 'ok' : 'pending'}>
                              {p.status === 'confirmed' ? t('dash.confirmed') : t('dash.awaitingReply')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* ---- Your children -------------------------------------------- */}
          <section className="card">
            <div className="card-header">
              <span className="card-title">{t('dash.yourChildren')}</span>
              <Link to="/app/children" className="small">
                {t('dash.manage')}
              </Link>
            </div>
            <div className="card-body">
              {family.children.length === 0 ? (
                <p className="muted small">{t('dash.noChildren')}</p>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 'var(--sp-4)',
                  }}
                >
                  {family.children.map((c) => (
                    <div key={c.id} className="panel">
                      <div className="row row-3">
                        <Avatar name={c.firstName} color={c.avatarColor} size="md" />
                        <div>
                          <div className="strong small">
                            {c.firstName}
                            {c.nickname && <span className="muted"> ({c.nickname})</span>}
                          </div>
                          <div className="tiny muted">
                            {t('common.yearsOld', { n: c.age })} ·{' '}
                            {t('dash.nInterests', { n: c.interests.length })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="stack stack-6">
          {/* ---- Your family ---------------------------------------------- */}
          <section className="card">
            <div className="card-header">
              <span className="card-title">{t('dash.yourFamilyCard')}</span>
              <Link to="/app/family" className="small">
                {t('common.edit')}
              </Link>
            </div>
            <div className="card-body stack stack-4">
              <div className="row row-4">
                <Avatar name={family.displayName} color="var(--brand-600)" size="lg" square />
                <div>
                  <div className="strong">{family.displayName}</div>
                  <div className="small muted row row-2" style={{ marginTop: 2 }}>
                    <IconMapPin size={12} />
                    {family.generalArea}
                  </div>
                </div>
              </div>

              <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
                <VerificationBadge status={family.verificationStatus} />
                <Badge tone="neutral">
                  <IconUsers size={11} />
                  {family.children.length}{' '}
                  {family.children.length === 1 ? t('common.child') : t('common.children')}
                </Badge>
                {family.privacy.discoverable ? (
                  <Badge tone="ok">{t('dash.discoverable')}</Badge>
                ) : (
                  <Badge tone="warn">{t('dash.hiddenFromDiscovery')}</Badge>
                )}
              </div>

              <hr className="divider" />

              <div>
                <div className="small strong" style={{ marginBottom: 'var(--sp-3)' }}>
                  {t('dash.whatVerified')}
                </div>
                <TrustSignals signals={parent.trustSignals} />
              </div>
            </div>
          </section>

          {/* ---- Availability --------------------------------------------- */}
          <section className="card">
            <div className="card-header">
              <span className="card-title">{t('dash.yourAvailability')}</span>
              <Link to="/app/settings" className="small">
                {t('dash.change')}
              </Link>
            </div>
            <div className="card-body">
              {family.availability.length === 0 ? (
                <p className="muted small">{t('dash.noAvailability')}</p>
              ) : (
                <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
                  {family.availability.slice(0, 8).map((a, i) => (
                    <span key={i} className="pill">
                      <IconClock size={11} />
                      {t(`day.${a.day}`)} {t(`blockPlural.${a.block}`)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          {!account.twoFactorEnabled && (
            <Alert tone="warn" title={t('dash.2faOffTitle')}>
              {t('dash.2faOffBody')} <Link to="/app/settings">{t('dash.turnItOn')}</Link>.
            </Alert>
          )}

          <PrototypeNote>{t('proto.dashboard')}</PrototypeNote>
        </div>
      </div>
    </div>
  );
}
