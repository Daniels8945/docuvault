import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// ── Request interceptor — attach token from localStorage on every request ─────
// axios.create() copies defaults at creation time; subsequent changes to
// axios.defaults do NOT propagate to custom instances. Reading from localStorage
// on each request is the only reliable way to keep the header in sync.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dv-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── 401 interceptor — redirect to /login when token expires ───────────────────
api.interceptors.response.use(
  res => res,
  err => {
    if (err?.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('dv-token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// ── Auth ───────────────────────────────────────────────────────────────────────
export const fetchSetupStatus = () => api.get('/auth/setup-status').then(r => r.data);

export const loginUser = (email, password) => {
  const form = new URLSearchParams();
  form.append('username', email); // OAuth2PasswordRequestForm uses 'username'
  form.append('password', password);
  return api.post('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }).then(r => r.data);
};

export const registerFirstAdmin = (data) =>
  api.post('/auth/register', data).then(r => r.data);

// ── Organizations ──────────────────────────────────────────────────────────────
export const fetchOrganizations  = ()         => api.get('/organizations').then(r => r.data);
export const createOrganization  = (data)     => api.post('/organizations', data).then(r => r.data);
export const updateOrganization  = (id, data) => api.patch(`/organizations/${id}`, data).then(r => r.data);
export const deleteOrganization  = (id)       => api.delete(`/organizations/${id}`).then(r => r.data);

// ── Workspaces ─────────────────────────────────────────────────────────────────
export const fetchWorkspaces  = (orgId = null) =>
  api.get('/workspaces', { params: orgId ? { org_id: orgId } : {} }).then(r => r.data);
export const fetchWorkspace   = (id)       => api.get(`/workspaces/${id}`).then(r => r.data);
export const createWorkspace  = (data)     => api.post('/workspaces', data).then(r => r.data);
export const updateWorkspace  = (id, data) => api.patch(`/workspaces/${id}`, data).then(r => r.data);
export const deleteWorkspace  = (id)       => api.delete(`/workspaces/${id}`).then(r => r.data);

// ── Folders ────────────────────────────────────────────────────────────────────
export const fetchFolders = (workspaceId = null) =>
  api.get('/folders', { params: workspaceId ? { workspace_id: workspaceId } : {} }).then(r => r.data);
export const createFolder = (data) => api.post('/folders', data).then(r => r.data);
export const deleteFolder = (id)   => api.delete(`/folders/${id}`).then(r => r.data);

// ── Documents ──────────────────────────────────────────────────────────────────
export const fetchDocuments = (filters = {}) =>
  api.get('/documents', { params: filters }).then(r => r.data);

export const uploadDocument = (file, metadata) => {
  const form = new FormData();
  form.append('file', file);
  Object.entries(metadata).forEach(([k, v]) => { if (v != null) form.append(k, v); });
  return api.post('/documents/upload', form).then(r => r.data);
};

export const updateDocument   = (id, data) => api.put(`/documents/${id}`, data).then(r => r.data);
export const deleteDocument   = (id)       => api.delete(`/documents/${id}`).then(r => r.data);
export const downloadDocument = (id)       => `/api/documents/${id}/download`;
export const previewDocument  = (id)       => `/api/documents/${id}/preview`;

// ── Versions ───────────────────────────────────────────────────────────────────
export const fetchDocumentVersions = (id) =>
  api.get(`/documents/${id}/versions`).then(r => r.data);

export const uploadNewVersion = (documentId, file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post(`/documents/${documentId}/versions`, form).then(r => r.data);
};

// ── Users ──────────────────────────────────────────────────────────────────────
export const fetchCurrentUser = () => api.get('/users/me').then(r => r.data);
export const fetchUsers       = () => api.get('/users').then(r => r.data);
export const createUser       = (data) => api.post('/users', data).then(r => r.data);
export const deleteUser       = (id)   => api.delete(`/users/${id}`).then(r => r.data);

// ── WhatsApp Rules ─────────────────────────────────────────────────────────────
export const fetchWhatsAppRules  = ()       => api.get('/whatsapp/rules').then(r => r.data);
export const createWhatsAppRule  = (data)   => api.post('/whatsapp/rules', data).then(r => r.data);
export const deleteWhatsAppRule  = (id)     => api.delete(`/whatsapp/rules/${id}`).then(r => r.data);

// ── Approvals ──────────────────────────────────────────────────────────────────
export const fetchApprovals  = (filters = {}) => api.get('/approvals', { params: filters }).then(r => r.data);
export const createApproval  = (data)         => api.post('/approvals', data).then(r => r.data);
export const updateApproval  = (id, data)     => api.put(`/approvals/${id}`, data).then(r => r.data);
