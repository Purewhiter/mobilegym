import React from 'react';

export const EmptyContactsIllustration: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg
      viewBox="0 0 300 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="laptop-gradient" x1="130" y1="140" x2="170" y2="180" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E5E7EB" />
          <stop offset="1" stopColor="#D1D5DB" />
        </linearGradient>
      </defs>

      {/* Background Elements - Soft blobs */}
      <path d="M40 120 Q30 80 60 60 T100 50 T140 70" stroke="#F3F4F6" strokeWidth="20" strokeLinecap="round" opacity="0.6"/>
      <path d="M260 140 Q280 100 240 80" stroke="#F3F4F6" strokeWidth="15" strokeLinecap="round" opacity="0.6"/>

      {/* Desk Surface */}
      <path d="M50 200 H250" stroke="#E5E7EB" strokeWidth="4" strokeLinecap="round" />

      {/* Person */}
      <g transform="translate(100, 80)">
        {/* Body */}
        <path d="M20 120 L20 80 Q20 50 50 50 Q80 50 80 80 L80 120" fill="#EFF6FF" />
        <path d="M20 120 L80 120" stroke="#DBEAFE" strokeWidth="1" />
        
        {/* Head */}
        <circle cx="50" cy="30" r="22" fill="#E5E7EB" />
        {/* Hair hint */}
        <path d="M30 25 Q50 10 70 25" fill="#D1D5DB" opacity="0.5" />
        
        {/* Left Arm holding Mug */}
        <path d="M80 90 Q95 90 95 105" stroke="#EFF6FF" strokeWidth="12" strokeLinecap="round" />
        {/* Mug */}
        <path d="M92 95 H102 V108 C102 112 99 115 95 115 H92 V95 Z" fill="#9CA3AF" />
        <path d="M102 100 H106 C108 100 108 106 106 106 H102" stroke="#9CA3AF" strokeWidth="2" fill="none"/>
        
        {/* Right Arm on Laptop */}
        <path d="M20 90 Q5 90 5 110" stroke="#EFF6FF" strokeWidth="12" strokeLinecap="round" />
      </g>

      {/* Laptop */}
      <g transform="translate(120, 150)">
        {/* Screen Back */}
        <path d="M0 0 L60 0 L55 35 H5 L0 0 Z" fill="#9CA3AF" opacity="0.3" transform="scale(1, -1) translate(0, -35)"/> 
        {/* Screen Front (Open) */}
        <path d="M5 -35 H55 V-5 H5 Z" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="1" />
        <path d="M25 -22 H35" stroke="#9CA3AF" strokeWidth="1" opacity="0.5"/>
        {/* Keyboard Base */}
        <path d="M-5 0 H65 L70 5 H-10 L-5 0 Z" fill="#D1D5DB" />
      </g>
    </svg>
  );
};
