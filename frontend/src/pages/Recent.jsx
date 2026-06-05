import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { fetchDocuments } from '../services/api';
import DocumentModal from '../components/DocumentModal';
import FileIcon from '../components/FileIcon';
import Badge from '../components/ui/Badge';
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

  useEffect(() => {
    setLoading(true);
    fetchDocuments(selectedWorkspace ? { workspace_id: selectedWorkspace } : {})
      .then(docs => setDocuments(docs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50)))
      .finally(() => setLoading(false));
  }, [selectedWorkspace]);

  const groups = documents.reduce((acc, doc) => {
    const label = dateLabel(doc.created_at);
    (acc[label] = acc[label] || []).push(doc);
    return acc;
  }, {});

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex items-center gap-3 mb-6 fade-in-up">
        <Clock className="w-7 h-7 text-blue-400" />
        <div>
          <h2 className="text-3xl font-bold">Recent</h2>
          <p className="text-gray-400 text-sm">Last 50 documents</p>
        </div>
      </div>

      {loading ? <Spinner /> : documents.length === 0 ? (
        <EmptyState icon={Clock} title="No recent documents" description="Uploaded documents will appear here." />
      ) : (
        <div className="space-y-8">
          {Object.entries(groups).map(([label, docs]) => (
            <div key={label}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{label}</p>
              <div className="glass-card rounded-xl overflow-hidden">
                {docs.map((doc, i) => (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    className={`flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-white/5 transition ${i < docs.length - 1 ? 'border-b border-white/5' : ''}`}
                  >
                    <FileIcon type={doc.file_type} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{doc.name}</p>
                      <p className="text-xs text-gray-500">{doc.uploaded_by} · {formatFileSize(doc.file_size)}</p>
                    </div>
                    <Badge status={doc.status} />
                    <p className="text-xs text-gray-500 hidden md:block flex-shrink-0">
                      {format(new Date(doc.created_at), 'h:mm a')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedDoc && (
        <DocumentModal
          document={selectedDoc}
          currentUser={currentUser}
          onClose={() => setSelectedDoc(null)}
          onUpdate={() => { setSelectedDoc(null); fetchDocuments(selectedWorkspace ? { workspace_id: selectedWorkspace } : {})
            .then(docs => setDocuments(docs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50))); }}
        />
      )}
    </div>
  );
};

export default Recent;
