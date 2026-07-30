import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

let _id = 0;

const ICONS = {
  success: CheckCircle,
  error:   XCircle,
  info:    Info,
};

const COLORS = {
  success: { bg: 'var(--c-success-bg, #052e16)',  border: '#16a34a', icon: '#4ade80', bar: '#16a34a' },
  error:   { bg: 'var(--c-danger-bg)',             border: 'var(--c-danger)', icon: 'var(--c-danger)', bar: 'var(--c-danger)' },
  info:    { bg: 'var(--c-accent-bg)',             border: 'var(--c-border2)', icon: 'var(--c-accent-txt)', bar: 'var(--c-accent-txt)' },
};

const DURATION = 4000;

const Toast = ({ toast, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const Icon = ICONS[toast.type] || Info;
  const c = COLORS[toast.type] || COLORS.info;

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(show);
  }, []);

  const hide = () => {
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  return (
    <div
      onClick={hide}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        background: c.bg, border: `1px solid ${c.border}`,
        borderRadius: 10, padding: '12px 14px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
        cursor: 'pointer', minWidth: 260, maxWidth: 360,
        overflow: 'hidden', position: 'relative',
        transform: visible ? 'translateX(0)' : 'translateX(120%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.3s cubic-bezier(.22,.68,0,1.2), opacity 0.3s ease',
      }}
    >
      <Icon size={18} style={{ color: c.icon, flexShrink: 0, marginTop: 1 }} />
      <p style={{ fontSize: 13, color: 'var(--c-text)', flex: 1, lineHeight: 1.45 }}>{toast.msg}</p>
      <X size={14} style={{ color: 'var(--c-text2)', flexShrink: 0, marginTop: 2 }} />

      {/* progress bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0,
        height: 3, background: c.bar, borderRadius: '0 0 0 10px',
        animation: `toast-shrink ${DURATION}ms linear forwards`,
      }} />
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((msg, type = 'info') => {
    const id = ++_id;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), DURATION + 350);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastCtx.Provider value={{ toast: push }}>
      {children}
      <style>{`
        @keyframes toast-shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 10,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <Toast toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};
