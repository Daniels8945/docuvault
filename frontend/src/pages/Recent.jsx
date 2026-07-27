import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { fetchDocuments } from '../services/api';
import DocumentModal from '../components/DocumentModal';
import FileIcon from '../components/FileIcon';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { formatFileSize } from '../lib/fileUtils';

const dateLabel = (dateStr) => {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  if (isThisWeek(d)) return 'This Week';
  return format(d, 'MMMM yyyy');
};

const Recent = ({ selectedWorkspace, currentUser }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);

  const load = () => {
    setLoading(true);
    fetchDocuments(selectedWorkspace ? { workspace_id: selectedWorkspace } : {})
      .then(docs => setDocuments(
        docs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50)
      ))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [selectedWorkspace]);
  useEffect(() => { document.title = 'Recent | DocuVault'; }, []);

  const groups = documents.reduce((acc, doc) => {
    const label = dateLabel(doc.created_at);
    (acc[label] = acc[label] || []).push(doc);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="px-8 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--c-border)' }}>
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5" style={{ color: 'var(--c-text2)' }} />
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--c-text)' }}>Recent</h2>
            <p className="text-xs" style={{ color: 'var(--c-text2)' }}>Last 50 documents</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading ? <Spinner /> : documents.length === 0 ? (
          <EmptyState icon={Clock} title="Nothing here yet" description="Uploaded documents will appear here." />
        ) : (
          <div className="space-y-7">
            {Object.entries(groups).map(([label, docs]) => (
              <div key={label} className="fade-in-up">
                <p className="section-label mb-3">{label}</p>
                <div className="rounded-xl overflow-hidden"
                  style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
                  {docs.map((doc, i) => (
                    <div key={doc.id} onClick={() => setSelectedDoc(doc)}
                      className="flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors"
                      style={i < docs.length - 1 ? { borderBottom: '1px solid var(--c-border)' } : {}}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--c-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <FileIcon type={doc.file_type} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--c-text)' }}>{doc.name}</p>
                        <p className="text-xs" style={{ color: 'var(--c-text2)' }}>
                          {doc.uploaded_by} · {formatFileSize(doc.file_size)}
                        </p>
                      </div>
                      <p className="text-xs flex-shrink-0 hidden md:block" style={{ color: 'var(--c-text2)' }}>
                        {format(new Date(doc.created_at), 'h:mm a')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedDoc && (
        <DocumentModal document={selectedDoc} currentUser={currentUser}
          onClose={() => setSelectedDoc(null)} onUpdate={() => { setSelectedDoc(null); load(); }} />
      )}
    </div>
  );
};

export default Recent;
