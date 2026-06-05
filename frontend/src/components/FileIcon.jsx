import React from 'react';
import { getFileLabel } from '../lib/fileUtils';

const SIZES = { sm: 'w-8 h-8 text-xs', md: 'w-12 h-12 text-sm', lg: 'w-16 h-16 text-base' };

const FileIcon = ({ type, size = 'md' }) => {
  const { label, color } = getFileLabel(type);
  return (
    <div className={`${SIZES[size]} rounded-xl bg-gradient-to-br ${color} flex items-center justify-center font-bold flex-shrink-0`}>
      {label}
    </div>
  );
};

export default FileIcon;
