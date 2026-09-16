import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services';
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

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'privacy', label: 'Privacy' },
  { id: 'matching', label: 'Matching' },
  { id: 'availability', label: 'Availability' },
  { id: 'security', label: 'Security' },
  { id: 'blocked', label: 'Blocked families' },
  { id: 'prototype', label: 'About this prototype' },
];

export function Settings() {
  const { family, account, refresh } = useApp();
  const toast = useToast();
  const [section, setSection] = useState<Section>('privacy');

  if (!family || !account) return <LoadingBlock />;

  return (
    <div className="stack stack-6">
      <div className="page-head">
        <h1>Settings</h1>
        <p>What other families can see, how matching works for you, and your account security.</p>
      </div>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              aria-current={section === s.id}
              onClick={() => setSection(s.id)}
            >
              {s.label}
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
      toast.push('Privacy settings updated.', 'ok');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack stack-6">
      <section className="card">
        <div className="card-header">
          <span className="card-title">What other families can see</span>
          {dirty && (
            <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
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
          <span className="card-title">Discovery</span>
        </div>
        <div className="card-body stack stack-5">
          <Switch
            label="Appear in other families' results"
            description="Turn this off to pause discovery without deleting anything. Existing conversations continue."
            checked={draft.discoverable}
            onChange={(v) => setDraft({ ...draft, discoverable: v })}
          />
          <hr className="divider" />
          <Switch
            label="Only accept requests from ID-verified parents"
            description="Strongly recommended. Parents who have not completed identity verification cannot send you a request at all."
            checked={draft.requireVerifiedToRequest}
            onChange={(v) => setDraft({ ...draft, requireVerifiedToRequest: v })}
          />
        </div>
        {dirty && (
          <div className="card-footer">
            <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}
      </section>

      <Alert tone="info" title="Never shown, at any setting">
        Your legal name, date of birth, phone number, email address, home address and precise
        location. These live in a separate record from your family profile and have no path
        into anything another family receives.
      </Alert>
    </div>
  );
}

/* ========================================================================== */
/* Matching                                                                    */
/* ========================================================================== */

function MatchingSection({ onSaved, toast }: { onSaved: () => Promise<void>; toast: Toast }) {
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
      toast.push('Matching preferences updated. Your results will change.', 'ok');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack stack-6">
      <section className="card">
        <div className="card-header">
          <span className="card-title">Hard limits</span>
        </div>
        <div className="card-body stack stack-6">
          <Alert tone="info">
            These are filters, not preferences. Families outside them are removed from your
            results entirely, rather than ranked lower — you will not be shown families you
            could not realistically meet.
          </Alert>

          <div className="field">
            <label className="label" htmlFor="set-travel">
              How far will you travel? — {maxTravelKm} km
            </label>
            <div className="hint">
              Applied in both directions: we also respect the other family's limit.
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
              How far from one of your children's ages another child can be.
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
              What should we weight most?
            </span>
          </span>
        </div>
        <div className="card-body">
          <WeightEditor value={weights} onChange={(k, v) => setWeights((w) => ({ ...w, [k]: v }))} />
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <span className="card-title">How you like to meet</span>
        </div>
        <div className="card-body">
          <StylePicker value={styles} onChange={setStyles} />
        </div>
      </section>

      <button className="btn btn-primary" onClick={save} disabled={busy} style={{ alignSelf: 'flex-start' }}>
        {busy ? 'Saving…' : 'Save matching preferences'}
      </button>
    </div>
  );
}

/* ========================================================================== */
/* Availability                                                                */
/* ========================================================================== */

function AvailabilitySection({ onSaved, toast }: { onSaved: () => Promise<void>; toast: Toast }) {
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
        <span className="card-title">When are you usually free?</span>
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
              toast.push('Availability updated.', 'ok');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Saving…' : 'Save availability'}
        </button>
      </div>
    </section>
  );
}

/* ========================================================================== */
/* Security                                                                    */
/* ========================================================================== */

function SecuritySection({ onSaved, toast }: { onSaved: () => Promise<void>; toast: Toast }) {
  const { account } = useApp();
  const [devices, setDevices] = useState<DeviceSession[]>([]);

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
              Sign-in security
            </span>
          </span>
        </div>
        <div className="card-body stack stack-5">
          <Switch
            label="Two-factor authentication"
            description="Requires a second factor when you sign in. Other families see this as a trust signal."
            checked={account.twoFactorEnabled}
            onChange={async (v) => {
              await api.setTwoFactor(v);
              await onSaved();
              toast.push(v ? 'Two-factor authentication on.' : 'Two-factor authentication off.', 'ok');
            }}
          />

          <hr className="divider" />

          <div className="stack stack-3">
            <div className="row row-between">
              <span className="small">Email verified</span>
              {account.emailVerified ? (
                <Badge tone="ok">
                  <IconCheck size={10} /> Verified
                </Badge>
              ) : (
                <Badge tone="warn">Not verified</Badge>
              )}
            </div>
            <div className="row row-between">
              <span className="small">Phone verified</span>
              {account.phoneVerified ? (
                <Badge tone="ok">
                  <IconCheck size={10} /> Verified
                </Badge>
              ) : (
                <Badge tone="warn">Not verified</Badge>
              )}
            </div>
            <div className="row row-between">
              <span className="small">Account state</span>
              <Badge tone={account.state === 'active' ? 'ok' : 'pending'}>
                {account.state.replace(/_/g, ' ')}
              </Badge>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <span className="card-title">Where you are signed in</span>
        </div>
        <div className="card-body">
          <div className="stack stack-3">
            {devices.map((d) => (
              <div key={d.id} className="row row-between row-4 panel">
                <div>
                  <div className="small strong row row-2">
                    {d.label}
                    {d.current && <Badge tone="brand">This device</Badge>}
                  </div>
                  <div className="tiny muted">
                    {d.location} · last seen{' '}
                    {new Date(d.lastSeenAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </div>
                </div>
                {!d.current && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={async () => {
                      await api.revokeDeviceSession(d.id);
                      await load();
                      toast.push('Session signed out.', 'ok');
                    }}
                  >
                    <IconTrash size={14} />
                    Sign out
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="tiny muted" style={{ marginTop: 'var(--sp-4)' }}>
            If you see a device you do not recognise, sign it out and change your password.
          </p>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="row row-2">
              <IconLock size={15} />
              How your account is protected
            </span>
          </span>
        </div>
        <div className="card-body">
          <ul className="stack stack-3 small">
            {[
              ['Password hashing', 'Argon2id, server-side. We never store or transmit a plaintext password.'],
              ['Sessions', 'HttpOnly, Secure, SameSite cookies that JavaScript cannot read, rotated on privilege change.'],
              ['Rate limiting', 'Sign-in, verification codes, requests, messages and browsing are all limited per account.'],
              ['Audit logging', 'Sensitive actions are recorded with personal data stripped out before writing.'],
              ['Least privilege', 'Our own staff see only what an open case requires, and every elevated read is logged.'],
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
              The list above describes the production design. In this browser-only prototype,
              sessions are held in <span className="mono">localStorage</span> rather than
              HttpOnly cookies, and there is no server to hash a password. See{' '}
              <span className="mono">docs/PROTOTYPE_DISCLOSURES.md</span> for the full
              difference.
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
            Blocked families
          </span>
        </span>
      </div>
      <div className="card-body">
        {blocked.length === 0 ? (
          <p className="small muted">
            You have not blocked anyone. Blocking is available from any family profile,
            conversation or request, and never requires a reason.
          </p>
        ) : (
          <div className="stack stack-3">
            {blocked.map((b) => (
              <div key={b.familyId} className="row row-between row-4 panel">
                <div>
                  <div className="small strong">{b.displayName}</div>
                  <div className="tiny muted">
                    Blocked {new Date(b.createdAt).toLocaleDateString('en-GB')}
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    await api.unblockFamily(b.familyId);
                    await load();
                    toast.push('Family unblocked.', 'ok');
                  }}
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="tiny muted" style={{ marginTop: 'var(--sp-4)' }}>
          Blocked families are not told. Unblocking does not restore a closed conversation.
        </p>
      </div>
    </section>
  );
}

/* ========================================================================== */
/* Prototype                                                                   */
/* ========================================================================== */

function PrototypeSection() {
  const [busy, setBusy] = useState(false);

  return (
    <div className="stack stack-6">
      <section className="card">
        <div className="card-header">
          <span className="card-title">About this prototype</span>
        </div>
        <div className="card-body stack stack-5">
          <PrototypeNote>
            This is a frontend prototype with a mock data layer. Every family here is
            fictional.
          </PrototypeNote>

          <div className="stack stack-3 small">
            {[
              ['Identity verification', 'Simulated. No provider is connected, and no document is ever checked.'],
              ['Email and SMS', 'Simulated. Codes are shown on screen instead of being delivered.'],
              ['Data storage', 'Your browser\'s localStorage. Nothing is sent anywhere.'],
              ['Password hashing', 'Not performed — there is no server.'],
              ['Moderation decisions', 'Recorded locally. No real reviewer sees anything.'],
              ['Security review', 'Not performed. This code has not been audited or penetration-tested.'],
              ['Legal compliance', 'Not assessed. A DPIA and jurisdiction-specific review are production requirements.'],
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
          <span className="card-title">Reset the prototype</span>
        </div>
        <div className="card-body stack stack-4">
          <p className="small muted">
            Clears everything stored in this browser and restores the seeded demo families,
            conversations and playdates. You will be signed out.
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
            {busy ? 'Resetting…' : 'Reset all prototype data'}
          </button>
        </div>
      </section>
    </div>
  );
}
