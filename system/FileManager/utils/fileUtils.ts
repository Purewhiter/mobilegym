/**
 * File Manager Utilities
 * 
 * Helper functions for file type detection and icons
 */
import {
  IcFolder, IcFile, IcImage, IcVideo, IcMusic, IcFileText
} from '../res/icons';
import { FSNode } from '../../../os/types';

const TEXT_PREVIEW_EXTENSIONS = new Set(['txt', 'log', 'md', 'json', 'csv']);

export function isTextPreviewableFile(node: FSNode): boolean {
  if (node.type !== 'file') return false;

  const mime = node.mimeType || '';
  if (mime.startsWith('text/')) return true;

  const lowerName = node.name.toLowerCase();
  const dotIndex = lowerName.lastIndexOf('.');
  if (dotIndex < 0 || dotIndex === lowerName.length - 1) return false;
  return TEXT_PREVIEW_EXTENSIONS.has(lowerName.slice(dotIndex + 1));
}

export function isPdfPreviewableFile(node: FSNode): boolean {
  if (node.type !== 'file') return false;

  const mime = node.mimeType || '';
  if (mime === 'application/pdf') return true;

  return node.name.toLowerCase().endsWith('.pdf');
}

export function getFileIcon(node: FSNode) {
  if (node.type === 'directory') return IcFolder;
  
  const mime = node.mimeType || '';
  if (mime.startsWith('image/')) return IcImage;
  if (mime.startsWith('video/')) return IcVideo;
  if (mime.startsWith('audio/')) return IcMusic;
  if (mime.includes('pdf') || mime.includes('document') || mime.includes('text')) return IcFileText;
  return IcFile;
}

export function getFileIconColor(node: FSNode): string {
  if (node.type === 'directory') return 'text-amber-500';
  
  const mime = node.mimeType || '';
  if (mime.startsWith('image/')) return 'text-green-500';
  if (mime.startsWith('video/')) return 'text-purple-500';
  if (mime.startsWith('audio/')) return 'text-pink-500';
  if (mime.includes('pdf')) return 'text-red-500';
  return 'text-gray-500';
}
