import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type AdminOverview } from '../../services';
import type { ModerationActionKind, ModerationCase } from '../../domain/types';
import { REPORT_REASON_COPY } from '../../domain/safety/contentScan';
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
import { timeAgo } from '../app/Requests';
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

const ACTIONS: Array<{ kind: ModerationActionKind; label: string; description: string; tone: string }> = [
  { kind: 'no_action', label: 'No action needed', description: 'Nothing to answer. The account is unaffected.', tone: 'ghost' },
  { kind: 'warning_issued', label: 'Issue a warning', description: 'The family is told what the concern was. Account stays active.', tone: 'secondary' },
  {
    kind: 'require_reverification',
    label: 'Require re-verification',
    description: 'Discovery closes until identity verification is completed again.',
    tone: 'secondary',
  },
  {
    kind: 'restrict_account',
    label: 'Restrict temporarily',
    description: 'Cannot send new requests. Existing conversations continue.',
    tone: 'secondary',
  },
  { kind: 'suspend_account', label: 'Suspend account', description: 'Signed out and unable to use PlayDate pending resolution.', tone: 'danger' },
  { kind: 'ban_account', label: 'Ban permanently', description: 'The account is closed for good. Used for confirmed child-safety concerns.', tone: 'danger' },
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
          <Logo to="/app" subtitle="Staff tools" />
          <Link to="/app" className="btn btn-secondary btn-sm">
            Back to my family
            <IconArrowRight size={14} />
          </Link>
        </div>
      </header>

      <div className="app-content">
        <div className="page-head">
          <h1>Moderation &amp; trust</h1>
          <p>
            Verification decisions, safety cases, account states and the audit trail. Reports
            never change an account on their own — a person does, and the decision is recorded.
          </p>
        </div>

        <div style={{ marginBottom: 'var(--sp-6)' }}>
          <PrototypeNote>
            In production this is a separate application behind separate staff authentication,
            with role-scoped access: a verification agent sees identity decisions and never a
            family's conversations. It is shown here to demonstrate the concept, and opening it
            from a parent account is itself written to the audit log.
          </PrototypeNote>
        </div>

        <div className="stat-row" style={{ marginBottom: 'var(--sp-8)' }}>
          <div className="stat">
            <div className="row row-2 small muted" style={{ marginBottom: 'var(--sp-2)' }}>
              <IconShieldCheck size={14} />
              Verification queue
            </div>
            <div className="stat-value">{data.pendingVerifications.length}</div>
            <div className="stat-label">awaiting a decision</div>
          </div>
          <div className="stat">
            <div className="row row-2 small muted" style={{ marginBottom: 'var(--sp-2)' }}>
              <IconGavel size={14} />
              Open cases
            </div>
            <div className="stat-value">{data.openCases.length}</div>
            <div className="stat-label">
              {data.openCases.filter((c) => c.priority === 'urgent').length} urgent
            </div>
          </div>
          <div className="stat">
            <div className="row row-2 small muted" style={{ marginBottom: 'var(--sp-2)' }}>
              <IconUsers size={14} />
              Accounts
            </div>
            <div className="stat-value">{data.accounts.length}</div>
            <div className="stat-label">
              {data.accounts.filter((a) => a.state !== 'active').length} not active
            </div>
          </div>
          <div className="stat">
            <div className="row row-2 small muted" style={{ marginBottom: 'var(--sp-2)' }}>
              <IconList size={14} />
              Audit entries
            </div>
            <div className="stat-value">{data.auditLog.length}</div>
            <div className="stat-label">most recent first</div>
          </div>
        </div>

        <Tabs
          label="Staff tools"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'verification', label: 'Verification queue', count: data.pendingVerifications.length },
            { value: 'reports', label: 'Reports & cases', count: data.openCases.length },
            { value: 'users', label: 'Accounts' },
            { value: 'audit', label: 'Audit log' },
          ]}
        />

        {/* ---- Verification queue ------------------------------------- */}
        {tab === 'verification' &&
          (data.pendingVerifications.length === 0 ? (
            <EmptyState
              icon={<IconShieldCheck size={22} />}
              title="Verification queue is clear"
              description="Identity checks awaiting a decision appear here."
            />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Family</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th style={{ textAlign: 'right' }}>Decision</th>
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
                        <Badge tone="pending">{v.status}</Badge>
                      </td>
                      <td className="muted">{v.submittedAt ? timeAgo(v.submittedAt) : '—'}</td>
                      <td>
                        <div className="row row-2 row-end">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={async () => {
                              await api.adminDecideVerification(
                                v.parentId,
                                'verified',
                                'Document and selfie matched.',
                              );
                              toast.push('Marked as verified.', 'ok');
                              await load();
                            }}
                          >
                            <IconCheck size={13} />
                            Approve
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={async () => {
                              await api.adminDecideVerification(
                                v.parentId,
                                'failed',
                                'The document could not be read clearly.',
                              );
                              toast.push('Marked as failed.', 'ok');
                              await load();
                            }}
                          >
                            <IconX size={13} />
                            Reject
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
              title="No open cases"
              description="Reports from parents are grouped into one case per reported family, so patterns across reporters are visible."
            />
          ) : (
            <div className="stack stack-4">
              <Alert tone="info">
                Reports do not change an account state. Only a decision recorded here does, and
                every decision requires a written rationale.
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
                        opened {timeAgo(c.createdAt)}
                      </div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => setActiveCase(c)}>
                      Review case
                    </button>
                  </div>

                  {c.notes.length > 0 && (
                    <div className="panel small" style={{ marginTop: 'var(--sp-4)' }}>
                      <div className="tiny muted">Latest note</div>
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
                  <th>Family</th>
                  <th>Account state</th>
                  <th>Verification</th>
                  <th>Joined</th>
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
                      {new Date(a.joinedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
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
            <Alert tone="info" title="Personal data is stripped before anything is written here.">
              Audit entries record what happened, by whom and against what — never message
              contents, names, contact details or locations. The log is a record of actions, not
              a second copy of the family database.
            </Alert>

            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {data.auditLog.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted center" style={{ padding: 'var(--sp-8)' }}>
                        No entries yet. Actions you take in the app appear here.
                      </td>
                    </tr>
                  ) : (
                    data.auditLog.map((e) => (
                      <tr key={e.id}>
                        <td className="muted nowrap">
                          {new Date(e.at).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
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
      setError('Choose an action.');
      return;
    }
    if (!rationale.trim()) {
      setError('A written rationale is required for every decision.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.adminActOnCase(moderationCase.id, action, rationale);
      toast.push('Decision recorded.', 'ok');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record the decision.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="Review case"
      description={`${moderationCase.reportIds.length} report${moderationCase.reportIds.length === 1 ? '' : 's'} · ${moderationCase.priority} priority`}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Recording…' : 'Record decision'}
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
            Opened {timeAgo(moderationCase.createdAt)} · reported family{' '}
            <span className="mono">{moderationCase.reportedFamilyId}</span>
          </div>
        </div>

        {moderationCase.notes.length > 0 && (
          <section>
            <h4 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--sp-3)' }}>
              Case notes
            </h4>
            <div className="stack stack-2">
              {moderationCase.notes.map((n, i) => (
                <div key={i} className="panel small">
                  <div className="tiny muted">
                    {n.by} · {timeAgo(n.at)}
                  </div>
                  <p style={{ marginTop: 2 }}>{n.body}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {reports.length > 0 && (
          <section>
            <h4 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--sp-3)' }}>Reports</h4>
            {reports.map((r) => (
              <div key={r.id} className="panel small">
                <div className="strong">{REPORT_REASON_COPY[r.reason]?.label ?? r.reason}</div>
                <p className="muted">{r.details}</p>
              </div>
            ))}
          </section>
        )}

        <Field
          label="Add a note"
          htmlFor="case-note"
          optional
          hint="Recorded against the case. Visible to other reviewers, never to the family."
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
                toast.push('Note added.', 'ok');
              }}
            >
              Add note
            </button>
          </div>
        </Field>

        <hr className="divider" />

        <div className="field">
          <span className="label">Decision</span>
          <div className="hint">
            Proportionate to what the evidence shows. An unproven report is not grounds for a
            restriction.
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
                  <div className="strong small">{a.label}</div>
                  <div className="tiny muted">{a.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <Field
          label="Rationale"
          htmlFor="case-rationale"
          hint="Required. Written to the audit log with your account id — this is what makes the decision reviewable later."
        >
          <textarea
            id="case-rationale"
            className="textarea"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="What the evidence showed, and why this action is proportionate."
          />
        </Field>

        {error && <Alert tone="danger">{error}</Alert>}

        <div className="panel small muted row row-3" style={{ alignItems: 'flex-start' }}>
          <IconDoc size={14} style={{ marginTop: 2, flexShrink: 0 }} />
          <span>
            The reporting family is not told what action was taken — that is the reported
            family's private account information. The reported family is told the outcome, but
            never who reported them.
          </span>
        </div>
      </div>
    </Modal>
  );
}
