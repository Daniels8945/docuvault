import React, { useState, useEffect } from 'react';
import { Lock, Globe, X, UserPlus } from 'lucide-react';
import Modal from './ui/Modal';
import toast from 'react-hot-toast';
import {
  fetchOrganizationMembers, addOrganizationMember, removeOrganizationMember, updateOrganization,
  fetchWorkspaceMembers, addWorkspaceMember, removeWorkspaceMember, updateWorkspace,
  fetchUserDirectory,
} from '../services/api';

const API = {
  organization: {
    fetchMembers: fetchOrganizationMembers,
    addMember: addOrganizationMember,
    removeMember: removeOrganizationMember,
    update: updateOrganization,
  },
  workspace: {
    fetchMembers: fetchWorkspaceMembers,
    addMember: addWorkspaceMember,
    removeMember: removeWorkspaceMember,
    update: updateWorkspace,
  },
};

const ShareModal = ({ resourceType, resource, onClose, onUpdated }) => {
  const api = API[resourceType];
  const [visibility, setVisibility] = useState(resource.visibility || 'public');
  const [members, setMembers] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    Promise.all([api.fetchMembers(resource.id), fetchUserDirectory()])
      .then(([m, d]) => { setMembers(m); setDirectory(d); })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource.id]);

  const memberIds = new Set(members.map(m => m.user_id));
  const candidates = directory.filter(u => u.id !== resource.owner_id && !memberIds.has(u.id));

  const toggleVisibility = async () => {
    const next = visibility === 'private' ? 'public' : 'private';
    setTogglingVisibility(true);
    try {
      await api.update(resource.id, { visibility: next });
      setVisibility(next);
      toast.success(next === 'private' ? 'Now private' : 'Now visible to everyone');
      onUpdated(next);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Could not change visibility.');
    } finally {
      setTogglingVisibility(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    setAddingMember(true);
    try {
      const member = await api.addMember(resource.id, selectedUserId);
      setMembers(prev => [...prev, member]);
      setSelectedUserId('');
      toast.success(`Shared with ${member.user_name}`);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Could not add member.');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId, name) => {
    try {
      await api.removeMember(resource.id, userId);
      setMembers(prev => prev.filter(m => m.user_id !== userId));
      toast.success(`Removed ${name}`);
    } catch {
      toast.error('Could not remove member.');
    }
  };

  return (
    <Modal onClose={onClose} title={`Share "${resource.name}"`} maxWidth="max-w-md">
      <div className="p-6 space-y-5">
        {/* Visibility toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg"
          style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)' }}>
          <div className="flex items-center gap-2">
            {visibility === 'private'
              ? <Lock className="w-4 h-4" style={{ color: 'var(--c-text2)' }} />
              : <Globe className="w-4 h-4" style={{ color: 'var(--c-text2)' }} />}
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>
                {visibility === 'private' ? 'Private' : 'Visible to everyone'}
              </p>
              <p className="text-xs" style={{ color: 'var(--c-text2)' }}>
                {visibility === 'private'
                  ? 'Only you and people added below can see this'
                  : 'Any signed-in staff member can see this'}
              </p>
            </div>
          </div>
          <button onClick={toggleVisibility} disabled={togglingVisibility}
            className="btn-secondary text-xs px-3 py-1.5 flex-shrink-0 disabled:opacity-50">
            {togglingVisibility ? '…' : visibility === 'private' ? 'Make public' : 'Make private'}
          </button>
        </div>

        {/* Members */}
        {visibility === 'private' && (
          <div className="space-y-3">
            <p className="section-label">Shared with</p>
            {loading ? (
              <p className="text-xs" style={{ color: 'var(--c-text2)' }}>Loading…</p>
            ) : members.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--c-text2)' }}>Nobody yet — add a colleague below.</p>
            ) : (
              <div className="space-y-1.5">
                {members.map(m => (
                  <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
                    style={{ background: 'var(--c-surface2)' }}>
                    <div>
                      <p className="text-xs font-medium" style={{ color: 'var(--c-text)' }}>{m.user_name}</p>
                      <p className="text-xs" style={{ color: 'var(--c-text2)' }}>{m.user_email}</p>
                    </div>
                    <button onClick={() => handleRemoveMember(m.user_id, m.user_name)}
                      style={{ color: 'var(--c-text2)' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--c-danger)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text2)'}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
                className="input-field flex-1 text-sm">
                <option value="">Select a person…</option>
                {candidates.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </select>
              <button onClick={handleAddMember} disabled={!selectedUserId || addingMember}
                className="btn-primary text-xs px-3 disabled:opacity-40">
                <UserPlus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <button onClick={onClose} className="btn-secondary w-full text-sm">Done</button>
      </div>
    </Modal>
  );
};

export default ShareModal;
