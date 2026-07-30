import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import { Menu, Sun, Moon } from 'lucide-react';
import Sidebar, { NAV } from './components/Sidebar';
import OncLogo from './components/OncLogo';
import Dashboard from './pages/Dashboard';
import Recent from './pages/Recent';
import WhatsAppInbox from './pages/WhatsAppInbox';
import Approvals from './pages/Approvals';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Spinner from './components/ui/Spinner';
import { useAuth } from './lib/AuthContext';
import { useTheme } from './lib/ThemeContext';
import { fetchCurrentUser, fetchOrganizations, fetchWorkspaces } from './services/api';
import { Settings as SettingsIcon } from 'lucide-react';

const MOBILE_BP = 768;

// ── Authenticated shell ────────────────────────────────────────────────────────

const AppShell = () => {
  const { user, setUser, logout } = useAuth();
  const { isDark, toggle }        = useTheme();
  const [organizations, setOrganizations] = useState([]);
  const [workspaces, setWorkspaces]       = useState([]);
  const [selectedOrg, setSelectedOrg]     = useState(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [isMobile, setIsMobile]     = useState(window.innerWidth < MOBILE_BP);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate  = useNavigate();
  const location  = useLocation();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BP);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    Promise.all([fetchCurrentUser(), fetchOrganizations()])
      .then(([u, orgs]) => {
        setUser(u);
        setOrganizations(orgs);
        if (orgs.length) setSelectedOrg(orgs[0].id);
      })
      .catch(() => {
        // JWT rejected — AuthContext interceptor handles redirect to /login
      })
      .finally(() => setLoading(false));
  }, [setUser]);

  useEffect(() => {
    if (!selectedOrg) { setWorkspaces([]); setSelectedWorkspace(null); return; }
    fetchWorkspaces(selectedOrg).then(ws => {
      setWorkspaces(ws);
      const first = ws.find(w => w.id !== 'ws_inbox');
      if (first && !selectedWorkspace) setSelectedWorkspace(first.id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg]);

  // ── Org CRUD callbacks ──────────────────────────────────────────────────────
  const handleOrgCreated = useCallback((org) => {
    setOrganizations(prev => [...prev, org]);
    setSelectedOrg(org.id);
    setWorkspaces([]);
    setSelectedWorkspace(null);
  }, []);

  const handleOrgDeleted = useCallback((orgId) => {
    setOrganizations(prev => {
      const remaining = prev.filter(o => o.id !== orgId);
      if (selectedOrg === orgId) {
        const next = remaining[0] ?? null;
        setSelectedOrg(next?.id ?? null);
        if (!next) { setWorkspaces([]); setSelectedWorkspace(null); }
      }
      return remaining;
    });
  }, [selectedOrg]);

  const handleOrgRenamed = useCallback((orgId, name) => {
    setOrganizations(prev => prev.map(o => o.id === orgId ? { ...o, name } : o));
  }, []);

  // ── Workspace CRUD callbacks ────────────────────────────────────────────────
  const handleWorkspaceCreated = useCallback((ws) => {
    setWorkspaces(prev => [...prev, ws]);
    setSelectedWorkspace(ws.id);
  }, []);

  const handleWorkspaceDeleted = useCallback((wsId) => {
    setWorkspaces(prev => {
      const remaining = prev.filter(w => w.id !== wsId);
      if (selectedWorkspace === wsId) {
        const next = remaining.find(w => w.id !== 'ws_inbox') ?? null;
        setSelectedWorkspace(next?.id ?? null);
      }
      return remaining;
    });
  }, [selectedWorkspace]);

  const handleWorkspaceRenamed = useCallback((wsId, name) => {
    setWorkspaces(prev => prev.map(w => w.id === wsId ? { ...w, name } : w));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--c-bg)' }}>
        <OncLogo size={52} />
        <Spinner />
      </div>
    );
  }

  const mobileNavItems = [...NAV, { path: '/settings', icon: SettingsIcon, label: 'Settings' }];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* ── Mobile top bar ────────────────────────────────────────── */}
      {isMobile && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 56, zIndex: 100,
          background: 'var(--c-sidebar)', borderBottom: '1px solid var(--c-border)',
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
        }}>
          <button onClick={() => setSidebarOpen(true)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 9, border: 'none',
              background: 'var(--c-surface2)', color: 'var(--c-text)', cursor: 'pointer', flexShrink: 0 }}>
            <Menu size={18} />
          </button>
          <OncLogo size={30} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', lineHeight: 1 }}>DocuVault</p>
            <p style={{ fontSize: 10, color: 'var(--c-text2)' }}>Onction Energy</p>
          </div>
          <button onClick={toggle}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 9, border: 'none',
              background: 'var(--c-surface2)', color: 'var(--c-text2)', cursor: 'pointer', flexShrink: 0 }}>
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {user && (
            <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              {user.name?.charAt(0)?.toUpperCase()}
            </div>
          )}
        </div>
      )}

      {/* ── Sidebar (desktop = sticky column; mobile = overlay drawer) */}
      <Sidebar
        currentUser={user}
        organizations={organizations}
        workspaces={workspaces}
        selectedOrg={selectedOrg}
        selectedWorkspace={selectedWorkspace}
        onSelectOrg={(id) => { setSelectedOrg(id); setSelectedWorkspace(null); }}
        onSelectWorkspace={setSelectedWorkspace}
        onOrgCreated={handleOrgCreated}
        onOrgDeleted={handleOrgDeleted}
        onOrgRenamed={handleOrgRenamed}
        onWorkspaceCreated={handleWorkspaceCreated}
        onWorkspaceDeleted={handleWorkspaceDeleted}
        onWorkspaceRenamed={handleWorkspaceRenamed}
        onLogout={logout}
        isMobile={isMobile}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* ── Page content ─────────────────────────────────────────── */}
      <main className="flex-1 min-w-0" style={{
        paddingTop:    isMobile ? 56  : 0,
        paddingBottom: isMobile ? 60  : 0,
      }}>
        <Routes>
          <Route path="/"           element={<Dashboard selectedWorkspace={selectedWorkspace} currentUser={user} />} />
          <Route path="/inbox"      element={<WhatsAppInbox currentUser={user} />} />
          <Route path="/recent"     element={<Recent selectedWorkspace={selectedWorkspace} currentUser={user} />} />
          <Route path="/approvals"  element={<Approvals currentUser={user} />} />
          <Route path="/settings"   element={<Settings currentUser={user} />} />
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* ── Mobile bottom navigation bar ─────────────────────────── */}
      {isMobile && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, height: 60, zIndex: 100,
          background: 'var(--c-sidebar)', borderTop: '1px solid var(--c-border)',
          display: 'flex', alignItems: 'center',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          {mobileNavItems.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <Link key={path} to={path}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 3, textDecoration: 'none', padding: '6px 0',
                  color: active ? 'var(--c-accent-txt)' : 'var(--c-text2)',
                }}>
                <Icon size={20} />
                <span style={{ fontSize: 9, fontWeight: active ? 600 : 400, lineHeight: 1 }}>
                  {label === 'WhatsApp Inbox' ? 'Inbox' : label}
                </span>
              </Link>
            );
          })}
        </nav>
      )}

    </div>
  );
};

// ── Root — handles auth gating before router even renders shell ────────────────

const AuthGate = () => {
  const { token, logout } = useAuth();
  // Only validate on mount if a stored token exists; skip entirely if no token.
  const [checking, setChecking] = useState(!!token);

  useEffect(() => {
    if (!token) { setChecking(false); return; }
    setChecking(true);
    fetchCurrentUser()
      .catch(() => logout()) // expired / invalid token — clear it so we redirect
      .finally(() => setChecking(false));
  }, [token, logout]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--c-bg)' }}>
        <Spinner />
      </div>
    );
  }

  // token is the single source of truth — no separate authed state that can go stale
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {token
        ? <Route path="/*" element={<AppShell />} />
        : <Route path="/*" element={<Navigate to="/login" replace />} />
      }
    </Routes>
  );
};

const App = () => (
  <Router>
    <AuthGate />
  </Router>
);

export default App;
