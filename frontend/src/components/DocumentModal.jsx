import React, { useState, useEffect, useRef } from 'react';
import { Download, Trash2, Upload, Pencil, Check, X, Clock, Eye, EyeOff, FolderInput, FileWarning, Lock, Globe } from 'lucide-react';
import { format } from 'date-fns';
import FileIcon from './FileIcon';
import Spinner from './ui/Spinner';
import Modal from './ui/Modal';
import { formatFileSize } from '../lib/fileUtils';
import {
  fetchDocumentVersions, updateDocument, deleteDocument, uploadNewVersion,
  fetchPreviewBlob, fetchDocumentUrl, downloadDocumentFile, fetchWorkspaces, fetchFolders,
} from '../services/api';
import toast from 'react-hot-toast';

// Rendered directly in-browser from an authenticated blob.
const NATIVE_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'text/plain',
];
const isNativeType = (type = '') => NATIVE_TYPES.includes(type) || type.startsWith('image/');

// No in-browser renderer exists for these — handed to Microsoft's Office
// Online Viewer instead, which needs a short-lived public link to fetch
// the file itself (it can't send our JWT header).
const OFFICE_TYPES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];
const isOfficeType = (type = '') => OFFICE_TYPES.includes(type);

const UnsupportedPreview = ({ onDownload, message }) => (
  <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
    <FileWarning className="w-8 h-8" style={{ color: 'var(--c-text3)' }} />
    <div>
      <p className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>
        {message || 'No inline preview for this file type'}
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--c-text2)' }}>Download the file to view it.</p>
    </div>
    {onDownload && (
      <button onClick={onDownload} className="btn-secondary text-xs px-3 py-1.5">
        <Download className="w-3.5 h-3.5" /> Download
      </button>
    )}
  </div>
);

const PreviewPane = ({ docId, fileType, name, onDownload }) => {
  if (isOfficeType(fileType)) {
    return <OfficePreview docId={docId} name={name} onDownload={onDownload} />;
  }
  if (!isNativeType(fileType)) {
    return <UnsupportedPreview onDownload={onDownload} />;
  }
  return <NativePreview docId={docId} fileType={fileType} name={name} />;
};

// Preview/download need the JWT bearer token, which only axios attaches —
// a plain <img>/<embed> src or <a href> hits the API with no auth header and
// gets a 401 JSON body back. Fetching as an authenticated blob and pointing
// the element at a local object URL sidesteps that entirely.
const NativePreview = ({ docId, fileType, name }) => {
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError]     = useState(false);

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
        toast.error('Could not load preview.');
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

// Word/Excel/PowerPoint have no in-browser renderer, so a short-lived
// presigned S3 link is generated and handed to Microsoft's public viewer,
// which fetches the file directly (never touches our auth at all).
const OfficePreview = ({ docId, name, onDownload }) => {
  const [viewerUrl, setViewerUrl] = useState(null);
  const [error, setError]         = useState(false);

  useEffect(() => {
    let cancelled = false;
    setViewerUrl(null);
    setError(false);
    fetchDocumentUrl(docId, 1)
      .then(({ url }) => {
        if (cancelled) return;
        setViewerUrl(`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        toast.error('Could not load preview.');
      });
    return () => { cancelled = true; };
  }, [docId]);

  if (error) {
    return <UnsupportedPreview onDownload={onDownload} message="Preview unavailable" />;
  }
  if (!viewerUrl) {
    return <div className="flex items-center justify-center h-full"><Spinner /></div>;
  }

  return (
    <iframe
      src={viewerUrl}
      title={name}
      style={{ display: 'block', width: '100%', height: '100%', border: 'none', background: 'var(--c-bg)' }}
    />
  );
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
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('preview');
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

  const isAdmin = currentUser?.role === 'admin';
  const isOwner = !!currentUser?.id && currentUser.id === doc.owner_id;
  const isPrivate = doc.visibility === 'private';
  const [togglingVisibility, setTogglingVisibility] = useState(false);

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
      toast.success(`New version of "${doc.name}" uploaded`);
      onUpdate();
    } catch {
      toast.error('Version upload failed — please try again.');
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadDocumentFile(doc.id, doc.name);
    } catch {
      toast.error('Download failed — please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const toggleVisibility = async () => {
    setTogglingVisibility(true);
    try {
      const next = isPrivate ? 'public' : 'private';
      await updateDocument(doc.id, { visibility: next });
      toast.success(next === 'private' ? 'Document is now private' : 'Document is now visible to everyone');
      onUpdate();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Could not change visibility.');
    } finally {
      setTogglingVisibility(false);
    }
  };

  const handleMove = async () => {
    if (!moveWorkspaceId) return;
    setMoving(true);
    try {
      await updateDocument(doc.id, { workspace_id: moveWorkspaceId, folder_id: moveFolderId || null });
      const wsName = moveWorkspaces.find(w => w.id === moveWorkspaceId)?.name || moveWorkspaceId;
      toast.success(`Moved "${doc.name}" to ${wsName}`);
      setShowMove(false);
      onUpdate();
    } catch {
      toast.error('Move failed — please try again.');
    } finally {
      setMoving(false);
    }
  };

  const TABS = [
    { id: 'preview',  icon: Eye,   label: 'Preview'  },
    { id: 'versions', icon: Clock, label: 'Versions' },
  ];

  return (
    <Modal onClose={onClose} maxWidth="max-w-4xl">
      <div className="flex flex-col md:flex-row md:min-h-[520px] md:max-h-[82vh]">

        {/* ── Mobile-only top bar (name + close) — the panels below get
             reordered so preview shows first on mobile, which would push
             the desktop close button out of reach without this ──────── */}
        <div className="flex md:hidden items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--c-border)' }}>
          <p className="text-sm font-semibold truncate flex-1 mr-3" style={{ color: 'var(--c-text)' }}>{doc.name}</p>
          <button onClick={onClose} className="p-1 rounded-lg flex-shrink-0" style={{ color: 'var(--c-text2)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Left panel ─────────────────────── */}
        <div className="w-full md:w-60 flex flex-col flex-shrink-0 order-2 md:order-1 md:overflow-y-auto border-t md:border-t-0 md:border-r"
          style={{ borderColor: 'var(--c-border)' }}>
          <div className="p-5 flex flex-col gap-4 flex-1">
            <div className="hidden md:flex items-start justify-between">
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
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition mt-0.5 flex-shrink-0"
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

            {/* Visibility */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {isPrivate
                  ? <Lock className="w-3.5 h-3.5" style={{ color: 'var(--c-text2)' }} />
                  : <Globe className="w-3.5 h-3.5" style={{ color: 'var(--c-text2)' }} />}
                <span className="text-xs font-medium" style={{ color: 'var(--c-text)' }}>
                  {isPrivate ? 'Private — only you can see this' : 'Visible to everyone'}
                </span>
              </div>
              {isOwner && (
                <button onClick={toggleVisibility} disabled={togglingVisibility}
                  className="text-xs font-medium hover:underline disabled:opacity-50"
                  style={{ color: 'var(--c-accent-txt)' }}>
                  {togglingVisibility ? '…' : isPrivate ? 'Make public' : 'Make private'}
                </button>
              )}
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
        <div className="order-1 md:order-2 flex flex-col overflow-hidden h-[50vh] md:h-auto md:flex-1">
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
            {tab === 'preview' && (
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <PreviewPane docId={doc.id} fileType={doc.file_type} name={doc.name} onDownload={handleDownload} />
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
