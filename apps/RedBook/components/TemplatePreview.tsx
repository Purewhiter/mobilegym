import React from 'react';

export type TemplateId = 'basic' | 'fresh' | 'memo' | 'border' | 'scribble';
export type TemplateVariant = 'large' | 'thumb';

export const TEMPLATE_BG: Record<TemplateId, string> = {
  basic: '#fffbe6',
  fresh: '#dff5e6',
  memo: '#fffef2',
  border: '#f7f7f7',
  scribble: '#e0f2fe',
};

export const TEMPLATE_TEXT_COLOR: Record<TemplateId, string> = {
  basic: '#4a4a4a',
  fresh: '#2f855a',
  memo: '#4b5563',
  border: '#111827',
  scribble: '#0369a1',
};

export function resolveTemplateId(id: string | undefined): TemplateId {
  return (id && id in TEMPLATE_BG ? id : 'basic') as TemplateId;
}

// thumb 视觉上约为 large 的 36%，尺寸按此系数从 large 派生
const LARGE_SCALE = {
  quoteFont: 56,
  underlineW: 24,
  underlineH: 4,
  leafSize: 44,
  memoLineGap: 28,
  borderOuterInset: 10,
  borderOuterWidth: 3,
  borderInnerInset: 18,
  borderInnerWidth: 1,
};

const VARIANT_RATIO: Record<TemplateVariant, number> = { large: 1, thumb: 0.36 };

function getScale(variant: TemplateVariant) {
  const r = VARIANT_RATIO[variant];
  const out: Record<keyof typeof LARGE_SCALE, number> = { ...LARGE_SCALE };
  (Object.keys(LARGE_SCALE) as (keyof typeof LARGE_SCALE)[]).forEach(k => {
    out[k] = LARGE_SCALE[k] * r;
  });
  return out;
}

const TemplateDecoration: React.FC<{ id: TemplateId; variant: TemplateVariant }> = ({ id, variant }) => {
  const sc = getScale(variant);
  if (id === 'basic') {
    return (
      <>
        <div
          className="absolute leading-none font-serif select-none"
          style={{ top: '6%', left: '6%', color: '#f6dd77', fontSize: sc.quoteFont }}
        >“</div>
        <div
          className="absolute rounded-full"
          style={{ bottom: '8%', right: '8%', backgroundColor: '#f6dd77', width: sc.underlineW, height: sc.underlineH }}
        />
      </>
    );
  }
  if (id === 'fresh') {
    return (
      <>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 100% 0%, rgba(255,255,255,0.75), transparent 55%)' }}
        />
        <svg
          className="absolute"
          style={{ top: '6%', right: '6%', width: sc.leafSize, height: sc.leafSize }}
          viewBox="0 0 24 24"
          fill="none"
        >
          <path d="M21 3 C13 4 6 10 3 21 C14 19 20 12 21 3 Z" fill="#7cc99b" />
          <path d="M6 18 L14 10" stroke="#3f8f5b" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </>
    );
  }
  if (id === 'memo') {
    const gap = sc.memoLineGap;
    return (
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${gap - 1}px, rgba(234,179,8,0.28) ${gap - 1}px, rgba(234,179,8,0.28) ${gap}px)`,
        }}
      />
    );
  }
  if (id === 'border') {
    return (
      <>
        <div
          className="absolute pointer-events-none rounded-[12px]"
          style={{ inset: sc.borderOuterInset, border: `${sc.borderOuterWidth}px solid #111` }}
        />
        <div
          className="absolute pointer-events-none rounded-[8px]"
          style={{ inset: sc.borderInnerInset, border: `${sc.borderInnerWidth}px solid #111` }}
        />
      </>
    );
  }
  if (id === 'scribble') {
    return (
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        fill="none"
      >
        <path d="M6 14 Q 12 6, 18 14 T 30 14" stroke="#0ea5e9" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="86" cy="16" r="2" fill="#0ea5e9" />
        <circle cx="92" cy="24" r="1.2" fill="#0ea5e9" />
        <circle cx="80" cy="24" r="1" fill="#0ea5e9" />
        <path d="M8 86 Q 16 78, 24 86" stroke="#0ea5e9" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M74 82 L 92 90" stroke="#0ea5e9" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M78 70 L 86 74" stroke="#0ea5e9" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  return null;
};

interface PreviewProps {
  templateId: string;
  text: string;
  fallbackText: string;
  variant: TemplateVariant;
  className?: string;
}

export const TemplatePreview: React.FC<PreviewProps> = ({ templateId, text, fallbackText, variant, className = '' }) => {
  const id = resolveTemplateId(templateId);
  const display = text || fallbackText;

  const textCls = variant === 'large'
    ? 'text-[28px] font-semibold text-center px-10 leading-snug'
    : 'text-[11px] font-medium text-center px-1 line-clamp-3 leading-tight overflow-hidden';

  return (
    <div
      className={`relative overflow-hidden flex items-center justify-center ${className}`}
      style={{ backgroundColor: TEMPLATE_BG[id] }}
    >
      <TemplateDecoration id={id} variant={variant} />
      <div
        className={`relative z-10 ${textCls}`}
        style={{ color: TEMPLATE_TEXT_COLOR[id], wordBreak: 'break-all' }}
      >
        {display}
      </div>
    </div>
  );
};

export default TemplatePreview;
