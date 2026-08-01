import React, { useState, useEffect, useRef } from 'react';
import { FolderOpen, MoreVertical, Info, Pencil, FolderInput, Trash2, X, Check, StickyNote, Send } from 'lucide-react';
import { format } from 'date-fns';
import Modal from './ui/Modal';
import { updateFolder, deleteFolder, fetchFolderNotes, createFolderNote, deleteFolderNote } from '../services/api';
import toast from 'react-hot-toast';

// Every folder in the workspace's own descendants, walked via parent_folder_id —
// used to stop a folder being moved into (or renamed to look like it's inside)
// one of its own children.
const collectDescendantIds = (folderId, allFolders) => {
  const ids = new Set();
  const queue = [folderId];
  while (queue.length) {
    const current = queue.pop();
    for (const f of allFolders) {
      if (f.parent_folder_id === current && !ids.has(f.id)) {
        ids.add(f.id);
        queue.push(f.id);
      }
    }
  }
  return ids;
};

const FolderCard = ({ folder, allFolders, canEdit, isAdmin, currentUser, onOpen, onChanged }) => {
  const [menuOpen, setMenuOpen]     = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showRename, setShowRename]   = useState(false);
  const [showMove, setShowMove]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [menuOpen]);

  const subfolderCount = allFolders.filter(f => f.parent_folder_id === folder.id).length;
  const parentName = allFolders.find(f => f.id === folder.parent_folder_id)?.name;

  const handleDelete = async () => {
    try {
      await deleteFolder(folder.id);
      toast.success(`Folder "${folder.name}" deleted`);
      onChanged();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to delete folder.');
    }
  };

  return (
    <div
      className="group relative flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer transition-all duration-150"
      style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
      onClick={() => onOpen(folder.id)}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-hover)'; e.currentTarget.style.borderColor = 'var(--c-border2)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-surface)'; e.currentTarget.style.borderColor = 'var(--c-border)'; }}
    >
      <FolderOpen className="w-7 h-7" style={{ color: 'var(--c-accent-txt)' }} />
      <p className="text-xs font-medium text-center truncate w-full" style={{ color: 'var(--c-text)' }}>{folder.name}</p>
      <p className="text-xs" style={{ color: 'var(--c-text2)' }}>{folder.document_count ?? 0} docs</p>

      <button
        onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition p-0.5 rounded"
        style={{ color: 'var(--c-text2)', background: menuOpen ? 'var(--c-surface2)' : 'transparent' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--c-text)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text2)'}
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>

      {menuOpen && (
        <div ref={menuRef} onClick={e => e.stopPropagation()}
          className="absolute top-8 right-2 z-20 rounded-lg overflow-hidden py-1"
          style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.16)', minWidth: 150 }}
        >
          <button onClick={() => { setMenuOpen(false); setShowDetails(true); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors"
            style={{ color: 'var(--c-text)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--c-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <Info className="w-3.5 h-3.5" /> Details
          </button>
          {canEdit && (
            <button onClick={() => { setMenuOpen(false); setShowRename(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors"
              style={{ color: 'var(--c-text)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--c-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Pencil className="w-3.5 h-3.5" /> Rename
            </button>
          )}
          {canEdit && (
            <button onClick={() => { setMenuOpen(false); setShowMove(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors"
              style={{ color: 'var(--c-text)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--c-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <FolderInput className="w-3.5 h-3.5" /> Move
            </button>
          )}
          {isAdmin && (
            <button onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors"
              style={{ color: 'var(--c-danger)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--c-danger-bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
        </div>
      )}

      {confirmDelete && (
        <div onClick={e => e.stopPropagation()}
          className="absolute top-8 right-2 z-20 rounded-lg p-3 space-y-2"
          style={{ background: 'var(--c-danger-bg)', border: '1px solid rgba(239,68,68,0.2)', boxShadow: '0 8px 24px rgba(0,0,0,0.16)', minWidth: 180 }}>
          <p className="text-xs" style={{ color: 'var(--c-danger)' }}>Delete "{folder.name}"?</p>
          <div className="flex gap-2">
            <button onClick={handleDelete}
              className="flex-1 text-xs font-semibold py-1 rounded-lg text-white"
              style={{ background: 'var(--c-danger)' }}>Yes</button>
            <button onClick={() => setConfirmDelete(false)} className="btn-secondary text-xs px-2 py-1 flex-1">Cancel</button>
          </div>
        </div>
      )}

      {showDetails && (
        <FolderDetailsModal folder={folder} subfolderCount={subfolderCount} parentName={parentName}
          currentUser={currentUser} isAdmin={isAdmin}
          onClose={() => setShowDetails(false)} />
      )}
      {showRename && (
        <RenameFolderModal folder={folder} onClose={() => setShowRename(false)} onRenamed={onChanged} />
      )}
      {showMove && (
        <MoveFolderModal folder={folder} allFolders={allFolders}
          onClose={() => setShowMove(false)} onMoved={onChanged} />
      )}
    </div>
  );
};

const FolderDetailsModal = ({ folder, subfolderCount, parentName, currentUser, isAdmin, onClose }) => {
  const [notes, setNotes]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft]     = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetchFolderNotes(folder.id).then(setNotes).finally(() => setLoading(false));
  }, [folder.id]);

  const handlePost = async () => {
    if (!draft.trim()) return;
    setPosting(true);
    try {
      const note = await createFolderNote(folder.id, draft.trim());
      setNotes(prev => [...prev, note]);
      setDraft('');
    } catch {
      toast.error('Could not post note — please try again.');
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await deleteFolderNote(folder.id, noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch {
      toast.error('Could not delete note.');
    }
  };

  return (
    <Modal onClose={onClose} title="Folder Details" maxWidth="max-w-md">
      <div className="p-6 space-y-4 text-sm">
        <div className="space-y-2.5">
          {[
            ['Name', folder.name],
            ['Location', parentName || 'Workspace root'],
            ['Documents', folder.document_count ?? 0],
            ['Subfolders', subfolderCount],
            ['Created by', folder.created_by_name || 'Unknown'],
            ['Created', format(new Date(folder.created_at), 'MMM d, yyyy · h:mm a')],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between">
              <span style={{ color: 'var(--c-text2)' }}>{label}</span>
              <span style={{ color: 'var(--c-text)', fontWeight: 500 }}>{value}</span>
            </div>
          ))}
        </div>

        <div className="pt-1" style={{ borderTop: '1px solid var(--c-border)' }}>
          <div className="flex items-center gap-1.5 py-3">
            <StickyNote className="w-3.5 h-3.5" style={{ color: 'var(--c-text2)' }} />
            <span className="section-label">Notes & Instructions</span>
          </div>

          <div className="space-y-2 mb-3" style={{ maxHeight: 220, overflowY: 'auto' }}>
            {loading ? (
              <p className="text-xs" style={{ color: 'var(--c-text2)' }}>Loading…</p>
            ) : notes.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--c-text2)' }}>
                No notes yet — leave instructions for whoever uses this folder next.
              </p>
            ) : notes.map(n => (
              <div key={n.id} className="p-2.5 rounded-lg"
                style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)' }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs whitespace-pre-wrap break-words flex-1" style={{ color: 'var(--c-text)' }}>
                    {n.content}
                  </p>
                  {(n.author_id === currentUser?.id || isAdmin) && (
                    <button onClick={() => handleDeleteNote(n.id)} className="flex-shrink-0"
                      style={{ color: 'var(--c-text2)' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--c-danger)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text2)'}>
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <p className="text-xs mt-1.5" style={{ color: 'var(--c-text2)' }}>
                  {n.author_name} · {format(new Date(n.created_at), 'MMM d, h:mm a')}
                </p>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePost()}
              placeholder="Leave a note or instruction…"
              className="input-field flex-1 text-xs py-1.5" />
            <button onClick={handlePost} disabled={!draft.trim() || posting}
              className="btn-primary text-xs px-3 disabled:opacity-40">
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <button onClick={onClose} className="btn-secondary w-full text-sm mt-1">Close</button>
      </div>
    </Modal>
  );
};

const RenameFolderModal = ({ folder, onClose, onRenamed }) => {
  const [name, setName] = useState(folder.name);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === folder.name) { onClose(); return; }
    setSaving(true);
    try {
      await updateFolder(folder.id, { name: name.trim() });
      toast.success(`Renamed to "${name.trim()}"`);
      onRenamed();
      onClose();
    } catch {
      toast.error('Rename failed — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Rename Folder" maxWidth="max-w-sm">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <input autoFocus value={name} onChange={e => setName(e.target.value)}
          className="input-field w-full" />
        <div className="flex gap-3">
          <button type="submit" disabled={!name.trim() || saving} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </Modal>
  );
};

const MoveFolderModal = ({ folder, allFolders, onClose, onMoved }) => {
  const [target, setTarget] = useState(folder.parent_folder_id || '');
  const [saving, setSaving] = useState(false);

  const blocked = collectDescendantIds(folder.id, allFolders);
  blocked.add(folder.id);
  const candidates = allFolders.filter(f => f.workspace_id === folder.workspace_id && !blocked.has(f.id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newParent = target || null;
    if ((newParent || null) === (folder.parent_folder_id || null)) { onClose(); return; }
    setSaving(true);
    try {
      await updateFolder(folder.id, { parent_folder_id: newParent });
      const destName = candidates.find(f => f.id === newParent)?.name || 'workspace root';
      toast.success(`Moved "${folder.name}" to ${destName}`);
      onMoved();
      onClose();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Move failed — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Move Folder" maxWidth="max-w-sm">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--c-text2)' }}>Destination</label>
          <select value={target} onChange={e => setTarget(e.target.value)} className="input-field w-full text-sm">
            <option value="">Workspace root</option>
            {candidates.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Moving…' : 'Move'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </Modal>
  );
};

export default FolderCard;
