import React from 'react';
import { STATUS_BADGE } from '../../lib/fileUtils';

const Badge = ({ status }) => (
  <span className={`badge ${STATUS_BADGE[status] || STATUS_BADGE.draft}`}>
    {status.replace(/_/g, ' ')}
  </span>
);

export default Badge;
