import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Approvals from './pages/Approvals';
import Recent from './pages/Recent';
import WhatsAppInbox from './pages/WhatsAppInbox';
import Settings from './pages/Settings';
import Spinner from './components/ui/Spinner';
import { fetchCurrentUser, fetchOrganizations, fetchWorkspaces } from './services/api';

const App = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);

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
    if (!selectedOrg) return;
    fetchWorkspaces(selectedOrg).then(ws => {
      setWorkspaces(ws);
      const first = ws.find(w => w.id !== 'ws_inbox');
      if (first) setSelectedWorkspace(first.id);
    });
  }, [selectedOrg]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold gradient-text mb-4">DocuVault</div>
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen flex">
        <Sidebar
          currentUser={currentUser}
          organizations={organizations}
          workspaces={workspaces}
          selectedOrg={selectedOrg}
          selectedWorkspace={selectedWorkspace}
          onSelectOrg={setSelectedOrg}
          onSelectWorkspace={setSelectedWorkspace}
        />
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<Dashboard selectedWorkspace={selectedWorkspace} currentUser={currentUser} />} />
            <Route path="/inbox" element={<WhatsAppInbox currentUser={currentUser} />} />
            <Route path="/approvals" element={<Approvals currentUser={currentUser} />} />
            <Route path="/recent" element={<Recent selectedWorkspace={selectedWorkspace} currentUser={currentUser} />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
