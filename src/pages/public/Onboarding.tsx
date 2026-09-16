import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services';
import { useApp } from '../../state/AppContext';
import {
  passwordStrength,
  validateChildAge,
  validateEmail,
  validateLength,
  validatePassword,
  validatePhone,
  validateVerificationCode,
} from '../../domain/validation';
import type {
  AvailabilitySlot,
  ChildInterest,
  Importance,
  PlaydateStyle,
  PrivacySettings,
} from '../../domain/types';
import { SAFETY_TIPS } from '../../domain/safety/contentScan';
import { Alert, Avatar, Field, PrototypeNote, Stars, useToast } from '../../components/ui';
import { LogoMark } from '../../components/layout/Logo';
import {
  AvailabilityGrid,
  InterestEditor,
  PrivacyControls,
  StylePicker,
  WeightEditor,
} from '../../components/family/Editors';
import {
  IconArrowRight,
  IconCheck,
  IconChevronLeft,
  IconEye,
  IconEyeOff,
  IconLock,
  IconPlus,
  IconShieldCheck,
  IconTrash,
} from '../../components/ui/Icons';
import { IMPORTANCE_LABELS } from '../../domain/interests';

/**
 * The eleven-step onboarding.
 *
 * The order is the safety model made sequential: identity before profile, profile before
 * privacy choices, privacy choices before discovery. A parent cannot reach the last step
 * without having passed every gate before it.
 */

const STEPS = [
  'Create account',
  'Verify email & phone',
  'Identity verification',
  'Family profile',
  'Add children',
  'Interests & importance',
  'Location preferences',
  'Availability',
  'Privacy preferences',
  'Safety guidelines',
  'Ready',
] as const;

interface DraftChild {
  firstName: string;
  nickname: string;
  age: string;
  pronouns: string;
  notes: string;
  energy: Importance;
  sociability: Importance;
  interests: ChildInterest[];
}

const emptyChild = (): DraftChild => ({
  firstName: '',
  nickname: '',
  age: '',
  pronouns: '',
  notes: '',
  energy: 3,
  sociability: 3,
  interests: [],
});

export function Onboarding() {
  const navigate = useNavigate();
  const toast = useToast();
  const { session, family, setSession, refresh } = useApp();

  // If a signed-in parent already has a family, they have finished onboarding.
  useEffect(() => {
    if (session && family) navigate('/app', { replace: true });
  }, [session, family, navigate]);

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Step 2
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const [phoneHint, setPhoneHint] = useState<string | null>(null);
  const [emailDone, setEmailDone] = useState(false);
  const [phoneDone, setPhoneDone] = useState(false);
  const [enable2fa, setEnable2fa] = useState(true);

  // Step 3
  const [legalFirst, setLegalFirst] = useState('');
  const [legalLast, setLegalLast] = useState('');
  const [dob, setDob] = useState('');
  const [idStatus, setIdStatus] = useState<'unstarted' | 'pending' | 'verified' | 'failed'>('unstarted');

  // Step 4
  const [familyName, setFamilyName] = useState('');
  const [generalArea, setGeneralArea] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [about, setAbout] = useState('');
  const [languages, setLanguages] = useState('Hebrew, English');

  // Step 5–6
  const [children, setChildren] = useState<DraftChild[]>([emptyChild()]);
  const [activeChild, setActiveChild] = useState(0);

  // Step 7
  const [maxTravelKm, setMaxTravelKm] = useState(8);
  const [ageFlex, setAgeFlex] = useState(2);
  const [styles, setStyles] = useState<PlaydateStyle[]>(['parents_stay', 'public_places_only']);
  const [weights, setWeights] = useState<Record<string, Importance>>({
    interests: 4,
    age: 4,
    distance: 3,
    availability: 3,
    style: 3,
  });

  // Step 8
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);

  // Step 9
  const [privacy, setPrivacy] = useState<PrivacySettings>({
    location: 'general_area',
    childName: 'first_name',
    childPhotos: 'hidden',
    childAges: 'exact',
    discoverable: true,
    availabilityDetail: 'summary',
    parentBio: 'connected_only',
    requireVerifiedToRequest: true,
  });

  // Step 10
  const [acceptedSafety, setAcceptedSafety] = useState(false);

  const go = (n: number) => {
    setError(null);
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : 'Something went wrong.');

  /* ---------------------------------------------------------------------- */
  /* Step handlers                                                           */
  /* ---------------------------------------------------------------------- */

  const submitAccount = async () => {
    const errs: Record<string, string> = {};
    const e1 = validateEmail(email);
    const e2 = validatePhone(phone);
    const e3 = validatePassword(password);
    if (e1) errs.email = e1;
    if (e2) errs.phone = e2;
    if (e3) errs.password = e3;
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setBusy(true);
    setError(null);
    try {
      const { session: s } = await api.signUp({ email, phone, password });
      setSession(s);
      const [eh, ph] = await Promise.all([api.sendEmailCode(), api.sendPhoneCode()]);
      setEmailHint(eh.hint);
      setPhoneHint(ph.hint);
      go(1);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const confirmEmail = async () => {
    const err = validateVerificationCode(emailCode);
    if (err) return setFieldErrors({ emailCode: err });
    setBusy(true);
    try {
      await api.confirmEmailCode(emailCode);
      setEmailDone(true);
      setFieldErrors({});
    } catch (e) {
      setFieldErrors({ emailCode: e instanceof Error ? e.message : 'Incorrect code.' });
    } finally {
      setBusy(false);
    }
  };

  const confirmPhone = async () => {
    const err = validateVerificationCode(phoneCode);
    if (err) return setFieldErrors({ phoneCode: err });
    setBusy(true);
    try {
      await api.confirmPhoneCode(phoneCode);
      setPhoneDone(true);
      setFieldErrors({});
    } catch (e) {
      setFieldErrors({ phoneCode: e instanceof Error ? e.message : 'Incorrect code.' });
    } finally {
      setBusy(false);
    }
  };

  const startIdentity = async () => {
    const errs: Record<string, string> = {};
    if (!legalFirst.trim()) errs.legalFirst = 'Enter your legal first name';
    if (!legalLast.trim()) errs.legalLast = 'Enter your legal last name';
    if (!dob) errs.dob = 'Enter your date of birth';
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setBusy(true);
    try {
      await api.startIdentityVerification({
        legalFirstName: legalFirst,
        legalLastName: legalLast,
        dateOfBirth: dob,
      });
      setIdStatus('pending');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const resolveIdentity = async (outcome: 'verified' | 'failed') => {
    setBusy(true);
    try {
      await api.resolveMockVerification(outcome);
      setIdStatus(outcome);
      await refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const submitFamily = async () => {
    const errs: Record<string, string> = {};
    const e1 = validateLength(familyName, 'Family name', 2, 80);
    const e2 = validateLength(generalArea, 'General area', 2, 80);
    if (e1) errs.familyName = e1;
    if (e2) errs.generalArea = e2;
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setBusy(true);
    try {
      await api.createFamily({
        displayName: familyName.startsWith('The ') ? familyName : `The ${familyName} Family`,
        generalArea,
        neighborhood: neighborhood || undefined,
        about: about || undefined,
        languages: languages
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean),
      });
      if (enable2fa) await api.setTwoFactor(true);
      await refresh();
      go(4);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      for (const c of children) {
        if (!c.firstName.trim()) continue;
        await api.addChild({
          firstName: c.firstName,
          nickname: c.nickname || undefined,
          age: Number(c.age),
          pronouns: c.pronouns || undefined,
          notes: c.notes || undefined,
          temperament: { energy: c.energy, sociability: c.sociability },
          interests: c.interests,
        });
      }
      await api.updatePreferences({
        maxTravelKm,
        ageFlexibilityYears: ageFlex,
        styles,
        weights: weights as never,
      });
      await api.updateAvailability(availability);
      await api.updatePrivacy(privacy);
      await api.acceptSafetyGuidelines();
      await refresh();
      toast.push('Your family profile is ready.', 'ok');
      navigate('/app');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  /* ---------------------------------------------------------------------- */

  const strength = passwordStrength(password);
  const child = children[activeChild];

  const updateChild = (patch: Partial<DraftChild>) => {
    setChildren((cs) => cs.map((c, i) => (i === activeChild ? { ...c, ...patch } : c)));
  };

  const childrenValid = children.some(
    (c) => c.firstName.trim() && !validateChildAge(Number(c.age)),
  );

  return (
    <div className="onboarding">
      <aside className="onboarding-aside">
        <div className="row row-3">
          <LogoMark size={32} />
          <span style={{ fontWeight: 640, fontSize: 'var(--text-lg)', letterSpacing: '-0.02em' }}>
            PlayDate
          </span>
        </div>

        <p
          className="small"
          style={{ color: 'rgba(255,255,255,0.72)', marginTop: 'var(--sp-5)', lineHeight: 1.6 }}
        >
          Every step here is a gate. Discovery does not open until verification is complete —
          that is what keeps PlayDate to verified parents.
        </p>

        <div className="onboarding-steps">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`onboarding-step${i === step ? ' active' : ''}${i < step ? ' done' : ''}`}
            >
              <span className="onboarding-step-dot">
                {i < step ? <IconCheck size={11} /> : i + 1}
              </span>
              {label}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 'var(--sp-8)' }}>
          <Link
            to="/"
            className="small"
            style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}
          >
            ← Back to the homepage
          </Link>
        </div>
      </aside>

      <main className="onboarding-main">
        <div className="onboarding-inner">
          <div className="onboarding-progress" aria-hidden="true">
            {STEPS.map((s, i) => (
              <div key={s} className={`onboarding-progress-seg${i <= step ? ' filled' : ''}`} />
            ))}
          </div>

          <div className="tiny muted" style={{ marginBottom: 'var(--sp-2)' }}>
            Step {step + 1} of {STEPS.length}
          </div>

          {error && (
            <div style={{ marginBottom: 'var(--sp-5)' }}>
              <Alert tone="danger">{error}</Alert>
            </div>
          )}

          {/* ============== 1. Account ============== */}
          {step === 0 && (
            <div className="stack stack-6">
              <div>
                <h1 style={{ fontSize: 'var(--text-2xl)' }}>Create your parent account</h1>
                <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
                  This account belongs to you, the parent. Your children will be added to your
                  family profile as dependents — they never get accounts of their own.
                </p>
              </div>

              <Field label="Email address" htmlFor="ob-email" error={fieldErrors.email}>
                <input
                  id="ob-email"
                  className="input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.email)}
                  placeholder="you@example.com"
                />
              </Field>

              <Field
                label="Mobile number"
                htmlFor="ob-phone"
                error={fieldErrors.phone}
                hint="Used to verify you are a real person, and to sign in securely. Never shown to other families."
              >
                <input
                  id="ob-phone"
                  className="input"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.phone)}
                  placeholder="+972 50 000 0000"
                />
              </Field>

              <Field label="Password" htmlFor="ob-password" error={fieldErrors.password}>
                <div style={{ position: 'relative' }}>
                  <input
                    id="ob-password"
                    className="input"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.password)}
                    style={{ paddingRight: '2.75rem' }}
                  />
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                  >
                    {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>

                {password && (
                  <div className="stack stack-2" style={{ marginTop: 'var(--sp-2)' }}>
                    <div className="meter">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className="meter-seg"
                          style={{
                            background:
                              i < strength.score
                                ? strength.score <= 1
                                  ? 'var(--danger-500)'
                                  : strength.score === 2
                                    ? 'var(--warn-500)'
                                    : 'var(--ok-500)'
                                : undefined,
                          }}
                        />
                      ))}
                    </div>
                    <div className="tiny muted">
                      {strength.label}
                      {strength.suggestions[0] ? ` — ${strength.suggestions[0]}` : ''}
                    </div>
                  </div>
                )}
              </Field>

              <PrototypeNote>
                In production, passwords are hashed server-side with Argon2id and checked
                against a breached-password list. This prototype has no server, so it stores a
                placeholder — never a real password.
              </PrototypeNote>

              <div className="row row-3">
                <button className="btn btn-primary" onClick={submitAccount} disabled={busy}>
                  {busy ? 'Creating…' : 'Create account'}
                  <IconArrowRight size={16} />
                </button>
                <Link to="/login" className="btn btn-ghost">
                  I already have an account
                </Link>
              </div>
            </div>
          )}

          {/* ============== 2. Verify contact ============== */}
          {step === 1 && (
            <div className="stack stack-6">
              <div>
                <h1 style={{ fontSize: 'var(--text-2xl)' }}>Verify your email and phone</h1>
                <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
                  Two codes. This is the first layer of keeping PlayDate to real parents, and
                  it makes throwaway accounts much harder to create in bulk.
                </p>
              </div>

              <PrototypeNote>
                There is no email or SMS provider in this prototype, so the codes are shown to
                you below. A real system sends them out of band and never returns them to the
                browser.
              </PrototypeNote>

              <div className="card card-pad stack stack-4">
                <div className="row row-between">
                  <span className="strong">Email — {email || 'your address'}</span>
                  {emailDone && <span className="badge badge-ok"><IconCheck size={11} /> Verified</span>}
                </div>
                {!emailDone && (
                  <>
                    <Field label="6-digit code" htmlFor="ob-ecode" error={fieldErrors.emailCode}>
                      <input
                        id="ob-ecode"
                        className="input"
                        inputMode="numeric"
                        maxLength={6}
                        value={emailCode}
                        onChange={(e) => setEmailCode(e.target.value)}
                        placeholder="000000"
                        style={{ letterSpacing: '0.3em', fontSize: 'var(--text-lg)' }}
                      />
                    </Field>
                    {emailHint && (
                      <div className="tiny muted">
                        Simulated code: <span className="mono strong">{emailHint}</span>
                      </div>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={confirmEmail} disabled={busy}>
                      Confirm email
                    </button>
                  </>
                )}
              </div>

              <div className="card card-pad stack stack-4">
                <div className="row row-between">
                  <span className="strong">Phone — {phone || 'your number'}</span>
                  {phoneDone && <span className="badge badge-ok"><IconCheck size={11} /> Verified</span>}
                </div>
                {!phoneDone && (
                  <>
                    <Field label="6-digit code" htmlFor="ob-pcode" error={fieldErrors.phoneCode}>
                      <input
                        id="ob-pcode"
                        className="input"
                        inputMode="numeric"
                        maxLength={6}
                        value={phoneCode}
                        onChange={(e) => setPhoneCode(e.target.value)}
                        placeholder="000000"
                        style={{ letterSpacing: '0.3em', fontSize: 'var(--text-lg)' }}
                      />
                    </Field>
                    {phoneHint && (
                      <div className="tiny muted">
                        Simulated code: <span className="mono strong">{phoneHint}</span>
                      </div>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={confirmPhone} disabled={busy}>
                      Confirm phone
                    </button>
                  </>
                )}
              </div>

              <label className="checkbox" data-checked={enable2fa}>
                <input type="checkbox" checked={enable2fa} onChange={(e) => setEnable2fa(e.target.checked)} />
                <div>
                  <div className="strong small">Turn on two-factor authentication</div>
                  <div className="tiny muted">
                    Requires a second factor when you sign in. Shown to other families as a
                    trust signal.
                  </div>
                </div>
              </label>

              <div className="row row-3">
                <button
                  className="btn btn-primary"
                  onClick={() => go(2)}
                  disabled={!emailDone || !phoneDone}
                >
                  Continue
                  <IconArrowRight size={16} />
                </button>
                {(!emailDone || !phoneDone) && (
                  <span className="small muted">Verify both to continue.</span>
                )}
              </div>
            </div>
          )}

          {/* ============== 3. Identity ============== */}
          {step === 2 && (
            <div className="stack stack-6">
              <div>
                <span className="eyebrow">
                  <IconShieldCheck size={13} />
                  Identity verification
                </span>
                <h1 style={{ fontSize: 'var(--text-2xl)', marginTop: 'var(--sp-2)' }}>
                  Confirm you are who you say you are
                </h1>
                <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
                  This platform involves children, so we verify every parent before they can
                  see any information about another family's children. This is a gate, not a
                  badge.
                </p>
              </div>

              <Alert tone="brand" title="Where your ID actually goes">
                Your document goes directly to the identity provider — Persona, Stripe
                Identity, Veriff or similar. PlayDate never receives or stores the image. We
                keep a decision and an opaque reference, nothing more.
              </Alert>

              {idStatus === 'unstarted' && (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: 'var(--sp-4)',
                    }}
                  >
                    <Field label="Legal first name" htmlFor="ob-lf" error={fieldErrors.legalFirst}>
                      <input
                        id="ob-lf"
                        className="input"
                        value={legalFirst}
                        onChange={(e) => setLegalFirst(e.target.value)}
                        autoComplete="given-name"
                      />
                    </Field>
                    <Field label="Legal last name" htmlFor="ob-ll" error={fieldErrors.legalLast}>
                      <input
                        id="ob-ll"
                        className="input"
                        value={legalLast}
                        onChange={(e) => setLegalLast(e.target.value)}
                        autoComplete="family-name"
                      />
                    </Field>
                  </div>

                  <Field label="Date of birth" htmlFor="ob-dob" error={fieldErrors.dob}>
                    <input
                      id="ob-dob"
                      className="input"
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                    />
                  </Field>

                  <div className="panel small muted row row-3" style={{ alignItems: 'flex-start' }}>
                    <IconLock size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                    <span>
                      These details are stored separately from your family profile and are never
                      shown to other families. They exist only to verify you.
                    </span>
                  </div>

                  <button className="btn btn-primary" onClick={startIdentity} disabled={busy}>
                    {busy ? 'Starting…' : 'Start verification'}
                    <IconArrowRight size={16} />
                  </button>
                </>
              )}

              {idStatus === 'pending' && (
                <div className="card card-pad stack stack-5">
                  <div className="row row-3">
                    <span className="badge badge-pending">Verification pending</span>
                  </div>
                  <p className="muted">
                    In production you would now be handed to the provider to photograph your ID
                    and take a selfie, and the decision would come back by webhook — usually in
                    under a minute.
                  </p>
                  <PrototypeNote>
                    No provider is connected. Choose an outcome below to continue the demo. This
                    is a simulation, not a verification.
                  </PrototypeNote>
                  <div className="row row-3 row-wrap">
                    <button className="btn btn-primary" onClick={() => resolveIdentity('verified')} disabled={busy}>
                      Simulate: verified
                    </button>
                    <button className="btn btn-secondary" onClick={() => resolveIdentity('failed')} disabled={busy}>
                      Simulate: failed
                    </button>
                  </div>
                </div>
              )}

              {idStatus === 'verified' && (
                <div className="card card-pad stack stack-4">
                  <span className="badge badge-ok" style={{ alignSelf: 'flex-start' }}>
                    <IconCheck size={11} /> Simulated verification complete
                  </span>
                  <p className="muted">
                    Discovery is now unlocked. Other families will see “Parent verified” on your
                    family profile — but never your legal name or date of birth.
                  </p>
                  <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => go(3)}>
                    Continue
                    <IconArrowRight size={16} />
                  </button>
                </div>
              )}

              {idStatus === 'failed' && (
                <div className="card card-pad stack stack-4">
                  <span className="badge badge-warn" style={{ alignSelf: 'flex-start' }}>
                    Verification failed
                  </span>
                  <p className="muted">
                    The document could not be read clearly. You can retry now, or build your
                    family profile first and verify later — but discovery stays closed until
                    verification succeeds.
                  </p>
                  <div className="row row-3 row-wrap">
                    <button className="btn btn-secondary" onClick={() => setIdStatus('unstarted')}>
                      Try again
                    </button>
                    <button className="btn btn-ghost" onClick={() => go(3)}>
                      Continue and verify later
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============== 4. Family profile ============== */}
          {step === 3 && (
            <div className="stack stack-6">
              <div>
                <h1 style={{ fontSize: 'var(--text-2xl)' }}>Create your family profile</h1>
                <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
                  One profile for the whole family — this is what other families see, not a
                  page about any individual child.
                </p>
              </div>

              <Field
                label="Family name"
                htmlFor="ob-fname"
                error={fieldErrors.familyName}
                hint='Usually your surname. Shown as "The Cohen Family".'
              >
                <input
                  id="ob-fname"
                  className="input"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="Cohen"
                />
              </Field>

              <Field
                label="General area"
                htmlFor="ob-area"
                error={fieldErrors.generalArea}
                hint="Broad enough that it does not identify where you live, e.g. “Jerusalem area”."
              >
                <input
                  id="ob-area"
                  className="input"
                  value={generalArea}
                  onChange={(e) => setGeneralArea(e.target.value)}
                  placeholder="Jerusalem area"
                />
              </Field>

              <Field
                label="Neighbourhood"
                htmlFor="ob-hood"
                optional
                hint="Only ever shown to families you have connected with, and only if you choose that setting."
              >
                <input
                  id="ob-hood"
                  className="input"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="Rehavia"
                />
              </Field>

              <Field label="Languages spoken at home" htmlFor="ob-lang" optional>
                <input
                  id="ob-lang"
                  className="input"
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                  placeholder="Hebrew, English"
                />
              </Field>

              <Field
                label="A short introduction"
                htmlFor="ob-about"
                optional
                hint="A sentence or two about your family. Avoid anything that identifies where you live or which school your children attend."
              >
                <textarea
                  id="ob-about"
                  className="textarea"
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  maxLength={600}
                  placeholder="We moved here last year and the kids are still finding their feet…"
                />
              </Field>

              <div className="row row-3">
                <button className="btn btn-ghost" onClick={() => go(2)}>
                  <IconChevronLeft size={16} />
                  Back
                </button>
                <button className="btn btn-primary" onClick={submitFamily} disabled={busy}>
                  {busy ? 'Saving…' : 'Continue'}
                  <IconArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ============== 5. Children ============== */}
          {step === 4 && (
            <div className="stack stack-6">
              <div>
                <h1 style={{ fontSize: 'var(--text-2xl)' }}>Add your children</h1>
                <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
                  We ask for an age in years, not a date of birth, and never for a surname or a
                  school. You choose what other families can see in a later step.
                </p>
              </div>

              {children.length > 1 && (
                <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
                  {children.map((c, i) => (
                    <button
                      key={i}
                      className={`pill${i === activeChild ? ' pill-strong' : ''}`}
                      onClick={() => setActiveChild(i)}
                    >
                      {c.firstName || `Child ${i + 1}`}
                    </button>
                  ))}
                </div>
              )}

              <div className="card card-pad stack stack-5">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: 'var(--sp-4)',
                  }}
                >
                  <Field label="First name" htmlFor="ob-cname">
                    <input
                      id="ob-cname"
                      className="input"
                      value={child.firstName}
                      onChange={(e) => updateChild({ firstName: e.target.value })}
                      placeholder="Noa"
                    />
                  </Field>
                  <Field label="Nickname" htmlFor="ob-cnick" optional>
                    <input
                      id="ob-cnick"
                      className="input"
                      value={child.nickname}
                      onChange={(e) => updateChild({ nickname: e.target.value })}
                      placeholder="Used if you hide first names"
                    />
                  </Field>
                  <Field label="Age" htmlFor="ob-cage">
                    <input
                      id="ob-cage"
                      className="input"
                      type="number"
                      min={1}
                      max={17}
                      value={child.age}
                      onChange={(e) => updateChild({ age: e.target.value })}
                      placeholder="8"
                    />
                  </Field>
                  <Field label="Pronouns" htmlFor="ob-cpro" optional>
                    <input
                      id="ob-cpro"
                      className="input"
                      value={child.pronouns}
                      onChange={(e) => updateChild({ pronouns: e.target.value })}
                      placeholder="she/her"
                    />
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
                      <Stars
                        value={child.energy}
                        onChange={(v) => updateChild({ energy: v })}
                        label="Energy level"
                      />
                    </div>
                    <div className="row row-between row-4">
                      <div>
                        <div className="small strong">With new children</div>
                        <div className="tiny muted">Needs warming up → jumps straight in</div>
                      </div>
                      <Stars
                        value={child.sociability}
                        onChange={(v) => updateChild({ sociability: v })}
                        label="Sociability"
                      />
                    </div>
                  </div>
                </div>

                <Field
                  label="Anything helpful for another parent to know"
                  htmlFor="ob-cnotes"
                  optional
                  hint="Only shown to families you have connected with — never while someone is browsing."
                >
                  <textarea
                    id="ob-cnotes"
                    className="textarea"
                    value={child.notes}
                    onChange={(e) => updateChild({ notes: e.target.value })}
                    maxLength={400}
                    placeholder="Loves building things and will happily spend two hours on one LEGO set."
                  />
                </Field>

                {children.length > 1 && (
                  <button
                    className="btn btn-danger-quiet btn-sm"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => {
                      setChildren((cs) => cs.filter((_, i) => i !== activeChild));
                      setActiveChild(0);
                    }}
                  >
                    <IconTrash size={14} />
                    Remove this child
                  </button>
                )}
              </div>

              <button
                className="btn btn-secondary"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => {
                  setChildren((cs) => [...cs, emptyChild()]);
                  setActiveChild(children.length);
                }}
              >
                <IconPlus size={16} />
                Add another child
              </button>

              <div className="row row-3">
                <button className="btn btn-ghost" onClick={() => go(3)}>
                  <IconChevronLeft size={16} />
                  Back
                </button>
                <button className="btn btn-primary" onClick={() => go(5)} disabled={!childrenValid}>
                  Continue
                  <IconArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ============== 6. Interests ============== */}
          {step === 5 && (
            <div className="stack stack-6">
              <div>
                <h1 style={{ fontSize: 'var(--text-2xl)' }}>What do they like doing?</h1>
                <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
                  For each interest, tell us two things: how much your child enjoys it, and how
                  much it should matter when we look for families. They are not the same
                  question.
                </p>
              </div>

              {children.length > 1 && (
                <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
                  {children.map((c, i) => (
                    <button
                      key={i}
                      className={`pill${i === activeChild ? ' pill-strong' : ''}`}
                      onClick={() => setActiveChild(i)}
                    >
                      {c.firstName || `Child ${i + 1}`}
                      <span className="tiny muted">{c.interests.length}</span>
                    </button>
                  ))}
                </div>
              )}

              <Alert tone="brand" title="Why the second rating matters">
                An interest you mark “extremely important” counts for roughly twenty-five times
                one you mark “not important”. It is not a tally of shared hobbies — one thing
                you genuinely care about will not be outvoted by a pile of small ones.
              </Alert>

              <div>
                <div className="strong" style={{ marginBottom: 'var(--sp-3)' }}>
                  {child.firstName || `Child ${activeChild + 1}`}'s interests
                </div>
                <InterestEditor
                  value={child.interests}
                  onChange={(next) => updateChild({ interests: next })}
                />
              </div>

              <div className="row row-3">
                <button className="btn btn-ghost" onClick={() => go(4)}>
                  <IconChevronLeft size={16} />
                  Back
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => go(6)}
                  disabled={children.every((c) => c.interests.length === 0)}
                >
                  Continue
                  <IconArrowRight size={16} />
                </button>
                {children.every((c) => c.interests.length === 0) && (
                  <span className="small muted">Add at least one interest.</span>
                )}
              </div>
            </div>
          )}

          {/* ============== 7. Location preferences ============== */}
          {step === 6 && (
            <div className="stack stack-6">
              <div>
                <h1 style={{ fontSize: 'var(--text-2xl)' }}>Where and how you would meet</h1>
                <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
                  These are hard limits, not preferences. Families outside them are removed
                  from your results rather than ranked last — you will not be shown families
                  you could not realistically meet.
                </p>
              </div>

              <Field
                label={`How far will you travel? — ${maxTravelKm} km`}
                htmlFor="ob-travel"
                hint="Applied in both directions: we also respect the other family's limit."
              >
                <input
                  id="ob-travel"
                  type="range"
                  min={1}
                  max={30}
                  value={maxTravelKm}
                  onChange={(e) => setMaxTravelKm(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--brand-600)' }}
                />
              </Field>

              <Field
                label={`Acceptable age gap — ${ageFlex} year${ageFlex === 1 ? '' : 's'}`}
                htmlFor="ob-agegap"
                hint="How far from one of your children's ages another child can be."
              >
                <input
                  id="ob-agegap"
                  type="range"
                  min={0}
                  max={5}
                  value={ageFlex}
                  onChange={(e) => setAgeFlex(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--brand-600)' }}
                />
              </Field>

              <div>
                <div className="label" style={{ marginBottom: 'var(--sp-3)' }}>
                  How do you like to meet?
                </div>
                <StylePicker value={styles} onChange={setStyles} />
              </div>

              <div>
                <div className="label" style={{ marginBottom: 'var(--sp-1)' }}>
                  What should we weight most?
                </div>
                <p className="hint" style={{ marginBottom: 'var(--sp-4)' }}>
                  Private to you. You can change these any time and your results update
                  immediately.
                </p>
                <WeightEditor
                  value={weights}
                  onChange={(k, v) => setWeights((w) => ({ ...w, [k]: v }))}
                />
              </div>

              <div className="row row-3">
                <button className="btn btn-ghost" onClick={() => go(5)}>
                  <IconChevronLeft size={16} />
                  Back
                </button>
                <button className="btn btn-primary" onClick={() => go(7)}>
                  Continue
                  <IconArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ============== 8. Availability ============== */}
          {step === 7 && (
            <div className="stack stack-6">
              <div>
                <h1 style={{ fontSize: 'var(--text-2xl)' }}>When are you usually free?</h1>
                <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
                  Rough blocks are enough. Families with no overlap with yours are filtered out
                  of each other's results.
                </p>
              </div>

              <AvailabilityGrid value={availability} onChange={setAvailability} />

              <div className="row row-3">
                <button className="btn btn-ghost" onClick={() => go(6)}>
                  <IconChevronLeft size={16} />
                  Back
                </button>
                <button className="btn btn-primary" onClick={() => go(8)} disabled={availability.length === 0}>
                  Continue
                  <IconArrowRight size={16} />
                </button>
                {availability.length === 0 && (
                  <span className="small muted">Choose at least one time.</span>
                )}
              </div>
            </div>
          )}

          {/* ============== 9. Privacy ============== */}
          {step === 8 && (
            <div className="stack stack-6">
              <div>
                <h1 style={{ fontSize: 'var(--text-2xl)' }}>Choose what others can see</h1>
                <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
                  Every setting starts at the most protective option that still lets matching
                  work. The preview beside each one shows exactly what another family would see.
                </p>
              </div>

              <div className="card card-pad">
                <PrivacyControls
                  value={privacy}
                  onChange={(patch) => setPrivacy((p) => ({ ...p, ...patch }))}
                  preview={{
                    generalArea: generalArea || 'Jerusalem area',
                    neighborhood: neighborhood || undefined,
                    childFirstName: children[0]?.firstName || 'Noa',
                    childNickname: children[0]?.nickname || undefined,
                    childAge: Number(children[0]?.age) || 8,
                  }}
                />
              </div>

              <div className="card card-pad stack stack-4">
                <label className="checkbox" data-checked={privacy.requireVerifiedToRequest}>
                  <input
                    type="checkbox"
                    checked={privacy.requireVerifiedToRequest}
                    onChange={(e) => setPrivacy((p) => ({ ...p, requireVerifiedToRequest: e.target.checked }))}
                  />
                  <div>
                    <div className="strong small">
                      Only accept requests from ID-verified parents
                    </div>
                    <div className="tiny muted">
                      Strongly recommended. Parents who have not completed identity verification
                      cannot send you a request at all.
                    </div>
                  </div>
                </label>

                <label className="checkbox" data-checked={privacy.discoverable}>
                  <input
                    type="checkbox"
                    checked={privacy.discoverable}
                    onChange={(e) => setPrivacy((p) => ({ ...p, discoverable: e.target.checked }))}
                  />
                  <div>
                    <div className="strong small">Appear in other families' results</div>
                    <div className="tiny muted">
                      Turn this off at any time to pause discovery without deleting anything.
                    </div>
                  </div>
                </label>
              </div>

              <div className="row row-3">
                <button className="btn btn-ghost" onClick={() => go(7)}>
                  <IconChevronLeft size={16} />
                  Back
                </button>
                <button className="btn btn-primary" onClick={() => go(9)}>
                  Continue
                  <IconArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ============== 10. Safety ============== */}
          {step === 9 && (
            <div className="stack stack-6">
              <div>
                <span className="eyebrow">
                  <IconShieldCheck size={13} />
                  Before you start
                </span>
                <h1 style={{ fontSize: 'var(--text-2xl)', marginTop: 'var(--sp-2)' }}>
                  How to use PlayDate safely
                </h1>
                <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
                  Six things worth two minutes of your time. None of this is unusual — it is
                  how most parents already arrange a first playdate.
                </p>
              </div>

              <div className="stack stack-3">
                {SAFETY_TIPS.map((t) => (
                  <div key={t.title} className="card card-pad">
                    <div className="row row-3" style={{ alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--ok-500)', marginTop: 2, flexShrink: 0 }}>
                        <IconCheck size={16} />
                      </span>
                      <div>
                        <div className="strong">{t.title}</div>
                        <p className="muted small" style={{ marginTop: 2 }}>
                          {t.body}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <label className="checkbox" data-checked={acceptedSafety}>
                <input
                  type="checkbox"
                  checked={acceptedSafety}
                  onChange={(e) => setAcceptedSafety(e.target.checked)}
                />
                <div>
                  <div className="strong small">I have read these and I understand them</div>
                  <div className="tiny muted">
                    We record that you saw this page, with a timestamp. You can reread it any
                    time from the Safety Centre.
                  </div>
                </div>
              </label>

              <div className="row row-3">
                <button className="btn btn-ghost" onClick={() => go(8)}>
                  <IconChevronLeft size={16} />
                  Back
                </button>
                <button className="btn btn-primary" onClick={() => go(10)} disabled={!acceptedSafety}>
                  Continue
                  <IconArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ============== 11. Done ============== */}
          {step === 10 && (
            <div className="stack stack-6">
              <div className="center stack stack-4" style={{ alignItems: 'center' }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 999,
                    background: 'var(--ok-50)',
                    color: 'var(--ok-600)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <IconCheck size={30} />
                </div>
                <h1 style={{ fontSize: 'var(--text-2xl)' }}>Your family profile is ready</h1>
                <p className="muted" style={{ maxWidth: '46ch' }}>
                  Here is what other families will see when you appear in their results.
                  Everything on this card is something you chose.
                </p>
              </div>

              <div className="card card-pad stack stack-4">
                <div className="row row-4">
                  <Avatar
                    name={familyName || 'Family'}
                    color="var(--brand-600)"
                    size="lg"
                    square
                  />
                  <div>
                    <div className="strong" style={{ fontSize: 'var(--text-md)' }}>
                      The {familyName || 'Your'} Family
                    </div>
                    <div className="small muted">
                      {privacy.location === 'hidden' ? 'Location not shared' : generalArea} ·{' '}
                      {children.filter((c) => c.firstName).length}{' '}
                      {children.filter((c) => c.firstName).length === 1 ? 'child' : 'children'}
                    </div>
                  </div>
                </div>

                <hr className="divider" />

                <div className="stack stack-3">
                  {children
                    .filter((c) => c.firstName)
                    .map((c, i) => (
                      <div key={i} className="row row-3">
                        <Avatar name={c.firstName} color="var(--accent-500)" size="sm" />
                        <div>
                          <div className="small strong">
                            {privacy.childName === 'hidden'
                              ? `Child ${i + 1}`
                              : privacy.childName === 'nickname'
                                ? c.nickname || `Child ${i + 1}`
                                : c.firstName}
                          </div>
                          <div className="tiny muted">
                            {privacy.childAges === 'exact'
                              ? `${c.age} years old`
                              : `${Math.max(1, Number(c.age) - 1)}–${Number(c.age) + 1} years old`}{' '}
                            · {c.interests.length} interests
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                <div className="panel small muted">
                  Not shown: your address, phone number, email, legal name, date of birth, or
                  precise location. Those never leave your private record.
                </div>
              </div>

              <div className="card card-pad">
                <div className="strong small" style={{ marginBottom: 'var(--sp-3) ' }}>
                  Your matching priorities
                </div>
                <div className="stack stack-2">
                  {(['interests', 'age', 'distance', 'availability', 'style'] as const).map((k) => (
                    <div key={k} className="row row-between">
                      <span className="small" style={{ textTransform: 'capitalize' }}>
                        {k === 'style' ? 'Playdate style' : k}
                      </span>
                      <span className="row row-3">
                        <Stars value={weights[k]} size="readonly" label={k} />
                        <span className="tiny muted">{IMPORTANCE_LABELS[weights[k]]}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button className="btn btn-primary btn-lg" onClick={finish} disabled={busy}>
                {busy ? 'Setting up…' : 'Enter discovery'}
                <IconArrowRight size={17} />
              </button>

              <button className="btn btn-ghost" onClick={() => go(9)}>
                <IconChevronLeft size={16} />
                Back
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
