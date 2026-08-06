import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, Clock, MessageCircle, Settings, CheckSquare,
  FolderOpen, Sun, Moon, Plus, Trash2, Check, X, Pencil, Building2, LogOut,
  Share2, Lock, ChevronRight, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';
import OncLogo from './OncLogo';
import ShareModal from './ShareModal';
import {
  createOrganization, deleteOrganization, updateOrganization,
  createWorkspace, deleteWorkspace, updateWorkspace,
} from '../services/api';

export const DEFAULT_WIDTH = 256;
const MIN_WIDTH     = 180;
const MAX_WIDTH     = 420;

export const NAV = [
  { path: '/',          icon: LayoutDashboard, label: 'Dashboard'      },
  { path: '/inbox',     icon: MessageCircle,   label: 'WhatsApp Inbox' },
  { path: '/recent',    icon: Clock,           label: 'Recent'         },
  { path: '/approvals', icon: CheckSquare,     label: 'Approvals'      },
];

const InlineInput = ({ placeholder, onConfirm, onCancel }) => {
  const [val, setVal]       = useState('');
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const submit = async () => {
    if (!val.trim() || saving) return;
    setSaving(true);
    try { await onConfirm(val.trim()); } finally { setSaving(false); }
  };
  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input ref={ref} value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
        placeholder={placeholder} className="input-field w-full"
        style={{ fontSize: 12, padding: '6px 10px' }} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={submit} disabled={!val.trim() || saving}
          style={{ flex: 1, fontSize: 11, padding: '5px 0', borderRadius: 7,
            fontWeight: 600, color: '#fff', background: 'var(--c-accent)',
            opacity: (!val.trim() || saving) ? 0.4 : 1, cursor: 'pointer' }}>
          {saving ? '…' : 'Create'}
        </button>
        <button onClick={onCancel}
          style={{ padding: '5px 12px', fontSize: 11, borderRadius: 7, fontWeight: 500,
            background: 'var(--c-surface2)', color: 'var(--c-text2)', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  );
};

const RenameInput = ({ current, onConfirm, onCancel }) => {
  const [val, setVal]       = useState(current);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const submit = async () => {
    if (!val.trim() || saving) return;
    if (val.trim() === current) { onCancel(); return; }
    setSaving(true);
    try { await onConfirm(val.trim()); } finally { setSaving(false); }
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
      <input ref={ref} value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
        style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, color: 'var(--c-text)',
          background: 'transparent', outline: 'none', borderBottom: '1px solid var(--c-border2)' }} />
      <button onClick={submit} style={{ padding: 2, color: 'var(--c-success)', cursor: 'pointer', lineHeight: 0 }}>
        <Check size={11} />
      </button>
      <button onClick={onCancel} style={{ padding: 2, color: 'var(--c-text2)', cursor: 'pointer', lineHeight: 0 }}>
        <X size={11} />
      </button>
    </div>
  );
};

const DeleteConfirm = ({ label, subtitle, onConfirm, onCancel }) => (
  <div style={{ padding: '8px 10px', borderRadius: 9, marginBottom: 2,
    background: 'var(--c-danger-bg)', border: '1px solid rgba(239,68,68,0.18)' }}>
    <p style={{ fontSize: 11, color: 'var(--c-danger)', marginBottom: subtitle ? 2 : 6, fontWeight: 500 }}>
      Delete "{label}"?
    </p>
    {subtitle && <p style={{ fontSize: 10, color: 'var(--c-text2)', marginBottom: 6 }}>{subtitle}</p>}
    <div style={{ display: 'flex', gap: 6 }}>
      <button onClick={onConfirm}
        style={{ flex: 1, fontSize: 11, padding: '4px 0', borderRadius: 6,
          fontWeight: 600, color: '#fff', background: 'var(--c-danger)', cursor: 'pointer' }}>
        Yes, delete
      </button>
      <button onClick={onCancel}
        style={{ padding: '4px 10px', fontSize: 11, borderRadius: 6, fontWeight: 500,
          background: 'var(--c-surface2)', color: 'var(--c-text2)', cursor: 'pointer' }}>
        Cancel
      </button>
    </div>
  </div>
);

const NavLink = ({ to, icon: Icon, label, active, onClick }) => (
  <Link to={to} onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 9,
      padding: '7px 8px', borderRadius: 9, textDecoration: 'none',
      fontSize: 12, fontWeight: 500,
      background: active ? 'var(--c-accent-bg)' : 'transparent',
      color: active ? 'var(--c-accent-txt)' : 'var(--c-text2)',
      transition: 'background 0.12s, color 0.12s',
    }}
    onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--c-hover)'; e.currentTarget.style.color = 'var(--c-text)'; } }}
    onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-text2)'; } }}>
    <Icon size={14} style={{ flexShrink: 0 }} />
    {label}
  </Link>
);

const Sidebar = ({
  currentUser, organizations, workspaces,
  selectedOrg, selectedWorkspace,
  onSelectOrg, onSelectWorkspace,
  onOrgCreated, onOrgDeleted, onOrgRenamed, onOrgUpdated,
  onWorkspaceCreated, onWorkspaceDeleted, onWorkspaceRenamed, onWorkspaceUpdated,
  onLogout,
  // Mobile props
  isMobile = false,
  isOpen   = false,
  onClose  = () => {},
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    if (isMobile) onClose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // ── Sidebar width (resizable, desktop only) ──────────────────────────────
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem('dv-sidebar-width'), 10);
    return (saved >= MIN_WIDTH && saved <= MAX_WIDTH) ? saved : DEFAULT_WIDTH;
  });
  const isResizing  = useRef(false);
  const startX      = useRef(0);
  const startWidth  = useRef(0);
  const liveWidth   = useRef(sidebarWidth);
  const handleRef   = useRef(null);

  const onMouseDown = useCallback((e) => {
    if (isMobile) return;
    e.preventDefault();
    isResizing.current = true;
    startX.current     = e.clientX;
    startWidth.current = liveWidth.current;
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [isMobile]);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isResizing.current) return;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + e.clientX - startX.current));
      liveWidth.current = next;
      setSidebarWidth(next);
    };
    const onMouseUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
      if (handleRef.current) handleRef.current.style.background = 'transparent';
      localStorage.setItem('dv-sidebar-width', liveWidth.current);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   onMouseUp);
    };
  }, []);

  // ── Org / Workspace UI state ─────────────────────────────────────────────
  const [showNewOrg,    setShowNewOrg]    = useState(false);
  const [renamingOrgId, setRenamingOrgId] = useState(null);
  const [deletingOrgId, setDeletingOrgId] = useState(null);
  const [showNewWs,    setShowNewWs]      = useState(false);
  const [renamingWsId, setRenamingWsId]  = useState(null);
  const [deletingWsId, setDeletingWsId]  = useState(null);
  const [shareTarget,  setShareTarget]   = useState(null); // { type: 'organization'|'workspace', resource }

  // ── Collapsible sections (persisted) ──────────────────────────────────────
  const [orgsExpanded, setOrgsExpanded] = useState(() => localStorage.getItem('dv-orgs-collapsed') !== 'true');
  const [wsExpanded,   setWsExpanded]   = useState(() => localStorage.getItem('dv-ws-collapsed') !== 'true');
  useEffect(() => { localStorage.setItem('dv-orgs-collapsed', (!orgsExpanded).toString()); }, [orgsExpanded]);
  useEffect(() => { localStorage.setItem('dv-ws-collapsed', (!wsExpanded).toString()); }, [wsExpanded]);

  // Desktop-only: hide the whole sidebar down to a small reopen button.
  // Mobile already has its own open/close drawer flow via isOpen/onClose —
  // this is separate and never applies there.
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('dv-sidebar-collapsed') === 'true');
  useEffect(() => { localStorage.setItem('dv-sidebar-collapsed', collapsed.toString()); }, [collapsed]);

  // Public items first, private ones below — until shared/made public, a
  // private org/workspace stays out of the way at the bottom of the list.
  const byVisibility = (a, b) => (a.visibility === 'private' ? 1 : 0) - (b.visibility === 'private' ? 1 : 0);
  const sortedOrgs = [...organizations].sort(byVisibility);
  const orgWorkspaces = workspaces.filter(w => w.organization_id === selectedOrg && w.id !== 'ws_inbox').sort(byVisibility);
  const canManage = (resourceOwnerId) => currentUser?.role === 'admin' || currentUser?.id === resourceOwnerId;

  // Selecting an org/workspace (or finishing creating one) navigates home —
  // on mobile that's also the point where the drawer should get out of the way.
  const goHome = () => {
    navigate('/');
    if (isMobile) onClose();
  };

  const handleCreateOrg = async (name) => {
    const org = await createOrganization({ name });
    onOrgCreated(org);
    setShowNewOrg(false);
    goHome();
  };
  const handleRenameOrg = async (orgId, name) => {
    await updateOrganization(orgId, { name });
    onOrgRenamed(orgId, name);
    setRenamingOrgId(null);
  };
  const handleDeleteOrg = async (orgId) => {
    try {
      await deleteOrganization(orgId);
      onOrgDeleted(orgId);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Could not delete organization — please try again or contact IT support.');
    } finally {
      setDeletingOrgId(null);
    }
  };
  const handleCreateWs = async (name) => {
    const ws = await createWorkspace({ name, organization_id: selectedOrg });
    onWorkspaceCreated(ws);
    setShowNewWs(false);
    goHome();
  };
  const handleRenameWs = async (wsId, name) => {
    await updateWorkspace(wsId, { name });
    onWorkspaceRenamed(wsId, name);
    setRenamingWsId(null);
  };
  const handleDeleteWs = async (wsId) => {
    try {
      await deleteWorkspace(wsId);
      onWorkspaceDeleted(wsId);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Could not delete workspace — please try again or contact IT support.');
    } finally {
      setDeletingWsId(null);
    }
  };

  const SectionHeader = ({ label, count, onAdd, expanded, onToggle }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginBottom: 6 }}>
      <button onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
          cursor: 'pointer', padding: '2px 0', color: 'inherit' }}>
        <ChevronRight size={12} style={{ color: 'var(--c-text2)', flexShrink: 0,
          transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
        <span className="section-label">{label}</span>
        {count > 0 && <span style={{ fontSize: 10, color: 'var(--c-text2)' }}>({count})</span>}
      </button>
      <button onClick={onAdd} title={`New ${label.slice(0, -1).toLowerCase()}`}
        style={{ color: 'var(--c-text2)', cursor: 'pointer', lineHeight: 0, padding: 2 }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--c-text)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text2)'}>
        <Plus size={13} />
      </button>
    </div>
  );

  // ── Mobile: determine width / position ──────────────────────────────────
  const mobileWidth = Math.min(320, window.innerWidth - 48);

  const asideStyle = isMobile ? {
    position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 200,
    width: mobileWidth,
    transform: isOpen ? 'translateX(0)' : `translateX(-${mobileWidth + 8}px)`,
    transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
    display: 'flex', flexDirection: 'column',
    background: 'var(--c-sidebar)',
    borderRight: '1px solid var(--c-sidebar-border)',
    overflowY: 'auto',
  } : {
    width: sidebarWidth, flexShrink: 0,
    height: '100vh', position: 'sticky', top: 0,
    display: 'flex', flexDirection: 'column',
    background: 'var(--c-sidebar)',
    borderRight: '1px solid var(--c-sidebar-border)',
  };

  const sidebarBody = (
    <aside style={asideStyle}>

      {/* ── Brand ────────────────────────────────────────────────── */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--c-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <OncLogo size={30} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-text)', lineHeight: 1 }}>
                DocuVault
              </p>
              <p style={{ fontSize: 10, color: 'var(--c-text2)', marginTop: 2 }}>Onction Energy</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={toggle} title={isDark ? 'Light mode' : 'Dark mode'}
              style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--c-surface2)', color: 'var(--c-text2)',
                border: '1px solid var(--c-border)', cursor: 'pointer' }}>
              {isDark ? <Sun size={13} /> : <Moon size={13} />}
            </button>
            {isMobile ? (
              <button onClick={onClose} title="Close sidebar"
                style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--c-surface2)', color: 'var(--c-text2)',
                  border: '1px solid var(--c-border)', cursor: 'pointer' }}>
                <X size={13} />
              </button>
            ) : (
              <button onClick={() => setCollapsed(true)} title="Hide sidebar"
                style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--c-surface2)', color: 'var(--c-text2)',
                  border: '1px solid var(--c-border)', cursor: 'pointer' }}>
                <PanelLeftClose size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Scrollable body ──────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '14px 0' }}>

        {/* Organizations */}
        <section style={{ padding: '0 12px', marginBottom: 18 }}>
          <SectionHeader label="Organizations" count={organizations.length}
            expanded={orgsExpanded} onToggle={() => setOrgsExpanded(v => !v)}
            onAdd={() => { setOrgsExpanded(true); setShowNewOrg(v => !v); }} />
          {orgsExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {sortedOrgs.map(org => {
              const isSelected = org.id === selectedOrg;
              const wsCount    = workspaces.filter(w => w.organization_id === org.id && w.id !== 'ws_inbox').length;
              if (deletingOrgId === org.id) {
                return (
                  <DeleteConfirm key={org.id} label={org.name}
                    subtitle={wsCount > 0 ? `This will also permanently delete ${wsCount} workspace(s) and all their documents.` : undefined}
                    onConfirm={() => handleDeleteOrg(org.id)}
                    onCancel={() => setDeletingOrgId(null)} />
                );
              }
              return (
                <div key={org.id} className="group"
                  style={{ display: 'flex', alignItems: 'center', gap: 9,
                    padding: '7px 8px', borderRadius: 9, cursor: 'pointer',
                    background: isSelected ? 'var(--c-accent-bg)' : 'transparent', transition: 'background 0.12s' }}
                  onClick={() => { onSelectOrg(org.id); goHome(); }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--c-hover)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: '#fff',
                    background: isSelected ? 'var(--c-accent)' : 'var(--c-text2)' }}>
                    {org.name.charAt(0).toUpperCase()}
                  </div>
                  {renamingOrgId === org.id ? (
                    <RenameInput current={org.name}
                      onConfirm={name => handleRenameOrg(org.id, name)}
                      onCancel={() => setRenamingOrgId(null)} />
                  ) : (
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 12, fontWeight: 500,
                      color: isSelected ? 'var(--c-accent-txt)' : 'var(--c-text)' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org.name}</span>
                      {org.visibility === 'private' && (
                        <Lock size={10} style={{ flexShrink: 0, color: 'var(--c-text2)' }} />
                      )}
                    </span>
                  )}
                  {renamingOrgId !== org.id && (
                    <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100"
                      style={{ display: 'flex', gap: 2, flexShrink: 0, transition: 'opacity 0.1s' }}>
                      {canManage(org.owner_id) && (
                        <button title="Share"
                          onClick={e => { e.stopPropagation(); setShareTarget({ type: 'organization', resource: org }); }}
                          style={{ padding: 3, borderRadius: 5, color: 'var(--c-text2)', cursor: 'pointer', lineHeight: 0 }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--c-accent-txt)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text2)'}>
                          <Share2 size={11} />
                        </button>
                      )}
                      <button title="Rename"
                        onClick={e => { e.stopPropagation(); setRenamingOrgId(org.id); }}
                        style={{ padding: 3, borderRadius: 5, color: 'var(--c-text2)', cursor: 'pointer', lineHeight: 0 }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--c-text)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text2)'}>
                        <Pencil size={11} />
                      </button>
                      <button title="Delete"
                        onClick={e => { e.stopPropagation(); setDeletingOrgId(org.id); }}
                        style={{ padding: 3, borderRadius: 5, color: 'var(--c-text2)', cursor: 'pointer', lineHeight: 0 }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--c-danger)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text2)'}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {organizations.length === 0 && !showNewOrg && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '20px 12px', textAlign: 'center', gap: 8 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', background: 'var(--c-surface2)', border: '1px solid var(--c-border)' }}>
                  <Building2 size={18} style={{ color: 'var(--c-text3)' }} />
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text)', marginBottom: 3 }}>No organizations</p>
                  <p style={{ fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.4 }}>Create one to start managing documents</p>
                </div>
                <button onClick={() => setShowNewOrg(true)}
                  style={{ marginTop: 4, fontSize: 11, padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                    background: 'var(--c-accent-bg)', color: 'var(--c-accent-txt)',
                    border: '1px solid var(--c-border2)', fontWeight: 500 }}>
                  + New Organization
                </button>
              </div>
            )}
          </div>
          )}
          {showNewOrg && (
            <InlineInput placeholder="Organization name…"
              onConfirm={handleCreateOrg}
              onCancel={() => setShowNewOrg(false)} />
          )}
        </section>

        {/* Workspaces */}
        {selectedOrg && (
          <section style={{ padding: '0 12px', marginBottom: 18 }}>
            <SectionHeader label="Workspaces" count={orgWorkspaces.length}
              expanded={wsExpanded} onToggle={() => setWsExpanded(v => !v)}
              onAdd={() => { setWsExpanded(true); setShowNewWs(v => !v); }} />
            {wsExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {orgWorkspaces.length === 0 && !showNewWs && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '14px 8px', textAlign: 'center', gap: 6 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', background: 'var(--c-surface2)', border: '1px solid var(--c-border)' }}>
                    <FolderOpen size={14} style={{ color: 'var(--c-text3)' }} />
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.4 }}>No workspaces yet</p>
                  <button onClick={() => setShowNewWs(true)}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 7, cursor: 'pointer',
                      background: 'var(--c-surface2)', color: 'var(--c-text)',
                      border: '1px solid var(--c-border)', fontWeight: 500 }}>
                    + New Workspace
                  </button>
                </div>
              )}
              {orgWorkspaces.map(ws => {
                const isActive = ws.id === selectedWorkspace;
                if (deletingWsId === ws.id) {
                  return (
                    <DeleteConfirm key={ws.id} label={ws.name}
                      onConfirm={() => handleDeleteWs(ws.id)}
                      onCancel={() => setDeletingWsId(null)} />
                  );
                }
                return (
                  <div key={ws.id} className="group"
                    style={{ display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 8px', borderRadius: 9, cursor: 'pointer',
                      background: isActive ? 'var(--c-accent-bg)' : 'transparent', transition: 'background 0.12s' }}
                    onClick={() => { onSelectWorkspace(ws.id); goHome(); }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--c-hover)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                    <FolderOpen size={14} style={{ flexShrink: 0, color: isActive ? 'var(--c-accent-txt)' : 'var(--c-text2)' }} />
                    {renamingWsId === ws.id ? (
                      <RenameInput current={ws.name}
                        onConfirm={name => handleRenameWs(ws.id, name)}
                        onCancel={() => setRenamingWsId(null)} />
                    ) : (
                      <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 12, fontWeight: 500,
                        color: isActive ? 'var(--c-accent-txt)' : 'var(--c-text)' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
                        {ws.visibility === 'private' && (
                          <Lock size={10} style={{ flexShrink: 0, color: 'var(--c-text2)' }} />
                        )}
                      </span>
                    )}
                    {renamingWsId !== ws.id && (
                      <div className="opacity-0 group-hover:opacity-100"
                        style={{ display: 'flex', gap: 2, flexShrink: 0, transition: 'opacity 0.1s' }}>
                        {canManage(ws.owner_id) && (
                          <button title="Share"
                            onClick={e => { e.stopPropagation(); setShareTarget({ type: 'workspace', resource: ws }); }}
                            style={{ padding: 3, borderRadius: 5, color: 'var(--c-text2)', cursor: 'pointer', lineHeight: 0 }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--c-accent-txt)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text2)'}>
                            <Share2 size={11} />
                          </button>
                        )}
                        <button title="Rename"
                          onClick={e => { e.stopPropagation(); setRenamingWsId(ws.id); }}
                          style={{ padding: 3, borderRadius: 5, color: 'var(--c-text2)', cursor: 'pointer', lineHeight: 0 }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--c-text)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text2)'}>
                          <Pencil size={11} />
                        </button>
                        <button title="Delete"
                          onClick={e => { e.stopPropagation(); setDeletingWsId(ws.id); }}
                          style={{ padding: 3, borderRadius: 5, color: 'var(--c-text2)', cursor: 'pointer', lineHeight: 0 }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--c-danger)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text2)'}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
            {showNewWs && (
              <InlineInput placeholder="Workspace name…"
                onConfirm={handleCreateWs}
                onCancel={() => setShowNewWs(false)} />
            )}
          </section>
        )}

        {/* Divider */}
        <div style={{ margin: '0 16px 14px', borderTop: '1px solid var(--c-border)' }} />

        {/* Navigation */}
        <nav style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(({ path, icon, label }) => (
            <NavLink key={path} to={path} icon={icon} label={label}
              active={location.pathname === path} />
          ))}
          <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--c-border)' }}>
            <NavLink to="/settings" icon={Settings} label="Settings" active={location.pathname === '/settings'} />
          </div>
        </nav>
      </div>

      {/* ── User card (pinned) ──────────────────────────────────────── */}
      {currentUser && (
        <div style={{ padding: '10px 12px 14px', flexShrink: 0, borderTop: '1px solid var(--c-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 10px', borderRadius: 10,
            background: 'var(--c-surface2)', border: '1px solid var(--c-border)' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser.name}
              </p>
              <p style={{ fontSize: 11, color: 'var(--c-text2)', textTransform: 'capitalize' }}>
                {currentUser.role}
              </p>
            </div>
            {onLogout && (
              <button onClick={onLogout} title="Sign out"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 6, border: 'none',
                  background: 'transparent', cursor: 'pointer', color: 'var(--c-text2)', flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-danger-bg)'; e.currentTarget.style.color = 'var(--c-danger)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-text2)'; }}>
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Resize handle (desktop only) ─────────────────────────── */}
      {!isMobile && (
        <div
          ref={handleRef}
          onMouseDown={onMouseDown}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-accent)'; e.currentTarget.style.opacity = '0.6'; }}
          onMouseLeave={e => { if (!isResizing.current) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '1'; } }}
          style={{ position: 'absolute', top: 0, right: 0, width: 4, height: '100%',
            cursor: 'col-resize', zIndex: 30, background: 'transparent', transition: 'background 0.15s' }}
        />
      )}
    </aside>
  );

  const shareModal = shareTarget && (
    <ShareModal
      resourceType={shareTarget.type}
      resource={shareTarget.resource}
      onClose={() => setShareTarget(null)}
      onUpdated={(nextVisibility) => {
        if (shareTarget.type === 'organization') onOrgUpdated?.(shareTarget.resource.id, nextVisibility);
        else onWorkspaceUpdated?.(shareTarget.resource.id, nextVisibility);
      }}
    />
  );

  if (!isMobile) {
    if (collapsed) {
      return (
        <>
          <button onClick={() => setCollapsed(false)} title="Show sidebar"
            style={{
              position: 'fixed', top: 16, left: 16, zIndex: 50,
              width: 36, height: 36, borderRadius: 9, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--c-surface2)', color: 'var(--c-text2)',
              border: '1px solid var(--c-border)', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}>
            <PanelLeftOpen size={16} />
          </button>
          {shareModal}
        </>
      );
    }
    return <>{sidebarBody}{shareModal}</>;
  }

  // Mobile: drawer + backdrop overlay
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 199,
          background: 'rgba(0,0,0,0.55)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}
      />
      {sidebarBody}
      {shareModal}
    </>
  );
};

export default Sidebar;
