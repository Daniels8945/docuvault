export const formatFileSize = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const getFileLabel = (type = '') => {
  if (type === 'application/pdf')                                                  return { label: 'PDF', color: '#ef4444' };
  if (type.includes('word') || type.includes('document'))                          return { label: 'DOC', color: '#3b82f6' };
  if (type.includes('sheet') || type.includes('excel'))                            return { label: 'XLS', color: '#22c55e' };
  if (type.includes('presentation') || type.includes('powerpoint'))                return { label: 'PPT', color: '#f97316' };
  if (type.startsWith('image/'))                                                   return { label: 'IMG', color: '#a855f7' };
  if (type === 'text/plain')                                                       return { label: 'TXT', color: '#64748b' };
  return { label: 'FILE', color: '#475569' };
};

export const STATUS_BADGE = {
  draft:            'badge-draft',
  active:           'badge-active',
  pending_approval: 'badge-pending',
  approved:         'badge-approved',
  rejected:         'badge-rejected',
};

export const STATUS_LABEL = {
  draft:            'Draft',
  active:           'Active',
  pending_approval: 'Pending',
  approved:         'Approved',
  rejected:         'Rejected',
};
