import React, { useState, useEffect, useRef } from 'react';
import { Download, Trash2, Upload, Pencil, Check, X, Clock, Eye, EyeOff, FolderInput } from 'lucide-react';
import { format } from 'date-fns';
import FileIcon from './FileIcon';
import Spinner from './ui/Spinner';
import Modal from './ui/Modal';
import { formatFileSize, getFileLabel } from '../lib/fileUtils';
import {
  fetchDocumentVersions, updateDocument, deleteDocument, uploadNewVersion,
  fetchPreviewBlob, downloadDocumentFile, fetchWorkspaces, fetchFolders,
} from '../services/api';
import { useToast } from '../lib/ToastContext';

const PREVIEWABLE_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'text/plain',
];

const canPreview = (type = '') =>
  PREVIEWABLE_TYPES.includes(type) || type.startsWith('image/');

// Preview/download need the JWT bearer token, which only axios attaches —
// a plain <img>/<embed> src or <a href> hits the API with no auth header and
// gets a 401 JSON body back. Fetching as an authenticated blob and pointing
// the element at a local object URL sidesteps that entirely.
const PreviewPane = ({ docId, fileType, name }) => {
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError]     = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    let objectUrl;
    setBlobUrl(null);
    setError(false);
    fetchPreviewBlob(docId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        toast('Could not load preview.', 'error');
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm" style={{ color: 'var(--c-text2)' }}>Preview unavailable.</p>
      </div>
    );
  }
  if (!blobUrl) {
    return <div className="flex items-center justify-center h-full"><Spinner /></div>;
  }

  if (fileType.startsWith('image/')) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 16, background: 'var(--c-bg)' }}>
        <img src={blobUrl} alt={name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />
      </div>
    );
  }
  if (fileType === 'application/pdf') {
    return (
      <embed
        src={blobUrl}
        type="application/pdf"
        style={{ display: 'block', width: '100%', height: '100%', background: 'var(--c-bg)' }}
      />
    );
  }
  if (fileType === 'text/plain') {
    return <TextPreview blobUrl={blobUrl} />;
  }
  return null;
};

const TextPreview = ({ blobUrl }) => {
  const [text, setText] = useState('');
  useEffect(() => { fetch(blobUrl).then(r => r.text()).then(setText); }, [blobUrl]);
  return (
    <pre className="p-5 text-xs overflow-auto h-full whitespace-pre-wrap break-words"
      style={{ background: 'var(--c-bg)', color: 'var(--c-text)', fontFamily: 'monospace' }}>
      {text || 'Loading…'}
    </pre>
  );
};

const DocumentModal = ({ document: doc, currentUser, onClose, onUpdate }) => {
  const { toast } = useToast();
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(canPreview(doc.file_type) ? 'preview' : 'versions');
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState(doc.name);
  const [editTags, setEditTags] = useState(false);
  const [tags, setTags] = useState((doc.tags || []).join(', '));
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [moveWorkspaces, setMoveWorkspaces] = useState([]);
  const [moveFolders, setMoveFolders] = useState([]);
  const [moveWorkspaceId, setMoveWorkspaceId] = useState(doc.workspace_id === 'ws_inbox' ? '' : doc.workspace_id);
  const [moveFolderId, setMoveFolderId] = useState(doc.folder_id || '');
  const [moving, setMoving] = useState(false);
  const versionInputRef = useRef(null);

  const { color } = getFileLabel(doc.file_type);
  const isAdmin = currentUser?.role === 'admin';
  const showPreview = canPreview(doc.file_type);

  useEffect(() => {
    fetchDocumentVersions(doc.id)
      .then(setVersions)
      .finally(() => setLoading(false));
  }, [doc.id]);

  useEffect(() => {
    if (!showMove) return;
    fetchWorkspaces().then(ws => setMoveWorkspaces(ws.filter(w => w.id !== 'ws_inbox')));
  }, [showMove]);

  useEffect(() => {
    if (!showMove || !moveWorkspaceId) { setMoveFolders([]); return; }
    fetchFolders(moveWorkspaceId).then(setMoveFolders);
  }, [showMove, moveWorkspaceId]);

  const save = async (patch) => {
    setSaving(true);
    try { await updateDocument(doc.id, patch); onUpdate(); }
    finally { setSaving(false); }
  };

  const saveName = async () => {
    if (name.trim() && name !== doc.name) await save({ name: name.trim() });
    setEditName(false);
  };

  const saveTags = async () => {
    const parsed = tags.split(',').map(t => t.trim()).filter(Boolean);
    await save({ tags: parsed });
    setEditTags(false);
  };

  const handleDelete = async () => {
    await deleteDocument(doc.id);
    onUpdate();
    onClose();
  };

  const handleVersionUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadNewVersion(doc.id, file);
      toast(`New version of "${doc.name}" uploaded`, 'success');
      onUpdate();
    } catch {
      toast('Version upload failed — please try again.', 'error');
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadDocumentFile(doc.id, doc.name);
    } catch {
      toast('Download failed — please try again.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleMove = async () => {
    if (!moveWorkspaceId) return;
    setMoving(true);
    try {
      await updateDocument(doc.id, { workspace_id: moveWorkspaceId, folder_id: moveFolderId || null });
      const wsName = moveWorkspaces.find(w => w.id === moveWorkspaceId)?.name || moveWorkspaceId;
      toast(`Moved "${doc.name}" to ${wsName}`, 'success');
      setShowMove(false);
      onUpdate();
    } catch {
      toast('Move failed — please try again.', 'error');
    } finally {
      setMoving(false);
    }
  };

  const TABS = [
    ...(showPreview ? [{ id: 'preview', icon: Eye, label: 'Preview' }] : []),
    { id: 'versions', icon: Clock, label: 'Versions' },
  ];

  return (
    <Modal onClose={onClose} maxWidth="max-w-4xl">
      <div className="flex" style={{ minHeight: 520, maxHeight: '82vh' }}>

        {/* ── Left panel ─────────────────────── */}
        <div className="w-60 flex flex-col flex-shrink-0 overflow-y-auto"
          style={{ borderRight: '1px solid var(--c-border)' }}>
          <div className="h-1 flex-shrink-0" style={{ backgroundColor: color }} />

          <div className="p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-start justify-between">
              <FileIcon type={doc.file_type} size="lg" />
              <button onClick={onClose}
                className="p-1 rounded-lg transition-colors flex-shrink-0 mt-0.5"
                style={{ color: 'var(--c-text2)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--c-text)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text2)'}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Name */}
            {editName ? (
              <div className="flex gap-2 items-center">
                <input autoFocus value={name} onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveName()}
                  className="input-field flex-1 text-sm py-1.5" />
                <button onClick={saveName} className="text-emerald-400 hover:text-emerald-300 transition"><Check className="w-4 h-4" /></button>
                <button onClick={() => { setEditName(false); setName(doc.name); }}
                  style={{ color: 'var(--c-text2)' }}><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="group flex items-start gap-2">
                <p className="font-semibold text-sm leading-snug break-all flex-1" style={{ color: 'var(--c-text)' }}>{doc.name}</p>
                {isAdmin && (
                  <button onClick={() => setEditName(true)}
                    className="opacity-0 group-hover:opacity-100 transition mt-0.5 flex-shrink-0"
                    style={{ color: 'var(--c-text2)' }}>
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Meta */}
            <div className="space-y-1.5 text-xs" style={{ color: 'var(--c-text2)' }}>
              <p>{formatFileSize(doc.file_size)}</p>
              <p>Version {doc.current_version}</p>
              <p>{format(new Date(doc.created_at), 'MMM d, yyyy · h:mm a')}</p>
              <p>By {doc.uploaded_by}</p>
            </div>

            {/* Tags */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="section-label">Tags</span>
                {isAdmin && !editTags && (
                  <button onClick={() => setEditTags(true)} style={{ color: 'var(--c-text2)' }}>
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
              {editTags ? (
                <div className="space-y-2">
                  <input value={tags} onChange={e => setTags(e.target.value)}
                    placeholder="tag1, tag2" className="input-field w-full text-xs py-1.5" />
                  <div className="flex gap-2">
                    <button onClick={saveTags} className="btn-primary text-xs px-3 py-1.5">Save</button>
                    <button onClick={() => setEditTags(false)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {doc.tags?.length ? doc.tags.map(t => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-md font-medium"
                      style={{ background: 'var(--c-accent-bg)', color: 'var(--c-accent-txt)' }}>
                      {t}
                    </span>
                  )) : <span className="text-xs" style={{ color: 'var(--c-text2)' }}>No tags</span>}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2 mt-auto pt-2">
              <button onClick={handleDownload} disabled={downloading}
                className="btn-secondary w-full text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                <Download className="w-4 h-4" /> {downloading ? 'Downloading…' : 'Download'}
              </button>

              {isAdmin && !showMove && (
                <button onClick={() => setShowMove(true)} className="btn-secondary w-full text-sm">
                  <FolderInput className="w-4 h-4" /> Move to…
                </button>
              )}
              {showMove && (
                <div className="rounded-xl p-3 space-y-2"
                  style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)' }}>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-text2)' }}>Workspace</label>
                    <select value={moveWorkspaceId}
                      onChange={e => { setMoveWorkspaceId(e.target.value); setMoveFolderId(''); }}
                      className="input-field w-full text-xs py-1.5">
                      <option value="">Select workspace…</option>
                      {moveWorkspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  {moveFolders.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-text2)' }}>Folder</label>
                      <select value={moveFolderId} onChange={e => setMoveFolderId(e.target.value)}
                        className="input-field w-full text-xs py-1.5">
                        <option value="">No folder (root)</option>
                        {moveFolders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={handleMove} disabled={!moveWorkspaceId || moving}
                      className="btn-primary text-xs px-3 py-1.5 flex-1 disabled:opacity-40">
                      {moving ? 'Moving…' : 'Move'}
                    </button>
                    <button onClick={() => setShowMove(false)} className="btn-secondary text-xs px-3 py-1.5 flex-1">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {isAdmin && !confirmDelete && (
                <button onClick={() => setConfirmDelete(true)}
                  className="w-full flex items-center justify-center gap-2 text-xs py-2 transition rounded-lg"
                  style={{ color: 'var(--c-text2)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-danger)'; e.currentTarget.style.background = 'var(--c-danger-bg)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text2)'; e.currentTarget.style.background = ''; }}>
                  <Trash2 className="w-3.5 h-3.5" /> Delete document
                </button>
              )}
              {confirmDelete && (
                <div className="rounded-xl p-3 space-y-2"
                  style={{ background: 'var(--c-danger-bg)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <p className="text-xs" style={{ color: 'var(--c-danger)' }}>Delete permanently?</p>
                  <div className="flex gap-2">
                    <button onClick={handleDelete}
                      className="flex-1 text-xs font-semibold py-1.5 rounded-lg text-white transition"
                      style={{ background: 'var(--c-danger)' }}>
                      Yes, delete
                    </button>
                    <button onClick={() => setConfirmDelete(false)} className="btn-secondary text-xs px-3 py-1.5 flex-1">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right panel ─────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center justify-between px-5 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--c-border)' }}>
            <div className="flex">
              {TABS.map(({ id, icon: Icon, label }) => (
                <button key={id} onClick={() => setTab(id)}
                  className="flex items-center gap-2 px-4 py-3.5 text-xs font-semibold transition-colors border-b-2 -mb-px"
                  style={tab === id
                    ? { borderBottomColor: 'var(--c-accent)', color: 'var(--c-accent-txt)' }
                    : { borderBottomColor: 'transparent', color: 'var(--c-text2)' }}>
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
            {tab === 'versions' && isAdmin && (
              <>
                <input ref={versionInputRef} type="file" className="hidden" onChange={handleVersionUpload} />
                <button onClick={() => versionInputRef.current?.click()} className="btn-secondary text-xs px-3 py-1.5">
                  <Upload className="w-3.5 h-3.5" /> Upload version
                </button>
              </>
            )}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden" style={{ display: 'flex', flexDirection: 'column' }}>
            {tab === 'preview' && showPreview && (
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <PreviewPane docId={doc.id} fileType={doc.file_type} name={doc.name} />
              </div>
            )}

            {tab === 'versions' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                {loading ? (
                  <div className="flex items-center justify-center py-12"><Spinner /></div>
                ) : versions.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--c-text3)' }} />
                    <p className="text-sm" style={{ color: 'var(--c-text2)' }}>No version history</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {versions.slice().reverse().map(v => (
                      <div key={v.id} className="flex items-start justify-between p-4 rounded-xl"
                        style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)' }}>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>v{v.version_number}</span>
                            {v.version_number === doc.current_version && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{ background: 'var(--c-accent-bg)', color: 'var(--c-accent-txt)' }}>
                                Current
                              </span>
                            )}
                          </div>
                          <p className="text-xs mt-1" style={{ color: 'var(--c-text2)' }}>
                            {v.uploaded_by} · {format(new Date(v.created_at), 'MMM d, yyyy · h:mm a')}
                          </p>
                          {v.notes && <p className="text-xs mt-1 italic" style={{ color: 'var(--c-text2)' }}>"{v.notes}"</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DocumentModal;
