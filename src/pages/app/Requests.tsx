import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type RequestView } from '../../services';
import { BAND_LABELS } from '../../domain/matching/engine';
import {
  Alert,
  Avatar,
  Badge,
  EmptyState,
  LoadingBlock,
  Tabs,
  useToast,
} from '../../components/ui';
import { FamilyMeta, InterestTags, VerificationBadge } from '../../components/family/FamilyBits';
import { CompatibilityModal } from '../../components/discovery/CompatibilityModal';
import { ReportDialog } from '../../components/safety/ReportDialog';
import {
  IconCheck,
  IconClock,
  IconFlag,
  IconInbox,
  IconInfo,
  IconSparkle,
  IconX,
} from '../../components/ui/Icons';

/**
 * The mutual-consent gate.
 *
 * Four responses, and three of them are equally acceptable. The UI must not make
 * declining feel like a social cost — there is no "are you sure?", no reason field, and
 * the other family is told nothing beyond the request no longer being pending.
 */
export function Requests() {
  const toast = useToast();
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [incoming, setIncoming] = useState<RequestView[] | null>(null);
  const [outgoing, setOutgoing] = useState<RequestView[] | null>(null);
  const [compat, setCompat] = useState<RequestView | null>(null);
  const [reporting, setReporting] = useState<RequestView | null>(null);

  const load = useCallback(async () => {
    const [i, o] = await Promise.all([api.getIncomingRequests(), api.getOutgoingRequests()]);
    setIncoming(i);
    setOutgoing(o);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const respond = async (id: string, response: 'accepted' | 'declined' | 'deferred') => {
    try {
      await api.respondToRequest(id, response);
      toast.push(
        response === 'accepted'
          ? 'Connected. You can now message each other.'
          : response === 'declined'
            ? 'Request declined. They are not told why.'
            : 'Saved for later.',
        'ok',
      );
      await load();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Could not respond.', 'error');
    }
  };

  if (incoming === null || outgoing === null) return <LoadingBlock />;

  return (
    <div className="stack stack-6">
      <div className="page-head">
        <h1>Requests</h1>
        <p>
          Nobody can message you until you agree to connect. Accepting, declining and leaving
          it are all equally fine — the other family is never told which you chose.
        </p>
      </div>

      <Tabs
        label="Requests"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'incoming', label: 'Received', count: incoming.length },
          { value: 'outgoing', label: 'Sent', count: outgoing.length },
        ]}
      />

      {tab === 'incoming' &&
        (incoming.length === 0 ? (
          <EmptyState
            icon={<IconInbox size={22} />}
            title="No requests waiting"
            description="When another family would like to connect, their request appears here with the reasons PlayDate suggested you to each other."
            action={
              <Link to="/app/discover" className="btn btn-secondary">
                Discover families
              </Link>
            }
          />
        ) : (
          <div className="stack stack-5">
            {incoming.map((view) => (
              <section key={view.request.id} className="card">
                {view.match && !view.match.excluded && (
                  <div className={`match-banner match-${view.match.band}`}>
                    <IconSparkle size={14} />
                    {BAND_LABELS[view.match.band]}
                  </div>
                )}

                <div className="card-body stack stack-5">
                  <div className="row row-4" style={{ flexWrap: 'wrap' }}>
                    <Avatar
                      name={view.otherFamily.displayName}
                      color="var(--brand-600)"
                      size="lg"
                      square
                    />
                    <div className="grow">
                      <h2 style={{ fontSize: 'var(--text-md)' }}>{view.otherFamily.displayName}</h2>
                      <div className="row row-wrap" style={{ gap: 'var(--sp-2)', marginTop: 6 }}>
                        <VerificationBadge status={view.otherFamily.verificationStatus} />
                        <Badge tone="neutral">
                          <IconClock size={11} />
                          {timeAgo(view.request.createdAt)}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <FamilyMeta family={view.otherFamily} />

                  {view.request.note && (
                    <div className="panel">
                      <div className="tiny muted" style={{ marginBottom: 4 }}>
                        Their note
                      </div>
                      <p className="small">{view.request.note}</p>
                    </div>
                  )}

                  {view.match && view.match.reasons.length > 0 && (
                    <ul className="reason-list">
                      {view.match.reasons
                        .filter((r) => r.tone === 'positive')
                        .slice(0, 4)
                        .map((r, i) => (
                          <li key={i} className="reason reason-positive">
                            <span className="reason-icon">
                              <IconCheck size={13} />
                            </span>
                            {r.text}
                          </li>
                        ))}
                    </ul>
                  )}

                  <InterestTags
                    interestIds={[
                      ...new Set(
                        view.otherFamily.children.flatMap((c) => c.interests.map((i) => i.interestId)),
                      ),
                    ]}
                    sharedIds={view.match?.sharedInterestIds ?? []}
                    limit={6}
                  />
                </div>

                <div className="card-footer">
                  <div className="row row-3 row-wrap">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => respond(view.request.id, 'accepted')}
                    >
                      <IconCheck size={14} />
                      Accept
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => respond(view.request.id, 'declined')}
                    >
                      <IconX size={14} />
                      Decline
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => respond(view.request.id, 'deferred')}
                    >
                      Maybe later
                    </button>
                    {view.match && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setCompat(view)}>
                        <IconInfo size={14} />
                        View compatibility
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ marginLeft: 'auto', color: 'var(--danger-600)' }}
                      onClick={() => setReporting(view)}
                    >
                      <IconFlag size={14} />
                      Report
                    </button>
                  </div>
                </div>
              </section>
            ))}
          </div>
        ))}

      {tab === 'outgoing' &&
        (outgoing.length === 0 ? (
          <EmptyState
            icon={<IconInbox size={22} />}
            title="No requests sent"
            description="Requests you send appear here until the other family responds."
            action={
              <Link to="/app/discover" className="btn btn-secondary">
                Discover families
              </Link>
            }
          />
        ) : (
          <div className="stack stack-4">
            {outgoing.map((view) => (
              <section key={view.request.id} className="card card-pad">
                <div className="row row-4 row-between" style={{ flexWrap: 'wrap' }}>
                  <div className="row row-4">
                    <Avatar
                      name={view.otherFamily.displayName}
                      color="var(--brand-600)"
                      size="md"
                      square
                    />
                    <div>
                      <div className="strong">{view.otherFamily.displayName}</div>
                      <div className="small muted">
                        Sent {timeAgo(view.request.createdAt)} · {view.otherFamily.locationLabel}
                      </div>
                    </div>
                  </div>
                  <div className="row row-3">
                    <Badge tone="pending">Awaiting response</Badge>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={async () => {
                        await api.withdrawRequest(view.request.id);
                        toast.push('Request withdrawn.', 'ok');
                        await load();
                      }}
                    >
                      Withdraw
                    </button>
                  </div>
                </div>
              </section>
            ))}

            <Alert tone="info">
              We do not show whether the other family has read your request, and you will not
              be told if they decline. People are allowed to say no quietly.
            </Alert>
          </div>
        ))}

      {compat?.match && (
        <CompatibilityModal
          open
          onClose={() => setCompat(null)}
          result={{
            projection: compat.otherFamily,
            match: compat.match,
            relationship: 'request_received',
          }}
        />
      )}

      {reporting && (
        <ReportDialog
          open
          onClose={() => setReporting(null)}
          familyId={reporting.otherFamily.id}
          familyName={reporting.otherFamily.displayName}
          onDone={load}
        />
      )}
    </div>
  );
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
