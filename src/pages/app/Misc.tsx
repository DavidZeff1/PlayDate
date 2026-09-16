import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type DiscoveryResult } from '../../services';
import { useApp } from '../../state/AppContext';
import { BAND_KEYS } from '../../domain/matching/engine';
import { useI18n, useT } from '../../i18n';
import { useFormat } from '../../i18n/format';
import {
  SAFETY_TIPS,
  REPORT_REASONS,
  reportDescKey,
  reportLabelKey,
} from '../../domain/safety/contentScan';
import type { AppNotification, Report } from '../../domain/types';
import {
  Alert,
  Badge,
  EmptyState,
  LoadingBlock,
  SafetyNote,
  Tabs,
  useToast,
} from '../../components/ui';
import { FamilyCard } from '../../components/discovery/FamilyCard';
import { RequestModal } from './Discover';
import {
  IconBell,
  IconBlock,
  IconCalendar,
  IconCheck,
  IconFlag,
  IconMessage,
  IconShieldCheck,
  IconSparkle,
  IconUsers,
} from '../../components/ui/Icons';

/* ========================================================================== */
/* Matches — the strongest of the discovery pool                               */
/* ========================================================================== */

export function Matches() {
  const { canDiscover } = useApp();
  const toast = useToast();
  const t = useT();
  const [results, setResults] = useState<DiscoveryResult[] | null>(null);
  const [requestTarget, setRequestTarget] = useState<DiscoveryResult | null>(null);

  const load = useCallback(async () => {
    if (!canDiscover) {
      setResults([]);
      return;
    }
    try {
      setResults(await api.discoverFamilies({ sort: 'match' }));
    } catch {
      setResults([]);
    }
  }, [canDiscover]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canDiscover) {
    return (
      <div className="stack stack-6">
        <div className="page-head">
          <h1>{t('nav.matches')}</h1>
        </div>
        <Alert tone="warn" title={t('match.gateTitle')}>
          Matching results open once your identity verification is complete.{' '}
          <Link to="/app/verification">{t('disc.gateCta')}</Link>.
        </Alert>
      </div>
    );
  }

  if (results === null) return <LoadingBlock label={t('match.working')} />;

  const strong = results.filter((r) => r.match.band === 'strong');
  const good = results.filter((r) => r.match.band === 'good');
  const other = results.filter((r) => r.match.band === 'possible' || r.match.band === 'weak');

  return (
    <div className="stack stack-8">
      <div className="page-head">
        <h1>{t('nav.matches')}</h1>
        <p>
          {t('match.sub')}
        </p>
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon={<IconSparkle size={22} />}
          title={t('match.emptyTitle')}
          description={t('match.emptyDesc')}
          action={
            <Link to="/app/settings" className="btn btn-secondary">
              {t('disc.adjustPrefs')}
            </Link>
          }
        />
      ) : (
        <>
          <MatchGroup
            title={t(BAND_KEYS.strong)}
            description={t('match.strongDesc')}
            results={strong}
            onRequest={setRequestTarget}
          />
          <MatchGroup
            title={t(BAND_KEYS.good)}
            description={t('match.goodDesc')}
            results={good}
            onRequest={setRequestTarget}
          />
          <MatchGroup
            title={t('match.otherTitle')}
            description={t('match.otherDesc')}
            results={other}
            onRequest={setRequestTarget}
          />
        </>
      )}

      {requestTarget && (
        <RequestModal
          result={requestTarget}
          onClose={() => setRequestTarget(null)}
          onSent={() => {
            setRequestTarget(null);
            toast.push(t('match.requestSent'), 'ok');
            void load();
          }}
        />
      )}
    </div>
  );
}

function MatchGroup({
  title,
  description,
  results,
  onRequest,
}: {
  title: string;
  description: string;
  results: DiscoveryResult[];
  onRequest: (r: DiscoveryResult) => void;
}) {
  if (results.length === 0) return null;
  return (
    <section className="stack stack-4">
      <div>
        <h2 style={{ fontSize: 'var(--text-lg)' }}>
          {title} <span className="muted" style={{ fontWeight: 400 }}>· {results.length}</span>
        </h2>
        <p className="small muted" style={{ marginTop: 2 }}>
          {description}
        </p>
      </div>
      <div className="family-grid">
        {results.map((r) => (
          <FamilyCard
            key={r.projection.id}
            result={r}
            onRequest={() => onRequest(r)}
          />
        ))}
      </div>
    </section>
  );
}

/* ========================================================================== */
/* Notifications                                                               */
/* ========================================================================== */

const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
  connection_request: <IconUsers size={16} />,
  request_accepted: <IconCheck size={16} />,
  new_message: <IconMessage size={16} />,
  playdate_proposed: <IconCalendar size={16} />,
  playdate_confirmed: <IconCalendar size={16} />,
  playdate_reminder: <IconCalendar size={16} />,
  verification_update: <IconShieldCheck size={16} />,
  safety_notice: <IconShieldCheck size={16} />,
  moderation_update: <IconFlag size={16} />,
};

export function Notifications() {
  const t = useT();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const f = useFormat();

  const load = useCallback(async () => {
    setItems(await api.getNotifications());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (items === null) return <LoadingBlock />;

  const unread = items.filter((i) => !i.read).length;

  return (
    <div className="stack stack-6">
      <div className="row row-between row-4" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="page-head" style={{ marginBottom: 0 }}>
          <h1>{t('nav.notifications')}</h1>
          <p>{t('ntf.sub')}</p>
        </div>
        {unread > 0 && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              await api.markAllNotificationsRead();
              await load();
            }}
          >
            {t('ntf.markAll')}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<IconBell size={22} />}
          title={t('ntf.emptyTitle')}
          description={t('ntf.emptyDesc')}
        />
      ) : (
        <div className="card">
          {items.map((n) => (
            <Link
              key={n.id}
              to={n.href ?? '/app'}
              className="thread-item"
              style={{ background: n.read ? undefined : 'var(--brand-50)' }}
              onClick={() => void api.markNotificationRead(n.id)}
            >
              <div
                className="next-step-icon action"
                style={{ width: 34, height: 34, flexShrink: 0 }}
              >
                {NOTIFICATION_ICONS[n.kind] ?? <IconBell size={16} />}
              </div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row row-between row-2">
                  <span className="strong small">{n.title}</span>
                  <span className="tiny muted nowrap">{f.timeAgo(n.createdAt)}</span>
                </div>
                <div className="small muted" style={{ marginTop: 2 }}>
                  {n.body}
                </div>
              </div>
              {!n.read && <span className="dot dot-warn" style={{ marginTop: 8 }} />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/* Safety Centre                                                               */
/* ========================================================================== */

export function SafetyCentre() {
  const { account } = useApp();
  const t = useT();
  const f = useFormat();
  const [tab, setTab] = useState<'guidance' | 'reports' | 'controls'>('guidance');
  const [reports, setReports] = useState<Report[]>([]);
  const [blocked, setBlocked] = useState<Array<{ familyId: string; displayName: string; createdAt: string }>>([]);
  const { d } = useI18n();

  useEffect(() => {
    void api.getMyReports().then(setReports);
    void api.getBlockedFamilies().then(setBlocked);
  }, []);

  return (
    <div className="stack stack-6">
      <div className="page-head">
        <h1>{t('nav.safetyCentre')}</h1>
        <p>
          {t('sc.sub')}
        </p>
      </div>

      <Tabs
        label={t('nav.safetyCentre')}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'guidance', label: t('sc.guidance') },
          { value: 'controls', label: t('sc.controls') },
          { value: 'reports', label: t('sc.yourReports'), count: reports.length },
        ]}
      />

      {tab === 'guidance' && (
        <div className="stack stack-5">
          <SafetyNote>
            {t('sc.notUnusual')}
          </SafetyNote>

          <div className="stack stack-3">
            {SAFETY_TIPS.map((tip) => (
              <div key={tip.titleKey} className="card card-pad">
                <div className="row row-3" style={{ alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--ok-500)', marginTop: 2, flexShrink: 0 }}>
                    <IconCheck size={16} />
                  </span>
                  <div>
                    <div className="strong">{t(tip.titleKey)}</div>
                    <p className="muted small" style={{ marginTop: 2 }}>
                      {t(tip.bodyKey)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Alert tone="warn" title={t('safetyPage.notEmergency')}>
            {t('safetyPage.notEmergencyBody')}
          </Alert>

          {account?.safetyGuidelinesAcceptedAt && (
            <p className="tiny muted">
              {t('sc.confirmedOn', {
                date: d(account.safetyGuidelinesAcceptedAt, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }),
              })}
            </p>
          )}
        </div>
      )}

      {tab === 'controls' && (
        <div className="stack stack-5">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 'var(--sp-4)',
            }}
          >
            <ControlCard
              icon={<IconBlock size={18} />}
              title={t('common.block')}
              body="Immediate and unilateral. Closes any conversation, withdraws any pending request, and removes each family from the other's results. No reason needed, and they are not told."
              link={{ to: '/app/settings', label: `Manage blocked families (${blocked.length})` }}
            />
            <ControlCard
              icon={<IconFlag size={18} />}
              title={t('common.report')}
              body={t('sc.reportBody')}
            />
            <ControlCard
              icon={<IconShieldCheck size={18} />}
              title={t('sc.pauseTitle')}
              body="Turn off discoverability to disappear from other families' results without deleting anything. Existing conversations continue."
              link={{ to: '/app/settings', label: t('sc.privacySettings') }}
            />
            <ControlCard
              icon={<IconUsers size={18} />}
              title={t('sc.requireTitle')}
              body={t('sc.requireBody')}
              link={{ to: '/app/settings', label: t('sc.privacySettings') }}
            />
          </div>

          <div className="card card-pad">
            <h3 style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--sp-3)' }}>
              {t('sc.whatReportDoes')}
            </h3>
            <div className="row row-wrap small" style={{ gap: 'var(--sp-3)' }}>
              <span className="pill">{t('sc.rf1')}</span>
              <span className="muted">→</span>
              <span className="pill">{t('safetyPage.flow2')}</span>
              <span className="muted">→</span>
              <span className="pill">{t('sc.rf3')}</span>
              <span className="muted">→</span>
              <span className="pill">{t('safetyPage.flow4')}</span>
            </div>
            <p className="small muted" style={{ marginTop: 'var(--sp-4)' }}>
              {t('sc.outcomes')}
            </p>
          </div>

          <div className="card card-pad">
            <h3 style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--sp-4)' }}>
              {t('sc.whatYouCanReport')}
            </h3>
            <div className="stack stack-3">
              {REPORT_REASONS.map(({ id, urgent }) => (
                <div key={id} className="row row-3" style={{ alignItems: 'flex-start' }}>
                  <span
                    className="dot"
                    style={{
                      marginTop: 8,
                      background: urgent ? 'var(--danger-500)' : 'var(--ink-300)',
                    }}
                  />
                  <div>
                    <div className="small strong">{t(reportLabelKey(id))}</div>
                    <div className="tiny muted">{t(reportDescKey(id))}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'reports' && (
        <div className="stack stack-4">
          {reports.length === 0 ? (
            <EmptyState
              icon={<IconFlag size={22} />}
              title={t('sc.noReportsTitle')}
              description={t('sc.noReportsDesc')}
            />
          ) : (
            reports.map((r) => (
              <div key={r.id} className="card card-pad">
                <div className="row row-between row-3" style={{ flexWrap: 'wrap' }}>
                  <div>
                    <div className="strong small">
                      {t(reportLabelKey(r.reason))}
                    </div>
                    <div className="tiny muted">
                      {t('sc.submitted', { when: f.timeAgo(r.createdAt) })}
                    </div>
                  </div>
                  <Badge tone="pending">{t('sc.underReview')}</Badge>
                </div>
                <p className="small muted" style={{ marginTop: 'var(--sp-3)' }}>
                  {r.details}
                </p>
              </div>
            ))
          )}
          <Alert tone="info">
            {t('sc.noOutcomeShared')}
          </Alert>
        </div>
      )}
    </div>
  );
}

function ControlCard({
  icon,
  title,
  body,
  link,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  link?: { to: string; label: string };
}) {
  return (
    <div className="card card-pad stack stack-3">
      <div className="feature-icon" style={{ width: 36, height: 36 }}>
        {icon}
      </div>
      <h3 style={{ fontSize: 'var(--text-base)' }}>{title}</h3>
      <p className="small muted">{body}</p>
      {link && (
        <Link to={link.to} className="small">
          {link.label}
        </Link>
      )}
    </div>
  );
}
