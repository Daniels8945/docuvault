import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Clock, MessageCircle, Settings,
  FolderOpen, Sun, Moon, Plus, Trash2, Check, X, Pencil, Building2,
} from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';
import {
  createOrganization, deleteOrganization, updateOrganization,
  createWorkspace, deleteWorkspace, updateWorkspace,
} from '../services/api';

const DEFAULT_WIDTH = 256;
const MIN_WIDTH     = 180;
const MAX_WIDTH     = 420;

const NAV = [
  { path: '/',       icon: LayoutDashboard, label: 'Dashboard'      },
  { path: '/inbox',  icon: MessageCircle,   label: 'WhatsApp Inbox' },
  { path: '/recent', icon: Clock,           label: 'Recent'         },
];

const VaultLogo = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 9v-2M12 17v-2M9 12H7M17 12h-2"/>
  </svg>
);

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
          background: 'transparent', outline: 'none',
          borderBottom: '1px solid var(--c-border2)' }} />
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
    {subtitle && (
      <p style={{ fontSize: 10, color: 'var(--c-text2)', marginBottom: 6 }}>{subtitle}</p>
    )}
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

const NavLink = ({ to, icon: Icon, label, active }) => (
  <Link to={to}
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
  onOrgCreated, onOrgDeleted, onOrgRenamed,
  onWorkspaceCreated, onWorkspaceDeleted, onWorkspaceRenamed,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();

  // ── Sidebar width (resizable) ──────────────────────────────────────────────
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
    e.preventDefault();
    isResizing.current = true;
    startX.current     = e.clientX;
    startWidth.current = liveWidth.current;
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

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

  // ── Org UI state ──────────────────────────────────────────────────────────
  const [showNewOrg,    setShowNewOrg]    = useState(false);
  const [renamingOrgId, setRenamingOrgId] = useState(null);
  const [deletingOrgId, setDeletingOrgId] = useState(null);

  // ── Workspace UI state ────────────────────────────────────────────────────
  const [showNewWs,    setShowNewWs]    = useState(false);
  const [renamingWsId, setRenamingWsId] = useState(null);
  const [deletingWsId, setDeletingWsId] = useState(null);

  const orgWorkspaces = workspaces.filter(w => w.organization_id === selectedOrg && w.id !== 'ws_inbox');

  // ── Org handlers ──────────────────────────────────────────────────────────
  const handleCreateOrg = async (name) => {
    const org = await createOrganization({ name });
    onOrgCreated(org);
    setShowNewOrg(false);
    navigate('/');
  };
  const handleRenameOrg = async (orgId, name) => {
    await updateOrganization(orgId, { name });
    onOrgRenamed(orgId, name);
    setRenamingOrgId(null);
  };
  const handleDeleteOrg = async (orgId) => {
    await deleteOrganization(orgId);
    onOrgDeleted(orgId);
    setDeletingOrgId(null);
  };

  // ── Workspace handlers ────────────────────────────────────────────────────
  const handleCreateWs = async (name) => {
    const ws = await createWorkspace({ name, organization_id: selectedOrg });
    onWorkspaceCreated(ws);
    setShowNewWs(false);
    navigate('/');
  };
  const handleRenameWs = async (wsId, name) => {
    await updateWorkspace(wsId, { name });
    onWorkspaceRenamed(wsId, name);
    setRenamingWsId(null);
  };
  const handleDeleteWs = async (wsId) => {
    await deleteWorkspace(wsId);
    onWorkspaceDeleted(wsId);
    setDeletingWsId(null);
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const SectionHeader = ({ label, onAdd }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 4px', marginBottom: 6 }}>
      <span className="section-label">{label}</span>
      <button onClick={onAdd} title={`New ${label.slice(0, -1).toLowerCase()}`}
        style={{ color: 'var(--c-text2)', cursor: 'pointer', lineHeight: 0, padding: 2 }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--c-text)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text2)'}>
        <Plus size={13} />
      </button>
    </div>
  );

  return (
    <aside style={{
      width: sidebarWidth, flexShrink: 0,
      height: '100vh', position: 'sticky', top: 0,
      display: 'flex', flexDirection: 'column',
      background: 'var(--c-sidebar)',
      borderRight: '1px solid var(--c-sidebar-border)',
    }}>

      {/* ── Brand ──────────────────────────────────────────────────── */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--c-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--c-accent-bg)', color: 'var(--c-accent-txt)' }}>
              <VaultLogo />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em',
                color: 'var(--c-text)', lineHeight: 1 }}>DocuVault</p>
              <p style={{ fontSize: 10, color: 'var(--c-text2)', marginTop: 2 }}>Enterprise</p>
            </div>
          </div>
          <button onClick={toggle} title={isDark ? 'Light mode' : 'Dark mode'}
            style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--c-surface2)', color: 'var(--c-text2)',
              border: '1px solid var(--c-border)', cursor: 'pointer' }}>
            {isDark ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        </div>
      </div>

      {/* ── Scrollable body ────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '14px 0' }}>

        {/* Organizations */}
        <section style={{ padding: '0 12px', marginBottom: 18 }}>
          <SectionHeader label="Organizations" onAdd={() => setShowNewOrg(v => !v)} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {organizations.map(org => {
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
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '7px 8px', borderRadius: 9, cursor: 'pointer',
                    background: isSelected ? 'var(--c-accent-bg)' : 'transparent',
                    transition: 'background 0.12s',
                  }}
                  onClick={() => { onSelectOrg(org.id); navigate('/'); }}
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
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: isSelected ? 'var(--c-accent-txt)' : 'var(--c-text)' }}>
                      {org.name}
                    </span>
                  )}

                  {renamingOrgId !== org.id && (
                    <div className="opacity-0 group-hover:opacity-100"
                      style={{ display: 'flex', gap: 2, flexShrink: 0, transition: 'opacity 0.1s' }}>
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
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '20px 12px', textAlign: 'center', gap: 8,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
                }}>
                  <Building2 size={18} style={{ color: 'var(--c-text3)' }} />
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text)', marginBottom: 3 }}>No organizations</p>
                  <p style={{ fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.4 }}>Create one to start managing documents</p>
                </div>
                <button onClick={() => setShowNewOrg(true)}
                  style={{
                    marginTop: 4, fontSize: 11, padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                    background: 'var(--c-accent-bg)', color: 'var(--c-accent-txt)',
                    border: '1px solid var(--c-border2)', fontWeight: 500,
                  }}>
                  + New Organization
                </button>
              </div>
            )}
          </div>

          {showNewOrg && (
            <InlineInput placeholder="Organization name…"
              onConfirm={handleCreateOrg}
              onCancel={() => setShowNewOrg(false)} />
          )}
        </section>

        {/* Workspaces */}
        {selectedOrg && (
          <section style={{ padding: '0 12px', marginBottom: 18 }}>
            <SectionHeader label="Workspaces" onAdd={() => setShowNewWs(v => !v)} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {orgWorkspaces.length === 0 && !showNewWs && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '14px 8px', textAlign: 'center', gap: 6,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
                  }}>
                    <FolderOpen size={14} style={{ color: 'var(--c-text3)' }} />
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.4 }}>No workspaces yet</p>
                  <button onClick={() => setShowNewWs(true)}
                    style={{
                      fontSize: 11, padding: '4px 10px', borderRadius: 7, cursor: 'pointer',
                      background: 'var(--c-surface2)', color: 'var(--c-text)',
                      border: '1px solid var(--c-border)', fontWeight: 500,
                    }}>
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
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 8px', borderRadius: 9, cursor: 'pointer',
                      background: isActive ? 'var(--c-accent-bg)' : 'transparent',
                      transition: 'background 0.12s',
                    }}
                    onClick={() => { onSelectWorkspace(ws.id); navigate('/'); }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--c-hover)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>

                    <FolderOpen size={14} style={{ flexShrink: 0,
                      color: isActive ? 'var(--c-accent-txt)' : 'var(--c-text2)' }} />

                    {renamingWsId === ws.id ? (
                      <RenameInput current={ws.name}
                        onConfirm={name => handleRenameWs(ws.id, name)}
                        onCancel={() => setRenamingWsId(null)} />
                    ) : (
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: isActive ? 'var(--c-accent-txt)' : 'var(--c-text)' }}>
                        {ws.name}
                      </span>
                    )}

                    {renamingWsId !== ws.id && (
                      <div className="opacity-0 group-hover:opacity-100"
                        style={{ display: 'flex', gap: 2, flexShrink: 0, transition: 'opacity 0.1s' }}>
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
            <NavLink key={path} to={path} icon={icon} label={label} active={location.pathname === path} />
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
          </div>
        </div>
      )}

      {/* ── Resize handle ──────────────────────────────────────────── */}
      <div
        ref={handleRef}
        onMouseDown={onMouseDown}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-accent)'; e.currentTarget.style.opacity = '0.6'; }}
        onMouseLeave={e => { if (!isResizing.current) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '1'; } }}
        style={{
          position: 'absolute', top: 0, right: 0,
          width: 4, height: '100%',
          cursor: 'col-resize',
          zIndex: 30,
          background: 'transparent',
          transition: 'background 0.15s',
        }}
      />
    </aside>
  );
};

export default Sidebar;
