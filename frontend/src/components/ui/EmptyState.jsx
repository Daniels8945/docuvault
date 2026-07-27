import React from 'react';

const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '64px 24px', textAlign: 'center',
  }}>
    <div style={{
      width: 56, height: 56, borderRadius: 16, marginBottom: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
    }}>
      <Icon style={{ width: 24, height: 24, color: 'var(--c-text3)' }} />
    </div>
    <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', marginBottom: 6 }}>
      {title}
    </h3>
    <p style={{ fontSize: 13, color: 'var(--c-text2)', maxWidth: 280, lineHeight: 1.5, marginBottom: action ? 20 : 0 }}>
      {description}
    </p>
    {action}
  </div>
);

export default EmptyState;
