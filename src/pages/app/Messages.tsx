import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type ConversationView } from '../../services';
import { useApp } from '../../state/AppContext';
import { scanMessage, peakSeverity } from '../../domain/safety/contentScan';
import { useI18n, useT } from '../../i18n';
import { useFormat } from '../../i18n/format';
import type { SafetyFlag } from '../../domain/types';
import {
  Alert,
  Avatar,
  EmptyState,
  LoadingBlock,
  Modal,
  useToast,
} from '../../components/ui';
import { DisclosureNotice, VerificationBadge } from '../../components/family/FamilyBits';
import { BlockDialog, ReportDialog } from '../../components/safety/ReportDialog';
import { PlayDateComposer } from './PlayDates';
import {
  IconAlert,
  IconBlock,
  IconCalendar,
  IconFlag,
  IconInfo,
  IconLogout,
  IconMessage,
  IconShieldCheck,
} from '../../components/ui/Icons';

export function Messages() {
  const { family } = useApp();
  const toast = useToast();
  const t = useT();
  const f = useFormat();
  const { d } = useI18n();
  const [threads, setThreads] = useState<ConversationView[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftFlags, setDraftFlags] = useState<SafetyFlag[]>([]);
  const [sending, setSending] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const t = await api.getConnections();
    setThreads(t);
    setActiveId((current) => current ?? t[0]?.conversation.id ?? null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = threads?.find((t) => t.conversation.id === activeId) ?? null;

  useEffect(() => {
    if (!active) return;
    void api.markConversationRead(active.conversation.id);
    // Scroll the newest message into view when a thread opens or grows.
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active]);

  // Scan as the parent types, so the nudge arrives before they send rather than after.
  useEffect(() => {
    setDraftFlags(draft.trim().length > 3 ? scanMessage(draft) : []);
  }, [draft]);

  const send = async () => {
    if (!active || !draft.trim()) return;
    setSending(true);
    try {
      await api.sendMessage(active.conversation.id, draft);
      setDraft('');
      await load();
      requestAnimationFrame(() => {
        if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
      });
    } catch (e) {
      toast.push(e instanceof Error ? e.message : t('msg.couldNotSend'), 'error');
    } finally {
      setSending(false);
    }
  };

  if (threads === null || !family) return <LoadingBlock />;

  if (threads.length === 0) {
    return (
      <div className="stack stack-6">
        <div className="page-head">
          <h1>{t('nav.messages')}</h1>
          <p>{t('msg.subShort')}</p>
        </div>
        <EmptyState
          icon={<IconMessage size={22} />}
          title={t('msg.emptyTitle')}
          description={t('msg.emptyDesc')}
          action={
            <Link to="/app/discover" className="btn btn-primary">
              {t('nav.discover')}
            </Link>
          }
        />
      </div>
    );
  }

  const severity = peakSeverity(draftFlags);

  return (
    <div className="stack stack-6">
      <div className="page-head">
        <h1>{t('nav.messages')}</h1>
        <p>
          {t('msg.sub')}
        </p>
      </div>

      <div className="messages-layout">
        {/* ---- Thread list --------------------------------------------- */}
        <div className="thread-list">
          {threads.map((th) => {
            const last = th.conversation.messages[th.conversation.messages.length - 1];
            return (
              <button
                key={th.conversation.id}
                className="thread-item"
                aria-current={th.conversation.id === activeId}
                onClick={() => setActiveId(th.conversation.id)}
              >
                <Avatar name={th.otherFamily.displayName} color="var(--brand-600)" size="md" square />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row row-between row-2">
                    <span
                      className="strong small"
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {th.otherFamily.displayName}
                    </span>
                    {last && <span className="tiny muted nowrap">{f.timeAgo(last.sentAt)}</span>}
                  </div>
                  <div
                    className="tiny muted"
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: 2,
                    }}
                  >
                    {last
                      ? `${last.senderFamilyId === family.id ? 'You: ' : ''}${last.body}`
                      : t('msg.noMessagesYet')}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ---- Conversation ---------------------------------------------- */}
        {active && (
          <div className="stack stack-4">
            <div className="conversation">
              <div className="conversation-head">
                <div className="row row-3" style={{ minWidth: 0 }}>
                  <Avatar name={active.otherFamily.displayName} color="var(--brand-600)" size="md" square />
                  <div style={{ minWidth: 0 }}>
                    <div className="strong small">{active.otherFamily.displayName}</div>
                    <div className="tiny muted">
                      {f.locationLabel(active.otherFamily.location)} ·{' '}
                      {active.otherFamily.childCount}{' '}
                      {active.otherFamily.childCount === 1 ? t('common.child') : t('common.children')}
                    </div>
                  </div>
                </div>
                <div className="row row-2">
                  <VerificationBadge status={active.otherFamily.verificationStatus} />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setPlanning(true)}
                  >
                    <IconCalendar size={14} />
                    {t('msg.planPlaydate')}
                  </button>
                </div>
              </div>

              <div className="conversation-body" ref={bodyRef}>
                {active.conversation.messages.length === 0 && (
                  <div className="panel small muted center">
                    {t('msg.sayHello')}
                  </div>
                )}

                {active.conversation.messages.map((m) => {
                  const mine = m.senderFamilyId === family.id;
                  return (
                    <div key={m.id} className={`bubble-row${mine ? ' mine' : ''}`}>
                      {!mine && (
                        <Avatar
                          name={active.otherFamily.displayName}
                          color="var(--brand-600)"
                          size="sm"
                          square
                        />
                      )}
                      <div>
                        <div className={`bubble ${mine ? 'bubble-mine' : 'bubble-them'}`}>{m.body}</div>
                        <div
                          className="tiny muted"
                          style={{ marginTop: 4, textAlign: mine ? 'right' : 'left' }}
                        >
                          {d(m.sentAt, {
                            weekday: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="conversation-foot stack stack-3">
                {/* Advisory nudge, shown only to the sender, never blocking. */}
                {draftFlags.length > 0 && (
                  <div className={`alert alert-${severity === 'high' ? 'warn' : 'info'}`}>
                    <span className="alert-icon">
                      {severity === 'high' ? <IconAlert size={16} /> : <IconInfo size={16} />}
                    </span>
                    <div className="stack stack-2">
                      {draftFlags.map((f, i) => (
                        <div key={i} className="small">
                          {t(f.messageKey as never)}
                        </div>
                      ))}
                      <div className="tiny" style={{ opacity: 0.8 }}>
                        {t('msg.onlyYouSee')}
                      </div>
                    </div>
                  </div>
                )}

                <div className="composer">
                  <textarea
                    className="textarea grow"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    placeholder={t('msg.placeholder')}
                    aria-label={t('msg.label')}
                    maxLength={2000}
                  />
                  <button className="btn btn-primary" onClick={send} disabled={sending || !draft.trim()}>
                    {sending ? t('common.sending') : t('common.send')}
                  </button>
                </div>
              </div>
            </div>

            {/* ---- Safety toolbar, always present ------------------------- */}
            <div className="card card-pad">
              <div className="row row-between row-4" style={{ flexWrap: 'wrap' }}>
                <div className="row row-3 small muted">
                  <IconShieldCheck size={16} />
                  <span>{t('msg.safetyAlways')}</span>
                </div>
                <div className="row row-2 row-wrap">
                  <Link to="/app/safety" className="btn btn-ghost btn-sm">
                    {t('msg.safetyResources')}
                  </Link>
                  <button className="btn btn-ghost btn-sm" onClick={() => setLeaving(true)}>
                    <IconLogout size={14} />
                    {t('common.leave')}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setBlocking(true)}>
                    <IconBlock size={14} />
                    {t('common.block')}
                  </button>
                  <button
                    className="btn btn-danger-quiet btn-sm"
                    onClick={() => setReporting(true)}
                  >
                    <IconFlag size={14} />
                    {t('common.report')}
                  </button>
                </div>
              </div>
            </div>

            <DisclosureNotice tier={active.otherFamily.tier} />
          </div>
        )}
      </div>

      {/* ---- Dialogs -------------------------------------------------- */}
      {active && reporting && (
        <ReportDialog
          open
          onClose={() => setReporting(false)}
          familyId={active.otherFamily.id}
          familyName={active.otherFamily.displayName}
          evidenceMessageIds={active.conversation.messages.map((m) => m.id)}
          onDone={async () => {
            await load();
            setActiveId(null);
          }}
        />
      )}

      {active && blocking && (
        <BlockDialog
          open
          onClose={() => setBlocking(false)}
          familyId={active.otherFamily.id}
          familyName={active.otherFamily.displayName}
          onDone={async () => {
            await load();
            setActiveId(null);
          }}
        />
      )}

      {active && leaving && (
        <Modal
          open
          onClose={() => setLeaving(false)}
          title={t('msg.leaveTitle')}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setLeaving(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  await api.leaveConversation(active.conversation.id);
                  setLeaving(false);
                  setActiveId(null);
                  toast.push(t('msg.left'), 'ok');
                  await load();
                }}
              >
                {t('msg.leaveConfirm')}
              </button>
            </>
          }
        >
          <div className="stack stack-4">
            <p>
              {t('msg.leaveBody', { name: active.otherFamily.displayName })}
            </p>
            <Alert tone="info">
              {t('msg.leaveAlert')}
            </Alert>
          </div>
        </Modal>
      )}

      {active && planning && (
        <PlayDateComposer
          connectionId={active.connection.id}
          otherFamily={active.otherFamily}
          onClose={() => setPlanning(false)}
          onDone={() => {
            setPlanning(false);
            toast.push(t('msg.playdateSent'), 'ok');
          }}
        />
      )}
    </div>
  );
}
