import React from 'react';

/**
 * Onction Energy company logo — power button + leaf, blue ring.
 * Matches the brand mark: blue outer circle, white centre, lime-green eco power icon.
 */
const OncLogo = ({ size = 32, className, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={style}
  >
    {/* White background fill */}
    <circle cx="50" cy="50" r="48" fill="white" />
    {/* Blue outer ring */}
    <circle cx="50" cy="50" r="45" stroke="#1AAEDE" strokeWidth="9" fill="none" />
    {/* Power button arc — starts upper-left, sweeps clockwise through the bottom,
        stops before upper-right (where the leaf continues) */}
    <path
      d="M 39 31 A 22 22 0 1 1 65 35"
      stroke="#8BBB28"
      strokeWidth="7.5"
      fill="none"
      strokeLinecap="round"
    />
    {/* Power button stem — centre up through the gap */}
    <line x1="50" y1="24" x2="50" y2="50" stroke="#8BBB28" strokeWidth="7.5" strokeLinecap="round" />
    {/* Leaf — replaces / extends from the upper-right end of the arc */}
    <path
      d="M 65 34 C 69 22 82 17 78 30 C 74 41 64 41 65 34 Z"
      fill="#8BBB28"
    />
  </svg>
);

export default OncLogo;
