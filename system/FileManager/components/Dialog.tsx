/**
 * Dialog Components for FileManager
 */
import React, { useState, useEffect } from 'react';
import { FSNode } from '../../../os/types';
import * as FileSystem from '../../../os/FileSystemService';
import { getFileIcon, getFileIconColor } from '../utils/fileUtils';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import * as TimeService from '@/os/TimeService';

// ============================================================================
// Base Dialog
// ============================================================================
interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({ open, onClose, title, children }) => {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-app-surface rounded-2xl w-[85%] max-w-[320px] overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-[17px] font-semibold text-app-text">{title}</h3>
        </div>
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Input Dialog
// ============================================================================
interface InputDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  onConfirm: (value: string) => void;
  confirmText?: string;
}

export const InputDialog: React.FC<InputDialogProps> = ({
  open, onClose, title, placeholder, defaultValue = '', onConfirm, confirmText
}) => {
  const s = useAppStrings(strings, stringsEn);
  const effectiveConfirmText = confirmText ?? s.dialog_confirm;
  const [value, setValue] = useState(defaultValue);
  
  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);
  
  const handleConfirm = () => {
    if (value.trim()) {
      onConfirm(value.trim());
      // Note: onConfirm is responsible for closing the dialog via back()
    }
  };
  
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-app-border rounded-xl text-[15px] focus:outline-none focus:border-blue-500"
        autoFocus
        onKeyDown={e => e.key === 'Enter' && handleConfirm()}
      />
      <div className="flex gap-3 mt-5">
        <button
          onClick={onClose}
          className="flex-1 py-3 rounded-xl bg-gray-100 text-[15px] font-medium text-gray-700"
        >
          {s.dialog_cancel}
        </button>
        <button
          onClick={handleConfirm}
          disabled={!value.trim()}
          className="flex-1 py-3 rounded-xl bg-blue-500 text-[15px] font-medium text-white disabled:opacity-50"
        >
          {effectiveConfirmText}
        </button>
      </div>
    </Dialog>
  );
};

// ============================================================================
// Confirm Dialog
// ============================================================================
interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open, onClose, title, message, onConfirm,
  confirmText, cancelText, isDestructive = false
}) => {
  const s = useAppStrings(strings, stringsEn);
  const effectiveCancelText = cancelText ?? s.dialog_cancel;
  const effectiveConfirmText = confirmText ?? s.dialog_confirm;
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-10 sm:items-center sm:pb-0 px-4">
      <div className="absolute inset-0 bg-black/40 transition-opacity" onClick={onClose} />
      <div className="relative bg-app-surface rounded-[32px] w-full max-w-[340px] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="px-6 pt-8 pb-4 text-center">
          <h3 className="text-[20px] font-semibold text-app-text mb-4">{title}</h3>
          <p className="text-[16px] text-gray-600 leading-relaxed px-2">
            {message}
          </p>
        </div>
        
        <div className="flex gap-3 p-6 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl bg-gray-50 text-[17px] font-medium text-app-text active:bg-gray-100 transition-colors"
          >
            {effectiveCancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-4 rounded-2xl bg-gray-50 text-[17px] font-medium active:bg-gray-100 transition-colors ${
              isDestructive ? 'text-red-500' : 'text-blue-500'
            }`}
          >
            {effectiveConfirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Action Menu (Popup)
// ============================================================================
interface ActionMenuProps {
  open: boolean;
  onClose: () => void;
  options: {
    label: string;
    onClick: () => void;
    destructive?: boolean;
  }[];
}

export const ActionMenu: React.FC<ActionMenuProps> = ({ open, onClose, options }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-end pb-24 pr-4 pointer-events-none">
      <div 
        className="fixed inset-0 bg-black/5 pointer-events-auto" 
        onClick={onClose} 
      />
      <div className="relative bg-app-surface rounded-[24px] w-[200px] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-200 pointer-events-auto">
        <div className="flex flex-col py-2">
          {options.map((opt, index) => (
            <button
              key={index}
              onClick={opt.onClick}
              className={`w-full px-6 py-3.5 text-left text-[16px] active:bg-gray-50 transition-colors ${
                opt.destructive ? 'text-red-500' : 'text-app-text'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// File Details Dialog
// ============================================================================
export const FileDetailsDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  file: FSNode | null;
}> = ({ open, onClose, file }) => {
  const s = useAppStrings(strings, stringsEn);
  if (!open || !file) return null;
  
  const formatDate = (timestamp: number) => {
    const date = TimeService.fromTimestamp(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };
  
  const isFolder = file.type === 'directory';
  
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-4 px-3">
      <div className="absolute inset-0 bg-black/40 transition-opacity" onClick={onClose} />
      <div className="relative bg-app-surface rounded-[32px] w-full overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header with icon */}
        <div className="pt-10 pb-4 flex flex-col items-center">
          <div className="w-24 h-24 flex items-center justify-center mb-4">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 20H4C2.89543 20 2 19.1046 2 18V6C2 4.89543 2.89543 4 4 4H9.17157C9.70201 4 10.2107 4.21071 10.5858 4.58579L12.4142 6.41421C12.7893 6.78929 13.298 7 13.8284 7H20C21.1046 7 22 7.89543 22 9V18C22 19.1046 21.1046 20 20 20Z" fill="#FFC107"/>
            </svg>
          </div>
          <h3 className="text-[22px] font-normal text-app-text text-center px-8 break-all">
            {file.name}
          </h3>
        </div>
        
        {/* Details */}
        <div className="px-8 py-4 space-y-4 text-[18px]">
          <div className="flex items-start gap-1">
            <span className="text-app-text shrink-0">{s.detail_location}</span>
            <span className="text-app-primary break-all leading-snug">
              {file.path.replace('/sdcard', '/storage/emulated/0')}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-app-text shrink-0">{s.detail_size}</span>
            <span className="text-app-text">{FileSystem.formatFileSize(file.size)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-app-text shrink-0">{s.detail_time}</span>
            <span className="text-app-text">{formatDate(file.modifiedAt)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-app-text shrink-0">{s.detail_readable}</span>
            <span className="text-app-text">{s.detail_yes}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-app-text shrink-0">{s.detail_writable}</span>
            <span className="text-app-text">{file.storage === 'preset' ? s.detail_no : s.detail_yes}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-app-text shrink-0">{s.detail_hidden}</span>
            <span className="text-app-text">{file.name.startsWith('.') ? s.detail_yes : s.detail_no}</span>
          </div>
        </div>
        
        {/* Button */}
        <div className="px-6 pb-8 mt-2">
          <button
            onClick={onClose}
            className="w-full py-4 rounded-[24px] bg-[#f2f2f2] text-[20px] font-normal text-app-text active:opacity-60 transition-opacity"
          >
            {s.dialog_got_it}
          </button>
        </div>
      </div>
    </div>
  );
};
