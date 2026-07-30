import React from 'react';
import logo from '../../assets/Onction-logo.png';

const OncLogo = ({ size = 32, className, style }) => (
  <img
    src={logo}
    width={size}
    height={size}
    alt="Onction Energy"
    className={className}
    style={{ display: 'block', borderRadius: '50%', flexShrink: 0, ...style }}
  />
);

export default OncLogo;
