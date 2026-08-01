import React from 'react';
import { format } from 'date-fns';
import { Lock } from 'lucide-react';
import FileIcon from './FileIcon';
import { formatFileSize } from '../lib/fileUtils';

const DocumentCard = ({ document: doc, onClick }) => {
  return (
    <div onClick={onClick} className="file-card fade-in-up">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <FileIcon type={doc.file_type} size="md" />
          <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
            {doc.visibility === 'private' && (
              <Lock className="w-3 h-3" style={{ color: 'var(--c-text2)' }} />
            )}
            <span className="text-xs" style={{ color: 'var(--c-text2)' }}>
              {formatFileSize(doc.file_size)}
            </span>
          </div>
        </div>
        <h3 className="font-semibold text-sm leading-snug mb-1 line-clamp-2"
          style={{ color: 'var(--c-text)' }} title={doc.name}>
          {doc.name}
        </h3>
        <p className="text-xs mb-3" style={{ color: 'var(--c-text2)' }}>
          {format(new Date(doc.created_at), 'MMM d, yyyy')}
          {doc.uploaded_by === 'whatsapp' ? ' · WhatsApp' : doc.uploaded_by ? ` · ${doc.uploaded_by}` : ''}
        </p>
        {doc.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {doc.tags.slice(0, 2).map(tag => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-md font-medium"
                style={{ background: 'var(--c-accent-bg)', color: 'var(--c-accent-txt)' }}>
                {tag}
              </span>
            ))}
            {doc.tags.length > 2 && (
              <span className="text-xs px-2 py-0.5 rounded-md"
                style={{ background: 'var(--c-surface2)', color: 'var(--c-text2)' }}>
                +{doc.tags.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentCard;
