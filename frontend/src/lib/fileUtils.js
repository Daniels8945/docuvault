export const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const getFileLabel = (type = '') => {
  if (type === 'application/pdf') return { label: 'PDF', color: 'from-red-500 to-red-600' };
  if (type.includes('word') || type.includes('document')) return { label: 'DOC', color: 'from-blue-500 to-blue-600' };
  if (type.includes('sheet') || type.includes('excel')) return { label: 'XLS', color: 'from-green-500 to-green-600' };
  if (type.includes('presentation') || type.includes('powerpoint')) return { label: 'PPT', color: 'from-orange-500 to-orange-600' };
  if (type.includes('image')) return { label: 'IMG', color: 'from-purple-500 to-purple-600' };
  return { label: 'FILE', color: 'from-gray-500 to-gray-600' };
};

export const STATUS_BADGE = {
  draft: 'bg-gray-500/20 text-gray-300',
  pending_approval: 'bg-yellow-500/20 text-yellow-300',
  approved: 'bg-green-500/20 text-green-300',
  rejected: 'bg-red-500/20 text-red-300',
};
