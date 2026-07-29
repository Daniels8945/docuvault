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

const Login = ({ onNeedsSetup }) => {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [mode, setMode]   = useState('login'); // 'login' | 'setup'
  const [form, setForm]   = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Check if initial setup is needed (no admin exists yet)
  useEffect(() => {
    fetchSetupStatus().then(({ setup_complete }) => {
      if (!setup_complete) setMode('setup');
    }).catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let token, user;
      if (mode === 'setup') {
        user = await registerFirstAdmin({ name: form.name, email: form.email, password: form.password });
        const res = await loginUser(form.email, form.password);
        token = res.access_token;
        user  = res.user;
      } else {
        const res = await loginUser(form.email, form.password);
        token = res.access_token;
        user  = res.user;
      }
      login(token, user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.detail || 'Login failed — check your credentials.');
    } finally {
      setLoading(false);
    }
  };

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
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 52, height: 52,
            borderRadius: 14,
            background: 'var(--c-accent-bg)',
            color: 'var(--c-accent-txt)',
            marginBottom: 14,
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
                  placeholder="Olaoluwa Adesanya"
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
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'var(--c-accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '11px 0',
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                marginTop: 4,
              }}
            >
              {loading
                ? (mode === 'setup' ? 'Creating account…' : 'Signing in…')
                : (mode === 'setup' ? 'Create Admin Account' : 'Sign In')}
            </button>

          </form>
        </div>

        {mode === 'setup' && (
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--c-text2)', marginTop: 16 }}>
            This account will be the system administrator.<br />
            Additional users can be created from Settings.
          </p>
        )}

      </div>
    </div>
  );
};

export default Login;
