// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
// 单色图标使用 currentColor，多色图标引用 res/colors.ts
import React from 'react';
import {
  // Navigation
  ChevronLeft,
  ChevronRight,

  // Communication
  Phone,
  Contact,
} from 'lucide-react';
export type { LucideIcon } from 'lucide-react';

// === Navigation ===
export const IcNavBack = ChevronLeft;
export const IcNavForward = ChevronRight;

// === Communication ===
export const IcPhone = Phone;

// === Custom SVG Components ===
/** 列表行右侧 chevron 箭头（向右） */
export const ChevronRightIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <span className="text-gray-300 flex-shrink-0" aria-hidden="true">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

// App launcher icon alias
export const IcLauncher = Contact;

// === ICON_REGISTRY for dynamic lookup ===
export const ICON_REGISTRY: Record<string, any> = {
  IcNavBack,
  IcNavForward,
  IcPhone,
  ChevronRightIcon,
  IcLauncher,
};

// === HyperOS symbols (public/icons/hyperos-symbols/*.svg) ===
export const HYPEROS_SYMBOLS_PATH = '/icons/hyperos-symbols';

/** URL for a HyperOS symbol by file name (without .svg). */
export function getHyperosSymbolUrl(name: string): string {
  return `${HYPEROS_SYMBOLS_PATH}/${name}.svg`;
}

// Symbol names used by this app — use these instead of raw strings.
export const IcSymbolAdd = 'add';
export const IcSymbolBack = 'back';
export const IcSymbolCarrier = 'carrier';
export const IcSymbolClose = 'close';
export const IcSymbolClose2 = 'close_2';
export const IcSymbolContactsCircle = 'contacts_circle';
export const IcSymbolDelete = 'delete';
export const IcSymbolExpandMore = 'expand_more';
export const IcSymbolFavorites = 'favorites';
export const IcSymbolFavoritesFill = 'favorites_fill';
export const IcSymbolMessages = 'messages';
export const IcSymbolMore = 'more';
export const IcSymbolOk = 'ok';
export const IcSymbolPhone = 'phone';
export const IcSymbolPlay = 'play';
export const IcSymbolSearch = 'search';
export const IcSymbolSettings = 'settings';
