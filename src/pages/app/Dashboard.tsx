import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type DashboardSummary } from '../../services';
import { Alert, Avatar, Badge, LoadingBlock, PrototypeNote } from '../../components/ui';
import { TrustSignals, VerificationBadge } from '../../components/family/FamilyBits';
import {
  IconArrowRight,
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
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getDashboard()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your dashboard.'));
  }, []);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data) return <LoadingBlock />;

  const { family, parent, account } = data;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const surname = family.displayName.replace(/^The\s+/, '').replace(/\s+Family$/, '');

  return (
    <div className="stack stack-8">
      <div>
        <h1 className="greeting">
          {greeting}, {surname} family <span aria-hidden="true">👋</span>
        </h1>
        <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
          {data.nextSteps.length > 0
            ? "Here's what needs your attention."
            : 'Everything is set up. Here is where things stand.'}
        </p>
      </div>

      {/* ---- What to do now ---------------------------------------------- */}
      {data.nextSteps.length > 0 && (
        <section className="stack stack-4">
          <h2 style={{ fontSize: 'var(--text-lg)' }}>What you can do now</h2>
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
                  <div className="strong">{s.title}</div>
                  <p className="small muted" style={{ marginTop: 2 }}>
                    {s.description}
                  </p>
                </div>
                <Link to={s.href} className="btn btn-secondary btn-sm">
                  {s.cta}
                  <IconArrowRight size={14} />
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
            Potential families
          </div>
          <div className="stat-value">{data.matchCount}</div>
          <div className="stat-label">match your preferences</div>
        </Link>

        <Link to="/app/requests" className="stat">
          <div className="row row-2 small muted" style={{ marginBottom: 'var(--sp-2)' }}>
            <IconInbox size={14} />
            Requests
          </div>
          <div className="stat-value">{data.pendingIncomingRequests}</div>
          <div className="stat-label">
            waiting for you
            {data.pendingOutgoingRequests > 0 && ` · ${data.pendingOutgoingRequests} sent`}
          </div>
        </Link>

        <Link to="/app/messages" className="stat">
          <div className="row row-2 small muted" style={{ marginBottom: 'var(--sp-2)' }}>
            <IconMessage size={14} />
            Messages
          </div>
          <div className="stat-value">{data.unreadMessages}</div>
          <div className="stat-label">unread</div>
        </Link>

        <Link to="/app/playdates" className="stat">
          <div className="row row-2 small muted" style={{ marginBottom: 'var(--sp-2)' }}>
            <IconCalendar size={14} />
            PlayDates
          </div>
          <div className="stat-value">{data.upcomingPlaydates.length}</div>
          <div className="stat-label">coming up</div>
        </Link>
      </section>

      <div className="dash-grid">
        <div className="stack stack-6">
          {/* ---- Upcoming ------------------------------------------------- */}
          <section className="card">
            <div className="card-header">
              <span className="card-title">Upcoming</span>
              <Link to="/app/playdates" className="small">
                All playdates
              </Link>
            </div>
            <div className="card-body">
              {data.upcomingPlaydates.length === 0 ? (
                <p className="muted small">
                  Nothing planned yet. Once you have connected with a family, you can propose a
                  playdate from your conversation.
                </p>
              ) : (
                <div className="stack stack-4">
                  {data.upcomingPlaydates.slice(0, 3).map((p) => {
                    const d = new Date(p.startsAt);
                    return (
                      <div key={p.id} className="row row-4">
                        <div className="date-block" style={{ minWidth: 70 }}>
                          <div className="dow">
                            {d.toLocaleDateString('en-GB', { weekday: 'short' })}
                          </div>
                          <div className="dom">{d.getDate()}</div>
                          <div className="time">
                            {d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div className="grow">
                          <div className="strong small">{p.place.label}</div>
                          <div className="tiny muted row row-2" style={{ marginTop: 2 }}>
                            <IconMapPin size={11} />
                            {p.place.area}
                            {p.place.isPublic && ' · Public place'}
                          </div>
                          <div style={{ marginTop: 6 }}>
                            <Badge tone={p.status === 'confirmed' ? 'ok' : 'pending'}>
                              {p.status === 'confirmed' ? 'Confirmed' : 'Awaiting reply'}
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
              <span className="card-title">Your children</span>
              <Link to="/app/children" className="small">
                Manage
              </Link>
            </div>
            <div className="card-body">
              {family.children.length === 0 ? (
                <p className="muted small">
                  No children added yet. Matching needs at least one child's age and interests.
                </p>
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
                            {c.age} years old · {c.interests.length} interests
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
              <span className="card-title">Your family</span>
              <Link to="/app/family" className="small">
                Edit
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
                  {family.children.length === 1 ? 'child' : 'children'}
                </Badge>
                {family.privacy.discoverable ? (
                  <Badge tone="ok">Discoverable</Badge>
                ) : (
                  <Badge tone="warn">Hidden from discovery</Badge>
                )}
              </div>

              <hr className="divider" />

              <div>
                <div className="small strong" style={{ marginBottom: 'var(--sp-3)' }}>
                  What we have verified
                </div>
                <TrustSignals signals={parent.trustSignals} />
              </div>
            </div>
          </section>

          {/* ---- Availability --------------------------------------------- */}
          <section className="card">
            <div className="card-header">
              <span className="card-title">Your availability</span>
              <Link to="/app/settings" className="small">
                Change
              </Link>
            </div>
            <div className="card-body">
              {family.availability.length === 0 ? (
                <p className="muted small">
                  Not set yet. Families with no overlapping free time are filtered out of each
                  other's results.
                </p>
              ) : (
                <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
                  {family.availability.slice(0, 8).map((a, i) => (
                    <span key={i} className="pill">
                      <IconClock size={11} />
                      {a.day.charAt(0).toUpperCase() + a.day.slice(1)} {a.block}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          {!account.twoFactorEnabled && (
            <Alert tone="warn" title="Two-factor authentication is off">
              It is the single biggest improvement you can make to your account's security, and
              other families see it as a trust signal.{' '}
              <Link to="/app/settings">Turn it on</Link>.
            </Alert>
          )}

          <PrototypeNote>
            You are signed in to a demo family with fictional data. Identity verification is
            simulated. Nothing here is a real account or a real person.
          </PrototypeNote>
        </div>
      </div>
    </div>
  );
}
