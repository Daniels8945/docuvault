import React, { useState, useEffect, useRef } from 'react';
import { Download, Trash2, CheckCircle, XCircle, Send, Upload, Pencil, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import FileIcon from './FileIcon';
import Badge from './ui/Badge';
import Spinner from './ui/Spinner';
import Modal from './ui/Modal';
import { formatFileSize } from '../lib/fileUtils';
import {
  fetchDocumentVersions, fetchApprovals, createApproval, updateApproval,
  updateDocument, deleteDocument, uploadNewVersion, downloadDocument,
} from '../services/api';

const TAB = { VERSIONS: 'versions', APPROVALS: 'approvals' };

const DocumentModal = ({ document: doc, currentUser, onClose, onUpdate }) => {
  const [versions, setVersions] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(TAB.VERSIONS);

  const [editName, setEditName] = useState(false);
  const [name, setName] = useState(doc.name);
  const [editTags, setEditTags] = useState(false);
  const [tags, setTags] = useState((doc.tags || []).join(', '));

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const versionInputRef = useRef(null);

  useEffect(() => {
    Promise.all([fetchDocumentVersions(doc.id), fetchApprovals({ document_id: doc.id })])
      .then(([v, a]) => { setVersions(v); setApprovals(a); })
      .finally(() => setLoading(false));
  }, [doc.id]);

  const save = async (patch) => {
    setSaving(true);
    try {
      await updateDocument(doc.id, patch);
      onUpdate();
    } finally {
      setSaving(false);
    }
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

  const handleSubmitApproval = async () => {
    await createApproval({ document_id: doc.id, submitted_by: currentUser.id, reviewers: ['Admin'] });
    onUpdate();
  };

  const handleReview = async (status) => {
    const latest = approvals.at(-1);
    if (!latest) return;
    await updateApproval(latest.id, { status, reviewed_by: currentUser.id });
    onUpdate();
  };

  const handleVersionUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadNewVersion(doc.id, file);
    onUpdate();
  };

  const isAdmin = currentUser?.role === 'admin';
  const isPending = doc.status === 'pending_approval';

  return (
    <Modal onClose={onClose} maxWidth="max-w-4xl">
      <div className="flex h-[80vh]">

        {/* ── Left panel ── */}
        <div className="w-72 border-r border-white/10 p-6 flex flex-col gap-5 overflow-y-auto flex-shrink-0">
          <div className="flex items-start justify-between">
            <FileIcon type={doc.file_type} size="lg" />
            <button onClick={onClose} className="text-gray-400 hover:text-white transition mt-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Editable name */}
          <div>
            {editName ? (
              <div className="flex gap-2">
                <input autoFocus value={name} onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveName()}
                  className="input-field flex-1 text-sm py-1.5" />
                <button onClick={saveName} className="text-green-400 hover:text-green-300"><Check className="w-4 h-4" /></button>
                <button onClick={() => { setEditName(false); setName(doc.name); }} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex items-start gap-2 group">
                <p className="font-semibold leading-snug break-all">{doc.name}</p>
                {isAdmin && (
                  <button onClick={() => setEditName(true)} className="opacity-0 group-hover:opacity-100 transition text-gray-400 hover:text-white mt-0.5 flex-shrink-0">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          <Badge status={doc.status} />

          <div className="text-sm text-gray-400 space-y-1">
            <p>{formatFileSize(doc.file_size)}</p>
            <p>Version {doc.current_version}</p>
            <p>{format(new Date(doc.created_at), 'MMM d, yyyy h:mm a')}</p>
            <p>By {doc.uploaded_by}</p>
          </div>

          {/* Editable tags */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Tags</span>
              {isAdmin && !editTags && (
                <button onClick={() => setEditTags(true)} className="text-gray-500 hover:text-white transition"><Pencil className="w-3 h-3" /></button>
              )}
            </div>
            {editTags ? (
              <div className="space-y-2">
                <input value={tags} onChange={e => setTags(e.target.value)} placeholder="comma, separated"
                  className="input-field w-full text-sm py-1.5" />
                <div className="flex gap-2">
                  <button onClick={saveTags} className="btn-primary text-xs px-3 py-1">Save</button>
                  <button onClick={() => setEditTags(false)} className="btn-secondary text-xs px-3 py-1">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {doc.tags?.length ? doc.tags.map(t => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">{t}</span>
                )) : <span className="text-xs text-gray-500">No tags</span>}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2 mt-auto">
            {doc.status === 'draft' && (
              <button onClick={handleSubmitApproval} className="btn-primary w-full flex items-center justify-center gap-2 text-sm">
                <Send className="w-4 h-4" /> Submit for Approval
              </button>
            )}
            {isPending && isAdmin && (
              <>
                <button onClick={() => handleReview('approved')} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2.5 rounded-lg transition text-sm">
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
                <button onClick={() => handleReview('rejected')} className="w-full flex items-center justify-center gap-2 bg-red-600/80 hover:bg-red-700 text-white font-semibold px-4 py-2.5 rounded-lg transition text-sm">
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              </>
            )}
            <a href={downloadDocument(doc.id)} target="_blank" rel="noreferrer"
              className="btn-secondary w-full flex items-center justify-center gap-2 text-sm">
              <Download className="w-4 h-4" /> Download
            </a>
            {isAdmin && (
              confirmDelete ? (
                <div className="glass-card p-3 rounded-lg space-y-2">
                  <p className="text-sm text-red-400">Delete this document?</p>
                  <div className="flex gap-2">
                    <button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex-1 transition">
                      Yes, delete
                    </button>
                    <button onClick={() => setConfirmDelete(false)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300 text-sm py-2 transition">
                  <Trash2 className="w-4 h-4" /> Delete Document
                </button>
              )
            )}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-white/10 px-6 flex-shrink-0">
            {[TAB.VERSIONS, TAB.APPROVALS].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-4 text-sm font-medium capitalize border-b-2 transition -mb-px ${tab === t ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {loading ? <Spinner /> : tab === TAB.VERSIONS ? (
              <div className="space-y-3">
                <input ref={versionInputRef} type="file" className="hidden" onChange={handleVersionUpload} />
                <button onClick={() => versionInputRef.current?.click()}
                  className="btn-secondary w-full flex items-center justify-center gap-2 text-sm mb-4">
                  <Upload className="w-4 h-4" /> Upload New Version
                </button>
                {versions.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-8">No version history</p>
                ) : versions.slice().reverse().map(v => (
                  <div key={v.id} className="glass-card p-4 rounded-lg flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">Version {v.version_number}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {v.uploaded_by} · {format(new Date(v.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                      {v.notes && <p className="text-xs text-gray-500 mt-1 italic">"{v.notes}"</p>}
                    </div>
                    {v.version_number === doc.current_version && (
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">Current</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {approvals.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-8">No approval history</p>
                ) : approvals.slice().reverse().map(a => (
                  <div key={a.id} className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge status={a.status} />
                      <span className="text-xs text-gray-400">{format(new Date(a.submitted_at), 'MMM d, yyyy')}</span>
                    </div>
                    <p className="text-sm text-gray-300">Submitted by {a.submitted_by}</p>
                    {a.reviewed_by && (
                      <p className="text-xs text-gray-500 mt-1">
                        Reviewed by {a.reviewed_by}
                        {a.reviewed_at && ` on ${format(new Date(a.reviewed_at), 'MMM d, yyyy')}`}
                      </p>
                    )}
                    {a.notes && <p className="text-xs text-gray-500 mt-1 italic">"{a.notes}"</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DocumentModal;
