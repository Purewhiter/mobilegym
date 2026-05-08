import React from 'react';

type Props = {
  fadingOut?: boolean;
};

export const BootSplash: React.FC<Props> = ({ fadingOut = false }) => (
  <div
    className={[
      'fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden',
      'transition-opacity duration-300 ease-out',
      fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100',
    ].join(' ')}
    style={{ background: '#08090d' }}
    aria-hidden={fadingOut ? 'true' : undefined}
  >
    {/* Aurora glow — slow breathing, sits behind the wordmark for depth */}
    <div
      className="absolute pointer-events-none"
      style={{
        width: '440px',
        height: '440px',
        borderRadius: '50%',
        background:
          'radial-gradient(circle, rgba(99,102,241,0.24) 0%, rgba(56,189,248,0.08) 38%, rgba(8,9,13,0) 72%)',
        filter: 'blur(20px)',
        animation: 'boot-aurora 4.8s ease-in-out infinite',
      }}
    />

    <div className="relative flex flex-col items-center select-none">
      <div
        className="boot-shimmer leading-none"
        style={{
          fontFamily:
            'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: '26px',
          fontWeight: 500,
          letterSpacing: '-0.012em',
        }}
      >
        MobileGym
      </div>
    </div>

    <style>{`
      @keyframes boot-aurora {
        0%, 100% { opacity: 0.72; transform: scale(1);    }
        50%      { opacity: 1;    transform: scale(1.06); }
      }
      @keyframes boot-shimmer-sweep {
        0%   { background-position: 220% 0; }
        100% { background-position: -120% 0; }
      }
      .boot-shimmer {
        background-image: linear-gradient(
          110deg,
          rgba(255,255,255,0.42) 0%,
          rgba(255,255,255,0.42) 38%,
          rgba(255,255,255,1)    50%,
          rgba(255,255,255,0.42) 62%,
          rgba(255,255,255,0.42) 100%
        );
        background-size: 240% 100%;
        background-clip: text;
        -webkit-background-clip: text;
        color: transparent;
        -webkit-text-fill-color: transparent;
        animation: boot-shimmer-sweep 3s ease-in-out infinite;
      }
    `}</style>
  </div>
);
