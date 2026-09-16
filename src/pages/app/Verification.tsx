import { useCallback, useEffect, useState } from 'react';
import { api, type VerificationState } from '../../services';
import { useApp } from '../../state/AppContext';
import { VERIFICATION_COPY } from '../../domain/trust/signals';
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

  const load = useCallback(async () => {
    setState(await api.getVerificationState());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!state) return <LoadingBlock />;

  const copy = VERIFICATION_COPY[state.identityStatus];

  const run = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      await refresh();
      if (success) toast.push(success, 'ok');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack stack-6">
      <div className="page-head">
        <h1>Verification</h1>
        <p>
          Verification is what keeps PlayDate to real, identifiable parents. Until it is
          complete, you cannot browse families or send requests — and the same rule protects
          your family from anyone who has not completed it.
        </p>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {/* ---- Identity ---------------------------------------------------- */}
      <section className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="row row-2">
              <IconShieldCheck size={16} />
              Identity verification
            </span>
          </span>
          <Badge
            tone={
              copy.tone === 'ok' ? 'ok' : copy.tone === 'pending' ? 'pending' : copy.tone === 'warn' ? 'warn' : 'neutral'
            }
          >
            {state.isMockProvider && state.identityStatus === 'verified'
              ? 'Simulated — verified'
              : copy.label}
          </Badge>
        </div>

        <div className="card-body stack stack-5">
          <p className="muted">{copy.description}</p>

          {state.isMockProvider && (
            <PrototypeNote>
              No identity provider is connected to this build. Anything below marked{' '}
              <em>simulated</em> is a demonstration of the workflow, not a real identity check.
              A verified badge produced here means nothing about any real person.
            </PrototypeNote>
          )}

          {state.identityStatus === 'unstarted' || state.identityStatus === 'required' || state.identityStatus === 'failed' ? (
            <>
              {state.failureReason && (
                <Alert tone="warn" title="Last attempt could not be completed">
                  {state.failureReason}
                </Alert>
              )}

              <Alert tone="brand" title="Where your ID goes">
                In production your document goes directly to the identity provider — Persona,
                Stripe Identity, Veriff or similar. PlayDate never receives or stores the
                image. We keep a decision and an opaque reference, nothing more.
              </Alert>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 'var(--sp-4)',
                }}
              >
                <Field label="Legal first name" htmlFor="v-lf">
                  <input id="v-lf" className="input" value={legalFirst} onChange={(e) => setLegalFirst(e.target.value)} />
                </Field>
                <Field label="Legal last name" htmlFor="v-ll">
                  <input id="v-ll" className="input" value={legalLast} onChange={(e) => setLegalLast(e.target.value)} />
                </Field>
                <Field label="Date of birth" htmlFor="v-dob">
                  <input id="v-dob" className="input" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                </Field>
              </div>

              <div className="panel small muted row row-3" style={{ alignItems: 'flex-start' }}>
                <IconLock size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>
                  Stored separately from your family profile. Never shown to another family at
                  any privacy setting, and readable by our staff only under an open safety case
                  — a read which is itself logged.
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
                    'Verification started.',
                  )
                }
              >
                {busy ? 'Starting…' : 'Start verification'}
              </button>
            </>
          ) : state.identityStatus === 'pending' ? (
            <>
              <Alert tone="info" title="Verification in progress">
                In production you would be handed to the provider to photograph your ID and take
                a selfie, and the decision would arrive by webhook — usually within a minute.
              </Alert>
              <div className="card card-pad stack stack-4" style={{ background: 'var(--warn-50)', borderColor: 'var(--warn-100)' }}>
                <div className="strong small" style={{ color: 'var(--warn-700)' }}>
                  Demo controls — these simulate a provider response
                </div>
                <div className="row row-3 row-wrap">
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() => run(() => api.resolveMockVerification('verified'), 'Simulated verification complete.')}
                  >
                    <IconCheck size={14} />
                    Simulate a pass
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => run(() => api.resolveMockVerification('failed'), 'Simulated verification failed.')}
                  >
                    <IconX size={14} />
                    Simulate a failure
                  </button>
                </div>
              </div>
            </>
          ) : (
            <Alert tone="ok" title={state.isMockProvider ? 'Simulated verification complete' : 'Verification complete'}>
              Discovery is open. Other families see “Parent verified” on your family profile —
              never your legal name or date of birth.
              {state.identityUpdatedAt && (
                <div className="tiny" style={{ marginTop: 6, opacity: 0.85 }}>
                  Completed {new Date(state.identityUpdatedAt).toLocaleDateString('en-GB')}
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
            <span className="card-title">Email address</span>
            {state.emailVerified ? (
              <Badge tone="ok">
                <IconCheck size={10} /> Verified
              </Badge>
            ) : (
              <Badge tone="warn">Not verified</Badge>
            )}
          </div>
          <div className="card-body stack stack-4">
            {state.emailVerified ? (
              <p className="small muted">Your email address is confirmed.</p>
            ) : (
              <>
                <Field label="6-digit code" htmlFor="v-ecode">
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
                    Send code
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={busy || !emailCode}
                    onClick={() => run(() => api.confirmEmailCode(emailCode), 'Email verified.')}
                  >
                    Confirm
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <span className="card-title">Phone number</span>
            {state.phoneVerified ? (
              <Badge tone="ok">
                <IconCheck size={10} /> Verified
              </Badge>
            ) : (
              <Badge tone="warn">Not verified</Badge>
            )}
          </div>
          <div className="card-body stack stack-4">
            {state.phoneVerified ? (
              <p className="small muted">Your phone number is confirmed. It is never shown to other families.</p>
            ) : (
              <>
                <Field label="6-digit code" htmlFor="v-pcode">
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
                    Send code
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={busy || !phoneCode}
                    onClick={() => run(() => api.confirmPhoneCode(phoneCode), 'Phone verified.')}
                  >
                    Confirm
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
          <span className="card-title">What each state means</span>
        </div>
        <div className="card-body">
          <div className="stack stack-4">
            {(['verified', 'pending', 'failed', 'required'] as const).map((s) => {
              const c = VERIFICATION_COPY[s];
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
            These states are never collapsed into one another. A pending check is never shown
            as verified, and a verified badge always corresponds to a completed decision — in
            this prototype, a simulated one, labelled as such.
          </p>
        </div>
      </section>
    </div>
  );
}
