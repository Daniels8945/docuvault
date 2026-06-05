import React from 'react';
import { X } from 'lucide-react';

const Modal = ({ onClose, title, children, maxWidth = 'max-w-2xl' }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className={`glass-card rounded-2xl ${maxWidth} w-full max-h-[90vh] flex flex-col fade-in-up`} onClick={e => e.stopPropagation()}>
      {title && (
        <div className="flex items-center justify-between p-6 border-b border-white/10 flex-shrink-0">
          <h3 className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      <div className="overflow-y-auto flex-1">{children}</div>
    </div>
  </div>
);

export default Modal;
