import React, { useState } from 'react';
import Modal from './ui/Modal';
import { createFolder } from '../services/api';

const CreateFolderModal = ({ workspaceId, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createFolder({ name: name.trim(), workspace_id: workspaceId });
      onCreated();
    } catch {
      alert('Failed to create folder.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title="New Folder" maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Folder Name</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Contracts Q1 2026"
            className="input-field w-full"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={!name.trim() || saving} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Folder'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateFolderModal;
