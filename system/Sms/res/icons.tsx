// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
// 单色图标使用 currentColor，多色图标引用 res/colors.ts
import React from 'react';
import {
  // Navigation
  ArrowLeft,
  ChevronRight,
  ChevronUp,

  // Actions / Controls
  Search,
  Plus,
  X,
  Check,

  // User / Content
  User,
  MessageSquare,
  MessageSquareText,
} from 'lucide-react';
export type { LucideIcon } from 'lucide-react';

// === Navigation ===
export const IcNavBack = ArrowLeft;
export const IcNavForward = ChevronRight;
export const IcExpand = ChevronUp;
export const IcClose = X;

// === Actions / Controls ===
export const IcSearch = Search;
export const IcAdd = Plus;
export const IcCheck = Check;

// === User / Content ===
export const IcUser = User;
export const IcMessage = MessageSquare;

// === Custom SVG Components ===
/** 发送箭头图标（向上箭头，用于短信发送按钮） */
export const SendArrowIcon: React.FC<{ active?: boolean } & React.SVGProps<SVGSVGElement>> = ({ active, ...props }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...props}>
    <path
      d="M12 4L12 20M12 4L6 10M12 4L18 10"
      stroke={active ? '#fff' : '#999'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** 问号圆圈图标（字符输入模式切换） */
export const QuestionCircleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
    <text x="12" y="16" fontSize="12" textAnchor="middle" fill="currentColor">?</text>
  </svg>
);

// App launcher icon alias
export const IcLauncher = MessageSquareText;

// === ICON_REGISTRY for dynamic lookup ===
export const ICON_REGISTRY: Record<string, any> = {
  IcNavBack,
  IcNavForward,
  IcExpand,
  IcClose,
  IcSearch,
  IcAdd,
  IcCheck,
  IcUser,
  IcMessage,
  SendArrowIcon,
  QuestionCircleIcon,
  IcLauncher,
};
