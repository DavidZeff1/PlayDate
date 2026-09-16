import { useCallback, useEffect, useState } from 'react';
import { api, type VerificationState } from '../../services';
import { useApp } from '../../state/AppContext';
import { VERIFICATION_TONE, verificationDescKey, verificationLabelKey } from '../../domain/trust/signals';
import { useI18n, useT } from '../../i18n';
import { Alert, Badge, Field, LoadingBlock, PrototypeNote, useToast } from '../../components/ui';
import { IconCheck, IconLock, IconShieldCheck, IconX } from '../../components/ui/Icons';

/**
 * Verification.
 *
 * The brief is explicit: do not pretend mock verification is real verification. Every
 * simulated state on this page is labelled as simulated, the "resolve" controls are
 * plainly demo controls, and the badge copy says "simulated" wherever the prototype
 * produced the result rather than a provider.
 */
export function Verification() {
  const { refresh } = useApp();
  const toast = useToast();
  const t = useT();
  const [state, setState] = useState<VerificationState | null>(null);
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const [phoneHint, setPhoneHint] = useState<string | null>(null);
  const [legalFirst, setLegalFirst] = useState('');
  const [legalLast, setLegalLast] = useState('');
  const [dob, setDob] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { d } = useI18n();

  const load = useCallback(async () => {
    setState(await api.getVerificationState());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!state) return <LoadingBlock />;

  const copy = {
    label: t(verificationLabelKey(state.identityStatus)),
    description: t(verificationDescKey(state.identityStatus)),
    tone: VERIFICATION_TONE[state.identityStatus],
  };

  const run = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      await refresh();
      if (success) toast.push(success, 'ok');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.somethingWrong'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack stack-6">
      <div className="page-head">
        <h1>{t('nav.verification')}</h1>
        <p>
          {t('ver.sub')}
        </p>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {/* ---- Identity ---------------------------------------------------- */}
      <section className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="row row-2">
              <IconShieldCheck size={16} />
              {t('ob.step3')}
            </span>
          </span>
          <Badge
            tone={
              copy.tone === 'ok' ? 'ok' : copy.tone === 'pending' ? 'pending' : copy.tone === 'warn' ? 'warn' : 'neutral'
            }
          >
            {state.isMockProvider && state.identityStatus === 'verified'
              ? t('ver.simVerified')
              : copy.label}
          </Badge>
        </div>

        <div className="card-body stack stack-5">
          <p className="muted">{copy.description}</p>

          {state.isMockProvider && (
            <PrototypeNote>
              {t('proto.verifPage')}
            </PrototypeNote>
          )}

          {state.identityStatus === 'unstarted' || state.identityStatus === 'required' || state.identityStatus === 'failed' ? (
            <>
              {state.failureReason && (
                <Alert tone="warn" title={t('ver.lastAttemptTitle')}>
                  {state.failureReason}
                </Alert>
              )}

              <Alert tone="brand" title={t('ver.whereTitle')}>
                {t('ver.whereBody')}
              </Alert>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 'var(--sp-4)',
                }}
              >
                <Field label={t('ob.id.legalFirst')} htmlFor="v-lf">
                  <input id="v-lf" className="input" value={legalFirst} onChange={(e) => setLegalFirst(e.target.value)} />
                </Field>
                <Field label={t('ob.id.legalLast')} htmlFor="v-ll">
                  <input id="v-ll" className="input" value={legalLast} onChange={(e) => setLegalLast(e.target.value)} />
                </Field>
                <Field label={t('ob.id.dob')} htmlFor="v-dob">
                  <input id="v-dob" className="input" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                </Field>
              </div>

              <div className="panel small muted row row-3" style={{ alignItems: 'flex-start' }}>
                <IconLock size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>
                  {t('ver.storedSeparately')}
                </span>
              </div>

              <button
                className="btn btn-primary"
                style={{ alignSelf: 'flex-start' }}
                disabled={busy || !legalFirst || !legalLast || !dob}
                onClick={() =>
                  run(
                    () =>
                      api.startIdentityVerification({
                        legalFirstName: legalFirst,
                        legalLastName: legalLast,
                        dateOfBirth: dob,
                      }),
                    t('ver.started'),
                  )
                }
              >
                {busy ? t('ob.id.starting') : t('ob.id.start')}
              </button>
            </>
          ) : state.identityStatus === 'pending' ? (
            <>
              <Alert tone="info" title={t('ver.inProgressTitle')}>
                {t('ver.inProgressBody')}
              </Alert>
              <div className="card card-pad stack stack-4" style={{ background: 'var(--warn-50)', borderColor: 'var(--warn-100)' }}>
                <div className="strong small" style={{ color: 'var(--warn-700)' }}>
                  {t('ver.demoControls')}
                </div>
                <div className="row row-3 row-wrap">
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() => run(() => api.resolveMockVerification('verified'), t('ver.simDone'))}
                  >
                    <IconCheck size={14} />
                    {t('ver.simPass')}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => run(() => api.resolveMockVerification('failed'), t('ver.simFailed'))}
                  >
                    <IconX size={14} />
                    {t('ver.simFail')}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <Alert tone="ok" title={state.isMockProvider ? t('ob.id.doneBadge') : t('ver.completeTitle')}>
              {t('ver.completeBody')}
              {state.identityUpdatedAt && (
                <div className="tiny" style={{ marginTop: 6, opacity: 0.85 }}>
                  {t('ver.completedOn', { date: d(state.identityUpdatedAt) })}
                </div>
              )}
            </Alert>
          )}
        </div>
      </section>

      {/* ---- Contact verification ----------------------------------------- */}
      <div className="dash-grid">
        <section className="card">
          <div className="card-header">
            <span className="card-title">{t('login.email')}</span>
            {state.emailVerified ? (
              <Badge tone="ok">
                <IconCheck size={10} /> {t('set.verified')}
              </Badge>
            ) : (
              <Badge tone="warn">{t('set.notVerified')}</Badge>
            )}
          </div>
          <div className="card-body stack stack-4">
            {state.emailVerified ? (
              <p className="small muted">{t('ver.emailConfirmed')}</p>
            ) : (
              <>
                <Field label={t('ob.verify.code')} htmlFor="v-ecode">
                  <input
                    id="v-ecode"
                    className="input"
                    inputMode="numeric"
                    maxLength={6}
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value)}
                    style={{ letterSpacing: '0.25em' }}
                  />
                </Field>
                {emailHint && (
                  <div className="tiny muted">
                    Simulated code: <span className="mono strong">{emailHint}</span>
                  </div>
                )}
                <div className="row row-2">
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => run(async () => setEmailHint((await api.sendEmailCode()).hint))}
                  >
                    {t('ver.sendCode')}
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={busy || !emailCode}
                    onClick={() => run(() => api.confirmEmailCode(emailCode), t('ver.emailVerifiedToast'))}
                  >
                    {t('common.confirm')}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <span className="card-title">{t('ver.phoneTitle')}</span>
            {state.phoneVerified ? (
              <Badge tone="ok">
                <IconCheck size={10} /> {t('set.verified')}
              </Badge>
            ) : (
              <Badge tone="warn">{t('set.notVerified')}</Badge>
            )}
          </div>
          <div className="card-body stack stack-4">
            {state.phoneVerified ? (
              <p className="small muted">{t('ver.phoneConfirmed')}</p>
            ) : (
              <>
                <Field label={t('ob.verify.code')} htmlFor="v-pcode">
                  <input
                    id="v-pcode"
                    className="input"
                    inputMode="numeric"
                    maxLength={6}
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value)}
                    style={{ letterSpacing: '0.25em' }}
                  />
                </Field>
                {phoneHint && (
                  <div className="tiny muted">
                    Simulated code: <span className="mono strong">{phoneHint}</span>
                  </div>
                )}
                <div className="row row-2">
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => run(async () => setPhoneHint((await api.sendPhoneCode()).hint))}
                  >
                    {t('ver.sendCode')}
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={busy || !phoneCode}
                    onClick={() => run(() => api.confirmPhoneCode(phoneCode), t('ver.phoneVerifiedToast'))}
                  >
                    {t('common.confirm')}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* ---- The four states ---------------------------------------------- */}
      <section className="card">
        <div className="card-header">
          <span className="card-title">{t('ver.statesTitle')}</span>
        </div>
        <div className="card-body">
          <div className="stack stack-4">
            {(['verified', 'pending', 'failed', 'required'] as const).map((s) => {
              const c = {
                label: t(verificationLabelKey(s)),
                description: t(verificationDescKey(s)),
                tone: VERIFICATION_TONE[s],
              };
              return (
                <div key={s} className="row row-4" style={{ alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 150 }}>
                    <Badge
                      tone={c.tone === 'ok' ? 'ok' : c.tone === 'pending' ? 'pending' : c.tone === 'warn' ? 'warn' : 'neutral'}
                    >
                      {c.label}
                    </Badge>
                  </div>
                  <p className="small muted grow">{c.description}</p>
                </div>
              );
            })}
          </div>
          <p className="tiny muted" style={{ marginTop: 'var(--sp-5)' }}>
            {t('ver.statesNote')}
          </p>
        </div>
      </section>
    </div>
  );
}
