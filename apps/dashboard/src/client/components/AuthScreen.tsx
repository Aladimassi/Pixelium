import { useState } from 'react';
import { BrandLogo } from './BrandLogo';

interface AuthScreenProps {
  onLogin: (email: string, password: string) => Promise<string | null>;
  onRegister: (displayName: string, email: string, password: string) => Promise<string | null>;
}

type AuthMode = 'login' | 'register';

const FEATURES = [
  { icon: '◈', title: 'Consent-first checkout', desc: 'Every purchase follows a signed mandate chain.' },
  { icon: '◎', title: 'AI shopping assistant', desc: 'Get advice, search, and buy in natural language.' },
  { icon: '⛨', title: 'Secure by design', desc: 'Broker validates intent before any payment runs.' },
];

export function AuthScreen({ onLogin, onRegister }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
  };

  const runLogin = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    const err = await onLogin(email, password);
    if (err) setError(err);
    setLoading(false);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runLogin(loginEmail.trim(), loginPassword);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const err = await onRegister(regName.trim(), regEmail.trim(), regPassword);
    if (err) setError(err);
    setLoading(false);
  };

  return (
    <div id="auth-screen" className="auth-screen">
      <div className="auth-layout">
        <aside className="auth-hero" aria-hidden="false">
          <div className="auth-hero__brand">
            <BrandLogo size="lg" subtitle="Consent Commerce" />
          </div>

          <h1 className="auth-hero__headline">
            Shop smarter with{' '}
            <span className="text-gradient">consent</span>
          </h1>
          <p className="auth-hero__lead">
            A modern storefront where AI helps you discover products and every checkout is backed by
            explicit, verifiable user consent.
          </p>

          <ul className="auth-features">
            {FEATURES.map((f) => (
              <li key={f.title} className="auth-feature">
                <span className="auth-feature__icon" aria-hidden="true">
                  {f.icon}
                </span>
                <div>
                  <strong>{f.title}</strong>
                  <p>{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <div className="auth-panel">
          <div className="auth-panel__card">
            <div className="auth-tabs" role="tablist" aria-label="Authentication">
              <button
                type="button"
                role="tab"
                id="auth-tab-login"
                aria-selected={mode === 'login'}
                aria-controls="auth-panel-login"
                className={`auth-tab${mode === 'login' ? ' auth-tab--active' : ''}`}
                onClick={() => switchMode('login')}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                id="auth-tab-register"
                aria-selected={mode === 'register'}
                aria-controls="auth-panel-register"
                className={`auth-tab${mode === 'register' ? ' auth-tab--active' : ''}`}
                onClick={() => switchMode('register')}
              >
                Create account
              </button>
            </div>

            {mode === 'login' ? (
              <div id="auth-panel-login" role="tabpanel" aria-labelledby="auth-tab-login" className="auth-form-wrap">
                <p className="auth-panel__eyebrow">Welcome back</p>
                <h2 className="auth-panel__title">Sign in to your store</h2>

                <form id="login-form" className="auth-form" onSubmit={handleLoginSubmit}>
                  <div className="auth-field">
                    <label htmlFor="login-email">Email</label>
                    <input
                      type="email"
                      id="login-email"
                      autoComplete="email"
                      required
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="auth-field">
                    <label htmlFor="login-password">Password</label>
                    <input
                      type="password"
                      id="login-password"
                      autoComplete="current-password"
                      required
                      placeholder="Enter your password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  {error && mode === 'login' ? (
                    <p id="login-error" className="form-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                  <button type="submit" className="btn-primary btn-full auth-submit" disabled={loading}>
                    {loading ? 'Signing in…' : 'Sign in →'}
                  </button>
                </form>
              </div>
            ) : (
              <div
                id="auth-panel-register"
                role="tabpanel"
                aria-labelledby="auth-tab-register"
                className="auth-form-wrap"
              >
                <p className="auth-panel__eyebrow">New here</p>
                <h2 className="auth-panel__title">Create your account</h2>
                <p className="auth-panel__sub">Join Pixulium to shop with AI and consent-aware checkout.</p>

                <form id="register-form" className="auth-form" onSubmit={handleRegisterSubmit}>
                  <div className="auth-field">
                    <label htmlFor="reg-name">Display name</label>
                    <input
                      type="text"
                      id="reg-name"
                      required
                      placeholder="How should we greet you?"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="auth-field">
                    <label htmlFor="reg-email">Email</label>
                    <input
                      type="email"
                      id="reg-email"
                      autoComplete="email"
                      required
                      placeholder="you@example.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="auth-field">
                    <label htmlFor="reg-password">Password</label>
                    <input
                      type="password"
                      id="reg-password"
                      autoComplete="new-password"
                      required
                      minLength={6}
                      placeholder="At least 6 characters"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  {error && mode === 'register' ? (
                    <p id="register-error" className="form-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                  <button type="submit" className="btn-primary btn-full auth-submit" disabled={loading}>
                    {loading ? 'Creating account…' : 'Create account →'}
                  </button>
                </form>

                <p className="auth-switch">
                  Already have an account?{' '}
                  <button type="button" className="auth-link" onClick={() => switchMode('login')}>
                    Sign in
                  </button>
                </p>
              </div>
            )}
          </div>

          <p className="auth-footer">
            Protected checkout · Mandate chain validation · Demo store
          </p>
        </div>
      </div>
    </div>
  );
}
