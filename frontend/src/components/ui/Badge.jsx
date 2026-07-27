import React from 'react';
import { STATUS_BADGE, STATUS_LABEL } from '../../lib/fileUtils';

const Badge = ({ status }) => (
  <span className={`badge ${STATUS_BADGE[status] || 'badge-draft'}`}>
    {STATUS_LABEL[status] || status}
  </span>
);

export default Badge;
