import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services';
import { useApp } from '../../state/AppContext';
import { DisclosureTier, type Family } from '../../domain/types';
import { projectFamily } from '../../domain/privacy/redaction';
import { Alert, Avatar, Badge, Field, LoadingBlock, useToast } from '../../components/ui';
import {
  ChildInterestList,
  FamilyMeta,
  InterestTags,
  STYLE_LABELS,
  TrustSignals,
  VerificationBadge,
} from '../../components/family/FamilyBits';
import { IconCheck, IconEye, IconLock, IconMapPin, IconEdit } from '../../components/ui/Icons';

/**
 * Your own family profile, with a "what others see" preview built from the *real*
 * redaction function — not a mock-up of it.
 *
 * That matters: the preview cannot drift from reality, because it is produced by the
 * same `projectFamily` call that serves other families. If the preview shows it, other
 * families genuinely see it; if it does not, they genuinely do not.
 */
export function MyFamily() {
  const { family, parent, refresh } = useApp();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);

  if (!family || !parent) return <LoadingBlock />;

  return (
    <div className="stack stack-6">
      <div className="row row-between row-4" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="page-head" style={{ marginBottom: 0 }}>
          <h1>My family</h1>
          <p>Your family profile — the one thing other families see.</p>
        </div>
        <div className="row row-3">
          <button className="btn btn-secondary btn-sm" onClick={() => setPreview((p) => !p)}>
            <IconEye size={15} />
            {preview ? 'Hide preview' : 'See what others see'}
          </button>
          {!editing && (
            <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>
              <IconEdit size={15} />
              Edit profile
            </button>
          )}
        </div>
      </div>

      {preview && <OthersViewPreview family={family} />}

      {editing ? (
        <EditFamilyForm
          family={family}
          onCancel={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await refresh();
            toast.push('Family profile updated.', 'ok');
          }}
        />
      ) : (
        <>
          <section className="card">
            <div className="card-body">
              <div className="row row-4" style={{ marginBottom: 'var(--sp-5)' }}>
                <Avatar name={family.displayName} color="var(--brand-600)" size="xl" square />
                <div className="grow">
                  <h2 style={{ fontSize: 'var(--text-xl)' }}>{family.displayName}</h2>
                  <div className="row row-wrap" style={{ gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
                    <VerificationBadge status={family.verificationStatus} />
                    <Badge tone="neutral">
                      <IconMapPin size={11} />
                      {family.generalArea}
                    </Badge>
                    {family.privacy.discoverable ? (
                      <Badge tone="ok">Discoverable</Badge>
                    ) : (
                      <Badge tone="warn">Hidden</Badge>
                    )}
                  </div>
                </div>
              </div>

              {family.about && <p className="muted">{family.about}</p>}

              <hr className="divider" />

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 'var(--sp-5)',
                }}
              >
                <Detail label="General area" value={family.generalArea} />
                <Detail
                  label="Neighbourhood"
                  value={family.neighborhood ?? 'Not set'}
                  note="Only shown to connected families"
                />
                <Detail label="Languages" value={family.languages.join(', ') || 'Not set'} />
                <Detail
                  label="Travel limit"
                  value={`${family.preferences.maxTravelKm} km`}
                  note="A hard filter, not a preference"
                />
                <Detail
                  label="Age flexibility"
                  value={`± ${family.preferences.ageFlexibilityYears} years`}
                />
                <Detail
                  label="Member since"
                  value={new Date(family.createdAt).toLocaleDateString('en-GB', {
                    month: 'long',
                    year: 'numeric',
                  })}
                />
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <span className="card-title">Children</span>
              <Link to="/app/children" className="small">
                Manage children
              </Link>
            </div>
            <div className="card-body">
              {family.children.length === 0 ? (
                <p className="muted small">No children added yet.</p>
              ) : (
                <div className="stack stack-5">
                  {family.children.map((c) => (
                    <div key={c.id} className="panel">
                      <div className="row row-3" style={{ marginBottom: 'var(--sp-3)' }}>
                        <Avatar name={c.firstName} color={c.avatarColor} size="md" />
                        <div className="grow">
                          <div className="strong">
                            {c.firstName}
                            {c.nickname && <span className="muted"> ({c.nickname})</span>}
                          </div>
                          <div className="small muted">
                            {c.age} years old
                            {c.pronouns && ` · ${c.pronouns}`}
                          </div>
                        </div>
                      </div>
                      <InterestTags interestIds={c.interests.map((i) => i.interestId)} limit={8} />
                      {c.notes && (
                        <p className="small muted" style={{ marginTop: 'var(--sp-3)' }}>
                          {c.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <div className="dash-grid">
            <section className="card">
              <div className="card-header">
                <span className="card-title">How you like to meet</span>
                <Link to="/app/settings" className="small">
                  Change
                </Link>
              </div>
              <div className="card-body">
                <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
                  {family.preferences.styles.length === 0 ? (
                    <span className="small muted">Not set.</span>
                  ) : (
                    family.preferences.styles.map((s) => (
                      <span key={s} className="pill">
                        {STYLE_LABELS[s]}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <span className="card-title">Verified about you</span>
                <Link to="/app/verification" className="small">
                  Verification
                </Link>
              </div>
              <div className="card-body">
                <TrustSignals signals={parent.trustSignals} />
              </div>
            </section>
          </div>

          <Alert tone="info" title="What is never on your profile">
            Your legal name, date of birth, phone number, email address, home address and
            precise location are stored separately from this profile and are never shown to
            another family — at any privacy setting.
          </Alert>
        </>
      )}
    </div>
  );
}

function Detail({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <div className="tiny muted">{label}</div>
      <div className="strong small" style={{ marginTop: 2 }}>
        {value}
      </div>
      {note && <div className="tiny muted">{note}</div>}
    </div>
  );
}

/* ========================================================================== */
/* "What others see" — built from the real redaction function                  */
/* ========================================================================== */

function OthersViewPreview({ family }: { family: Family }) {
  // Deliberately no parent profile and no distance: this is what a stranger at
  // DISCOVERY tier receives, produced by the same function that serves them.
  const discovery = projectFamily(family, { tier: DisclosureTier.DISCOVERY, distanceKm: 3.2 });
  const connected = projectFamily(family, { tier: DisclosureTier.CONNECTED, distanceKm: 3.2 });

  if (!discovery) {
    return (
      <Alert tone="warn" title="You are currently hidden from discovery">
        Other families cannot see your profile at all. Turn discoverability back on in
        Settings when you are ready.
      </Alert>
    );
  }

  return (
    <section className="card card-pad stack stack-5" style={{ background: 'var(--surface-2)' }}>
      <div>
        <h2 style={{ fontSize: 'var(--text-md)' }}>What other families see</h2>
        <p className="small muted" style={{ marginTop: 4 }}>
          Generated by the same code that serves other families, so this cannot drift from
          reality.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--sp-4)',
        }}
      >
        <PreviewCard
          title="Someone browsing"
          icon={<IconLock size={14} />}
          tone="neutral"
          projection={discovery}
        />
        <PreviewCard
          title="A family you have connected with"
          icon={<IconCheck size={14} />}
          tone="ok"
          projection={connected!}
        />
      </div>

      <div className="panel small muted">
        Neither view contains your address, phone number, email, legal name, date of birth or
        coordinates — those fields do not exist on the object that is sent.
      </div>
    </section>
  );
}

function PreviewCard({
  title,
  icon,
  tone,
  projection,
}: {
  title: string;
  icon: React.ReactNode;
  tone: 'neutral' | 'ok';
  projection: ReturnType<typeof projectFamily>;
}) {
  if (!projection) return null;
  return (
    <div className="card card-pad">
      <div className="row row-2 tiny strong" style={{ marginBottom: 'var(--sp-4)', color: tone === 'ok' ? 'var(--ok-600)' : 'var(--ink-500)' }}>
        {icon}
        {title}
      </div>

      <div className="row row-3" style={{ marginBottom: 'var(--sp-3)' }}>
        <Avatar name={projection.displayName} color="var(--brand-600)" size="md" square />
        <div>
          <div className="strong small">{projection.displayName}</div>
          <div className="tiny muted">{projection.locationLabel}</div>
        </div>
      </div>

      <FamilyMeta family={projection} />

      <div className="stack stack-3" style={{ marginTop: 'var(--sp-4)' }}>
        {projection.children.map((c) => (
          <div key={c.id}>
            <div className="small strong">
              {c.displayName} <span className="muted">· {c.ageLabel}</span>
            </div>
            <div style={{ marginTop: 'var(--sp-2)' }}>
              <ChildInterestList child={c} />
            </div>
            {c.notes && (
              <p className="tiny muted" style={{ marginTop: 'var(--sp-2)' }}>
                Note: {c.notes}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Edit form                                                                   */
/* ========================================================================== */

function EditFamilyForm({
  family,
  onCancel,
  onSaved,
}: {
  family: Family;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState(family.displayName);
  const [generalArea, setGeneralArea] = useState(family.generalArea);
  const [neighborhood, setNeighborhood] = useState(family.neighborhood ?? '');
  const [about, setAbout] = useState(family.about ?? '');
  const [languages, setLanguages] = useState(family.languages.join(', '));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.updateFamilyProfile({
        displayName,
        generalArea,
        neighborhood: neighborhood || undefined,
        about,
        languages: languages
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card card-pad stack stack-5">
      <h2 style={{ fontSize: 'var(--text-md)' }}>Edit family profile</h2>

      <Field label="Family name" htmlFor="ef-name">
        <input id="ef-name" className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </Field>

      <Field
        label="General area"
        htmlFor="ef-area"
        hint="Broad enough that it does not identify where you live."
      >
        <input id="ef-area" className="input" value={generalArea} onChange={(e) => setGeneralArea(e.target.value)} />
      </Field>

      <Field
        label="Neighbourhood"
        htmlFor="ef-hood"
        optional
        hint="Only shown to connected families, and only if your privacy settings allow it."
      >
        <input id="ef-hood" className="input" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
      </Field>

      <Field label="Languages spoken at home" htmlFor="ef-lang" optional>
        <input id="ef-lang" className="input" value={languages} onChange={(e) => setLanguages(e.target.value)} />
      </Field>

      <Field
        label="About your family"
        htmlFor="ef-about"
        optional
        hint="Avoid anything that identifies where you live or which school your children attend."
      >
        <textarea
          id="ef-about"
          className="textarea"
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          maxLength={600}
        />
      </Field>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="row row-3">
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </section>
  );
}
