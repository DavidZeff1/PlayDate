import { useState } from 'react';
import { api } from '../../services';
import type { ReportReason } from '../../domain/types';
import { REPORT_REASON_COPY } from '../../domain/safety/contentScan';
import { Alert, Modal, useToast } from '../ui';
import { IconAlert } from '../ui/Icons';

const ORDER: ReportReason[] = [
  'child_safety_urgent',
  'suspicious_behavior',
  'fake_identity',
  'harassment',
  'inappropriate_messages',
  'misrepresentation',
  'unwanted_contact',
  'inappropriate_content',
  'safety_concern',
];

/**
 * Reporting.
 *
 * Three product decisions worth naming:
 *
 *  1. The reported family is never told. Notifying them invites retaliation against the
 *     reporter and gives them time to delete evidence.
 *  2. A report never publicly marks anyone. It opens a case for a human; only a
 *     moderator decision changes an account state.
 *  3. Blocking is offered alongside, because a parent who is worried enough to report
 *     usually wants the contact to stop now, not after a review.
 */
export function ReportDialog({
  open,
  onClose,
  familyId,
  familyName,
  evidenceMessageIds,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  familyId: string;
  familyName: string;
  evidenceMessageIds?: string[];
  onDone?: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const toast = useToast();

  const reset = () => {
    setReason(null);
    setDetails('');
    setAlsoBlock(true);
    setError(null);
    setDone(false);
  };

  const submit = async () => {
    if (!reason) {
      setError('Choose what happened so we can route this to the right team.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.reportFamily({
        reportedFamilyId: familyId,
        reason,
        details,
        evidenceMessageIds,
        alsoBlock,
      });
      setDone(true);
      toast.push('Report submitted. Our safety team will review it.', 'ok');
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Modal
        open={open}
        onClose={() => {
          reset();
          onClose();
        }}
        title="Report received"
        footer={
          <button
            className="btn btn-primary"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Done
          </button>
        }
      >
        <div className="stack stack-4">
          <Alert tone="ok" title="Thank you — this has gone to our safety team.">
            A person will review it. We do not tell {familyName} that you reported them.
          </Alert>
          <p className="small muted">
            If a child is in immediate danger, please contact your local emergency services.
            PlayDate is not an emergency service.
          </p>
          {alsoBlock && (
            <p className="small muted">
              You have also blocked this family. They can no longer see your profile, message
              you, or appear in your results.
            </p>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={`Report ${familyName}`}
      description="Reports are reviewed by people, not automated systems."
      footer={
        <>
          <button
            className="btn btn-secondary"
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="btn btn-danger" onClick={submit} disabled={busy}>
            {busy ? 'Submitting…' : 'Submit report'}
          </button>
        </>
      }
    >
      <div className="stack stack-5">
        <Alert tone="info">
          Nothing you write here is shared with {familyName}. They are not told that a report
          exists. Reports never automatically change anyone's profile — a moderator decides
          what happens next.
        </Alert>

        <div className="field">
          <span className="label">What happened?</span>
          <div className="stack stack-2" role="radiogroup" aria-label="Report reason">
            {ORDER.map((r) => {
              const copy = REPORT_REASON_COPY[r];
              return (
                <label key={r} className="radio" data-checked={reason === r}>
                  <input
                    type="radio"
                    name="report-reason"
                    checked={reason === r}
                    onChange={() => setReason(r)}
                  />
                  <div>
                    <div className="strong small row row-2">
                      {copy.urgent && (
                        <span style={{ color: 'var(--danger-500)' }}>
                          <IconAlert size={13} />
                        </span>
                      )}
                      {copy.label}
                    </div>
                    <div className="tiny muted">{copy.description}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="report-details">
            Tell us what happened
          </label>
          <div className="hint">
            Dates, what was said, anything that felt off. Detail helps our team act quickly.
          </div>
          <textarea
            id="report-details"
            className="textarea"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="What happened, and when?"
            maxLength={2000}
          />
          <div className="tiny muted">{details.length}/2000</div>
        </div>

        {evidenceMessageIds && evidenceMessageIds.length > 0 && (
          <div className="panel small">
            <strong>Attaching this conversation.</strong> Our safety team will be able to read
            the messages in this thread — only this thread, and only while the case is open.
          </div>
        )}

        <label className="checkbox" data-checked={alsoBlock}>
          <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} />
          <div>
            <div className="strong small">Also block this family</div>
            <div className="tiny muted">
              Takes effect immediately. They disappear from your results, cannot message you,
              and are not told that you blocked them.
            </div>
          </div>
        </label>

        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

/* ========================================================================== */
/* Block confirmation                                                          */
/* ========================================================================== */

export function BlockDialog({
  open,
  onClose,
  familyId,
  familyName,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  familyId: string;
  familyName: string;
  onDone?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Block ${familyName}?`}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.blockFamily(familyId);
                toast.push(`${familyName} has been blocked.`, 'ok');
                onDone?.();
                onClose();
              } catch (e) {
                toast.push(e instanceof Error ? e.message : 'Could not block.', 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Blocking…' : 'Block family'}
          </button>
        </>
      }
    >
      <div className="stack stack-4">
        <p>Blocking takes effect immediately and works in both directions:</p>
        <ul className="stack stack-2 small muted">
          <li>• They will not appear in your results, and you will not appear in theirs.</li>
          <li>• Any conversation between you closes and cannot be reopened.</li>
          <li>• Any pending request between you is withdrawn.</li>
          <li>• They are not told that you blocked them.</li>
        </ul>
        <p className="small muted">
          You can undo this from Settings → Blocked families. If something concerning happened,
          consider reporting it as well — blocking stops the contact, but only a report tells our
          safety team.
        </p>
      </div>
    </Modal>
  );
}
