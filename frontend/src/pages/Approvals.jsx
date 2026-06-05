import React, { useState, useEffect, useCallback } from 'react';
import { CheckSquare, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { fetchDocuments, fetchApprovals, updateApproval } from '../services/api';
import DocumentModal from '../components/DocumentModal';
import FileIcon from '../components/FileIcon';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { formatFileSize } from '../lib/fileUtils';

const TABS = [
  { value: 'pending_approval', label: 'Pending', icon: Clock },
  { value: 'approved', label: 'Approved', icon: CheckCircle },
  { value: 'rejected', label: 'Rejected', icon: XCircle },
];

const Approvals = ({ currentUser }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending_approval');
  const [selectedDoc, setSelectedDoc] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const docs = await fetchDocuments({ status: tab });
      setDocuments(docs);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const quickReview = async (e, doc, status) => {
    e.stopPropagation();
    const approvals = await fetchApprovals({ document_id: doc.id });
    const latest = approvals.at(-1);
    if (!latest) return;
    await updateApproval(latest.id, { status, reviewed_by: currentUser?.id });
    load();
  };

  const counts = { total: documents.length };

  return (
    <div className="p-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="mb-6 fade-in-up">
        <div className="flex items-center gap-3 mb-1">
          <CheckSquare className="w-7 h-7 text-blue-400" />
          <h2 className="text-3xl font-bold">Approvals</h2>
        </div>
        <p className="text-gray-400 text-sm">{counts.total} document{counts.total !== 1 ? 's' : ''} in this view</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 glass-card p-1 rounded-xl w-fit">
        {TABS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === value ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : documents.length === 0 ? (
        <EmptyState icon={CheckSquare} title={`No ${tab.replace('_', ' ')} documents`} description="Nothing here right now." />
      ) : (
        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Document</th>
                <th className="text-left px-5 py-3 hidden md:table-cell">Size</th>
                <th className="text-left px-5 py-3 hidden lg:table-cell">Uploaded</th>
                <th className="text-left px-5 py-3">Status</th>
                {tab === 'pending_approval' && currentUser?.role === 'admin' && (
                  <th className="text-right px-5 py-3">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {documents.map(doc => (
                <tr
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  className="border-b border-white/5 hover:bg-white/5 transition cursor-pointer"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <FileIcon type={doc.file_type} size="sm" />
                      <div>
                        <p className="font-medium text-sm truncate max-w-xs">{doc.name}</p>
                        <p className="text-xs text-gray-500">v{doc.current_version} · {doc.uploaded_by}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-400 hidden md:table-cell">{formatFileSize(doc.file_size)}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-400 hidden lg:table-cell">
                    {format(new Date(doc.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="px-5 py-3.5"><Badge status={doc.status} /></td>
                  {tab === 'pending_approval' && currentUser?.role === 'admin' && (
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={e => quickReview(e, doc, 'approved')}
                          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={e => quickReview(e, doc, 'rejected')}
                          className="flex items-center gap-1.5 bg-red-600/70 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedDoc && (
        <DocumentModal
          document={selectedDoc}
          currentUser={currentUser}
          onClose={() => setSelectedDoc(null)}
          onUpdate={() => { setSelectedDoc(null); load(); }}
        />
      )}
    </div>
  );
};

export default Approvals;
