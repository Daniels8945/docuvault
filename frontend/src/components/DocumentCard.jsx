import React from 'react';
import { format } from 'date-fns';
import FileIcon from './FileIcon';
import Badge from './ui/Badge';
import { formatFileSize } from '../lib/fileUtils';

const DocumentCard = ({ document: doc, onClick }) => (
  <div onClick={onClick} className="file-card fade-in-up">
    <div className="flex items-start justify-between mb-4">
      <FileIcon type={doc.file_type} />
      <Badge status={doc.status} />
    </div>

    <h3 className="font-semibold mb-1 truncate" title={doc.name}>{doc.name}</h3>

    <p className="text-xs text-gray-400 mb-3">
      v{doc.current_version} · {formatFileSize(doc.file_size)} · {format(new Date(doc.created_at), 'MMM d, yyyy')}
    </p>

    {doc.tags?.length > 0 && (
      <div className="flex flex-wrap gap-1">
        {doc.tags.slice(0, 2).map(tag => (
          <span key={tag} className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">{tag}</span>
        ))}
        {doc.tags.length > 2 && (
          <span className="text-xs px-2 py-0.5 rounded bg-gray-500/20 text-gray-400">+{doc.tags.length - 2}</span>
        )}
      </div>
    )}
  </div>
);

export default DocumentCard;
