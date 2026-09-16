import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type AdminOverview } from '../../services';
import type { ModerationActionKind, ModerationCase } from '../../domain/types';
import { reportLabelKey } from '../../domain/safety/contentScan';
import { useI18n, useT } from '../../i18n';
import { useFormat } from '../../i18n/format';
import type { TKey } from '../../i18n/types';
import {
  Alert,
  Badge,
  EmptyState,
  Field,
  LoadingBlock,
  Modal,
  PrototypeNote,
  Tabs,
  useToast,
} from '../../components/ui';
import { Logo } from '../../components/layout/Logo';
import {
  IconArrowRight,
  IconCheck,
  IconDoc,
  IconGavel,
  IconList,
  IconShieldCheck,
  IconUsers,
  IconX,
} from '../../components/ui/Icons';

type Tab = 'verification' | 'reports' | 'users' | 'audit';

/**
 * Moderation actions, in escalating order of severity.
 *
 * The labels are dictionary KEYS, not sentences: this array lives at module scope, so
 * it cannot call the translate hook. The component resolves them at render time, which
 * is also what makes the list re-render correctly when the language changes.
 */
const ACTIONS: Array<{
  kind: ModerationActionKind;
  labelKey: TKey;
  descKey: TKey;
  tone: string;
}> = [
  { kind: 'no_action', labelKey: 'admin.act.no_action', descKey: 'admin.act.no_actionDesc', tone: 'ghost' },
  {
    kind: 'warning_issued',
    labelKey: 'admin.act.warning_issued',
    descKey: 'admin.act.warning_issuedDesc',
    tone: 'secondary',
  },
  {
    kind: 'require_reverification',
    labelKey: 'admin.act.require_reverification',
    descKey: 'admin.act.require_reverificationDesc',
    tone: 'secondary',
  },
  {
    kind: 'restrict_account',
    labelKey: 'admin.act.restrict_account',
    descKey: 'admin.act.restrict_accountDesc',
    tone: 'secondary',
  },
  {
    kind: 'suspend_account',
    labelKey: 'admin.act.suspend_account',
    descKey: 'admin.act.suspend_accountDesc',
    tone: 'danger',
  },
  { kind: 'ban_account', labelKey: 'admin.act.ban_account', descKey: 'admin.act.ban_accountDesc', tone: 'danger' },
];

/**
 * Staff tooling — the moderation, verification and audit concept.
 *
 * In production this would be a SEPARATE application behind separate authentication,
 * with its own roles (`moderator`, `verification_agent`, `admin`) and no parent-facing
 * code in the bundle at all. It is included here so the concept is demonstrable, and
 * every view opened from a parent session writes an audit entry saying exactly that.
 */
export function Admin() {
  const t = useT();
  const f = useFormat();
  const { d } = useI18n();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('verification');
  const [data, setData] = useState<AdminOverview | null>(null);
  const [activeCase, setActiveCase] = useState<ModerationCase | null>(null);

  const load = useCallback(async () => {
    setData(await api.adminOverview());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data) return <LoadingBlock />;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header className="site-header">
        <div className="site-header-inner">
          <Logo to="/app" subtitle={t('nav.staffTools')} />
          <Link to="/app" className="btn btn-secondary btn-sm">
            {t('admin.backToFamily')}
            <IconArrowRight size={14} />
          </Link>
        </div>
      </header>

      <div className="app-content">
        <div className="page-head">
          <h1>{t('admin.h1')}</h1>
          <p>
            {t('admin.sub')}
          </p>
        </div>

        <div style={{ marginBottom: 'var(--sp-6)' }}>
          <PrototypeNote>
            {t('proto.admin')}
          </PrototypeNote>
        </div>

        <div className="stat-row" style={{ marginBottom: 'var(--sp-8)' }}>
          <div className="stat">
            <div className="row row-2 small muted" style={{ marginBottom: 'var(--sp-2)' }}>
              <IconShieldCheck size={14} />
              {t('admin.queue')}
            </div>
            <div className="stat-value">{data.pendingVerifications.length}</div>
            <div className="stat-label">{t('admin.awaitingDecision')}</div>
          </div>
          <div className="stat">
            <div className="row row-2 small muted" style={{ marginBottom: 'var(--sp-2)' }}>
              <IconGavel size={14} />
              {t('admin.openCases')}
            </div>
            <div className="stat-value">{data.openCases.length}</div>
            <div className="stat-label">
              {t('admin.urgent', {
                n: data.openCases.filter((c) => c.priority === 'urgent').length,
              })}
            </div>
          </div>
          <div className="stat">
            <div className="row row-2 small muted" style={{ marginBottom: 'var(--sp-2)' }}>
              <IconUsers size={14} />
              {t('admin.accounts')}
            </div>
            <div className="stat-value">{data.accounts.length}</div>
            <div className="stat-label">
              {t('admin.notActive', {
                n: data.accounts.filter((a) => a.state !== 'active').length,
              })}
            </div>
          </div>
          <div className="stat">
            <div className="row row-2 small muted" style={{ marginBottom: 'var(--sp-2)' }}>
              <IconList size={14} />
              {t('admin.auditEntries')}
            </div>
            <div className="stat-value">{data.auditLog.length}</div>
            <div className="stat-label">{t('admin.mostRecent')}</div>
          </div>
        </div>

        <Tabs
          label={t('nav.staffTools')}
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'verification', label: t('admin.queue'), count: data.pendingVerifications.length },
            { value: 'reports', label: t('admin.tabReports'), count: data.openCases.length },
            { value: 'users', label: t('admin.accounts') },
            { value: 'audit', label: t('admin.tabAudit') },
          ]}
        />

        {/* ---- Verification queue ------------------------------------- */}
        {tab === 'verification' &&
          (data.pendingVerifications.length === 0 ? (
            <EmptyState
              icon={<IconShieldCheck size={22} />}
              title={t('admin.queueClear')}
              description={t('admin.queueClearDesc')}
            />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t('admin.colFamily')}</th>
                    <th>{t('admin.colStatus')}</th>
                    <th>{t('admin.colSubmitted')}</th>
                    <th style={{ textAlign: 'right' }}>{t('admin.colDecision')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pendingVerifications.map((v) => (
                    <tr key={v.parentId}>
                      <td>
                        <div className="strong">{v.familyDisplayName}</div>
                        <div className="mono tiny">{v.parentId}</div>
                      </td>
                      <td>
                        <Badge tone="pending">{f.verificationLabel(v.status)}</Badge>
                      </td>
                      <td className="muted">{v.submittedAt ? f.timeAgo(v.submittedAt) : '—'}</td>
                      <td>
                        <div className="row row-2 row-end">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={async () => {
                              await api.adminDecideVerification(
                                v.parentId,
                                'verified',
                                t('admin.approveRationale'),
                              );
                              toast.push(t('admin.markedVerified'), 'ok');
                              await load();
                            }}
                          >
                            <IconCheck size={13} />
                            {t('admin.approve')}
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={async () => {
                              await api.adminDecideVerification(
                                v.parentId,
                                'failed',
                                t('admin.rejectRationale'),
                              );
                              toast.push(t('admin.markedFailed'), 'ok');
                              await load();
                            }}
                          >
                            <IconX size={13} />
                            {t('admin.reject')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {/* ---- Cases -------------------------------------------------- */}
        {tab === 'reports' &&
          (data.openCases.length === 0 ? (
            <EmptyState
              icon={<IconGavel size={22} />}
              title={t('admin.noCases')}
              description={t('admin.noCasesDesc')}
            />
          ) : (
            <div className="stack stack-4">
              <Alert tone="info">
                {t('admin.reportsDoNotChange')}
              </Alert>

              {data.openCases.map((c) => (
                <section key={c.id} className="card card-pad">
                  <div className="row row-between row-4" style={{ flexWrap: 'wrap' }}>
                    <div>
                      <div className="row row-3" style={{ flexWrap: 'wrap' }}>
                        <span className="strong">
                          {data.accounts.find((a) => a.familyId === c.reportedFamilyId)
                            ?.familyDisplayName ?? c.reportedFamilyId}
                        </span>
                        <Badge
                          tone={
                            c.priority === 'urgent'
                              ? 'warn'
                              : c.priority === 'high'
                                ? 'pending'
                                : 'neutral'
                          }
                        >
                          {c.priority} priority
                        </Badge>
                        <Badge tone="neutral">{c.status}</Badge>
                      </div>
                      <div className="tiny muted mono" style={{ marginTop: 4 }}>
                        {c.id} · {c.reportIds.length} report{c.reportIds.length === 1 ? '' : 's'} ·
                        opened {f.timeAgo(c.createdAt)}
                      </div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => setActiveCase(c)}>
                      {t('admin.reviewCase')}
                    </button>
                  </div>

                  {c.notes.length > 0 && (
                    <div className="panel small" style={{ marginTop: 'var(--sp-4)' }}>
                      <div className="tiny muted">{t('admin.latestNote')}</div>
                      <p style={{ marginTop: 2 }}>{c.notes[c.notes.length - 1].body}</p>
                    </div>
                  )}
                </section>
              ))}
            </div>
          ))}

        {/* ---- Accounts ------------------------------------------------ */}
        {tab === 'users' && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t('admin.colFamily')}</th>
                  <th>{t('set.accountState')}</th>
                  <th>{t('nav.verification')}</th>
                  <th>{t('admin.colJoined')}</th>
                </tr>
              </thead>
              <tbody>
                {data.accounts.map((a) => (
                  <tr key={a.familyId}>
                    <td>
                      <div className="strong">{a.familyDisplayName}</div>
                      <div className="mono tiny">{a.familyId}</div>
                    </td>
                    <td>
                      <Badge
                        tone={
                          a.state === 'active'
                            ? 'ok'
                            : a.state === 'banned' || a.state === 'suspended'
                              ? 'warn'
                              : 'pending'
                        }
                      >
                        {a.state.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={a.verification === 'verified' ? 'ok' : 'pending'}>
                        {a.verification}
                      </Badge>
                    </td>
                    <td className="muted">
                      {d(a.joinedAt, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ---- Audit --------------------------------------------------- */}
        {tab === 'audit' && (
          <div className="stack stack-4">
            <Alert tone="info" title={t('admin.auditStripped')}>
              {t('admin.auditStrippedBody')}
            </Alert>

            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t('admin.colWhen')}</th>
                    <th>{t('admin.colActor')}</th>
                    <th>{t('admin.colAction')}</th>
                    <th>{t('admin.colTarget')}</th>
                    <th>{t('admin.colMetadata')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.auditLog.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted center" style={{ padding: 'var(--sp-8)' }}>
                        {t('admin.noEntries')}
                      </td>
                    </tr>
                  ) : (
                    data.auditLog.map((e) => (
                      <tr key={e.id}>
                        <td className="muted nowrap">
                          {d(e.at, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="mono">{e.actor}</td>
                        <td>
                          <span className="badge badge-neutral">{e.action}</span>
                        </td>
                        <td className="mono muted">{e.target ?? '—'}</td>
                        <td className="mono tiny muted">
                          {e.metadata ? JSON.stringify(e.metadata) : '—'}
                          {e.caseId && <div>case: {e.caseId}</div>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {activeCase && (
        <CaseModal
          moderationCase={activeCase}
          onClose={() => setActiveCase(null)}
          onDone={async () => {
            setActiveCase(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

/* ========================================================================== */
/* Case review                                                                 */
/* ========================================================================== */

function CaseModal({
  moderationCase,
  onClose,
  onDone,
}: {
  moderationCase: ModerationCase;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const t = useT();
  const f = useFormat();
  const [note, setNote] = useState('');
  const [action, setAction] = useState<ModerationActionKind | null>(null);
  const [rationale, setRationale] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<
    Array<{ id: string; reason: string; details: string; createdAt: string }>
  >([]);

  useEffect(() => {
    // The prototype reads reports from the overview; a real console would fetch them
    // scoped to the case, and the read would be audited against the case id.
    void api.adminOverview().then(() => setReports([]));
  }, []);

  const submit = async () => {
    if (!action) {
      setError(t('admin.chooseAction'));
      return;
    }
    if (!rationale.trim()) {
      setError(t('admin.rationaleRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.adminActOnCase(moderationCase.id, action, rationale);
      toast.push(t('admin.decisionRecorded'), 'ok');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.couldNotRecord'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={t('admin.reviewCase')}
      description={`${moderationCase.reportIds.length} report${moderationCase.reportIds.length === 1 ? '' : 's'} · ${moderationCase.priority} priority`}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? t('admin.recording') : t('admin.recordDecision')}
          </button>
        </>
      }
    >
      <div className="stack stack-6">
        <div className="panel small">
          <div className="row row-between">
            <span className="mono">{moderationCase.id}</span>
            <Badge tone={moderationCase.priority === 'urgent' ? 'warn' : 'neutral'}>
              {moderationCase.priority}
            </Badge>
          </div>
          <div className="muted tiny" style={{ marginTop: 4 }}>
            Opened {f.timeAgo(moderationCase.createdAt)} · reported family{' '}
            <span className="mono">{moderationCase.reportedFamilyId}</span>
          </div>
        </div>

        {moderationCase.notes.length > 0 && (
          <section>
            <h4 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--sp-3)' }}>
              {t('admin.caseNotes')}
            </h4>
            <div className="stack stack-2">
              {moderationCase.notes.map((n, i) => (
                <div key={i} className="panel small">
                  <div className="tiny muted">
                    {n.by} · {f.timeAgo(n.at)}
                  </div>
                  <p style={{ marginTop: 2 }}>{n.body}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {reports.length > 0 && (
          <section>
            <h4 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--sp-3)' }}>{t('admin.caseReports')}</h4>
            {reports.map((r) => (
              <div key={r.id} className="panel small">
                <div className="strong">{t(reportLabelKey(r.reason))}</div>
                <p className="muted">{r.details}</p>
              </div>
            ))}
          </section>
        )}

        <Field
          label={t('admin.addNote')}
          htmlFor="case-note"
          optional
          hint={t('admin.addNoteHint')}
        >
          <div className="row row-3" style={{ alignItems: 'flex-start' }}>
            <textarea
              id="case-note"
              className="textarea grow"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
            <button
              className="btn btn-secondary btn-sm"
              disabled={!note.trim() || busy}
              onClick={async () => {
                await api.adminAddCaseNote(moderationCase.id, note);
                setNote('');
                toast.push(t('admin.noteAdded'), 'ok');
              }}
            >
              {t('admin.addNoteBtn')}
            </button>
          </div>
        </Field>

        <hr className="divider" />

        <div className="field">
          <span className="label">{t('admin.colDecision')}</span>
          <div className="hint">
            {t('admin.decisionHint')}
          </div>
          <div className="stack stack-2" style={{ marginTop: 'var(--sp-2)' }}>
            {ACTIONS.map((a) => (
              <label key={a.kind} className="radio" data-checked={action === a.kind}>
                <input
                  type="radio"
                  name="mod-action"
                  checked={action === a.kind}
                  onChange={() => setAction(a.kind)}
                />
                <div>
                  <div className="strong small">{t(a.labelKey)}</div>
                  <div className="tiny muted">{t(a.descKey)}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <Field
          label={t('admin.rationale')}
          htmlFor="case-rationale"
          hint={t('admin.rationaleHint')}
        >
          <textarea
            id="case-rationale"
            className="textarea"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder={t('admin.rationalePlaceholder')}
          />
        </Field>

        {error && <Alert tone="danger">{error}</Alert>}

        <div className="panel small muted row row-3" style={{ alignItems: 'flex-start' }}>
          <IconDoc size={14} style={{ marginTop: 2, flexShrink: 0 }} />
          <span>
            {t('admin.notTold')}
          </span>
        </div>
      </div>
    </Modal>
  );
}
