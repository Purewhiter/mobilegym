import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IcFileText, IcNavBack } from '../res/icons';
import * as FileSystem from '@/os/FileSystemService';
import { useFileManagerGestures } from '../hooks/useFileManagerGestures';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';

type LoadState =
  | { status: 'loading'; text: '' }
  | { status: 'ready'; text: string }
  | { status: 'error'; text: '' };

function decodePdfString(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}

function extractSimplePdfText(raw: string): string {
  const lines: string[] = [];
  const textObjectPattern = /BT([\s\S]*?)ET/g;
  let objectMatch: RegExpExecArray | null;

  while ((objectMatch = textObjectPattern.exec(raw)) !== null) {
    const body = objectMatch[1];
    const stringPattern = /\((?:\\.|[^\\)])*\)\s*Tj/g;
    let stringMatch: RegExpExecArray | null;

    while ((stringMatch = stringPattern.exec(body)) !== null) {
      const token = stringMatch[0];
      const encoded = token.slice(1, token.lastIndexOf(')'));
      lines.push(decodePdfString(encoded));
    }
  }

  return lines.join('\n').trim();
}

export const PdfPreviewPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { bindBack } = useFileManagerGestures();
  const s = useAppStrings(strings, stringsEn);
  const path = searchParams.get('path') || '';
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading', text: '' });

  const fileName = useMemo(() => {
    if (!path) return s.pdf_preview_no_file;
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 1] || s.pdf_preview_no_file;
  }, [path, s.pdf_preview_no_file]);

  const file = useMemo(() => (path ? FileSystem.getNode(path) : null), [path]);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      if (!path || !file || file.type !== 'file') {
        setLoadState({ status: 'error', text: '' });
        return;
      }

      setLoadState({ status: 'loading', text: '' });
      const blob = await FileSystem.readFile(path);
      if (cancelled) return;

      if (!blob) {
        setLoadState({ status: 'error', text: '' });
        return;
      }

      const raw = await blob.text();
      if (cancelled) return;

      const text = extractSimplePdfText(raw);
      if (!text) {
        setLoadState({ status: 'error', text: '' });
        return;
      }

      setLoadState({ status: 'ready', text });
    }

    loadPdf();
    return () => {
      cancelled = true;
    };
  }, [file, path]);

  return (
    <div className="h-full bg-app-surface flex flex-col">
      <div className="pt-10 px-4 pb-3 flex items-center gap-3 border-b border-gray-100 shrink-0">
        <button
          {...bindBack()}
          className="w-10 h-10 flex items-center justify-center -ml-2 active:opacity-60"
        >
          <IcNavBack size={28} className="text-app-text" />
        </button>
        <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
          <IcFileText size={24} className="text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-[17px] font-semibold text-app-text truncate">{fileName}</h1>
          {file && (
            <div className="text-[12px] text-gray-500 truncate">
              {FileSystem.formatFileSize(file.size)}
            </div>
          )}
        </div>
      </div>

      <div
        className="flex-1 bg-white overflow-y-auto"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {loadState.status === 'loading' && (
          <div className="h-full flex items-center justify-center text-[14px] text-gray-400">
            {s.pdf_preview_loading}
          </div>
        )}
        {loadState.status === 'error' && (
          <div className="h-full flex items-center justify-center px-8 text-center text-[14px] text-gray-400">
            {s.pdf_preview_failed}
          </div>
        )}
        {loadState.status === 'ready' && (
          <div className="min-h-full bg-white px-7 py-8 text-[15px] leading-7 text-gray-900 whitespace-pre-wrap break-words">
            {loadState.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfPreviewPage;
