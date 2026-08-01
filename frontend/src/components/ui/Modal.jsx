import React from 'react';
import { X } from 'lucide-react';

const Modal = ({ onClose, title, children, maxWidth = 'max-w-2xl' }) => (
  <div className="modal-overlay fade-in-up" onClick={onClose}>
    <div
      className={`${maxWidth} w-full max-h-[90vh] flex flex-col`}
      style={{
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border2)',
        borderRadius: 16,
        boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
      }}
      onClick={e => e.stopPropagation()}
    >
      {title && (
        <div className="flex items-center justify-between px-6 py-5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--c-border)' }}>
          <h3 className="text-base font-semibold" style={{ color: 'var(--c-text)' }}>{title}</h3>
          <button onClick={onClose}
            className="p-2 rounded-lg transition-colors flex-shrink-0"
            style={{ color: 'var(--c-text2)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-text)'; e.currentTarget.style.background = 'var(--c-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text2)'; e.currentTarget.style.background = ''; }}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="overflow-y-auto flex-1">{children}</div>
    </div>
  </div>
);

export default Modal;
