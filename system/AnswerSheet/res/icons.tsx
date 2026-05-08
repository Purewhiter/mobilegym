// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
import { ClipboardCheck } from 'lucide-react';

// ── App launcher ──────────────────────────────────────────
export const IcAnswerSheet = ClipboardCheck;
export const IcLauncher = ClipboardCheck;

// ── Registry for dynamic lookup ───────────────────────────
export const ICON_REGISTRY: Record<string, any> = {
  IcAnswerSheet,
  IcLauncher,
};
