/**
 * Clipboard Module - Public API
 * 
 * Provides clipboard functionality for Apps.
 * 
 * Usage:
 * ```tsx
 * import { useClipboard, useCopyableText, ClipboardService } from '@/os/clipboard';
 * 
 * // In a component:
 * function MyComponent() {
 *   const { copyText, getText, hasText } = useClipboard();
 *   
 *   // Copy text
 *   copyText('Hello World');
 *   
 *   // Get clipboard text
 *   const text = getText();
 * }
 * 
 * // For long-pressable text:
 * function MessageBubble({ text }: { text: string }) {
 *   const { handlers, containerRef } = useCopyableText(text);
 *   return <div ref={containerRef} {...handlers}>{text}</div>;
 * }
 * ```
 */

// Service
export { ClipboardService } from '../ClipboardService';
export type { 
  ClipboardItem, 
  ClipboardItemType, 
  ClipboardServiceState,
} from '../ClipboardService';
export type { SelectionMenuPosition } from '../TextSelectionService';

// Hooks
export { 
  useClipboard, 
  useClipboardPaste,
  useClipboardSelectAll,
  useCopyableText,
} from '../hooks/useClipboard';
export type { UseClipboardReturn } from '../hooks/useClipboard';

