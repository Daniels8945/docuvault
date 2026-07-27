import React, { useState, useEffect, useCallback } from 'react';
import { Settings as SettingsIcon, Plus, Trash2, Building2, FolderOpen, MessageCircle, X } from 'lucide-react';
import {
  fetchOrganizations, createOrganization,
  fetchWorkspaces, createWorkspace, deleteWorkspace,
  fetchWhatsAppRules, deleteWhatsAppRule,
} from '../services/api';
import Spinner from '../components/ui/Spinner';

const TABS = [
  { id: 'orgs',       label: 'Organizations', icon: Building2     },
  { id: 'workspaces', label: 'Workspaces',    icon: FolderOpen    },
  { id: 'whatsapp',   label: 'Routing Rules', icon: MessageCircle },
];

const Settings = () => {
  const [tab, setTab] = useState('orgs');
  const [orgs, setOrgs] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, w, r] = await Promise.all([fetchOrganizations(), fetchWorkspaces(), fetchWhatsAppRules()]);
      setOrgs(o); setWorkspaces(w); setRules(r);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { document.title = 'Settings | DocuVault'; }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (tab === 'orgs') await createOrganization({ name: formData.name, description: formData.description });
      if (tab === 'workspaces') await createWorkspace({ name: formData.name, organization_id: formData.org_id, description: formData.description });
      setShowForm(false);
      setFormData({});
      load();
    } finally { setSaving(false); }
  };

  const handleDelete = async (type, id) => {
    if (!confirm('Delete this item?')) return;
    if (type === 'workspace') await deleteWorkspace(id);
    if (type === 'rule') await deleteWhatsAppRule(id);
    load();
  };

  const wsName = (id) => workspaces.find(w => w.id === id)?.name || id;
  const orgName = (id) => orgs.find(o => o.id === id)?.name || id;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="px-8 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--c-border)' }}>
        <div className="flex items-center gap-3">
          <SettingsIcon className="w-5 h-5" style={{ color: 'var(--c-text2)' }} />
          <h2 className="text-lg font-bold" style={{ color: 'var(--c-text)' }}>Settings</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit"
          style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setTab(id); setShowForm(false); setFormData({}); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all"
              style={tab === id
                ? { background: 'var(--c-accent-bg)', color: 'var(--c-accent-txt)', border: '1px solid var(--c-border2)' }
                : { color: 'var(--c-text2)' }}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {loading ? <Spinner /> : (
          <div className="max-w-xl space-y-4 fade-in-up">
            {tab !== 'whatsapp' && !showForm && (
              <button onClick={() => { setShowForm(true); setFormData({}); }} className="btn-secondary text-xs">
                <Plus className="w-3.5 h-3.5" />
                Add {tab === 'orgs' ? 'Organization' : 'Workspace'}
              </button>
            )}

            {showForm && (
              <div className="rounded-xl p-5 space-y-4"
                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-accent-bg)' }}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>
                    New {tab === 'orgs' ? 'Organization' : 'Workspace'}
                  </p>
                  <button onClick={() => setShowForm(false)} style={{ color: 'var(--c-text2)' }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {[
                  { key: 'name', label: 'Name', placeholder: 'Enter name', required: true },
                  { key: 'description', label: 'Description (optional)', placeholder: 'Brief description' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--c-text2)' }}>{f.label}</label>
                    <input value={formData[f.key] || ''} onChange={e => setFormData(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder} className="input-field w-full" />
                  </div>
                ))}
                {tab === 'workspaces' && (
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--c-text2)' }}>Organization</label>
                    <select value={formData.org_id || ''} onChange={e => setFormData(p => ({ ...p, org_id: e.target.value }))}
                      className="input-field w-full">
                      <option value="">Select…</option>
                      {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={handleSave} disabled={!formData.name?.trim() || saving} className="btn-primary text-xs disabled:opacity-40">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setShowForm(false)} className="btn-secondary text-xs">Cancel</button>
                </div>
              </div>
            )}

            {/* Organizations list */}
            {tab === 'orgs' && (
              <div className="rounded-xl overflow-hidden"
                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
                {orgs.length === 0 ? (
                  <p className="text-xs p-5" style={{ color: 'var(--c-text2)' }}>No organizations yet.</p>
                ) : orgs.map((org, i) => (
                  <div key={org.id} className="flex items-center gap-4 px-5 py-4"
                    style={i < orgs.length - 1 ? { borderBottom: '1px solid var(--c-border)' } : {}}>
                    <Building2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-accent-txt)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>{org.name}</p>
                      {org.description && <p className="text-xs mt-0.5" style={{ color: 'var(--c-text2)' }}>{org.description}</p>}
                    </div>
                    <span className="text-xs" style={{ color: 'var(--c-text2)' }}>
                      {workspaces.filter(w => w.organization_id === org.id).length} workspaces
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Workspaces list */}
            {tab === 'workspaces' && (
              <div className="rounded-xl overflow-hidden"
                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
                {workspaces.filter(w => w.id !== 'ws_inbox').length === 0 ? (
                  <p className="text-xs p-5" style={{ color: 'var(--c-text2)' }}>No workspaces yet.</p>
                ) : workspaces.filter(w => w.id !== 'ws_inbox').map((ws, i, arr) => (
                  <div key={ws.id} className="flex items-center gap-4 px-5 py-4"
                    style={i < arr.length - 1 ? { borderBottom: '1px solid var(--c-border)' } : {}}>
                    <FolderOpen className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-accent-txt)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>{ws.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--c-text2)' }}>{orgName(ws.organization_id)}</p>
                    </div>
                    <button onClick={() => handleDelete('workspace', ws.id)}
                      className="p-1 transition-colors" style={{ color: 'var(--c-text2)' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--c-danger)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text2)'}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* WhatsApp rules */}
            {tab === 'whatsapp' && (
              rules.length === 0 ? (
                <div className="rounded-xl p-5" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
                  <p className="text-xs" style={{ color: 'var(--c-text2)' }}>No routing rules. Add them from the WhatsApp Inbox page.</p>
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden"
                  style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
                  {rules.map((rule, i) => (
                    <div key={rule.id} className="flex items-center gap-4 px-5 py-4"
                      style={i < rules.length - 1 ? { borderBottom: '1px solid var(--c-border)' } : {}}>
                      <MessageCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-success)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>{rule.group_name}</p>
                        <p className="text-xs font-mono mt-0.5 truncate" style={{ color: 'var(--c-text2)' }}>{rule.group_jid}</p>
                      </div>
                      <span className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--c-accent-txt)' }}>
                        {wsName(rule.workspace_id)}
                      </span>
                      <button onClick={() => handleDelete('rule', rule.id)}
                        className="p-1 transition-colors" style={{ color: 'var(--c-text2)' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--c-danger)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text2)'}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
