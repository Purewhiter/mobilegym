import React, { useMemo, useState } from 'react';
import { IcStorage, IcFile, IcImage, IcFilm, IcMusic, IcFileText, IcRefresh } from '../res/icons';
import { SettingsHeader } from './SettingsHeader';
import { PreferenceCategory } from './PreferenceCategory';
import { PreferenceItem } from './PreferenceItem';
import * as FileSystem from '../../../os/FileSystemService';
import { getEffectiveBuildInfo } from '../../../os/managers/registry';
import type { FSNode } from '../../../os/types';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
function parseCapacityBytes(raw: string | undefined): number {
  const s = String(raw ?? '').trim();
  const m = s.match(/([\d.]+)\s*(TB|GB|MB|KB|B)/i);
  if (!m) return 512 * 1024 * 1024 * 1024;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return 512 * 1024 * 1024 * 1024;
  const unit = m[2].toUpperCase();
  const k = 1024;
  if (unit === 'TB') return n * k * k * k * k;
  if (unit === 'GB') return n * k * k * k;
  if (unit === 'MB') return n * k * k;
  if (unit === 'KB') return n * k;
  return n;
}

function sumSize(nodes: FSNode[]): number {
  return nodes.reduce((acc, n) => acc + (typeof n.size === 'number' ? n.size : 0), 0);
}

function openFileManager(route: string) {
  // 真机做法：发 ACTION_VIEW + type=inode/directory intent，让系统找匹配的文件管理器。
  // 我们在 intent.route 上明示目标子页（IntentResolver 让 caller hint 优先于 filter.route），
  // 一次性带 OS 跳到指定路由，不依赖 App-side dispatcher 二次跳转。
  // 默认 same-task push（不加 newTask），FileManager Activity 入栈到 Settings task，
  // 用户按返回单步即可回 Settings。
  const os = window.__OS__;
  if (os && typeof os.startActivity === 'function') {
    os.startActivity({
      action: 'ACTION_VIEW',
      type: 'inode/directory',
      route,
    });
  }
}

export const StorageDashboardPage: React.FC = () => {
  const s = useAppStrings(strings, stringsEn);
  const [refreshKey, setRefreshKey] = useState(0);

  const stats = useMemo(() => {
    // Empty query matches all names (includes('') => true).
    const allFiles = FileSystem.searchFiles('', { path: '/sdcard', type: 'file' });
    const images = allFiles.filter((n) => (n.mimeType || '').startsWith('image/'));
    const videos = allFiles.filter((n) => (n.mimeType || '').startsWith('video/'));
    const audio = allFiles.filter((n) => (n.mimeType || '').startsWith('audio/'));
    const docs = allFiles.filter((n) => {
      const mt = n.mimeType || '';
      if (mt.startsWith('text/')) return true;
      if (mt.startsWith('application/pdf')) return true;
      if (mt.startsWith('application/msword')) return true;
      if (mt.startsWith('application/vnd')) return true;
      if (mt.startsWith('application/rtf')) return true;
      return false;
    });

    const used = sumSize(allFiles);
    const total = parseCapacityBytes(getEffectiveBuildInfo().storageTotal);
    const free = Math.max(0, total - used);

    return {
      total,
      used,
      free,
      images: sumSize(images),
      videos: sumSize(videos),
      audio: sumSize(audio),
      docs: sumSize(docs),
      filesCount: allFiles.length,
    };
  }, [refreshKey]);

  const usedText = `${FileSystem.formatFileSize(stats.used)} / ${FileSystem.formatFileSize(stats.total)}`;
  const freeText = FileSystem.formatFileSize(stats.free);

  return (
    <div className="h-full bg-app-bg flex flex-col">
      <SettingsHeader title={s.storage} />
      <div className="flex-1 overflow-y-auto no-scrollbar pb-8">
        <div className="px-4 mt-2">
          <div className="bg-app-surface rounded-2xl overflow-hidden">
            <PreferenceItem
              title={s.storage_usage}
              summary={`${s.files} ${stats.filesCount}`}
              value={usedText}
              showChevron={false}
              showDivider={false}
            >
              <IcStorage size={16} className="text-gray-300" />
            </PreferenceItem>
          </div>
        </div>

        <PreferenceCategory title={s.categories}>
          <PreferenceItem
            title={s.files}
            summary={s.browse_sdcard}
            value={usedText}
            showDivider={true}
            onClick={() => openFileManager('/')}
          >
            <IcFile size={16} className="text-gray-300" />
          </PreferenceItem>
          <PreferenceItem
            title={s.photos_2}
            value={FileSystem.formatFileSize(stats.images)}
            showDivider={true}
            onClick={() => openFileManager('/category/images')}
          >
            <IcImage size={16} className="text-gray-300" />
          </PreferenceItem>
          <PreferenceItem
            title={s.videos}
            value={FileSystem.formatFileSize(stats.videos)}
            showDivider={true}
            onClick={() => openFileManager('/category/videos')}
          >
            <IcFilm size={16} className="text-gray-300" />
          </PreferenceItem>
          <PreferenceItem
            title={s.audio}
            value={FileSystem.formatFileSize(stats.audio)}
            showDivider={true}
            onClick={() => openFileManager('/category/audio')}
          >
            <IcMusic size={16} className="text-gray-300" />
          </PreferenceItem>
          <PreferenceItem
            title={s.documents}
            value={FileSystem.formatFileSize(stats.docs)}
            showDivider={false}
            onClick={() => openFileManager('/category/documents')}
          >
            <IcFileText size={16} className="text-gray-300" />
          </PreferenceItem>
        </PreferenceCategory>

        <div className="px-4">
          <div className="bg-app-surface rounded-2xl overflow-hidden">
            <PreferenceItem
              title={s.refresh_statistics}
              summary={s.recalculate_storage_usage}
              showDivider={false}
              onClick={() => setRefreshKey((x) => x + 1)}
            >
              <IcRefresh size={16} className="text-gray-300" />
            </PreferenceItem>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorageDashboardPage;

