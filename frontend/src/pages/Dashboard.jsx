import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Upload, FolderPlus, Search, FolderOpen, Trash2, FileText, HardDrive, Calendar, Building2 } from 'lucide-react';
import { fetchDocuments, fetchFolders, fetchWorkspace, fetchWorkspaceStats, deleteFolder } from '../services/api';
import DocumentCard from '../components/DocumentCard';
import DocumentModal from '../components/DocumentModal';
import UploadModal from '../components/UploadModal';
import CreateFolderModal from '../components/CreateFolderModal';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { formatFileSize } from '../lib/fileUtils';

const STATUSES = [
  { value: '',       label: 'All'    },
  { value: 'active', label: 'Active' },
  { value: 'draft',  label: 'Draft'  },
];

const StatCard = ({ icon: Icon, value, label, color }) => (
  <div className="stat-card flex items-center gap-4">
    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: color + '18' }}>
      <Icon className="w-5 h-5" style={{ color }} />
    </div>
    <div>
      <p className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>{value}</p>
      <p className="text-xs" style={{ color: 'var(--c-text2)' }}>{label}</p>
    </div>
  </div>
);

const Dashboard = ({ selectedWorkspace, currentUser }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedFolder = searchParams.get('folder') || null;
  const setSelectedFolder = useCallback((id) => {
    setSearchParams(id ? { folder: id } : {}, { replace: false });
  }, [setSearchParams]);

  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [workspace, setWorkspace] = useState(null);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);

  const load = useCallback(async () => {
    if (!selectedWorkspace) { setLoading(false); return; }
    setLoading(true);
    try {
      const [ws, flds, docs, wsStats] = await Promise.all([
        fetchWorkspace(selectedWorkspace),
        fetchFolders(selectedWorkspace),
        fetchDocuments({
          workspace_id: selectedWorkspace,
          ...(selectedFolder
            ? { folder_id: selectedFolder }
            : { root_only: true }),
          ...(search ? { search } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
        }),
        fetchWorkspaceStats(selectedWorkspace),
      ]);
      setWorkspace(ws);
      setFolders(flds);
      setDocuments(docs);
      setStats(wsStats);
    } finally {
      setLoading(false);
    }
  }, [selectedWorkspace, selectedFolder, search, statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSearchParams({}, { replace: true }); }, [selectedWorkspace]); // clear folder when workspace changes

  const currentFolderName = folders.find(f => f.id === selectedFolder)?.name;

  useEffect(() => {
    const parts = [];
    if (currentFolderName) parts.push(currentFolderName);
    if (workspace?.name) parts.push(workspace.name);
    parts.push('DocuVault');
    document.title = parts.join(' | ');
  }, [workspace, currentFolderName]);

  const handleFolderDelete = async (e, folderId) => {
    e.stopPropagation();
    if (!confirm('Delete this folder?')) return;
    await deleteFolder(folderId);
    load();
  };

  // ── No workspace selected ─────────────────────────────────────────────────
  if (!selectedWorkspace) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <div className="px-8 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--c-border)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--c-text)' }}>Dashboard</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={Building2}
            title="No workspace selected"
            description="Select a workspace from the sidebar, or create a new organization and workspace to get started."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <div className="px-8 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--c-border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--c-text)' }}>
              {workspace?.name || 'Dashboard'}
            </h2>
            {selectedFolder && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <button onClick={() => setSelectedFolder(null)}
                  className="text-xs hover:underline" style={{ color: 'var(--c-accent-txt)' }}>
                  {workspace?.name}
                </button>
                <span className="text-xs" style={{ color: 'var(--c-text2)' }}>/</span>
                <span className="text-xs" style={{ color: 'var(--c-text2)' }}>{currentFolderName}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowCreateFolder(true)} className="btn-secondary text-xs">
              <FolderPlus className="w-3.5 h-3.5" /> New Folder
            </button>
            <button onClick={() => setShowUpload(true)} className="btn-primary text-xs">
              <Upload className="w-3.5 h-3.5" /> Upload
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        {/* Stats — always workspace-wide (root + every folder), not just what's on screen */}
        {!selectedFolder && (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 fade-in-up">
            <StatCard icon={FileText}   value={stats?.document_count ?? 0}                label="Total documents" color="#6366f1" />
            <StatCard icon={Calendar}   value={stats?.this_week_count ?? 0}                label="Added this week" color="#22c55e" />
            <StatCard icon={HardDrive}  value={formatFileSize(stats?.storage_bytes ?? 0)}  label="Storage used"    color="#f59e0b" />
            <StatCard icon={FolderOpen} value={stats?.folder_count ?? folders.length}       label="Folders"         color="#06b6d4" />
          </div>
        )}

        {/* Search + filter */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--c-text2)' }} />
            <input type="text" placeholder="Search documents…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="input-field w-full pl-9 text-sm" />
          </div>
          <div className="flex gap-1.5">
            {STATUSES.map(s => (
              <button key={s.value} onClick={() => setStatusFilter(s.value)}
                className="text-xs px-3 py-2 rounded-lg font-medium transition-all"
                style={statusFilter === s.value
                  ? { background: 'var(--c-accent-bg)', color: 'var(--c-accent-txt)', border: '1px solid var(--c-border2)' }
                  : { background: 'var(--c-surface)', color: 'var(--c-text2)', border: '1px solid var(--c-border)' }
                }>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Folders */}
        {!selectedFolder && folders.length > 0 && (
          <div className="fade-in-up">
            <p className="section-label mb-3">Folders</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {folders.map(folder => (
                <div key={folder.id} onClick={() => setSelectedFolder(folder.id)}
                  className="group relative flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer transition-all duration-150"
                  style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-hover)'; e.currentTarget.style.borderColor = 'var(--c-border2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-surface)'; e.currentTarget.style.borderColor = 'var(--c-border)'; }}>
                  <FolderOpen className="w-7 h-7" style={{ color: 'var(--c-accent-txt)' }} />
                  <p className="text-xs font-medium text-center truncate w-full" style={{ color: 'var(--c-text)' }}>{folder.name}</p>
                  <p className="text-xs" style={{ color: 'var(--c-text2)' }}>
                    {folder.document_count ?? 0} docs
                  </p>
                  {currentUser?.role === 'admin' && (
                    <button onClick={e => handleFolderDelete(e, folder.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition p-0.5"
                      style={{ color: 'var(--c-text2)' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--c-danger)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text2)'}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documents */}
        <div className="fade-in-up">
          {!selectedFolder && folders.length > 0 && <p className="section-label mb-3">Documents</p>}
          {loading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : documents.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {documents.map(doc => (
                <DocumentCard key={doc.id} document={doc} onClick={() => setSelectedDoc(doc)} />
              ))}
            </div>
          ) : search ? (
            <EmptyState icon={Search}
              title="No results"
              description={`Nothing matches "${search}". Try a different search term.`} />
          ) : selectedFolder ? (
            <EmptyState icon={Upload}
              title="This folder is empty"
              description="Upload a document here, or drag one in from the top-level view."
              action={
                <button onClick={() => setShowUpload(true)} className="btn-primary text-sm">
                  <Upload className="w-4 h-4" /> Upload a Document
                </button>
              } />
          ) : folders.length > 0 ? (
            <EmptyState icon={FolderOpen}
              title="No documents outside a folder"
              description="This workspace's documents are all organised inside the folders above." />
          ) : (
            <EmptyState icon={Upload}
              title="This workspace is empty"
              description="Upload your first document to start building your knowledge base."
              action={
                <button onClick={() => setShowUpload(true)} className="btn-primary text-sm">
                  <Upload className="w-4 h-4" /> Upload a Document
                </button>
              } />
          )}
        </div>
      </div>

      {showUpload && <UploadModal workspaceId={selectedWorkspace} folderId={selectedFolder}
        onClose={() => setShowUpload(false)} onComplete={() => { setShowUpload(false); load(); }} />}
      {showCreateFolder && <CreateFolderModal workspaceId={selectedWorkspace}
        onClose={() => setShowCreateFolder(false)} onCreated={() => { setShowCreateFolder(false); load(); }} />}
      {selectedDoc && <DocumentModal document={selectedDoc} currentUser={currentUser}
        onClose={() => setSelectedDoc(null)} onUpdate={() => { setSelectedDoc(null); load(); }} />}
    </div>
  );
};

export default Dashboard;
