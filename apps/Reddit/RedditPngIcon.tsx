import React from 'react';
const asset = (r: unknown) => { const s = String(r ?? '').trim(); return (!s || s.startsWith('http')) ? s : `/@app-assets/Reddit/${s}`; };

export const RedditPngIcon = ({ className = '' }: { size?: number | string; className?: string }) => {
  return (
    <img
      src={asset('app_icon.png')}
      alt="Reddit"
      className={className}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      draggable={false}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  );
};
