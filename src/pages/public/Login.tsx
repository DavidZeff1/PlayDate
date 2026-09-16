import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services';
import { useApp } from '../../state/AppContext';
import { Alert, Field, PrototypeNote } from '../../components/ui';
import { Logo } from '../../components/layout/Logo';
import { IconEye, IconEyeOff, IconLock } from '../../components/ui/Icons';

export function Login() {
  const navigate = useNavigate();
  const { setSession } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { session } = await api.signIn(email, password);
      setSession(session);
      navigate('/app');
    } catch (err) {
      // The API returns one message for every credential failure — see mockApi.signIn.
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  const demo = async () => {
    setBusy(true);
    const { session } = await api.signInAsDemo();
    setSession(session);
    navigate('/app');
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ marginBottom: 'var(--sp-6)' }}>
          <Logo />
        </div>

        <h1 style={{ fontSize: 'var(--text-xl)' }}>Welcome back</h1>
        <p className="muted small" style={{ marginTop: 'var(--sp-2)', marginBottom: 'var(--sp-6)' }}>
          Sign in to your family account.
        </p>

        <form onSubmit={submit} className="stack stack-5">
          <Field label="Email address" htmlFor="login-email">
            <input
              id="login-email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </Field>

          <Field label="Password" htmlFor="login-password">
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                className="input"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingRight: '2.75rem' }}
                required
              />
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
              >
                {show ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            </div>
          </Field>

          {error && <Alert tone="danger">{error}</Alert>}

          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="row row-3" style={{ margin: 'var(--sp-6) 0' }}>
          <hr className="divider grow" style={{ margin: 0 }} />
          <span className="tiny muted">or</span>
          <hr className="divider grow" style={{ margin: 0 }} />
        </div>

        <button className="btn btn-secondary btn-block" onClick={demo} disabled={busy}>
          Explore as the Cohen family
        </button>

        <p className="small muted center" style={{ marginTop: 'var(--sp-6)' }}>
          New here? <Link to="/signup">Create a family account</Link>
        </p>

        <div style={{ marginTop: 'var(--sp-6)' }}>
          <PrototypeNote>
            No real accounts exist. Use “Explore as the Cohen family” to sign in to the
            seeded demo family with matches, requests and a confirmed playdate already set up.
          </PrototypeNote>
        </div>

        <div
          className="row row-3 tiny muted"
          style={{ marginTop: 'var(--sp-5)', justifyContent: 'center' }}
        >
          <IconLock size={12} />
          <span>Sign-in attempts are rate-limited to slow credential stuffing.</span>
        </div>
      </div>
    </div>
  );
}
