import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, Plus, Trash2, ArrowRight, Wifi, Search, X } from 'lucide-react';
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

const PAGE_SIZE = 50;

const WhatsAppInbox = ({ currentUser }) => {
  const [documents, setDocuments] = useState([]);
  const [rules, setRules] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);       // initial full-page load
  const [docsLoading, setDocsLoading] = useState(false); // search/page-jump refetch
  const [loadingMore, setLoadingMore] = useState(false); // "Load more" append
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showRuleForm, setShowRuleForm] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');           // debounced value actually sent to the API
  const [page, setPage] = useState(1);
  const [jumpPage, setJumpPage] = useState('1');
  const [hasMore, setHasMore] = useState(false);
  const searchDebounceRef = useRef(null);

  // Debounce the search box — refetch from page 1 ~350ms after typing stops,
  // not on every keystroke.
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(searchDebounceRef.current);
  }, [searchInput]);

  const loadDocPage = useCallback(async (targetPage, { append = false } = {}) => {
    const docs = await fetchDocuments({
      workspace_id: 'ws_inbox',
      skip: (targetPage - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      search: search || undefined,
    });
    setDocuments(prev => (append ? [...prev, ...docs] : docs));
    setHasMore(docs.length === PAGE_SIZE);
    setPage(targetPage);
    setJumpPage(String(targetPage));
  }, [search]);

  const loadMeta = useCallback(async () => {
    const [r, ws] = await Promise.all([fetchWhatsAppRules(), fetchWorkspaces()]);
    setRules(r);
    setWorkspaces(ws);
  }, []);

  // Initial load: rules + workspaces + first page of documents.
  useEffect(() => {
    setLoading(true);
    Promise.all([loadMeta(), loadDocPage(1)]).finally(() => setLoading(false));
    document.title = 'WhatsApp Inbox | DocuVault';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search changed — reset to page 1 and replace the list (skip on first mount,
  // which the initial-load effect above already handles).
  const isFirstSearch = useRef(true);
  useEffect(() => {
    if (isFirstSearch.current) { isFirstSearch.current = false; return; }
    setDocsLoading(true);
    loadDocPage(1).finally(() => setDocsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try { await loadDocPage(page + 1, { append: true }); }
    finally { setLoadingMore(false); }
  };

  const handleJumpToPage = async (e) => {
    e.preventDefault();
    const target = Math.max(1, parseInt(jumpPage, 10) || 1);
    setDocsLoading(true);
    try { await loadDocPage(target); }
    finally { setDocsLoading(false); }
  };

  const reloadDocuments = () => loadDocPage(1);

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
                {documents.length} uncategorised document{documents.length !== 1 ? 's' : ''} loaded{hasMore ? ' (more available)' : ''}
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
                  <button onClick={async () => { if (!confirm('Delete rule?')) return; await deleteWhatsAppRule(rule.id); loadMeta(); }}
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
          <div className="flex items-center justify-between gap-4 mb-3">
            <p className="section-label">Uncategorised Documents</p>
            <div className="relative" style={{ width: 240 }}>
              <Search className="w-3.5 h-3.5 absolute pointer-events-none"
                style={{ left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text2)' }} />
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                placeholder="Search by name…" className="input-field w-full text-xs"
                style={{ paddingLeft: 30, paddingRight: searchInput ? 28 : 10 }} />
              {searchInput && (
                <button onClick={() => setSearchInput('')} title="Clear search"
                  className="absolute" style={{ right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text2)' }}>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {loading || docsLoading ? <Spinner /> : documents.length === 0 ? (
            <EmptyState icon={MessageCircle}
              title={search ? 'No matching documents' : 'Inbox is empty'}
              description={search
                ? `Nothing found for "${search}".`
                : 'Documents from WhatsApp without a matching routing rule will appear here.'} />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {documents.map(doc => (
                  <DocumentCard key={doc.id} document={doc} onClick={() => setSelectedDoc(doc)} />
                ))}
              </div>

              <div className="flex items-center justify-between gap-4 pt-5 mt-2 flex-wrap"
                style={{ borderTop: '1px solid var(--c-border)' }}>
                <form onSubmit={handleJumpToPage} className="flex items-center gap-2">
                  <label className="text-xs" style={{ color: 'var(--c-text2)' }}>
                    Page {page} · jump to
                  </label>
                  <input type="number" min="1" value={jumpPage}
                    onChange={e => setJumpPage(e.target.value)}
                    className="input-field text-xs" style={{ width: 60, padding: '5px 8px' }} />
                  <button type="submit" className="btn-secondary text-xs px-2.5 py-1.5">Go</button>
                </form>
                {hasMore && (
                  <button onClick={handleLoadMore} disabled={loadingMore}
                    className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">
                    {loadingMore ? 'Loading…' : `Load ${PAGE_SIZE} more`}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showRuleForm && (
        <RuleForm workspaces={workspaces} onSave={createWhatsAppRule}
          onClose={() => { setShowRuleForm(false); loadMeta(); }} />
      )}
      {selectedDoc && (
        <DocumentModal document={selectedDoc} currentUser={currentUser}
          onClose={() => setSelectedDoc(null)} onUpdate={() => { setSelectedDoc(null); reloadDocuments(); }} />
      )}
    </div>
  );
};

export default WhatsAppInbox;
