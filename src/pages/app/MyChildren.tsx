import { useState } from 'react';
import { api } from '../../services';
import { useApp } from '../../state/AppContext';
import type { Child, ChildInterest, Importance } from '../../domain/types';
import { validateChildAge, validateLength } from '../../domain/validation';
import { IMPORTANCE_LABELS, interestEmoji, interestLabel } from '../../domain/interests';
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
  const [editing, setEditing] = useState<Child | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Child | null>(null);

  if (!family) return <LoadingBlock />;

  return (
    <div className="stack stack-6">
      <div className="row row-between row-4" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="page-head" style={{ marginBottom: 0 }}>
          <h1>My children</h1>
          <p>
            Your children are dependents on your family profile. They have no accounts, no
            inbox, and no way to be contacted by anyone.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
          <IconPlus size={15} />
          Add a child
        </button>
      </div>

      {family.children.length === 0 ? (
        <EmptyState
          icon={<IconChildren size={22} />}
          title="No children added yet"
          description="Matching works from ages and interests, so adding at least one child is what makes discovery useful."
          action={
            <button className="btn btn-primary" onClick={() => setEditing('new')}>
              <IconPlus size={16} />
              Add your first child
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
                      {child.age} years old
                      {child.pronouns && ` · ${child.pronouns}`}
                    </div>
                  </div>
                </div>
                <div className="row row-2">
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditing(child)}>
                    <IconEdit size={14} />
                    Edit
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => setDeleting(child)}
                    aria-label={`Remove ${child.firstName}`}
                  >
                    <IconTrash size={16} />
                  </button>
                </div>
              </div>

              <div className="card-body stack stack-5">
                {child.interests.length === 0 ? (
                  <p className="small muted">
                    No interests yet. Three or more makes a noticeable difference to matching.
                  </p>
                ) : (
                  <div>
                    <div className="small strong" style={{ marginBottom: 'var(--sp-3)' }}>
                      Interests
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
                      <div className="tiny muted">Energy level</div>
                      <Stars value={child.temperament.energy} size="sm" label="Energy" />
                    </div>
                    <div>
                      <div className="tiny muted">With new children</div>
                      <Stars value={child.temperament.sociability} size="sm" label="Sociability" />
                    </div>
                  </div>
                )}

                {child.notes && (
                  <div className="panel">
                    <div className="tiny muted" style={{ marginBottom: 2 }}>
                      Note for other parents — only visible after you connect
                    </div>
                    <p className="small">{child.notes}</p>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <Alert tone="info" title="What other families can see about your children">
        Their chosen name (first name, a nickname, or nothing), age or age band, and interests.
        Never a surname, a date of birth, a school, or a photo unless you explicitly turn photos
        on. Your notes are withheld until you connect.
      </Alert>

      {editing && (
        <ChildModal
          child={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
            toast.push('Saved.', 'ok');
          }}
        />
      )}

      {deleting && (
        <Modal
          open
          onClose={() => setDeleting(null)}
          title={`Remove ${deleting.firstName}?`}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setDeleting(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  await api.removeChild(deleting.id);
                  setDeleting(null);
                  await refresh();
                  toast.push('Child removed.', 'ok');
                }}
              >
                Remove
              </button>
            </>
          }
        >
          <p>
            This removes {deleting.firstName} from your family profile, along with their
            interests. Your matches will change accordingly. This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}

function InterestRow({ interest }: { interest: ChildInterest }) {
  return (
    <div className="row row-between row-3" style={{ flexWrap: 'wrap' }}>
      <span className="small row row-2">
        <span aria-hidden="true">{interestEmoji(interest.interestId)}</span>
        {interestLabel(interest.interestId)}
      </span>
      <span className="row row-4 row-wrap">
        <span className="row row-2">
          <span className="tiny muted">Enjoys</span>
          <Stars value={interest.enthusiasm} size="readonly" label="Enjoyment" />
        </span>
        <span className="row row-2">
          <span className="tiny muted">Matters</span>
          <Stars value={interest.importance} size="readonly" label="Matching importance" />
          <span className="tiny muted">{IMPORTANCE_LABELS[interest.importance]}</span>
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const errs: Record<string, string> = {};
    const e1 = validateLength(firstName, 'First name', 1, 40);
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
      title={child ? `Edit ${child.firstName}` : 'Add a child'}
      description="We ask for an age in years, never a date of birth."
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
          <Field label="First name" htmlFor="cm-first" error={errors.firstName}>
            <input
              id="cm-first"
              className="input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              aria-invalid={Boolean(errors.firstName)}
            />
          </Field>
          <Field
            label="Nickname"
            htmlFor="cm-nick"
            optional
            hint="Used if you choose nickname disclosure."
          >
            <input id="cm-nick" className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </Field>
          <Field label="Age" htmlFor="cm-age" error={errors.age}>
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
            How do they play?
          </div>
          <div className="stack stack-3">
            <div className="row row-between row-4">
              <div>
                <div className="small strong">Energy level</div>
                <div className="tiny muted">Quiet one-on-one play → boisterous group play</div>
              </div>
              <Stars value={energy} onChange={setEnergy} label="Energy level" />
            </div>
            <div className="row row-between row-4">
              <div>
                <div className="small strong">With new children</div>
                <div className="tiny muted">Needs warming up → jumps straight in</div>
              </div>
              <Stars value={sociability} onChange={setSociability} label="Sociability" />
            </div>
          </div>
        </div>

        <Field
          label="Anything helpful for another parent to know"
          htmlFor="cm-notes"
          optional
          hint="Only shown to families you have connected with."
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
            Interests
          </div>
          <p className="hint" style={{ marginBottom: 'var(--sp-4)' }}>
            Two ratings per interest: how much your child enjoys it (other families see this),
            and how much it should count when matching (private to you).
          </p>
          <InterestEditor value={interests} onChange={setInterests} />
        </div>

        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}
