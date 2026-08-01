import React, { useState, useRef } from 'react';
import { Upload, File, X, CheckCircle, Lock } from 'lucide-react';
import Modal from './ui/Modal';
import { uploadDocument } from '../services/api';
import { formatFileSize } from '../lib/fileUtils';
import { useToast } from '../lib/ToastContext';

const UploadModal = ({ workspaceId, folderId, onClose, onComplete }) => {
  const { toast } = useToast();
  const [files, setFiles]         = useState([]);
  const [tags, setTags]           = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const [done, setDone]           = useState(false);
  const inputRef = useRef(null);

  const addFiles = (incoming) => setFiles(prev => [...prev, ...Array.from(incoming)]);
  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        await uploadDocument(file, {
          workspace_id: workspaceId, folder_id: folderId, tags,
          visibility: isPrivate ? 'private' : 'public',
        });
      }
      setDone(true);
      const label = files.length === 1 ? `"${files[0].name}"` : `${files.length} files`;
      toast(`${label} uploaded successfully`, 'success');
      setTimeout(() => onComplete(), 1400);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : 'Upload failed — please try again.';
      toast(msg, 'error');
    } finally {
      setUploading(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (done) {
    return (
      <Modal onClose={onClose} title="Upload Documents">
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '48px 32px', gap: 16,
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(34,197,94,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'success-pop 0.4s cubic-bezier(.22,.68,0,1.4) forwards',
          }}>
            <CheckCircle size={40} style={{ color: '#22c55e' }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text)' }}>
            {files.length === 1 ? 'File uploaded!' : `${files.length} files uploaded!`}
          </p>
          <p style={{ fontSize: 13, color: 'var(--c-text2)' }}>Refreshing workspace…</p>
          <style>{`
            @keyframes success-pop {
              from { transform: scale(0.4); opacity: 0; }
              to   { transform: scale(1);   opacity: 1; }
            }
          `}</style>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title="Upload Documents">
      <div className="p-6 space-y-5">
        <div
          className={`dropzone ${dragOver ? 'dragover' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        >
          <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="font-semibold mb-1">Drag & Drop Files</p>
          <p className="text-sm text-gray-400 mb-4">or click to browse</p>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
          <button onClick={() => inputRef.current?.click()} className="btn-primary text-sm px-4 py-2">
            Select Files
          </button>
        </div>

        {files.length > 0 && (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {files.map((file, i) => (
              <div key={i} className="glass-card p-3 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <File className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium truncate max-w-xs">{file.name}</p>
                    <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <button onClick={() => removeFile(i)} className="text-gray-500 hover:text-red-400 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Tags (comma-separated)</label>
          <input
            type="text"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="contract, Q1-2026, legal"
            className="input-field w-full"
          />
        </div>

        <label className="flex items-start gap-3 p-3 rounded-lg cursor-pointer"
          style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)' }}>
          <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)}
            className="mt-0.5" style={{ accentColor: 'var(--c-accent)' }} />
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" style={{ color: 'var(--c-text2)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>Keep this private</span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--c-text2)' }}>
              Only visible to you — not even admins can see it. You can make it public later.
            </p>
          </div>
        </label>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleUpload}
            disabled={!files.length || uploading}
            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading…' : `Upload ${files.length || ''} File${files.length !== 1 ? 's' : ''}`}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </Modal>
  );
};

export default UploadModal;
