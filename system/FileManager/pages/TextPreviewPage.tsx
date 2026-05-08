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

export const TextPreviewPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { bindBack } = useFileManagerGestures();
  const s = useAppStrings(strings, stringsEn);
  const path = searchParams.get('path') || '';
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading', text: '' });

  const fileName = useMemo(() => {
    if (!path) return s.text_preview_no_file;
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 1] || s.text_preview_no_file;
  }, [path, s.text_preview_no_file]);

  const file = useMemo(() => (path ? FileSystem.getNode(path) : null), [path]);

  useEffect(() => {
    let cancelled = false;

    async function loadText() {
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

      const text = await blob.text();
      if (!cancelled) setLoadState({ status: 'ready', text });
    }

    loadText();
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
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
          <IcFileText size={24} className="text-gray-500" />
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
        className="flex-1 overflow-y-auto bg-white"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {loadState.status === 'loading' && (
          <div className="h-full flex items-center justify-center text-[14px] text-gray-400">
            {s.text_preview_loading}
          </div>
        )}
        {loadState.status === 'error' && (
          <div className="h-full flex items-center justify-center px-8 text-center text-[14px] text-gray-400">
            {s.text_preview_failed}
          </div>
        )}
        {loadState.status === 'ready' && (
          <pre className="min-h-full whitespace-pre-wrap break-words px-4 py-4 text-[14px] leading-6 text-gray-800 font-mono">
            {loadState.text || s.text_preview_empty}
          </pre>
        )}
      </div>
    </div>
  );
};

export default TextPreviewPage;
