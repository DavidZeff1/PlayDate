import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type DiscoveryResult } from '../../services';
import { useApp } from '../../state/AppContext';
import { BAND_LABELS } from '../../domain/matching/engine';
import { SAFETY_TIPS, REPORT_REASON_COPY } from '../../domain/safety/contentScan';
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
import { timeAgo } from './Requests';
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
          <h1>Matches</h1>
        </div>
        <Alert tone="warn" title="Verification needed">
          Matching results open once your identity verification is complete.{' '}
          <Link to="/app/verification">Go to verification</Link>.
        </Alert>
      </div>
    );
  }

  if (results === null) return <LoadingBlock label="Working out your matches…" />;

  const strong = results.filter((r) => r.match.band === 'strong');
  const good = results.filter((r) => r.match.band === 'good');
  const other = results.filter((r) => r.match.band === 'possible' || r.match.band === 'weak');

  return (
    <div className="stack stack-8">
      <div className="page-head">
        <h1>Matches</h1>
        <p>
          Your discovery pool, grouped by how well it fits the priorities you set. There is no
          single "best" family here — the point is a large, carefully filtered set you can
          judge for yourself.
        </p>
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon={<IconSparkle size={22} />}
          title="No matches yet"
          description="Widening your travel distance or acceptable age gap in Settings is usually the quickest fix."
          action={
            <Link to="/app/settings" className="btn btn-secondary">
              Adjust preferences
            </Link>
          }
        />
      ) : (
        <>
          <MatchGroup
            title={BAND_LABELS.strong}
            description="Strong overlap on the things you marked most important."
            results={strong}
            onRequest={setRequestTarget}
          />
          <MatchGroup
            title={BAND_LABELS.good}
            description="Good overlap, with one or two areas that matter less to you."
            results={good}
            onRequest={setRequestTarget}
          />
          <MatchGroup
            title="Worth a look"
            description="Less overlap on your priorities, but still families you could realistically meet."
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
            toast.push('Request sent.', 'ok');
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
  const [items, setItems] = useState<AppNotification[] | null>(null);

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
          <h1>Notifications</h1>
          <p>Requests, messages, playdates and account updates.</p>
        </div>
        {unread > 0 && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              await api.markAllNotificationsRead();
              await load();
            }}
          >
            Mark all as read
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<IconBell size={22} />}
          title="Nothing yet"
          description="You will hear from us when a family responds, sends a message, or proposes a playdate."
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
                  <span className="tiny muted nowrap">{timeAgo(n.createdAt)}</span>
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
  const [tab, setTab] = useState<'guidance' | 'reports' | 'controls'>('guidance');
  const [reports, setReports] = useState<Report[]>([]);
  const [blocked, setBlocked] = useState<Array<{ familyId: string; displayName: string; createdAt: string }>>([]);

  useEffect(() => {
    void api.getMyReports().then(setReports);
    void api.getBlockedFamilies().then(setBlocked);
  }, []);

  return (
    <div className="stack stack-6">
      <div className="page-head">
        <h1>Safety Centre</h1>
        <p>
          How to use PlayDate safely, what happens when you report someone, and everything you
          can control.
        </p>
      </div>

      <Tabs
        label="Safety Centre"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'guidance', label: 'Guidance' },
          { value: 'controls', label: 'Your controls' },
          { value: 'reports', label: 'Your reports', count: reports.length },
        ]}
      />

      {tab === 'guidance' && (
        <div className="stack stack-5">
          <SafetyNote>
            None of this is unusual. It is how most parents already arrange a first playdate —
            we have just built it into the product so it is the default rather than something
            you have to remember.
          </SafetyNote>

          <div className="stack stack-3">
            {SAFETY_TIPS.map((t) => (
              <div key={t.title} className="card card-pad">
                <div className="row row-3" style={{ alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--ok-500)', marginTop: 2, flexShrink: 0 }}>
                    <IconCheck size={16} />
                  </span>
                  <div>
                    <div className="strong">{t.title}</div>
                    <p className="muted small" style={{ marginTop: 2 }}>
                      {t.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Alert tone="warn" title="PlayDate is not an emergency service.">
            If a child is in immediate danger, contact your local emergency services first, then
            report to us.
          </Alert>

          {account?.safetyGuidelinesAcceptedAt && (
            <p className="tiny muted">
              You confirmed you had read these on{' '}
              {new Date(account.safetyGuidelinesAcceptedAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              .
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
              title="Block"
              body="Immediate and unilateral. Closes any conversation, withdraws any pending request, and removes each family from the other's results. No reason needed, and they are not told."
              link={{ to: '/app/settings', label: `Manage blocked families (${blocked.length})` }}
            />
            <ControlCard
              icon={<IconFlag size={18} />}
              title="Report"
              body="Opens a case for a human reviewer. It never publicly marks anyone and the reported family is never told. Available from any profile, request or conversation."
            />
            <ControlCard
              icon={<IconShieldCheck size={18} />}
              title="Pause discovery"
              body="Turn off discoverability to disappear from other families' results without deleting anything. Existing conversations continue."
              link={{ to: '/app/settings', label: 'Privacy settings' }}
            />
            <ControlCard
              icon={<IconUsers size={18} />}
              title="Require verification"
              body="Only let ID-verified parents send you a request. On by default, and we recommend leaving it on."
              link={{ to: '/app/settings', label: 'Privacy settings' }}
            />
          </div>

          <div className="card card-pad">
            <h3 style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--sp-3)' }}>
              What a report actually does
            </h3>
            <div className="row row-wrap small" style={{ gap: 'var(--sp-3)' }}>
              <span className="pill">You report</span>
              <span className="muted">→</span>
              <span className="pill">Case opened</span>
              <span className="muted">→</span>
              <span className="pill">A person reviews it</span>
              <span className="muted">→</span>
              <span className="pill">Decision recorded</span>
            </div>
            <p className="small muted" style={{ marginTop: 'var(--sp-4)' }}>
              Outcomes are: no action, a warning, required re-verification, a temporary
              restriction, suspension, or a permanent ban. Every decision is recorded with a
              reason and a named reviewer. Several reports about the same family are grouped
              into one case so a pattern is visible as a pattern.
            </p>
          </div>

          <div className="card card-pad">
            <h3 style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--sp-4)' }}>
              What you can report
            </h3>
            <div className="stack stack-3">
              {Object.entries(REPORT_REASON_COPY).map(([k, v]) => (
                <div key={k} className="row row-3" style={{ alignItems: 'flex-start' }}>
                  <span
                    className="dot"
                    style={{
                      marginTop: 8,
                      background: v.urgent ? 'var(--danger-500)' : 'var(--ink-300)',
                    }}
                  />
                  <div>
                    <div className="small strong">{v.label}</div>
                    <div className="tiny muted">{v.description}</div>
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
              title="You have not reported anyone"
              description="Reports you submit appear here so you can see what you told us and when."
            />
          ) : (
            reports.map((r) => (
              <div key={r.id} className="card card-pad">
                <div className="row row-between row-3" style={{ flexWrap: 'wrap' }}>
                  <div>
                    <div className="strong small">
                      {REPORT_REASON_COPY[r.reason]?.label ?? r.reason}
                    </div>
                    <div className="tiny muted">Submitted {timeAgo(r.createdAt)}</div>
                  </div>
                  <Badge tone="pending">Under review</Badge>
                </div>
                <p className="small muted" style={{ marginTop: 'var(--sp-3)' }}>
                  {r.details}
                </p>
              </div>
            ))
          )}
          <Alert tone="info">
            We do not tell you what action was taken against another family — that is their
            private account information. If the behaviour continues, please report it again.
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
