import React from 'react';

const SIZES = { sm: 'w-6 h-6 border-2', md: 'w-12 h-12 border-4', lg: 'w-16 h-16 border-4' };

const Spinner = ({ size = 'md' }) => (
  <div className="flex items-center justify-center py-20">
    <div className={`${SIZES[size]} border-blue-500 border-t-transparent rounded-full animate-spin`} />
  </div>
);

export default Spinner;
