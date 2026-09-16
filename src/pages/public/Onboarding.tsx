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
  type ValidationError,
} from '../../domain/validation';
import { useT } from '../../i18n';
import type { TKey } from '../../i18n/types';
import { useFormat } from '../../i18n/format';
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
import { importanceLabels } from '../../domain/interests';

/**
 * The eleven-step onboarding.
 *
 * The order is the safety model made sequential: identity before profile, profile before
 * privacy choices, privacy choices before discovery. A parent cannot reach the last step
 * without having passed every gate before it.
 */

/**
 * Step labels are dictionary KEYS. The array is module scope and so cannot call the
 * translate hook; `Onboarding` resolves them at render time, which also means the
 * sidebar relabels itself when the language changes mid-signup.
 */
const STEPS = [
  'ob.step1',
  'ob.step2',
  'ob.step3',
  'safetyPage.chain2',
  'ob.step5',
  'ob.step6',
  'ob.step7',
  'ob.step8',
  'ob.step9',
  'ob.step10',
  'ob.step11',
] as const satisfies readonly TKey[];

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

  const t = useT();
  const fmt = useFormat();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, ValidationError>>({});

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

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : t('common.somethingWrong'));

  /* ---------------------------------------------------------------------- */
  /* Step handlers                                                           */
  /* ---------------------------------------------------------------------- */

  const submitAccount = async () => {
    const errs: Record<string, ValidationError> = {};
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
      setFieldErrors({ emailCode: { key: 'val.code.wrong' } });
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
      setFieldErrors({ phoneCode: { key: 'val.code.wrong' } });
    } finally {
      setBusy(false);
    }
  };

  const startIdentity = async () => {
    const errs: Record<string, ValidationError> = {};
    if (!legalFirst.trim()) errs.legalFirst = { key: 'val.legalFirst' };
    if (!legalLast.trim()) errs.legalLast = { key: 'val.legalLast' };
    if (!dob) errs.dob = { key: 'val.dob' };
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
    const errs: Record<string, ValidationError> = {};
    const e1 = validateLength(familyName, 'val.familyName', 2, 80);
    const e2 = validateLength(generalArea, 'val.generalArea', 2, 80);
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
          {t('ob.asideP')}
        </p>

        <div className="onboarding-steps">
          {STEPS.map((labelKey, i) => (
            <div
              key={labelKey}
              className={`onboarding-step${i === step ? ' active' : ''}${i < step ? ' done' : ''}`}
            >
              <span className="onboarding-step-dot">
                {i < step ? <IconCheck size={11} /> : i + 1}
              </span>
              {t(labelKey)}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 'var(--sp-8)' }}>
          <Link
            to="/"
            className="small"
            style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}
          >
            <span aria-hidden="true">←</span> {t('ob.backHome')}
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
            {t('ob.stepOf', { n: step + 1, total: STEPS.length })}
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
                <h1 style={{ fontSize: 'var(--text-2xl)' }}>{t('how.p1.title')}</h1>
                <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
                  {t('ob.acc.p')}
                </p>
              </div>

              <Field label={t('login.email')} htmlFor="ob-email" error={fmt.errorText(fieldErrors.email)}>
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
                label={t('ob.acc.phone')}
                htmlFor="ob-phone"
                error={fmt.errorText(fieldErrors.phone)}
                hint={t('ob.acc.phoneHint')}
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

              <Field label={t('login.password')} htmlFor="ob-password" error={fmt.errorText(fieldErrors.password)}>
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
                    aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
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
                      {t(strength.labelKey)}
                      {strength.suggestionKeys[0] ? ` — ${t(strength.suggestionKeys[0])}` : ''}
                    </div>
                  </div>
                )}
              </Field>

              <PrototypeNote>
                {t('proto.password')}
              </PrototypeNote>

              <div className="row row-3">
                <button className="btn btn-primary" onClick={submitAccount} disabled={busy}>
                  {busy ? t('ob.acc.creating') : t('nav.createAccount')}
                  <IconArrowRight size={16} />
                </button>
                <Link to="/login" className="btn btn-ghost">
                  {t('ob.acc.haveAccount')}
                </Link>
              </div>
            </div>
          )}

          {/* ============== 2. Verify contact ============== */}
          {step === 1 && (
            <div className="stack stack-6">
              <div>
                <h1 style={{ fontSize: 'var(--text-2xl)' }}>{t('ob.verify.h1')}</h1>
                <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
                  {t('ob.verify.p')}
                </p>
              </div>

              <PrototypeNote>
                {t('proto.codes')}
              </PrototypeNote>

              <div className="card card-pad stack stack-4">
                <div className="row row-between">
                  <span className="strong">Email — {email || 'your address'}</span>
                  {emailDone && <span className="badge badge-ok"><IconCheck size={11} /> Verified</span>}
                </div>
                {!emailDone && (
                  <>
                    <Field label={t('ob.verify.code')} htmlFor="ob-ecode" error={fmt.errorText(fieldErrors.emailCode)}>
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
                      {t('ob.verify.confirmEmail')}
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
                    <Field label={t('ob.verify.code')} htmlFor="ob-pcode" error={fmt.errorText(fieldErrors.phoneCode)}>
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
                      {t('ob.verify.confirmPhone')}
                    </button>
                  </>
                )}
              </div>

              <label className="checkbox" data-checked={enable2fa}>
                <input type="checkbox" checked={enable2fa} onChange={(e) => setEnable2fa(e.target.checked)} />
                <div>
                  <div className="strong small">{t('ob.verify.2fa')}</div>
                  <div className="tiny muted">
                    {t('ob.verify.2faDesc')}
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
                  <span className="small muted">{t('ob.verify.bothToContinue')}</span>
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
                  {t('ob.step3')}
                </span>
                <h1 style={{ fontSize: 'var(--text-2xl)', marginTop: 'var(--sp-2)' }}>
                  {t('ob.id.h1')}
                </h1>
                <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
                  {t('ob.id.p')}
                </p>
              </div>

              <Alert tone="brand" title={t('ob.id.whereTitle')}>
                {t('ob.id.whereBody')}
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
                    <Field label={t('ob.id.legalFirst')} htmlFor="ob-lf" error={fmt.errorText(fieldErrors.legalFirst)}>
                      <input
                        id="ob-lf"
                        className="input"
                        value={legalFirst}
                        onChange={(e) => setLegalFirst(e.target.value)}
                        autoComplete="given-name"
                      />
                    </Field>
                    <Field label={t('ob.id.legalLast')} htmlFor="ob-ll" error={fmt.errorText(fieldErrors.legalLast)}>
                      <input
                        id="ob-ll"
                        className="input"
                        value={legalLast}
                        onChange={(e) => setLegalLast(e.target.value)}
                        autoComplete="family-name"
                      />
                    </Field>
                  </div>

                  <Field label={t('ob.id.dob')} htmlFor="ob-dob" error={fmt.errorText(fieldErrors.dob)}>
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
                      {t('ob.id.storedSeparately')}
                    </span>
                  </div>

                  <button className="btn btn-primary" onClick={startIdentity} disabled={busy}>
                    {busy ? t('ob.id.starting') : t('ob.id.start')}
                    <IconArrowRight size={16} />
                  </button>
                </>
              )}

              {idStatus === 'pending' && (
                <div className="card card-pad stack stack-5">
                  <div className="row row-3">
                    <span className="badge badge-pending">{t('verif.pending.label')}</span>
                  </div>
                  <p className="muted">
                    {t('ob.id.pendingP')}
                  </p>
                  <PrototypeNote>
                    {t('proto.verifNoProvider')}
                  </PrototypeNote>
                  <div className="row row-3 row-wrap">
                    <button className="btn btn-primary" onClick={() => resolveIdentity('verified')} disabled={busy}>
                      {t('ob.id.simVerified')}
                    </button>
                    <button className="btn btn-secondary" onClick={() => resolveIdentity('failed')} disabled={busy}>
                      {t('ob.id.simFailed')}
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
                    {t('ob.id.doneP')}
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
                    {t('verif.failed.label')}
                  </span>
                  <p className="muted">
                    {t('ob.id.failedP')}
                  </p>
                  <div className="row row-3 row-wrap">
                    <button className="btn btn-secondary" onClick={() => setIdStatus('unstarted')}>
                      {t('common.retry')}
                    </button>
                    <button className="btn btn-ghost" onClick={() => go(3)}>
                      {t('ob.id.verifyLater')}
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
                <h1 style={{ fontSize: 'var(--text-2xl)' }}>{t('ob.fam.h1')}</h1>
                <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
                  {t('ob.fam.p')}
                </p>
              </div>

              <Field
                label={t('ob.fam.name')}
                htmlFor="ob-fname"
                error={fmt.errorText(fieldErrors.familyName)}
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
                label={t('ob.fam.area')}
                htmlFor="ob-area"
                error={fmt.errorText(fieldErrors.generalArea)}
                hint={t('ob.fam.areaHint')}
              >
                <input
                  id="ob-area"
                  className="input"
                  value={generalArea}
                  onChange={(e) => setGeneralArea(e.target.value)}
                  placeholder={t('landing.previewArea')}
                />
              </Field>

              <Field
                label={t('ob.fam.hood')}
                htmlFor="ob-hood"
                optional
                hint={t('ob.fam.hoodHint')}
              >
                <input
                  id="ob-hood"
                  className="input"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="Rehavia"
                />
              </Field>

              <Field label={t('ob.fam.langs')} htmlFor="ob-lang" optional>
                <input
                  id="ob-lang"
                  className="input"
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                  placeholder="Hebrew, English"
                />
              </Field>

              <Field
                label={t('ob.fam.about')}
                htmlFor="ob-about"
                optional
                hint={t('ob.fam.aboutHint')}
              >
                <textarea
                  id="ob-about"
                  className="textarea"
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  maxLength={600}
                  placeholder={t('ob.fam.aboutPlaceholder')}
                />
              </Field>

              <div className="row row-3">
                <button className="btn btn-ghost" onClick={() => go(2)}>
                  <IconChevronLeft size={16} />
                  {t('common.back')}
                </button>
                <button className="btn btn-primary" onClick={submitFamily} disabled={busy}>
                  {busy ? t('common.saving') : t('common.continue')}
                  <IconArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ============== 5. Children ============== */}
          {step === 4 && (
            <div className="stack stack-6">
              <div>
                <h1 style={{ fontSize: 'var(--text-2xl)' }}>{t('how.p3.i2')}</h1>
                <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
                  {t('ob.kids.p')}
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
                      {c.firstName || t('common.childN', { n: i + 1 })}
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
                  <Field label={t('ob.kids.firstName')} htmlFor="ob-cname">
                    <input
                      id="ob-cname"
                      className="input"
                      value={child.firstName}
                      onChange={(e) => updateChild({ firstName: e.target.value })}
                      placeholder="Noa"
                    />
                  </Field>
                  <Field label={t('ob.kids.nickname')} htmlFor="ob-cnick" optional>
                    <input
                      id="ob-cnick"
                      className="input"
                      value={child.nickname}
                      onChange={(e) => updateChild({ nickname: e.target.value })}
                      placeholder={t('ob.kids.nicknameHint')}
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
                  <Field label={t('ob.kids.pronouns')} htmlFor="ob-cpro" optional>
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
                    {t('ob.kids.howPlay')}
                  </div>
                  <div className="stack stack-3">
                    <div className="row row-between row-4">
                      <div>
                        <div className="small strong">{t('ob.kids.energy')}</div>
                        <div className="tiny muted">{t('ob.kids.energyHint')}</div>
                      </div>
                      <Stars
                        value={child.energy}
                        onChange={(v) => updateChild({ energy: v })}
                        label={t('ob.kids.energy')}
                      />
                    </div>
                    <div className="row row-between row-4">
                      <div>
                        <div className="small strong">{t('ob.kids.social')}</div>
                        <div className="tiny muted">{t('ob.kids.socialHint')}</div>
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
                  label={t('ob.kids.notes')}
                  htmlFor="ob-cnotes"
                  optional
                  hint={t('ob.kids.notesHint')}
                >
                  <textarea
                    id="ob-cnotes"
                    className="textarea"
                    value={child.notes}
                    onChange={(e) => updateChild({ notes: e.target.value })}
                    maxLength={400}
                    placeholder={t('ob.kids.notesPlaceholder')}
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
                    {t('ob.kids.removeThis')}
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
                {t('ob.kids.addAnother')}
              </button>

              <div className="row row-3">
                <button className="btn btn-ghost" onClick={() => go(3)}>
                  <IconChevronLeft size={16} />
                  {t('common.back')}
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
                <h1 style={{ fontSize: 'var(--text-2xl)' }}>{t('ob.int.h1')}</h1>
                <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
                  {t('ob.int.p')}
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
                      {c.firstName || t('common.childN', { n: i + 1 })}
                      <span className="tiny muted">{c.interests.length}</span>
                    </button>
                  ))}
                </div>
              )}

              <Alert tone="brand" title={t('ob.int.whyTitle')}>
                {t('ob.int.whyBody')}
              </Alert>

              <div>
                <div className="strong" style={{ marginBottom: 'var(--sp-3)' }}>
                  {t('ob.int.childsInterests', {
                    name: child.firstName || t('common.childN', { n: activeChild + 1 }),
                  })}
                </div>
                <InterestEditor
                  value={child.interests}
                  onChange={(next) => updateChild({ interests: next })}
                />
              </div>

              <div className="row row-3">
                <button className="btn btn-ghost" onClick={() => go(4)}>
                  <IconChevronLeft size={16} />
                  {t('common.back')}
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
                  <span className="small muted">{t('ob.int.addOne')}</span>
                )}
              </div>
            </div>
          )}

          {/* ============== 7. Location preferences ============== */}
          {step === 6 && (
            <div className="stack stack-6">
              <div>
                <h1 style={{ fontSize: 'var(--text-2xl)' }}>{t('ob.loc.h1')}</h1>
                <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
                  {t('ob.loc.p')}
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
                  {t('ob.loc.howMeet')}
                </div>
                <StylePicker value={styles} onChange={setStyles} />
              </div>

              <div>
                <div className="label" style={{ marginBottom: 'var(--sp-1)' }}>
                  {t('ob.loc.weightH')}
                </div>
                <p className="hint" style={{ marginBottom: 'var(--sp-4)' }}>
                  {t('ob.loc.weightHint')}
                </p>
                <WeightEditor
                  value={weights}
                  onChange={(k, v) => setWeights((w) => ({ ...w, [k]: v }))}
                />
              </div>

              <div className="row row-3">
                <button className="btn btn-ghost" onClick={() => go(5)}>
                  <IconChevronLeft size={16} />
                  {t('common.back')}
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
                <h1 style={{ fontSize: 'var(--text-2xl)' }}>{t('ob.avail.h1')}</h1>
                <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
                  {t('ob.avail.p')}
                </p>
              </div>

              <AvailabilityGrid value={availability} onChange={setAvailability} />

              <div className="row row-3">
                <button className="btn btn-ghost" onClick={() => go(6)}>
                  <IconChevronLeft size={16} />
                  {t('common.back')}
                </button>
                <button className="btn btn-primary" onClick={() => go(8)} disabled={availability.length === 0}>
                  Continue
                  <IconArrowRight size={16} />
                </button>
                {availability.length === 0 && (
                  <span className="small muted">{t('ob.avail.chooseOne')}</span>
                )}
              </div>
            </div>
          )}

          {/* ============== 9. Privacy ============== */}
          {step === 8 && (
            <div className="stack stack-6">
              <div>
                <h1 style={{ fontSize: 'var(--text-2xl)' }}>{t('how.p4.title')}</h1>
                <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
                  {t('ob.priv.p')}
                </p>
              </div>

              <div className="card card-pad">
                <PrivacyControls
                  value={privacy}
                  onChange={(patch) => setPrivacy((p) => ({ ...p, ...patch }))}
                  preview={{
                    generalArea: generalArea || t('landing.previewArea'),
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
                      {t('ob.priv.verifiedOnly')}
                    </div>
                    <div className="tiny muted">
                      {t('ob.priv.verifiedOnlyDesc')}
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
                    <div className="strong small">{t('ob.priv.discoverable')}</div>
                    <div className="tiny muted">
                      {t('ob.priv.discoverableDesc')}
                    </div>
                  </div>
                </label>
              </div>

              <div className="row row-3">
                <button className="btn btn-ghost" onClick={() => go(7)}>
                  <IconChevronLeft size={16} />
                  {t('common.back')}
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
                  {t('ob.safe.eyebrow')}
                </span>
                <h1 style={{ fontSize: 'var(--text-2xl)', marginTop: 'var(--sp-2)' }}>
                  {t('ob.safe.h1')}
                </h1>
                <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
                  {t('ob.safe.p')}
                </p>
              </div>

              <div className="stack stack-3">
                {SAFETY_TIPS.map((tip) => (
                  <div key={tip.titleKey} className="card card-pad">
                    <div className="row row-3" style={{ alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--ok-500)', marginTop: 2, flexShrink: 0 }}>
                        <IconCheck size={16} />
                      </span>
                      <div>
                        <div className="strong">{t(tip.titleKey)}</div>
                        <p className="muted small" style={{ marginTop: 2 }}>
                          {t(tip.bodyKey)}
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
                  <div className="strong small">{t('ob.safe.accept')}</div>
                  <div className="tiny muted">
                    {t('ob.safe.acceptDesc')}
                  </div>
                </div>
              </label>

              <div className="row row-3">
                <button className="btn btn-ghost" onClick={() => go(8)}>
                  <IconChevronLeft size={16} />
                  {t('common.back')}
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
                <h1 style={{ fontSize: 'var(--text-2xl)' }}>{t('ob.done.h1')}</h1>
                <p className="muted" style={{ maxWidth: '46ch' }}>
                  {t('ob.done.p')}
                </p>
              </div>

              <div className="card card-pad stack stack-4">
                <div className="row row-4">
                  <Avatar
                    name={familyName || t('admin.colFamily')}
                    color="var(--brand-600)"
                    size="lg"
                    square
                  />
                  <div>
                    <div className="strong" style={{ fontSize: 'var(--text-md)' }}>
                      The {familyName || t('ob.done.yourFamily')} Family
                    </div>
                    <div className="small muted">
                      {privacy.location === 'hidden' ? t('ed.locNotShared') : generalArea} ·{' '}
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
                              ? t('common.childN', { n: i + 1 })
                              : privacy.childName === 'nickname'
                                ? c.nickname || t('common.childN', { n: i + 1 })
                                : c.firstName}
                          </div>
                          <div className="tiny muted">
                            {privacy.childAges === 'exact'
                              ? t('common.yearsOld', { n: Number(c.age) })
                              : t('common.ageRange', {
                                  from: Math.max(1, Number(c.age) - 1),
                                  to: Number(c.age) + 1,
                                })}{' '}
                            · {t('ob.done.nInterests', { n: c.interests.length })}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                <div className="panel small muted">
                  {t('ob.done.notShown')}
                </div>
              </div>

              <div className="card card-pad">
                <div className="strong small" style={{ marginBottom: 'var(--sp-3) ' }}>
                  {t('ob.done.priorities')}
                </div>
                <div className="stack stack-2">
                  {(['interests', 'age', 'distance', 'availability', 'style'] as const).map((k) => (
                    <div key={k} className="row row-between">
                      <span className="small" style={{ textTransform: 'capitalize' }}>
                        {k === 'style' ? t('compat.factorStyle') : k}
                      </span>
                      <span className="row row-3">
                        <Stars value={weights[k]} size="readonly" label={k} />
                        <span className="tiny muted">{importanceLabels(t)[weights[k]]}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button className="btn btn-primary btn-lg" onClick={finish} disabled={busy}>
                {busy ? t('ob.done.settingUp') : t('ob.done.enter')}
                <IconArrowRight size={17} />
              </button>

              <button className="btn btn-ghost" onClick={() => go(9)}>
                <IconChevronLeft size={16} />
                {t('common.back')}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
