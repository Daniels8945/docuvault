import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Recent from './pages/Recent';
import WhatsAppInbox from './pages/WhatsAppInbox';
import Settings from './pages/Settings';
import Spinner from './components/ui/Spinner';
import { fetchCurrentUser, fetchOrganizations, fetchWorkspaces } from './services/api';

const VaultLogo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 9v-2M12 17v-2M9 12H7M17 12h-2"/>
  </svg>
);

const App = () => {
  const [currentUser, setCurrentUser]     = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [workspaces, setWorkspaces]       = useState([]);
  const [selectedOrg, setSelectedOrg]     = useState(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    Promise.all([fetchCurrentUser(), fetchOrganizations()])
      .then(([user, orgs]) => {
        setCurrentUser(user);
        setOrganizations(orgs);
        if (orgs.length) setSelectedOrg(orgs[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedOrg) { setWorkspaces([]); setSelectedWorkspace(null); return; }
    fetchWorkspaces(selectedOrg).then(ws => {
      setWorkspaces(ws);
      const first = ws.find(w => w.id !== 'ws_inbox');
      if (first && !selectedWorkspace) setSelectedWorkspace(first.id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg]);

  // ── Org CRUD callbacks ────────────────────────────────────────────────────
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

  // ── Workspace CRUD callbacks ──────────────────────────────────────────────
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
    <Router>
      <div className="flex" style={{ minHeight: '100vh' }}>
        <Sidebar
          currentUser={currentUser}
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
        />
        <main className="flex-1 min-w-0">
          <Routes>
            <Route path="/"         element={<Dashboard selectedWorkspace={selectedWorkspace} currentUser={currentUser} />} />
            <Route path="/inbox"    element={<WhatsAppInbox currentUser={currentUser} />} />
            <Route path="/recent"   element={<Recent selectedWorkspace={selectedWorkspace} currentUser={currentUser} />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
