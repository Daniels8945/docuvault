import React, { useState, useEffect, useCallback } from 'react';
import { MessageCircle, Plus, Trash2, ArrowRight } from 'lucide-react';
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
    try {
      await onSave({ ...form, folder_id: form.folder_id || null });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Add Routing Rule" maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Group JID</label>
          <input value={form.group_jid} onChange={e => set('group_jid', e.target.value)}
            placeholder="120363xxx@g.us or 2348xxx@c.us"
            className="input-field w-full text-sm" required />
          <p className="text-xs text-gray-500 mt-1">Find this in WAHA → GET /api/default/chats</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Group Name</label>
          <input value={form.group_name} onChange={e => set('group_name', e.target.value)}
            placeholder="e.g. Trading Team Chat"
            className="input-field w-full text-sm" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Route to Workspace</label>
          <select value={form.workspace_id} onChange={e => set('workspace_id', e.target.value)}
            className="input-field w-full text-sm" required>
            <option value="">Select workspace…</option>
            {workspaces.filter(w => w.id !== 'ws_inbox').map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        {folders.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">Folder (optional)</label>
            <select value={form.folder_id} onChange={e => set('folder_id', e.target.value)}
              className="input-field w-full text-sm">
              <option value="">No specific folder</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Saving…' : 'Add Rule'}
          </button>
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDeleteRule = async (id) => {
    if (!confirm('Delete this routing rule?')) return;
    await deleteWhatsAppRule(id);
    load();
  };

  const wsName = (id) => workspaces.find(w => w.id === id)?.name || id;

  return (
    <div className="p-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 fade-in-up">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-7 h-7 text-green-400" />
          <div>
            <h2 className="text-3xl font-bold">WhatsApp Inbox</h2>
            <p className="text-gray-400 text-sm">{documents.length} uncategorised document{documents.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={() => setShowRuleForm(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Add Routing Rule
        </button>
      </div>

      {/* Routing rules */}
      {rules.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Routing Rules</h3>
          <div className="glass-card rounded-xl overflow-hidden">
            {rules.map((rule, i) => (
              <div key={rule.id} className={`flex items-center gap-4 px-5 py-3.5 ${i < rules.length - 1 ? 'border-b border-white/5' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{rule.group_name}</p>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">{rule.group_jid}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <p className="text-sm text-blue-300 flex-shrink-0">{wsName(rule.workspace_id)}</p>
                <button onClick={() => handleDeleteRule(rule.id)} className="text-gray-500 hover:text-red-400 transition p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inbox documents */}
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Uncategorised Documents</h3>
      {loading ? <Spinner /> : documents.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="Inbox is empty"
          description="Documents sent via WhatsApp that don't match a routing rule will appear here."
        />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {documents.map(doc => (
            <DocumentCard key={doc.id} document={doc} onClick={() => setSelectedDoc(doc)} />
          ))}
        </div>
      )}

      {showRuleForm && (
        <RuleForm
          workspaces={workspaces}
          onSave={createWhatsAppRule}
          onClose={() => { setShowRuleForm(false); load(); }}
        />
      )}
      {selectedDoc && (
        <DocumentModal
          document={selectedDoc}
          currentUser={currentUser}
          onClose={() => setSelectedDoc(null)}
          onUpdate={() => { setSelectedDoc(null); load(); }}
        />
      )}
    </div>
  );
};

export default WhatsAppInbox;
