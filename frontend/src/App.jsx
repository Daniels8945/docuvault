import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Recent from './pages/Recent';
import WhatsAppInbox from './pages/WhatsAppInbox';
import Approvals from './pages/Approvals';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Spinner from './components/ui/Spinner';
import { useAuth } from './lib/AuthContext';
import { fetchCurrentUser, fetchOrganizations, fetchWorkspaces } from './services/api';

const VaultLogo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 9v-2M12 17v-2M9 12H7M17 12h-2"/>
  </svg>
);

// ── Authenticated shell ────────────────────────────────────────────────────────

const AppShell = () => {
  const { user, setUser, logout } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [workspaces, setWorkspaces]       = useState([]);
  const [selectedOrg, setSelectedOrg]     = useState(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--c-accent-bg)', color: 'var(--c-accent-txt)' }}>
            <VaultLogo />
          </div>
          <span className="text-base font-bold" style={{ color: 'var(--c-text)' }}>DocuVault</span>
        </div>
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex" style={{ minHeight: '100vh' }}>
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
      />
      <main className="flex-1 min-w-0">
        <Routes>
          <Route path="/"           element={<Dashboard selectedWorkspace={selectedWorkspace} currentUser={user} />} />
          <Route path="/inbox"      element={<WhatsAppInbox currentUser={user} />} />
          <Route path="/recent"     element={<Recent selectedWorkspace={selectedWorkspace} currentUser={user} />} />
          <Route path="/approvals"  element={<Approvals currentUser={user} />} />
          <Route path="/settings"   element={<Settings currentUser={user} />} />
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
      </main>
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
