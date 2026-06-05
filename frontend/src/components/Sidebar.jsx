import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, Clock, MessageCircle, Settings, ChevronDown, FolderOpen } from 'lucide-react';

const NAV = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/inbox', icon: MessageCircle, label: 'WhatsApp Inbox' },
  { path: '/approvals', icon: CheckSquare, label: 'Approvals' },
  { path: '/recent', icon: Clock, label: 'Recent' },
];

const Sidebar = ({ currentUser, organizations, workspaces, selectedOrg, selectedWorkspace, onSelectOrg, onSelectWorkspace }) => {
  const location = useLocation();
  const [orgOpen, setOrgOpen] = useState(false);

  const currentOrg = organizations.find(o => o.id === selectedOrg);
  const orgWorkspaces = workspaces.filter(w => w.organization_id === selectedOrg);

  return (
    <aside className="w-72 glass-card m-3 mr-0 p-5 flex flex-col flex-shrink-0">
      {/* Brand */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold gradient-text">DocuVault</h1>
        <p className="text-xs text-gray-500 mt-0.5">Document Management</p>
      </div>

      {/* Org selector */}
      <div className="mb-5 relative">
        <button
          onClick={() => setOrgOpen(o => !o)}
          className="w-full glass-card p-3 rounded-xl flex items-center justify-between hover:bg-slate-700/70 transition"
        >
          <div className="text-left min-w-0">
            <p className="text-xs text-gray-500 mb-0.5">Organization</p>
            <p className="font-semibold text-sm truncate">{currentOrg?.name || 'Select…'}</p>
          </div>
          <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${orgOpen ? 'rotate-180' : ''}`} />
        </button>

        {orgOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 glass-card p-1.5 rounded-xl z-20 shadow-xl">
            {organizations.map(org => (
              <button
                key={org.id}
                onClick={() => { onSelectOrg(org.id); setOrgOpen(false); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition hover:bg-blue-500/10 ${selectedOrg === org.id ? 'text-blue-400' : ''}`}
              >
                {org.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Workspaces */}
      {orgWorkspaces.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Workspaces</p>
          <div className="space-y-1">
            {orgWorkspaces.map(ws => (
              <button
                key={ws.id}
                onClick={() => onSelectWorkspace(ws.id)}
                className={`sidebar-item w-full text-left px-3 py-2.5 flex items-center gap-2.5 ${selectedWorkspace === ws.id ? 'active' : ''}`}
              >
                <FolderOpen className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span className="text-sm truncate">{ws.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="space-y-1 flex-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Navigation</p>
        {NAV.map(({ path, icon: Icon, label }) => (
          <Link
            key={path}
            to={path}
            className={`sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg ${location.pathname === path ? 'active' : ''}`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{label}</span>
          </Link>
        ))}
      </nav>

      {/* Settings at bottom */}
      <Link
        to="/settings"
        className={`sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg mt-2 ${location.pathname === '/settings' ? 'active' : ''}`}
      >
        <Settings className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm">Settings</span>
      </Link>

      {/* User */}
      {currentUser && (
        <div className="glass-card p-3 rounded-xl mt-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
            {currentUser.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{currentUser.name}</p>
            <p className="text-xs text-gray-400 capitalize">{currentUser.role}</p>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
