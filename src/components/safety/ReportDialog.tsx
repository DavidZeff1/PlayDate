import { useState } from 'react';
import { api } from '../../services';
import type { ReportReason } from '../../domain/types';
import { REPORT_REASONS, reportDescKey, reportLabelKey } from '../../domain/safety/contentScan';
import { useT } from '../../i18n';
import { Alert, Modal, useToast } from '../ui';
import { IconAlert } from '../ui/Icons';

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
  const t = useT();

  const reset = () => {
    setReason(null);
    setDetails('');
    setAlsoBlock(true);
    setError(null);
    setDone(false);
  };

  const submit = async () => {
    if (!reason) {
      setError(t('rep.chooseReason'));
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
      toast.push(t('rep.submitted'), 'ok');
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.somethingWrong'));
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
        title={t('rep.receivedTitle')}
        footer={
          <button
            className="btn btn-primary"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            {t('common.done')}
          </button>
        }
      >
        <div className="stack stack-4">
          <Alert tone="ok" title={t('rep.thanksTitle')}>
            {t('rep.thanksBody', { name: familyName })}
          </Alert>
          <p className="small muted">{t('rep.emergency')}</p>
          {alsoBlock && (
            <p className="small muted">{t('rep.alsoBlocked')}</p>
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
      title={t('rep.title', { name: familyName })}
      description={t('rep.sub')}
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
            {t('common.cancel')}
          </button>
          <button className="btn btn-danger" onClick={submit} disabled={busy}>
            {busy ? t('rep.submitting') : t('rep.submitReport')}
          </button>
        </>
      }
    >
      <div className="stack stack-5">
        <Alert tone="info">{t('rep.intro', { name: familyName })}</Alert>

        <div className="field">
          <span className="label">{t('rep.whatHappened')}</span>
          <div className="stack stack-2" role="radiogroup" aria-label={t('rep.reasonGroup')}>
            {REPORT_REASONS.map(({ id, urgent }) => {
              const r = id as ReportReason;
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
                      {urgent && (
                        <span style={{ color: 'var(--danger-500)' }}>
                          <IconAlert size={13} />
                        </span>
                      )}
                      {t(reportLabelKey(r))}
                    </div>
                    <div className="tiny muted">{t(reportDescKey(r))}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="report-details">
            {t('rep.tellUs')}
          </label>
          <div className="hint">{t('rep.tellUsHint')}</div>
          <textarea
            id="report-details"
            className="textarea"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={t('rep.placeholder')}
            maxLength={2000}
          />
          <div className="tiny muted">{t('common.charCount', { n: details.length, max: 2000 })}</div>
        </div>

        {evidenceMessageIds && evidenceMessageIds.length > 0 && (
          <div className="panel small">
            <strong>{t('rep.attaching')}</strong> {t('rep.attachingBody')}
          </div>
        )}

        <label className="checkbox" data-checked={alsoBlock}>
          <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} />
          <div>
            <div className="strong small">{t('rep.alsoBlock')}</div>
            <div className="tiny muted">{t('rep.alsoBlockDesc')}</div>
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
  const t = useT();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('block.title', { name: familyName })}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button
            className="btn btn-danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.blockFamily(familyId);
                toast.push(t('block.blocked', { name: familyName }), 'ok');
                onDone?.();
                onClose();
              } catch (e) {
                toast.push(e instanceof Error ? e.message : t('block.couldNot'), 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? t('block.blocking') : t('block.confirm')}
          </button>
        </>
      }
    >
      <div className="stack stack-4">
        <p>{t('block.intro')}</p>
        <ul className="stack stack-2 small muted">
          <li>• {t('block.b1')}</li>
          <li>• {t('block.b2')}</li>
          <li>• {t('block.b3')}</li>
          <li>• {t('block.b4')}</li>
        </ul>
        <p className="small muted">{t('block.undo')}</p>
      </div>
    </Modal>
  );
}
