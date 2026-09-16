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
  TrustSignals,
  VerificationBadge,
} from '../../components/family/FamilyBits';
import { useI18n, useT } from '../../i18n';
import { useFormat } from '../../i18n/format';
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
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);
  const { d } = useI18n();

  if (!family || !parent) return <LoadingBlock />;

  return (
    <div className="stack stack-6">
      <div className="row row-between row-4" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="page-head" style={{ marginBottom: 0 }}>
          <h1>{t('nav.myFamily')}</h1>
          <p>{t('fam.sub')}</p>
        </div>
        <div className="row row-3">
          <button className="btn btn-secondary btn-sm" onClick={() => setPreview((p) => !p)}>
            <IconEye size={15} />
            {preview ? t('fam.hidePreview') : t('fam.seePreview')}
          </button>
          {!editing && (
            <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>
              <IconEdit size={15} />
              {t('fam.editProfile')}
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
            toast.push(t('fam.updated'), 'ok');
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
                      <Badge tone="ok">{t('dash.discoverable')}</Badge>
                    ) : (
                      <Badge tone="warn">{t('fam.hidden')}</Badge>
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
                <Detail label={t('ob.fam.area')} value={family.generalArea} />
                <Detail
                  label={t('ob.fam.hood')}
                  value={family.neighborhood ?? t('common.notSet')}
                  note={t('fam.hoodNote')}
                />
                <Detail label={t('fam.languages')} value={family.languages.join(', ') || t('common.notSet')} />
                <Detail
                  label={t('fam.travelLimit')}
                  value={`${family.preferences.maxTravelKm} km`}
                  note={t('fam.travelNote')}
                />
                <Detail
                  label={t('fam.ageFlex')}
                  value={t('fam.ageFlexVal', { n: family.preferences.ageFlexibilityYears })}
                />
                <Detail
                  label={t('fam.memberSince')}
                  value={d(family.createdAt, { month: 'long', year: 'numeric' })}
                />
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <span className="card-title">{t('fam.childrenTitle')}</span>
              <Link to="/app/children" className="small">
                {t('fam.manageChildren')}
              </Link>
            </div>
            <div className="card-body">
              {family.children.length === 0 ? (
                <p className="muted small">{t('fam.noChildren')}</p>
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
                            {t('common.yearsOld', { n: c.age })}
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
                <span className="card-title">{t('privacyPage.disc7')}</span>
                <Link to="/app/settings" className="small">
                  {t('dash.change')}
                </Link>
              </div>
              <div className="card-body">
                <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
                  {family.preferences.styles.length === 0 ? (
                    <span className="small muted">Not set.</span>
                  ) : (
                    family.preferences.styles.map((s) => (
                      <span key={s} className="pill">
                        {t(`style.${s}`)}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <span className="card-title">{t('fam.verifiedAbout')}</span>
                <Link to="/app/verification" className="small">
                  {t('nav.verification')}
                </Link>
              </div>
              <div className="card-body">
                <TrustSignals signals={parent.trustSignals} />
              </div>
            </section>
          </div>

          <Alert tone="info" title={t('fam.neverOnProfile')}>
            {t('fam.neverOnProfileBody')}
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
  const t = useT();
  // Deliberately no parent profile and no distance: this is what a stranger at
  // DISCOVERY tier receives, produced by the same function that serves them.
  const discovery = projectFamily(family, { tier: DisclosureTier.DISCOVERY, distanceKm: 3.2 });
  const connected = projectFamily(family, { tier: DisclosureTier.CONNECTED, distanceKm: 3.2 });

  if (!discovery) {
    return (
      <Alert tone="warn" title={t('fam.previewHiddenTitle')}>
        {t('fam.previewHiddenBody')}
      </Alert>
    );
  }

  return (
    <section className="card card-pad stack stack-5" style={{ background: 'var(--surface-2)' }}>
      <div>
        <h2 style={{ fontSize: 'var(--text-md)' }}>{t('fam.previewH2')}</h2>
        <p className="small muted" style={{ marginTop: 4 }}>
          {t('fam.previewP')}
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
          title={t('fam.previewBrowsing')}
          icon={<IconLock size={14} />}
          tone="neutral"
          projection={discovery}
        />
        <PreviewCard
          title={t('fam.previewConnected')}
          icon={<IconCheck size={14} />}
          tone="ok"
          projection={connected!}
        />
      </div>

      <div className="panel small muted">
        {t('fam.previewNeither')}
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
  const t = useT();
  const f = useFormat();
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
          <div className="tiny muted">{f.locationLabel(projection.location)}</div>
        </div>
      </div>

      <FamilyMeta family={projection} />

      <div className="stack stack-3" style={{ marginTop: 'var(--sp-4)' }}>
        {projection.children.map((c) => (
          <div key={c.id}>
            <div className="small strong">
              {f.childName(c.displayName)}{' '}
              <span className="muted">· {f.ageLabel(c.ageView)}</span>
            </div>
            <div style={{ marginTop: 'var(--sp-2)' }}>
              <ChildInterestList child={c} />
            </div>
            {c.notes && (
              <p className="tiny muted" style={{ marginTop: 'var(--sp-2)' }}>
                {t('fam.noteLabel')} {c.notes}
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
  const t = useT();
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
      setError(e instanceof Error ? e.message : t('fam.couldNotSave'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card card-pad stack stack-5">
      <h2 style={{ fontSize: 'var(--text-md)' }}>{t('fam.editH2')}</h2>

      <Field label={t('ob.fam.name')} htmlFor="ef-name">
        <input id="ef-name" className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </Field>

      <Field
        label={t('ob.fam.area')}
        htmlFor="ef-area"
        hint={t('ob.fam.areaHint')}
      >
        <input id="ef-area" className="input" value={generalArea} onChange={(e) => setGeneralArea(e.target.value)} />
      </Field>

      <Field
        label={t('ob.fam.hood')}
        htmlFor="ef-hood"
        optional
        hint={t('ob.fam.hoodHint')}
      >
        <input id="ef-hood" className="input" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
      </Field>

      <Field label={t('ob.fam.langs')} htmlFor="ef-lang" optional>
        <input id="ef-lang" className="input" value={languages} onChange={(e) => setLanguages(e.target.value)} />
      </Field>

      <Field
        label={t('fam.aboutLabel')}
        htmlFor="ef-about"
        optional
        hint={t('fam.aboutHint')}
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
          {busy ? t('common.saving') : t('common.saveChanges')}
        </button>
        <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          {t('common.cancel')}
        </button>
      </div>
    </section>
  );
}
