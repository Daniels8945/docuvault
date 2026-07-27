import React from 'react';
import { getFileLabel } from '../lib/fileUtils';

const SIZES = {
  sm: { box: 'w-8 h-8 rounded-lg text-xs', font: 'text-[10px]' },
  md: { box: 'w-11 h-11 rounded-xl text-sm', font: 'text-xs' },
  lg: { box: 'w-14 h-14 rounded-xl', font: 'text-sm' },
};

const FileIcon = ({ type, size = 'md' }) => {
  const { label, color } = getFileLabel(type);
  const s = SIZES[size];
  return (
    <div
      className={`${s.box} flex items-center justify-center font-bold flex-shrink-0`}
      style={{ backgroundColor: color + '22', color }}
    >
      <span className={s.font}>{label}</span>
    </div>
  );
};

export default FileIcon;
