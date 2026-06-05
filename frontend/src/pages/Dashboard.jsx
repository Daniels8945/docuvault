import React, { useState, useEffect, useCallback } from 'react';
import { Upload, FolderPlus, Search, FolderOpen, Trash2, SlidersHorizontal } from 'lucide-react';
import { fetchDocuments, fetchFolders, fetchWorkspace, deleteFolder } from '../services/api';
import DocumentCard from '../components/DocumentCard';
import DocumentModal from '../components/DocumentModal';
import UploadModal from '../components/UploadModal';
import CreateFolderModal from '../components/CreateFolderModal';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const Dashboard = ({ selectedWorkspace, currentUser }) => {
  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [workspace, setWorkspace] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);

  const load = useCallback(async () => {
    if (!selectedWorkspace) return;
    setLoading(true);
    try {
      const [ws, flds, docs] = await Promise.all([
        fetchWorkspace(selectedWorkspace),
        fetchFolders(selectedWorkspace),
        fetchDocuments({
          workspace_id: selectedWorkspace,
          ...(selectedFolder ? { folder_id: selectedFolder } : {}),
          ...(search ? { search } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
        }),
      ]);
      setWorkspace(ws);
      setFolders(flds);
      setDocuments(docs);
    } finally {
      setLoading(false);
    }
  }, [selectedWorkspace, selectedFolder, search, statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSelectedFolder(null); }, [selectedWorkspace]);

  const handleFolderDelete = async (e, folderId) => {
    e.stopPropagation();
    if (!confirm('Delete this folder?')) return;
    await deleteFolder(folderId);
    load();
  };

  const currentFolderName = folders.find(f => f.id === selectedFolder)?.name;

  return (
    <div className="p-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 fade-in-up">
        <div>
          <h2 className="text-3xl font-bold">{workspace?.name || 'Dashboard'}</h2>
          <p className="text-gray-400 text-sm mt-1">{documents.length} documents</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreateFolder(true)} className="btn-secondary flex items-center gap-2 text-sm">
            <FolderPlus className="w-4 h-4" /> New Folder
          </button>
          <button onClick={() => setShowUpload(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Upload className="w-4 h-4" /> Upload
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search documents…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field w-full pl-10 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-gray-400" />
          {STATUSES.map(s => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={`text-xs px-3 py-2 rounded-lg transition font-medium ${statusFilter === s.value ? 'bg-blue-500 text-white' : 'glass-card text-gray-300 hover:bg-slate-700/70'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Breadcrumb */}
      {selectedFolder && (
        <div className="flex items-center gap-2 text-sm mb-4">
          <button onClick={() => setSelectedFolder(null)} className="text-blue-400 hover:underline">{workspace?.name}</button>
          <span className="text-gray-600">/</span>
          <span className="text-gray-300">{currentFolderName}</span>
        </div>
      )}

      {/* Folders grid */}
      {!selectedFolder && folders.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Folders</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {folders.map(folder => (
              <div
                key={folder.id}
                onClick={() => setSelectedFolder(folder.id)}
                className="glass-card p-4 rounded-xl cursor-pointer hover:bg-slate-700/70 transition group relative"
              >
                <FolderOpen className="w-8 h-8 text-blue-400 mb-2" />
                <p className="font-medium text-sm truncate">{folder.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {documents.filter(d => d.folder_id === folder.id).length} docs
                </p>
                {currentUser?.role === 'admin' && (
                  <button
                    onClick={e => handleFolderDelete(e, folder.id)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition text-gray-500 hover:text-red-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents */}
      <div>
        {!selectedFolder && folders.length > 0 && (
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">All Documents</h3>
        )}
        {loading ? <Spinner /> : documents.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {documents.map(doc => (
              <DocumentCard key={doc.id} document={doc} onClick={() => setSelectedDoc(doc)} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FolderOpen}
            title="No documents"
            description={search ? 'Try a different search term' : 'Upload your first document to get started'}
            action={!search && (
              <button onClick={() => setShowUpload(true)} className="btn-primary">Upload Document</button>
            )}
          />
        )}
      </div>

      {showUpload && (
        <UploadModal
          workspaceId={selectedWorkspace}
          folderId={selectedFolder}
          onClose={() => setShowUpload(false)}
          onComplete={() => { setShowUpload(false); load(); }}
        />
      )}
      {showCreateFolder && (
        <CreateFolderModal
          workspaceId={selectedWorkspace}
          onClose={() => setShowCreateFolder(false)}
          onCreated={() => { setShowCreateFolder(false); load(); }}
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

export default Dashboard;
