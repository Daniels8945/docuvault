import React from 'react';

const Spinner = ({ size = 'md' }) => {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';
  return (
    <div className="flex items-center justify-center py-16">
      <div
        className={`${s} rounded-full animate-spin`}
        style={{ border: '2px solid rgba(255,255,255,0.06)', borderTopColor: '#6366f1' }}
      />
    </div>
  );
};

export default Spinner;
