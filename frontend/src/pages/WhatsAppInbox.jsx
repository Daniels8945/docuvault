import React, { useState, useEffect, useCallback } from 'react';
import { MessageCircle, Plus, Trash2, ArrowRight, Wifi } from 'lucide-react';
import { fetchDocuments, fetchWhatsAppRules, createWhatsAppRule, deleteWhatsAppRule, fetchWorkspaces, fetchFolders } from '../services/api';
import DocumentCard from '../components/DocumentCard';
import DocumentModal from '../components/DocumentModal';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';

const RuleForm = ({ workspaces, onSave, onClose }) => {
  const [form, setForm] = useState({ group_jid: '', group_name: '', workspace_id: '', folder_id: '' });
  const [folders, setFolders] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (form.workspace_id) fetchFolders(form.workspace_id).then(setFolders);
    else setFolders([]);
  }, [form.workspace_id]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.group_jid || !form.group_name || !form.workspace_id) return;
    setSaving(true);
    try { await onSave({ ...form, folder_id: form.folder_id || null }); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Modal onClose={onClose} title="Add Routing Rule" maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--c-text2)' }}>Group JID</label>
          <input value={form.group_jid} onChange={e => set('group_jid', e.target.value)}
            placeholder="120363xxx@g.us" className="input-field w-full" required />
          <p className="text-xs mt-1" style={{ color: 'var(--c-text2)' }}>Find in WAHA → GET /api/default/chats</p>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--c-text2)' }}>Display Name</label>
          <input value={form.group_name} onChange={e => set('group_name', e.target.value)}
            placeholder="e.g. Trading Team" className="input-field w-full" required />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--c-text2)' }}>Route to Workspace</label>
          <select value={form.workspace_id} onChange={e => set('workspace_id', e.target.value)}
            className="input-field w-full" required>
            <option value="">Select workspace…</option>
            {workspaces.filter(w => w.id !== 'ws_inbox').map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        {folders.length > 0 && (
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--c-text2)' }}>Folder (optional)</label>
            <select value={form.folder_id} onChange={e => set('folder_id', e.target.value)} className="input-field w-full">
              <option value="">No specific folder</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Add Rule'}</button>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </Modal>
  );
};

const WhatsAppInbox = ({ currentUser }) => {
  const [documents, setDocuments] = useState([]);
  const [rules, setRules] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showRuleForm, setShowRuleForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [docs, r, ws] = await Promise.all([
        fetchDocuments({ workspace_id: 'ws_inbox' }),
        fetchWhatsAppRules(),
        fetchWorkspaces(),
      ]);
      setDocuments(docs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      setRules(r);
      setWorkspaces(ws);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { document.title = 'WhatsApp Inbox | DocuVault'; }, []);

  const wsName = (id) => workspaces.find(w => w.id === id)?.name || id;

  return (
    <div className="flex flex-col h-full md:h-screen overflow-hidden">
      <div className="px-8 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--c-border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--c-success-bg)' }}>
              <MessageCircle className="w-4 h-4" style={{ color: 'var(--c-success)' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--c-text)' }}>WhatsApp Inbox</h2>
              <p className="text-xs" style={{ color: 'var(--c-text2)' }}>
                {documents.length} uncategorised document{documents.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button onClick={() => setShowRuleForm(true)} className="btn-primary text-xs">
            <Plus className="w-3.5 h-3.5" /> Add Rule
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-7">
        {rules.length > 0 && (
          <div className="fade-in-up">
            <p className="section-label mb-3">Routing Rules</p>
            <div className="rounded-xl overflow-hidden"
              style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
              {rules.map((rule, i) => (
                <div key={rule.id} className="flex items-center gap-4 px-5 py-4"
                  style={i < rules.length - 1 ? { borderBottom: '1px solid var(--c-border)' } : {}}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--c-success-bg)' }}>
                    <Wifi className="w-3.5 h-3.5" style={{ color: 'var(--c-success)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>{rule.group_name}</p>
                    <p className="text-xs font-mono mt-0.5 truncate" style={{ color: 'var(--c-text2)' }}>{rule.group_jid}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--c-text2)' }} />
                  <span className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--c-accent-txt)' }}>
                    {wsName(rule.workspace_id)}
                  </span>
                  <button onClick={async () => { if (!confirm('Delete rule?')) return; await deleteWhatsAppRule(rule.id); load(); }}
                    className="p-1 flex-shrink-0 transition-colors" style={{ color: 'var(--c-text2)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--c-danger)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text2)'}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="fade-in-up">
          <p className="section-label mb-3">Uncategorised Documents</p>
          {loading ? <Spinner /> : documents.length === 0 ? (
            <EmptyState icon={MessageCircle} title="Inbox is empty"
              description="Documents from WhatsApp without a matching routing rule will appear here." />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {documents.map(doc => (
                <DocumentCard key={doc.id} document={doc} onClick={() => setSelectedDoc(doc)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showRuleForm && (
        <RuleForm workspaces={workspaces} onSave={createWhatsAppRule}
          onClose={() => { setShowRuleForm(false); load(); }} />
      )}
      {selectedDoc && (
        <DocumentModal document={selectedDoc} currentUser={currentUser}
          onClose={() => setSelectedDoc(null)} onUpdate={() => { setSelectedDoc(null); load(); }} />
      )}
    </div>
  );
};

export default WhatsAppInbox;
