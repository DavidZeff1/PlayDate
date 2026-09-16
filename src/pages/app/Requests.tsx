import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type RequestView } from '../../services';
import { BAND_KEYS } from '../../domain/matching/engine';
import { useI18n, useT } from '../../i18n';
import { useFormat } from '../../i18n/format';
import { renderReasons } from '../../i18n/render';
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
  const t = useT();
  const { locale } = useI18n();
  const f = useFormat();
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
          ? t('req.accepted')
          : response === 'declined'
            ? t('req.declined')
            : t('req.deferred'),
        'ok',
      );
      await load();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : t('req.couldNotRespond'), 'error');
    }
  };

  if (incoming === null || outgoing === null) return <LoadingBlock />;

  return (
    <div className="stack stack-6">
      <div className="page-head">
        <h1>{t('nav.requests')}</h1>
        <p>
          {t('req.sub')}
        </p>
      </div>

      <Tabs
        label={t('nav.requests')}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'incoming', label: t('req.received'), count: incoming.length },
          { value: 'outgoing', label: t('req.sent'), count: outgoing.length },
        ]}
      />

      {tab === 'incoming' &&
        (incoming.length === 0 ? (
          <EmptyState
            icon={<IconInbox size={22} />}
            title={t('req.emptyInTitle')}
            description={t('req.emptyInDesc')}
            action={
              <Link to="/app/discover" className="btn btn-secondary">
                {t('nav.discover')}
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
                    {t(BAND_KEYS[view.match.band])}
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
                          {f.timeAgo(view.request.createdAt)}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <FamilyMeta family={view.otherFamily} />

                  {view.request.note && (
                    <div className="panel">
                      <div className="tiny muted" style={{ marginBottom: 4 }}>
                        {t('req.theirNote')}
                      </div>
                      <p className="small">{view.request.note}</p>
                    </div>
                  )}

                  {view.match && view.match.reasons.length > 0 && (
                    <ul className="reason-list">
                      {renderReasons(
                        view.match.reasons.filter((r) => r.tone === 'positive').slice(0, 4),
                        t,
                        locale,
                      ).map((r, i) => (
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
                      {t('common.accept')}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => respond(view.request.id, 'declined')}
                    >
                      <IconX size={14} />
                      {t('common.decline')}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => respond(view.request.id, 'deferred')}
                    >
                      {t('req.maybeLater')}
                    </button>
                    {view.match && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setCompat(view)}>
                        <IconInfo size={14} />
                        {t('landing.previewCompat')}
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ marginLeft: 'auto', color: 'var(--danger-600)' }}
                      onClick={() => setReporting(view)}
                    >
                      <IconFlag size={14} />
                      {t('common.report')}
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
            title={t('req.emptyOutTitle')}
            description={t('req.emptyOutDesc')}
            action={
              <Link to="/app/discover" className="btn btn-secondary">
                {t('nav.discover')}
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
                        {t('req.sentAgo', { when: f.timeAgo(view.request.createdAt) })} ·{' '}
                        {f.locationLabel(view.otherFamily.location)}
                      </div>
                    </div>
                  </div>
                  <div className="row row-3">
                    <Badge tone="pending">{t('req.awaitingResponse')}</Badge>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={async () => {
                        await api.withdrawRequest(view.request.id);
                        toast.push(t('req.withdrawn'), 'ok');
                        await load();
                      }}
                    >
                      {t('common.withdraw')}
                    </button>
                  </div>
                </div>
              </section>
            ))}

            <Alert tone="info">
              {t('req.noReadReceipts')}
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

