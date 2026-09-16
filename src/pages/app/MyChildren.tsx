import { useState } from 'react';
import { api } from '../../services';
import { useApp } from '../../state/AppContext';
import type { Child, ChildInterest, Importance } from '../../domain/types';
import { validateChildAge, validateLength, type ValidationError } from '../../domain/validation';
import { importanceLabels, interestEmoji, interestLabel } from '../../domain/interests';
import { useT } from '../../i18n';
import { useFormat } from '../../i18n/format';
import {
  Alert,
  Avatar,
  EmptyState,
  Field,
  LoadingBlock,
  Modal,
  Stars,
  useToast,
} from '../../components/ui';
import { InterestEditor } from '../../components/family/Editors';
import { IconChildren, IconEdit, IconPlus, IconTrash } from '../../components/ui/Icons';

export function MyChildren() {
  const { family, refresh } = useApp();
  const toast = useToast();
  const t = useT();
  const [editing, setEditing] = useState<Child | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Child | null>(null);

  if (!family) return <LoadingBlock />;

  return (
    <div className="stack stack-6">
      <div className="row row-between row-4" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="page-head" style={{ marginBottom: 0 }}>
          <h1>{t('kids.h1')}</h1>
          <p>{t('kids.sub')}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
          <IconPlus size={15} />
          {t('kids.addChild')}
        </button>
      </div>

      {family.children.length === 0 ? (
        <EmptyState
          icon={<IconChildren size={22} />}
          title={t('kids.emptyTitle')}
          description={t('kids.emptyDesc')}
          action={
            <button className="btn btn-primary" onClick={() => setEditing('new')}>
              <IconPlus size={16} />
              {t('kids.addFirst')}
            </button>
          }
        />
      ) : (
        <div className="stack stack-5">
          {family.children.map((child) => (
            <section key={child.id} className="card">
              <div className="card-header">
                <div className="row row-3">
                  <Avatar name={child.firstName} color={child.avatarColor} size="md" />
                  <div>
                    <div className="strong">
                      {child.firstName}
                      {child.nickname && <span className="muted"> ({child.nickname})</span>}
                    </div>
                    <div className="small muted">
                      {t('common.yearsOld', { n: child.age })}
                      {child.pronouns && ` · ${child.pronouns}`}
                    </div>
                  </div>
                </div>
                <div className="row row-2">
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditing(child)}>
                    <IconEdit size={14} />
                    {t('common.edit')}
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => setDeleting(child)}
                    aria-label={t('kids.removeAria', { name: child.firstName })}
                  >
                    <IconTrash size={16} />
                  </button>
                </div>
              </div>

              <div className="card-body stack stack-5">
                {child.interests.length === 0 ? (
                  <p className="small muted">
                    {t('kids.noInterests')}
                  </p>
                ) : (
                  <div>
                    <div className="small strong" style={{ marginBottom: 'var(--sp-3)' }}>
                      {t('kids.interests')}
                    </div>
                    <div className="stack stack-2">
                      {[...child.interests]
                        .sort((a, b) => b.importance - a.importance || b.enthusiasm - a.enthusiasm)
                        .map((i) => (
                          <InterestRow key={i.interestId} interest={i} />
                        ))}
                    </div>
                  </div>
                )}

                {child.temperament && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: 'var(--sp-4)',
                    }}
                  >
                    <div>
                      <div className="tiny muted">{t('ob.kids.energy')}</div>
                      <Stars value={child.temperament.energy} size="sm" label={t('ob.kids.energy')} />
                    </div>
                    <div>
                      <div className="tiny muted">{t('ob.kids.social')}</div>
                      <Stars value={child.temperament.sociability} size="sm" label={t('ob.kids.social')} />
                    </div>
                  </div>
                )}

                {child.notes && (
                  <div className="panel">
                    <div className="tiny muted" style={{ marginBottom: 2 }}>
                      {t('kids.noteHeader')}
                    </div>
                    <p className="small">{child.notes}</p>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <Alert tone="info" title={t('kids.whatOthersSee')}>
        {t('kids.whatOthersSeeBody')}
      </Alert>

      {editing && (
        <ChildModal
          child={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
            toast.push(t('kids.saved'), 'ok');
          }}
        />
      )}

      {deleting && (
        <Modal
          open
          onClose={() => setDeleting(null)}
          title={t('kids.removeTitle', { name: deleting.firstName })}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setDeleting(null)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  await api.removeChild(deleting.id);
                  setDeleting(null);
                  await refresh();
                  toast.push(t('kids.removed'), 'ok');
                }}
              >
                {t('common.remove')}
              </button>
            </>
          }
        >
          <p>{t('kids.removeBody', { name: deleting.firstName })}</p>
        </Modal>
      )}
    </div>
  );
}

function InterestRow({ interest }: { interest: ChildInterest }) {
  const t = useT();
  const impLabels = importanceLabels(t);
  return (
    <div className="row row-between row-3" style={{ flexWrap: 'wrap' }}>
      <span className="small row row-2">
        <span aria-hidden="true">{interestEmoji(interest.interestId)}</span>
        {interestLabel(interest.interestId, t)}
      </span>
      <span className="row row-4 row-wrap">
        <span className="row row-2">
          <span className="tiny muted">{t('kids.enjoys')}</span>
          <Stars value={interest.enthusiasm} size="readonly" label="Enjoyment" />
        </span>
        <span className="row row-2">
          <span className="tiny muted">{t('kids.matters')}</span>
          <Stars value={interest.importance} size="readonly" label="Matching importance" />
          <span className="tiny muted">{impLabels[interest.importance]}</span>
        </span>
      </span>
    </div>
  );
}

/* ========================================================================== */
/* Add / edit child                                                            */
/* ========================================================================== */

function ChildModal({
  child,
  onClose,
  onSaved,
}: {
  child: Child | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState(child?.firstName ?? '');
  const [nickname, setNickname] = useState(child?.nickname ?? '');
  const [age, setAge] = useState(child ? String(child.age) : '');
  const [pronouns, setPronouns] = useState(child?.pronouns ?? '');
  const [notes, setNotes] = useState(child?.notes ?? '');
  const [energy, setEnergy] = useState<Importance>(child?.temperament?.energy ?? 3);
  const [sociability, setSociability] = useState<Importance>(child?.temperament?.sociability ?? 3);
  const [interests, setInterests] = useState<ChildInterest[]>(child?.interests ?? []);
  const [errors, setErrors] = useState<Record<string, ValidationError>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();
  const f = useFormat();

  const save = async () => {
    const errs: Record<string, ValidationError> = {};
    const e1 = validateLength(firstName, 'val.firstName', 1, 40);
    const e2 = validateChildAge(Number(age));
    if (e1) errs.firstName = e1;
    if (e2) errs.age = e2;
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setBusy(true);
    setError(null);
    try {
      const payload = {
        firstName,
        nickname: nickname || undefined,
        age: Number(age),
        pronouns: pronouns || undefined,
        notes: notes || undefined,
        temperament: { energy, sociability },
        interests,
      };
      if (child) await api.updateChild(child.id, payload);
      else await api.addChild(payload);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={child ? t('kids.editTitle', { name: child.firstName }) : t('kids.addTitle')}
      description={t('kids.modalSub')}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : child ? 'Save changes' : 'Add child'}
          </button>
        </>
      }
    >
      <div className="stack stack-5">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 'var(--sp-4)',
          }}
        >
          <Field label={t('kids.firstName' as never)} htmlFor="cm-first" error={f.errorText(errors.firstName)}>
            <input
              id="cm-first"
              className="input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              aria-invalid={Boolean(errors.firstName)}
            />
          </Field>
          <Field
            label={t('ob.kids.nickname')}
            htmlFor="cm-nick"
            optional
            hint={t('kids.nicknameHint')}
          >
            <input id="cm-nick" className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </Field>
          <Field label={t('ob.kids.age')} htmlFor="cm-age" error={f.errorText(errors.age)}>
            <input
              id="cm-age"
              className="input"
              type="number"
              min={1}
              max={17}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              aria-invalid={Boolean(errors.age)}
            />
          </Field>
          <Field label="Pronouns" htmlFor="cm-pro" optional>
            <input id="cm-pro" className="input" value={pronouns} onChange={(e) => setPronouns(e.target.value)} />
          </Field>
        </div>

        <div>
          <div className="label" style={{ marginBottom: 'var(--sp-3)' }}>
            {t('ob.kids.howPlay')}
          </div>
          <div className="stack stack-3">
            <div className="row row-between row-4">
              <div>
                <div className="small strong">{t('ob.kids.energy')}</div>
                <div className="tiny muted">{t('ob.kids.energyHint')}</div>
              </div>
              <Stars value={energy} onChange={setEnergy} label={t('ob.kids.energy')} />
            </div>
            <div className="row row-between row-4">
              <div>
                <div className="small strong">{t('ob.kids.social')}</div>
                <div className="tiny muted">{t('ob.kids.socialHint')}</div>
              </div>
              <Stars value={sociability} onChange={setSociability} label={t('ob.kids.social')} />
            </div>
          </div>
        </div>

        <Field
          label={t('ob.kids.notes')}
          htmlFor="cm-notes"
          optional
          hint={t('ob.kids.notesHint')}
        >
          <textarea
            id="cm-notes"
            className="textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={400}
          />
        </Field>

        <hr className="divider" />

        <div>
          <div className="label" style={{ marginBottom: 'var(--sp-1)' }}>
            {t('kids.interests')}
          </div>
          <p className="hint" style={{ marginBottom: 'var(--sp-4)' }}>
            {t('kids.interestsHint')}
          </p>
          <InterestEditor value={interests} onChange={setInterests} />
        </div>

        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}
