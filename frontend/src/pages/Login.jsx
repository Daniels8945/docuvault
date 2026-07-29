import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { loginUser, registerFirstAdmin, fetchSetupStatus } from '../services/api';

const VaultIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 9v-2M12 17v-2M9 12H7M17 12h-2"/>
  </svg>
);

// Flatten FastAPI validation errors (detail can be a string or array of objects)
const formatError = (err) => {
  const detail = err?.response?.data?.detail;
  if (!detail) return 'Request failed — check your connection and try again.';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(d => d.msg || JSON.stringify(d)).join('; ');
  return JSON.stringify(detail);
};

const Login = () => {
  const { login } = useAuth();
  const navigate   = useNavigate();

  // 'checking' while we probe setup status, then 'setup' or 'login'
  const [mode, setMode]       = useState('checking');
  const [form, setForm]       = useState({ name: '', email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSetupStatus()
      .then(({ setup_complete }) => setMode(setup_complete ? 'login' : 'setup'))
      .catch(() => setMode('login')); // endpoint missing or network error → show login
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'setup') {
        await registerFirstAdmin({ name: form.name, email: form.email, password: form.password });
      }
      const res   = await loginUser(form.email, form.password);
      login(res.access_token, res.user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'checking') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--c-bg)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--c-accent-bg)', color: 'var(--c-accent-txt)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <VaultIcon />
          </div>
          <p style={{ fontSize: 13, color: 'var(--c-text2)' }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--c-bg)',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 52, height: 52, borderRadius: 14,
            background: 'var(--c-accent-bg)', color: 'var(--c-accent-txt)', marginBottom: 14,
          }}>
            <VaultIcon />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--c-text)', marginBottom: 4 }}>
            DocuVault
          </h1>
          <p style={{ fontSize: 13, color: 'var(--c-text2)' }}>
            {mode === 'setup'
              ? 'First-time setup — create your admin account'
              : 'Sign in to your workspace'}
          </p>
        </div>

        {/* Card */}
        <div className="glass-card" style={{ borderRadius: 14, padding: 28 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {mode === 'setup' && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--c-text2)', marginBottom: 6 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="Your full name"
                  required
                  className="input-field"
                  style={{ width: '100%' }}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--c-text2)', marginBottom: 6 }}>
                Email Address
              </label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="you@onctionenergy.com"
                required
                className="input-field"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--c-text2)', marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                className="input-field"
                style={{ width: '100%' }}
              />
            </div>

            {error && (
              <div style={{
                background: 'var(--c-danger-bg)',
                border: '1px solid var(--c-danger)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
                color: 'var(--c-danger)',
                wordBreak: 'break-word',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'var(--c-accent)', color: '#fff', border: 'none',
                borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 4,
              }}
            >
              {loading
                ? (mode === 'setup' ? 'Creating account…' : 'Signing in…')
                : (mode === 'setup' ? 'Create Admin Account' : 'Sign In')}
            </button>

          </form>
        </div>

        {/* Mode toggle */}
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--c-text2)', marginTop: 16 }}>
          {mode === 'setup' ? (
            <>
              Already have an account?{' '}
              <button onClick={() => { setMode('login'); setError(''); }}
                style={{ color: 'var(--c-accent-txt)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Sign in instead
              </button>
            </>
          ) : (
            <>
              First time here?{' '}
              <button onClick={() => { setMode('setup'); setError(''); }}
                style={{ color: 'var(--c-accent-txt)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Set up admin account
              </button>
            </>
          )}
        </p>

        {mode === 'setup' && (
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--c-text2)', marginTop: 8 }}>
            This account will be the system administrator.
          </p>
        )}

      </div>
    </div>
  );
};

export default Login;
