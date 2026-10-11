import {
  AlertCircle,
  Eye,
  EyeOff,
  Gauge,
  ListChecks,
  Loader2,
  Lock,
  LogIn,
  Mail,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';
import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useAuth } from '../api/auth';
import { ApiError } from '../api/client';
import styles from './Login.module.css';

const POINTS = [
  { icon: Gauge, text: 'Every transaction scored live against your rules' },
  { icon: ListChecks, text: 'A clear reason for every point of every score' },
  { icon: ScrollText, text: 'Analyst decisions and sign-ins kept on record' },
];

export default function Login() {
  const { login, notice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [badCredentials, setBadCredentials] = useState(false);
  const [busy, setBusy] = useState(false);
  const errorId = useId();
  const helpId = useId();
  const capsId = useId();

  const message = error ?? notice;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setBadCredentials(false);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
      setBadCredentials(err instanceof ApiError && err.status === 401);
      setBusy(false);
    }
  }

  const trackCapsLock = (event: KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(event.getModifierState('CapsLock'));

  return (
    <div className={styles.screen}>
      <aside className={styles.brandPanel}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <ShieldCheck size={20} strokeWidth={2.25} />
          </span>
          <span className={styles.brandName}>Sentinel</span>
        </div>
        <div className={styles.pitch}>
          <p className={styles.tagline}>Catch fraud before it costs you.</p>
          <ul className={styles.points}>
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text}>
                <Icon size={18} aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className={styles.brandFoot}>Fraud risk analysis</p>
      </aside>

      <main id="main" className={styles.formPanel}>
        <form className={styles.form} onSubmit={onSubmit}>
          <header>
            <h1 className={styles.title}>Welcome back</h1>
            <p className={styles.subtitle}>Sign in to your Sentinel account.</p>
          </header>

          {message && (
            <div id={errorId} className={styles.alert} role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <span>{message}</span>
            </div>
          )}

          <div className={styles.field}>
            <label htmlFor={`${errorId}-email`}>Email</label>
            <div className={styles.inputWrap}>
              <Mail size={17} aria-hidden="true" className={styles.inputIcon} />
              <input
                id={`${errorId}-email`}
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                required
                autoFocus
                value={email}
                aria-invalid={badCredentials || undefined}
                aria-describedby={message ? errorId : undefined}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label htmlFor={`${errorId}-password`}>Password</label>
              <button
                type="button"
                className={styles.linkButton}
                aria-expanded={showHelp}
                aria-controls={helpId}
                onClick={() => setShowHelp((open) => !open)}
              >
                Forgot password?
              </button>
            </div>
            <div className={styles.inputWrap}>
              <Lock size={17} aria-hidden="true" className={styles.inputIcon} />
              <input
                id={`${errorId}-password`}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Your password"
                required
                value={password}
                aria-invalid={badCredentials || undefined}
                aria-describedby={
                  [message ? errorId : '', capsLock ? capsId : ''].filter(Boolean).join(' ') ||
                  undefined
                }
                onChange={(e) => setPassword(e.target.value)}
                onKeyUp={trackCapsLock}
                onKeyDown={trackCapsLock}
              />
              <button
                type="button"
                className={styles.reveal}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((shown) => !shown)}
              >
                {showPassword ? (
                  <EyeOff size={17} aria-hidden="true" />
                ) : (
                  <Eye size={17} aria-hidden="true" />
                )}
              </button>
            </div>
            {capsLock && (
              <p id={capsId} className={styles.hint}>
                Caps Lock is on.
              </p>
            )}
            <p id={helpId} className={styles.help} hidden={!showHelp}>
              Sentinel does not send reset emails. Ask your Sentinel administrator to set a new
              password for you.
            </p>
          </div>

          <button type="submit" className={styles.submit} disabled={busy}>
            {busy ? (
              <Loader2 size={17} aria-hidden="true" className={styles.spin} />
            ) : (
              <LogIn size={17} aria-hidden="true" />
            )}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className={styles.footnote}>
            For authorised users only. Sign-ins, including failed ones, are recorded.
          </p>
        </form>
      </main>
    </div>
  );
}
