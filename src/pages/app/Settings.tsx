import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services';
import { useI18n, useT } from '../../i18n';
import type { TKey } from '../../i18n/types';
import { useApp } from '../../state/AppContext';
import type {
  AvailabilitySlot,
  DeviceSession,
  Importance,
  PlaydateStyle,
  PrivacySettings,
} from '../../domain/types';
import {
  Alert,
  Badge,
  LoadingBlock,
  PrototypeNote,
  Switch,
  useToast,
} from '../../components/ui';
import {
  AvailabilityGrid,
  PrivacyControls,
  StylePicker,
  WeightEditor,
} from '../../components/family/Editors';
import {
  IconBlock,
  IconCheck,
  IconKey,
  IconLock,
  IconSliders,
  IconTrash,
} from '../../components/ui/Icons';

type Section = 'privacy' | 'matching' | 'availability' | 'security' | 'blocked' | 'prototype';

/**
 * Section labels are dictionary KEYS, not sentences — this array is module scope and
 * cannot call the translate hook. `Settings` resolves them at render time.
 */
const SECTIONS: Array<{ id: Section; labelKey: TKey }> = [
  { id: 'privacy', labelKey: 'nav.privacy' },
  { id: 'matching', labelKey: 'set.matching' },
  { id: 'availability', labelKey: 'ob.step8' },
  { id: 'security', labelKey: 'set.security' },
  { id: 'blocked', labelKey: 'set.blocked' },
  { id: 'prototype', labelKey: 'set.aboutPrototype' },
];

export function Settings() {
  const t = useT();
  const { family, account, refresh } = useApp();
  const toast = useToast();
  const [section, setSection] = useState<Section>('privacy');

  if (!family || !account) return <LoadingBlock />;

  return (
    <div className="stack stack-6">
      <div className="page-head">
        <h1>{t('nav.settings')}</h1>
        <p>{t('set.sub')}</p>
      </div>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label={t('set.sections')}>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              aria-current={section === s.id}
              onClick={() => setSection(s.id)}
            >
              {t(s.labelKey)}
            </button>
          ))}
        </nav>

        <div>
          {section === 'privacy' && <PrivacySection onSaved={refresh} toast={toast} />}
          {section === 'matching' && <MatchingSection onSaved={refresh} toast={toast} />}
          {section === 'availability' && <AvailabilitySection onSaved={refresh} toast={toast} />}
          {section === 'security' && <SecuritySection onSaved={refresh} toast={toast} />}
          {section === 'blocked' && <BlockedSection toast={toast} />}
          {section === 'prototype' && <PrototypeSection />}
        </div>
      </div>
    </div>
  );
}

type Toast = ReturnType<typeof useToast>;

/* ========================================================================== */
/* Privacy                                                                     */
/* ========================================================================== */

function PrivacySection({ onSaved, toast }: { onSaved: () => Promise<void>; toast: Toast }) {
  const t = useT();
  const { family } = useApp();
  const [draft, setDraft] = useState<PrivacySettings | null>(family?.privacy ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (family) setDraft(family.privacy);
  }, [family]);

  if (!family || !draft) return <LoadingBlock />;

  const dirty = JSON.stringify(draft) !== JSON.stringify(family.privacy);

  const save = async () => {
    setBusy(true);
    try {
      await api.updatePrivacy(draft);
      await onSaved();
      toast.push(t('set.privacyUpdated'), 'ok');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack stack-6">
      <section className="card">
        <div className="card-header">
          <span className="card-title">{t('set.whatOthersSee')}</span>
          {dirty && (
            <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
              {busy ? t('common.saving') : t('common.saveChanges')}
            </button>
          )}
        </div>
        <div className="card-body">
          <PrivacyControls
            value={draft}
            onChange={(patch) => setDraft({ ...draft, ...patch })}
            preview={{
              generalArea: family.generalArea,
              neighborhood: family.neighborhood,
              childFirstName: family.children[0]?.firstName ?? 'Noa',
              childNickname: family.children[0]?.nickname,
              childAge: family.children[0]?.age ?? 8,
            }}
          />
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <span className="card-title">{t('set.discovery')}</span>
        </div>
        <div className="card-body stack stack-5">
          <Switch
            label={t('ob.priv.discoverable')}
            description={t('set.appearDesc')}
            checked={draft.discoverable}
            onChange={(v) => setDraft({ ...draft, discoverable: v })}
          />
          <hr className="divider" />
          <Switch
            label={t('ob.priv.verifiedOnly')}
            description={t('ob.priv.verifiedOnlyDesc')}
            checked={draft.requireVerifiedToRequest}
            onChange={(v) => setDraft({ ...draft, requireVerifiedToRequest: v })}
          />
        </div>
        {dirty && (
          <div className="card-footer">
            <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
              {busy ? t('common.saving') : t('common.saveChanges')}
            </button>
          </div>
        )}
      </section>

      <Alert tone="info" title={t('set.neverShownTitle')}>
        {t('set.neverShownBody')}
      </Alert>
    </div>
  );
}

/* ========================================================================== */
/* Matching                                                                    */
/* ========================================================================== */

function MatchingSection({ onSaved, toast }: { onSaved: () => Promise<void>; toast: Toast }) {
  const t = useT();
  const { family } = useApp();
  const [maxTravelKm, setMaxTravelKm] = useState(family?.preferences.maxTravelKm ?? 8);
  const [ageFlex, setAgeFlex] = useState(family?.preferences.ageFlexibilityYears ?? 2);
  const [styles, setStyles] = useState<PlaydateStyle[]>(family?.preferences.styles ?? []);
  const [weights, setWeights] = useState<Record<string, Importance>>(
    (family?.preferences.weights as unknown as Record<string, Importance>) ?? {},
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!family) return;
    setMaxTravelKm(family.preferences.maxTravelKm);
    setAgeFlex(family.preferences.ageFlexibilityYears);
    setStyles(family.preferences.styles);
    setWeights(family.preferences.weights as unknown as Record<string, Importance>);
  }, [family]);

  if (!family) return <LoadingBlock />;

  const save = async () => {
    setBusy(true);
    try {
      await api.updatePreferences({
        maxTravelKm,
        ageFlexibilityYears: ageFlex,
        styles,
        weights: weights as never,
      });
      await onSaved();
      toast.push(t('set.matchingUpdated'), 'ok');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack stack-6">
      <section className="card">
        <div className="card-header">
          <span className="card-title">{t('set.hardLimits')}</span>
        </div>
        <div className="card-body stack stack-6">
          <Alert tone="info">
            {t('set.hardLimitsBody')}
          </Alert>

          <div className="field">
            <label className="label" htmlFor="set-travel">
              How far will you travel? — {maxTravelKm} km
            </label>
            <div className="hint">
              {t('ob.loc.travelHint')}
            </div>
            <input
              id="set-travel"
              type="range"
              min={1}
              max={30}
              value={maxTravelKm}
              onChange={(e) => setMaxTravelKm(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--brand-600)' }}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="set-agegap">
              Acceptable age gap — {ageFlex} year{ageFlex === 1 ? '' : 's'}
            </label>
            <div className="hint">
              {t('ob.loc.ageGapHint')}
            </div>
            <input
              id="set-agegap"
              type="range"
              min={0}
              max={5}
              value={ageFlex}
              onChange={(e) => setAgeFlex(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--brand-600)' }}
            />
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="row row-2">
              <IconSliders size={15} />
              {t('ob.loc.weightH')}
            </span>
          </span>
        </div>
        <div className="card-body">
          <WeightEditor value={weights} onChange={(k, v) => setWeights((w) => ({ ...w, [k]: v }))} />
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <span className="card-title">{t('privacyPage.disc7')}</span>
        </div>
        <div className="card-body">
          <StylePicker value={styles} onChange={setStyles} />
        </div>
      </section>

      <button className="btn btn-primary" onClick={save} disabled={busy} style={{ alignSelf: 'flex-start' }}>
        {busy ? t('common.saving') : t('set.saveMatching')}
      </button>
    </div>
  );
}

/* ========================================================================== */
/* Availability                                                                */
/* ========================================================================== */

function AvailabilitySection({ onSaved, toast }: { onSaved: () => Promise<void>; toast: Toast }) {
  const t = useT();
  const { family } = useApp();
  const [slots, setSlots] = useState<AvailabilitySlot[]>(family?.availability ?? []);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (family) setSlots(family.availability);
  }, [family]);

  if (!family) return <LoadingBlock />;

  return (
    <section className="card">
      <div className="card-header">
        <span className="card-title">{t('ob.avail.h1')}</span>
      </div>
      <div className="card-body stack stack-5">
        <AvailabilityGrid value={slots} onChange={setSlots} />
        <button
          className="btn btn-primary"
          style={{ alignSelf: 'flex-start' }}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api.updateAvailability(slots);
              await onSaved();
              toast.push(t('set.availUpdated'), 'ok');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? t('common.saving') : t('set.saveAvailability')}
        </button>
      </div>
    </section>
  );
}

/* ========================================================================== */
/* Security                                                                    */
/* ========================================================================== */

function SecuritySection({ onSaved, toast }: { onSaved: () => Promise<void>; toast: Toast }) {
  const t = useT();
  const { account } = useApp();
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const { d } = useI18n();

  const load = useCallback(async () => {
    setDevices(await api.getDeviceSessions());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!account) return <LoadingBlock />;

  return (
    <div className="stack stack-6">
      <section className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="row row-2">
              <IconKey size={15} />
              {t('set.signInSecurity')}
            </span>
          </span>
        </div>
        <div className="card-body stack stack-5">
          <Switch
            label={t('how.p1.i3')}
            description={t('set.2faDesc')}
            checked={account.twoFactorEnabled}
            onChange={async (v) => {
              await api.setTwoFactor(v);
              await onSaved();
              toast.push(v ? t('set.2faOn') : t('set.2faOff'), 'ok');
            }}
          />

          <hr className="divider" />

          <div className="stack stack-3">
            <div className="row row-between">
              <span className="small">{t('trust.email_verified')}</span>
              {account.emailVerified ? (
                <Badge tone="ok">
                  <IconCheck size={10} /> Verified
                </Badge>
              ) : (
                <Badge tone="warn">{t('set.notVerified')}</Badge>
              )}
            </div>
            <div className="row row-between">
              <span className="small">{t('trust.phone_verified')}</span>
              {account.phoneVerified ? (
                <Badge tone="ok">
                  <IconCheck size={10} /> Verified
                </Badge>
              ) : (
                <Badge tone="warn">{t('set.notVerified')}</Badge>
              )}
            </div>
            <div className="row row-between">
              <span className="small">{t('set.accountState')}</span>
              <Badge tone={account.state === 'active' ? 'ok' : 'pending'}>
                {account.state.replace(/_/g, ' ')}
              </Badge>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <span className="card-title">{t('set.whereSignedIn')}</span>
        </div>
        <div className="card-body">
          <div className="stack stack-3">
            {devices.map((dev) => (
              <div key={dev.id} className="row row-between row-4 panel">
                <div>
                  <div className="small strong row row-2">
                    {dev.label}
                    {dev.current && <Badge tone="brand">{t('set.thisDevice')}</Badge>}
                  </div>
                  <div className="tiny muted">
                    {dev.location} · last seen{' '}
                    {d(dev.lastSeenAt, { day: 'numeric', month: 'short' })}
                  </div>
                </div>
                {!dev.current && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={async () => {
                      await api.revokeDeviceSession(dev.id);
                      await load();
                      toast.push(t('set.deviceSignedOut'), 'ok');
                    }}
                  >
                    <IconTrash size={14} />
                    {t('nav.signOut')}
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="tiny muted" style={{ marginTop: 'var(--sp-4)' }}>
            {t('set.unknownDevice')}
          </p>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="row row-2">
              <IconLock size={15} />
              {t('set.howProtected')}
            </span>
          </span>
        </div>
        <div className="card-body">
          <ul className="stack stack-3 small">
            {[
              [t('set.prot1'), t('set.prot1b')],
              [t('set.prot2'), t('set.prot2b')],
              [t('set.prot3'), t('set.prot3b')],
              [t('set.prot4'), t('set.prot4b')],
              [t('set.prot5'), t('set.prot5b')],
            ].map(([t, d]) => (
              <li key={t} className="row row-3" style={{ alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--ok-500)', marginTop: 2, flexShrink: 0 }}>
                  <IconCheck size={14} />
                </span>
                <div>
                  <span className="strong">{t}</span> — <span className="muted">{d}</span>
                </div>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 'var(--sp-5)' }}>
            <PrototypeNote>
              {t('proto.security')}
            </PrototypeNote>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ========================================================================== */
/* Blocked                                                                     */
/* ========================================================================== */

function BlockedSection({ toast }: { toast: Toast }) {
  const t = useT();
  const { d } = useI18n();
  const [blocked, setBlocked] = useState<
    Array<{ familyId: string; displayName: string; createdAt: string }>
  >([]);

  const load = useCallback(async () => {
    setBlocked(await api.getBlockedFamilies());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="card">
      <div className="card-header">
        <span className="card-title">
          <span className="row row-2">
            <IconBlock size={15} />
            {t('set.blocked')}
          </span>
        </span>
      </div>
      <div className="card-body">
        {blocked.length === 0 ? (
          <p className="small muted">
            {t('set.noBlocked')}
          </p>
        ) : (
          <div className="stack stack-3">
            {blocked.map((b) => (
              <div key={b.familyId} className="row row-between row-4 panel">
                <div>
                  <div className="small strong">{b.displayName}</div>
                  <div className="tiny muted">
                    {t('set.blockedOn', { date: d(b.createdAt) })}
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    await api.unblockFamily(b.familyId);
                    await load();
                    toast.push(t('set.unblocked'), 'ok');
                  }}
                >
                  {t('common.unblock')}
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="tiny muted" style={{ marginTop: 'var(--sp-4)' }}>
          {t('set.blockedNote')}
        </p>
      </div>
    </section>
  );
}

/* ========================================================================== */
/* Prototype                                                                   */
/* ========================================================================== */

function PrototypeSection() {
  const t = useT();
  const [busy, setBusy] = useState(false);

  return (
    <div className="stack stack-6">
      <section className="card">
        <div className="card-header">
          <span className="card-title">{t('set.aboutPrototype')}</span>
        </div>
        <div className="card-body stack stack-5">
          <PrototypeNote>
            {t('set.protoIntro')}
          </PrototypeNote>

          <div className="stack stack-3 small">
            {[
              [t('ob.step3'), t('set.protoV1')],
              [t('set.protoK2'), t('set.protoV2')],
              [t('set.protoK3'), 'Your browser\'s localStorage. Nothing is sent anywhere.'],
              [t('set.prot1'), t('set.protoV4')],
              [t('set.protoK5'), t('set.protoV5')],
              [t('set.protoK6'), t('set.protoV6')],
              [t('set.protoK7'), t('set.protoV7')],
            ].map(([k, v]) => (
              <div key={k} className="row row-between row-4" style={{ alignItems: 'flex-start' }}>
                <span className="strong" style={{ minWidth: 160 }}>
                  {k}
                </span>
                <span className="muted" style={{ textAlign: 'right', flex: 1 }}>
                  {v}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <span className="card-title">{t('set.resetTitle')}</span>
        </div>
        <div className="card-body stack stack-4">
          <p className="small muted">
            {t('set.resetBody')}
          </p>
          <button
            className="btn btn-danger-quiet"
            style={{ alignSelf: 'flex-start' }}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await api.resetPrototype();
              window.location.href = '/';
            }}
          >
            <IconTrash size={15} />
            {busy ? t('set.resetting') : t('set.resetCta')}
          </button>
        </div>
      </section>
    </div>
  );
}
