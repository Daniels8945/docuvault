import React, { useState, useEffect, useCallback } from 'react';
import { Settings as SettingsIcon, Plus, Trash2, Pencil, Key, Building2, FolderOpen, MessageCircle, Users, X, Eye, EyeOff } from 'lucide-react';
import {
  fetchOrganizations, createOrganization,
  fetchWorkspaces, createWorkspace, deleteWorkspace,
  fetchWhatsAppRules, deleteWhatsAppRule,
  fetchUsers, createUser, updateUser, resetUserPassword, deleteUser,
} from '../services/api';
import Spinner from '../components/ui/Spinner';
import { useToast } from '../lib/ToastContext';

const ROLE_LABELS = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' };
const ROLE_COLORS = {
  admin:  { background: 'var(--c-danger-bg)',  color: 'var(--c-danger)'      },
  editor: { background: 'var(--c-accent-bg)',  color: 'var(--c-accent-txt)'  },
  viewer: { background: 'var(--c-surface)',     color: 'var(--c-text2)'       },
};

const Settings = ({ currentUser }) => {
  const { toast } = useToast();
  const isAdmin = currentUser?.role === 'admin';

  const TABS = [
    { id: 'orgs',       label: 'Organizations', icon: Building2     },
    { id: 'workspaces', label: 'Workspaces',    icon: FolderOpen    },
    { id: 'whatsapp',   label: 'Routing Rules', icon: MessageCircle },
    ...(isAdmin ? [{ id: 'users', label: 'Users', icon: Users }] : []),
  ];

  const [tab, setTab]           = useState('orgs');
  const [orgs, setOrgs]         = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [rules, setRules]       = useState([]);
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [formData, setFormData] = useState({});
  const [showPw, setShowPw]     = useState(false);

  const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm]           = useState({});
  const [savingEdit, setSavingEdit]       = useState(false);

  const [resettingUserId, setResettingUserId] = useState(null);
  const [resetPw, setResetPw]                 = useState('');
  const [showResetPw, setShowResetPw]         = useState(false);
  const [savingReset, setSavingReset]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, w, r] = await Promise.all([fetchOrganizations(), fetchWorkspaces(), fetchWhatsAppRules()]);
      setOrgs(o); setWorkspaces(w); setRules(r);
      if (isAdmin) {
        const u = await fetchUsers();
        setUsers(u);
      }
    } finally { setLoading(false); }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { document.title = 'Settings | DocuVault'; }, []);

  const resetForm = () => { setShowForm(false); setFormData({}); setShowPw(false); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (tab === 'orgs')       await createOrganization({ name: formData.name, description: formData.description });
      if (tab === 'workspaces') await createWorkspace({ name: formData.name, organization_id: formData.org_id, description: formData.description });
      if (tab === 'users')      await createUser({ name: formData.name, email: formData.email, password: formData.password, role: formData.role || 'viewer' });
      toast(`${tab === 'orgs' ? 'Organization' : tab === 'workspaces' ? 'Workspace' : 'User'} "${formData.name}" created`, 'success');
      resetForm();
      load();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast(typeof detail === 'string' ? detail : 'Save failed — please try again.', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async (type, id) => {
    if (!confirm('Delete this item?')) return;
    try {
      if (type === 'workspace') await deleteWorkspace(id);
      if (type === 'rule')      await deleteWhatsAppRule(id);
      if (type === 'user')      await deleteUser(id);
      load();
    } catch {
      toast('Delete failed — please try again.', 'error');
    }
  };

  const startEdit = (u) => {
    setResettingUserId(null);
    setEditingUserId(u.id);
    setEditForm({ name: u.name, email: u.email, role: u.role });
  };
  const cancelEdit = () => { setEditingUserId(null); setEditForm({}); };

  const saveEdit = async (u) => {
    if (!editForm.name?.trim() || !editForm.email?.trim()) return;
    setSavingEdit(true);
    try {
      await updateUser(u.id, editForm);
      toast(`Profile updated for ${editForm.name.trim()}`, 'success');
      cancelEdit();
      load();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast(typeof detail === 'string' ? detail : 'Update failed — please try again.', 'error');
    } finally { setSavingEdit(false); }
  };

  const startReset = (u) => {
    setEditingUserId(null);
    setResettingUserId(u.id);
    setResetPw('');
    setShowResetPw(false);
  };
  const cancelReset = () => { setResettingUserId(null); setResetPw(''); setShowResetPw(false); };

  const saveReset = async (u) => {
    if (resetPw.length < 8) return;
    setSavingReset(true);
    try {
      await resetUserPassword(u.id, resetPw);
      toast(`Password reset for ${u.name}`, 'success');
      cancelReset();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast(typeof detail === 'string' ? detail : 'Password reset failed — please try again.', 'error');
    } finally { setSavingReset(false); }
  };

  const wsName  = (id) => workspaces.find(w => w.id === id)?.name || id;
  const orgName = (id) => orgs.find(o => o.id === id)?.name || id;

  const userFormValid = tab === 'users'
    ? formData.name?.trim() && formData.email?.trim() && formData.password?.length >= 8
    : formData.name?.trim();

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
            <button key={id} onClick={() => { setTab(id); resetForm(); }}
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

            {/* Add button */}
            {tab !== 'whatsapp' && !showForm && (
              <button onClick={() => { setShowForm(true); setFormData({ role: 'viewer' }); }} className="btn-secondary text-xs">
                <Plus className="w-3.5 h-3.5" />
                {tab === 'orgs' ? 'Add Organization' : tab === 'workspaces' ? 'Add Workspace' : 'Add User'}
              </button>
            )}

            {/* Form */}
            {showForm && (
              <div className="rounded-xl p-5 space-y-4"
                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-accent-bg)' }}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>
                    {tab === 'orgs' ? 'New Organization' : tab === 'workspaces' ? 'New Workspace' : 'New User'}
                  </p>
                  <button onClick={resetForm} style={{ color: 'var(--c-text2)' }}><X className="w-4 h-4" /></button>
                </div>

                {/* Org / Workspace fields */}
                {tab !== 'users' && [
                  { key: 'name',        label: 'Name',                   placeholder: 'Enter name',        required: true },
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

                {/* User fields */}
                {tab === 'users' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--c-text2)' }}>Full Name</label>
                      <input value={formData.name || ''} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                        placeholder="Jane Smith" className="input-field w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--c-text2)' }}>Email Address</label>
                      <input type="email" value={formData.email || ''} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                        placeholder="jane@onctionenergy.com" className="input-field w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--c-text2)' }}>Password</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPw ? 'text' : 'password'}
                          value={formData.password || ''}
                          onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                          placeholder="Min. 8 characters"
                          className="input-field w-full"
                          style={{ paddingRight: 36 }}
                        />
                        <button type="button" onClick={() => setShowPw(p => !p)}
                          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text2)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {formData.password && formData.password.length < 8 && (
                        <p className="text-xs mt-1" style={{ color: 'var(--c-danger)' }}>At least 8 characters required</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--c-text2)' }}>Role</label>
                      <select value={formData.role || 'viewer'} onChange={e => setFormData(p => ({ ...p, role: e.target.value }))}
                        className="input-field w-full">
                        <option value="viewer">Viewer — can browse and download documents</option>
                        <option value="editor">Editor — can upload and manage documents</option>
                        <option value="admin">Admin — full access including user management</option>
                      </select>
                    </div>
                  </>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={handleSave} disabled={!userFormValid || saving} className="btn-primary text-xs disabled:opacity-40">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={resetForm} className="btn-secondary text-xs">Cancel</button>
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

            {/* WhatsApp routing rules */}
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

            {/* Users list (admin only) */}
            {tab === 'users' && (
              <div className="rounded-xl overflow-hidden"
                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
                {users.length === 0 ? (
                  <p className="text-xs p-5" style={{ color: 'var(--c-text2)' }}>No users found.</p>
                ) : users.map((u, i) => (
                  <div key={u.id}
                    style={i < users.length - 1 ? { borderBottom: '1px solid var(--c-border)' } : {}}>

                    {editingUserId === u.id ? (
                      <div className="px-5 py-4 space-y-3">
                        <div>
                          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--c-text2)' }}>Full Name</label>
                          <input value={editForm.name || ''} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                            className="input-field w-full text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--c-text2)' }}>Email Address</label>
                          <input type="email" value={editForm.email || ''} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                            className="input-field w-full text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--c-text2)' }}>Role</label>
                          <select value={editForm.role || 'viewer'} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}
                            className="input-field w-full text-sm">
                            <option value="viewer">Viewer — can browse and download documents</option>
                            <option value="editor">Editor — can upload and manage documents</option>
                            <option value="admin">Admin — full access including user management</option>
                          </select>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => saveEdit(u)}
                            disabled={!editForm.name?.trim() || !editForm.email?.trim() || savingEdit}
                            className="btn-primary text-xs px-3 py-1.5 disabled:opacity-40">
                            {savingEdit ? 'Saving…' : 'Save'}
                          </button>
                          <button onClick={cancelEdit} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
                        </div>
                      </div>
                    ) : resettingUserId === u.id ? (
                      <div className="px-5 py-4 space-y-3">
                        <p className="text-xs font-medium" style={{ color: 'var(--c-text)' }}>
                          Reset password for {u.name}
                        </p>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showResetPw ? 'text' : 'password'}
                            value={resetPw}
                            onChange={e => setResetPw(e.target.value)}
                            placeholder="New password — min. 8 characters"
                            className="input-field w-full text-sm"
                            style={{ paddingRight: 36 }}
                            autoFocus
                          />
                          <button type="button" onClick={() => setShowResetPw(p => !p)}
                            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text2)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                            {showResetPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {resetPw && resetPw.length < 8 && (
                          <p className="text-xs" style={{ color: 'var(--c-danger)' }}>At least 8 characters required</p>
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => saveReset(u)} disabled={resetPw.length < 8 || savingReset}
                            className="btn-primary text-xs px-3 py-1.5 disabled:opacity-40">
                            {savingReset ? 'Resetting…' : 'Reset Password'}
                          </button>
                          <button onClick={cancelReset} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 px-5 py-4">
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                          background: 'var(--c-accent-bg)', color: 'var(--c-accent-txt)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 700,
                        }}>
                          {u.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>{u.name}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--c-text2)' }}>{u.email}</p>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={ROLE_COLORS[u.role] || ROLE_COLORS.viewer}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                        <button onClick={() => startEdit(u)} title="Edit profile"
                          className="p-1 transition-colors flex-shrink-0" style={{ color: 'var(--c-text2)' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--c-text)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text2)'}>
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => startReset(u)} title="Reset password"
                          className="p-1 transition-colors flex-shrink-0" style={{ color: 'var(--c-text2)' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--c-accent-txt)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text2)'}>
                          <Key className="w-3.5 h-3.5" />
                        </button>
                        {u.id !== currentUser?.id && (
                          <button onClick={() => handleDelete('user', u.id)} title="Delete user"
                            className="p-1 transition-colors flex-shrink-0" style={{ color: 'var(--c-text2)' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--c-danger)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text2)'}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
