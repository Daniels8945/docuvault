import React, { useState, useEffect, useCallback } from 'react';
import { Settings as SettingsIcon, Plus, Trash2, Building2, FolderOpen, MessageCircle } from 'lucide-react';
import {
  fetchOrganizations, createOrganization,
  fetchWorkspaces, createWorkspace, deleteWorkspace,
  fetchWhatsAppRules, deleteWhatsAppRule,
} from '../services/api';
import Spinner from '../components/ui/Spinner';

const TABS = [
  { id: 'orgs', label: 'Organizations', icon: Building2 },
  { id: 'workspaces', label: 'Workspaces', icon: FolderOpen },
  { id: 'whatsapp', label: 'WhatsApp Rules', icon: MessageCircle },
];

const InlineForm = ({ fields, onSave, onCancel, saving }) => {
  const [vals, setVals] = useState(() => Object.fromEntries(fields.map(f => [f.key, f.default || ''])));
  const set = (k, v) => setVals(p => ({ ...p, [k]: v }));
  const handleSubmit = (e) => { e.preventDefault(); onSave(vals); };

  return (
    <form onSubmit={handleSubmit} className="glass-card p-4 rounded-xl space-y-3">
      {fields.map(f => (
        <div key={f.key}>
          <label className="block text-xs font-medium text-gray-400 mb-1">{f.label}</label>
          {f.type === 'select' ? (
            <select value={vals[f.key]} onChange={e => set(f.key, e.target.value)} className="input-field w-full text-sm" required={f.required}>
              <option value="">Select…</option>
              {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input type="text" value={vals[f.key]} onChange={e => set(f.key, e.target.value)}
              placeholder={f.placeholder} className="input-field w-full text-sm" required={f.required} />
          )}
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving} className="btn-primary text-sm px-4 py-2 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary text-sm px-4 py-2">Cancel</button>
      </div>
    </form>
  );
};

const Settings = () => {
  const [tab, setTab] = useState('orgs');
  const [orgs, setOrgs] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, w, r] = await Promise.all([fetchOrganizations(), fetchWorkspaces(), fetchWhatsAppRules()]);
      setOrgs(o); setWorkspaces(w); setRules(r);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data) => {
    setSaving(true);
    try {
      if (tab === 'orgs') await createOrganization({ name: data.name, description: data.description });
      if (tab === 'workspaces') await createWorkspace({ name: data.name, organization_id: data.org_id, description: data.description });
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type, id) => {
    if (!confirm('Delete this item?')) return;
    if (type === 'workspace') await deleteWorkspace(id);
    if (type === 'rule') await deleteWhatsAppRule(id);
    load();
  };

  const formFields = {
    orgs: [
      { key: 'name', label: 'Name', placeholder: 'Organization name', required: true },
      { key: 'description', label: 'Description', placeholder: 'Brief description' },
    ],
    workspaces: [
      { key: 'name', label: 'Name', placeholder: 'Workspace name', required: true },
      { key: 'description', label: 'Description', placeholder: 'Brief description' },
      { key: 'org_id', label: 'Organization', type: 'select', required: true, options: orgs.map(o => ({ value: o.id, label: o.name })) },
    ],
  };

  const wsName = (id) => workspaces.find(w => w.id === id)?.name || id;
  const orgName = (id) => orgs.find(o => o.id === id)?.name || id;

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex items-center gap-3 mb-6 fade-in-up">
        <SettingsIcon className="w-7 h-7 text-gray-400" />
        <h2 className="text-3xl font-bold">Settings</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 glass-card p-1 rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setTab(id); setShowForm(false); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === id ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <div className="max-w-2xl space-y-4">
          {/* Add button */}
          {tab !== 'whatsapp' && !showForm && (
            <button onClick={() => setShowForm(true)} className="btn-secondary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> Add {tab === 'orgs' ? 'Organization' : 'Workspace'}
            </button>
          )}

          {showForm && tab !== 'whatsapp' && (
            <InlineForm
              fields={formFields[tab]}
              onSave={handleSave}
              onCancel={() => setShowForm(false)}
              saving={saving}
            />
          )}

          {/* Organizations list */}
          {tab === 'orgs' && (
            <div className="glass-card rounded-xl overflow-hidden">
              {orgs.length === 0 ? <p className="text-gray-500 text-sm p-5">No organizations</p> : orgs.map((org, i) => (
                <div key={org.id} className={`flex items-center gap-4 px-5 py-4 ${i < orgs.length - 1 ? 'border-b border-white/5' : ''}`}>
                  <Building2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{org.name}</p>
                    {org.description && <p className="text-xs text-gray-500 mt-0.5">{org.description}</p>}
                  </div>
                  <span className="text-xs text-gray-500">{workspaces.filter(w => w.organization_id === org.id).length} workspaces</span>
                </div>
              ))}
            </div>
          )}

          {/* Workspaces list */}
          {tab === 'workspaces' && (
            <div className="glass-card rounded-xl overflow-hidden">
              {workspaces.length === 0 ? <p className="text-gray-500 text-sm p-5">No workspaces</p> : workspaces.map((ws, i) => (
                <div key={ws.id} className={`flex items-center gap-4 px-5 py-4 ${i < workspaces.length - 1 ? 'border-b border-white/5' : ''}`}>
                  <FolderOpen className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{ws.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{orgName(ws.organization_id)}</p>
                  </div>
                  <button onClick={() => handleDelete('workspace', ws.id)} className="text-gray-500 hover:text-red-400 transition p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* WhatsApp rules */}
          {tab === 'whatsapp' && (
            <div className="glass-card rounded-xl overflow-hidden">
              {rules.length === 0 ? (
                <p className="text-gray-500 text-sm p-5">No routing rules. Add them from the WhatsApp Inbox page.</p>
              ) : rules.map((rule, i) => (
                <div key={rule.id} className={`flex items-center gap-4 px-5 py-4 ${i < rules.length - 1 ? 'border-b border-white/5' : ''}`}>
                  <MessageCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{rule.group_name}</p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{rule.group_jid}</p>
                  </div>
                  <span className="text-xs text-blue-300">{wsName(rule.workspace_id)}</span>
                  <button onClick={() => handleDelete('rule', rule.id)} className="text-gray-500 hover:text-red-400 transition p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Settings;
