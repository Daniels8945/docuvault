import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// ── Organizations ──────────────────────────────────────────────────────────────
export const fetchOrganizations = () => api.get('/organizations').then(r => r.data);
export const createOrganization = (data) => api.post('/organizations', data).then(r => r.data);

// ── Workspaces ─────────────────────────────────────────────────────────────────
export const fetchWorkspaces = (orgId = null) =>
  api.get('/workspaces', { params: orgId ? { org_id: orgId } : {} }).then(r => r.data);
export const fetchWorkspace = (id) => api.get(`/workspaces/${id}`).then(r => r.data);
export const createWorkspace = (data) => api.post('/workspaces', data).then(r => r.data);
export const deleteWorkspace = (id) => api.delete(`/workspaces/${id}`).then(r => r.data);

// ── Folders ────────────────────────────────────────────────────────────────────
export const fetchFolders = (workspaceId = null) =>
  api.get('/folders', { params: workspaceId ? { workspace_id: workspaceId } : {} }).then(r => r.data);
export const createFolder = (data) => api.post('/folders', data).then(r => r.data);
export const deleteFolder = (id) => api.delete(`/folders/${id}`).then(r => r.data);

// ── Documents ──────────────────────────────────────────────────────────────────
export const fetchDocuments = (filters = {}) =>
  api.get('/documents', { params: filters }).then(r => r.data);

export const uploadDocument = (file, metadata) => {
  const form = new FormData();
  form.append('file', file);
  Object.entries(metadata).forEach(([k, v]) => { if (v != null) form.append(k, v); });
  return api.post('/documents/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
};

export const updateDocument = (id, data) => api.put(`/documents/${id}`, data).then(r => r.data);
export const deleteDocument = (id) => api.delete(`/documents/${id}`).then(r => r.data);
export const downloadDocument = (id) => `/api/documents/${id}/download`;

// ── Versions ───────────────────────────────────────────────────────────────────
export const fetchDocumentVersions = (id) =>
  api.get(`/documents/${id}/versions`).then(r => r.data);

export const uploadNewVersion = (documentId, file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post(`/documents/${documentId}/versions`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

// ── Approvals ──────────────────────────────────────────────────────────────────
export const fetchApprovals = (filters = {}) =>
  api.get('/approvals', { params: filters }).then(r => r.data);
export const createApproval = (data) => api.post('/approvals', data).then(r => r.data);
export const updateApproval = (id, data) => api.put(`/approvals/${id}`, data).then(r => r.data);

// ── Users ──────────────────────────────────────────────────────────────────────
export const fetchCurrentUser = () => api.get('/users/me').then(r => r.data);

// ── WhatsApp Rules ─────────────────────────────────────────────────────────────
export const fetchWhatsAppRules = () => api.get('/whatsapp/rules').then(r => r.data);
export const createWhatsAppRule = (data) => api.post('/whatsapp/rules', data).then(r => r.data);
export const deleteWhatsAppRule = (id) => api.delete(`/whatsapp/rules/${id}`).then(r => r.data);
