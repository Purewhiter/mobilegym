/**
 * File System Configuration
 * 
 * Defines the preset directory structure and files for the simulated Android file system.
 * Files in presetFiles should have corresponding resources in /public/media/
 */
import { FileSystemConfig } from '../types';

export const FILE_SYSTEM_CONFIG: FileSystemConfig = {
  // 基础目录结构 - 系统会自动根据 manifest 中的文件创建其他目录
  presetStructure: [
    { path: '/sdcard', displayName: '内部存储' },
  ],
  
  // 预置文件列表（仅作为 manifest.json 不存在时的回退）
  // 实际文件应放入 public/media/ 目录，系统会自动发现
  // 详见 public/media/README.md
  presetFiles: [
    // 此处留空，文件会从 manifest.json 自动加载
    // 如果需要使用在线占位图，可以取消下面的注释：
    /*
    {
      path: '/sdcard/DCIM/Camera/sample.jpg',
      uri: 'https://picsum.photos/seed/sample/800/600',
      mimeType: 'image/jpeg',
      size: 100000,
      width: 800,
      height: 600,
    },
    */
  ],
};

/**
 * Album definitions for the gallery app
 * Albums are virtual groupings based on file paths or MIME types
 */
export const ALBUM_DEFINITIONS = [
  { id: 'all', name: '全部', type: 'system' as const, pathPattern: '/sdcard' },
  { id: 'camera', name: '相机', type: 'system' as const, pathPattern: '/sdcard/DCIM/Camera' },
  { id: 'screenshots', name: '截图', type: 'system' as const, pathPattern: '/sdcard/DCIM/Screenshots' },
  { id: 'pictures', name: '图片', type: 'system' as const, pathPattern: '/sdcard/Pictures' },
  { id: 'videos', name: '视频', type: 'system' as const, pathPattern: null, mimePrefix: 'video/' },
  { id: 'wechat', name: '微信', type: 'app' as const, pathPattern: '/sdcard/Pictures/WeChat' },
  { id: 'redbook', name: '小红书', type: 'app' as const, pathPattern: '/sdcard/Pictures/Redbook' },
  { id: 'downloads', name: '下载', type: 'system' as const, pathPattern: '/sdcard/Download' },
  { id: 'movies', name: '电影', type: 'system' as const, pathPattern: '/sdcard/Movies' },
];
