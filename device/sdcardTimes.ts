/**
 * Fixed modified times of the preset `public/sdcard` files, keyed by path under
 * `public/sdcard`, in Asia/Shanghai local time.
 *
 * The seed must not use the host's file mtimes: git sets them to the checkout
 * time, so they differ between machines and every file in a checkout ties.
 * Files whose name carries a date use that date; the undated photos keep the
 * times `crossapp_content` FavoriteWaterSceneryPhotos stamps on them, and
 * IMG_8xxx stay newer than the dated camera photos as they were on the old seed.
 * A file missing here gets `SDCARD_DEFAULT_MODIFIED_AT` and a warning.
 */

const TABLE: Record<string, string> = {
  'Alarms/morning_alarm.ogg': '2025-03-02 07:00:00',
  'Android/data/com.eg.android.AlipayGphone/cache': '2026-04-28 09:00:00',
  'Android/data/com.ss.android.ugc.aweme/cache': '2026-04-28 09:01:00',
  'Android/data/com.tencent.mm/cache': '2026-04-28 09:02:00',
  'Android/media/com.tencent.mm/placeholder': '2026-04-28 09:03:00',
  'Android/media/com.whatsapp/placeholder': '2026-04-28 09:04:00',
  'Audiobooks/三体_第一章.mp3': '2025-11-08 21:30:00',
  'DCIM/Camera/IMG_20221201_094515.jpg': '2022-12-01 09:45:15',
  'DCIM/Camera/IMG_20230325_110540.jpg': '2023-03-25 11:05:40',
  'DCIM/Camera/IMG_20240610_183025.jpg': '2024-06-10 18:30:25',
  'DCIM/Camera/IMG_20250815_142310.jpg': '2025-08-15 14:23:10',
  'DCIM/Camera/IMG_20251020_091520.jpg': '2025-10-20 09:15:20',
  'DCIM/Camera/IMG_20260108_153045.jpg': '2026-01-08 15:30:45',
  'DCIM/Camera/IMG_20260112_102030.jpg': '2026-01-12 10:20:30',
  'DCIM/Camera/IMG_20260115_143022.jpg': '2026-01-15 14:30:22',
  'DCIM/Camera/IMG_20260116_091530.jpg': '2026-01-16 09:15:30',
  'DCIM/Camera/IMG_20260117_185412.jpg': '2026-01-17 18:54:12',
  'DCIM/Camera/IMG_20260119_101501.jpg': '2026-01-19 10:15:01',
  'DCIM/Camera/IMG_20260119_101502.jpg': '2026-01-19 10:15:02',
  'DCIM/Camera/IMG_20260119_101503.jpg': '2026-01-19 10:15:03',
  'DCIM/Camera/IMG_20260119_101504.jpg': '2026-01-19 10:15:04',
  'DCIM/Camera/IMG_20260320_yiheyuan_wanshoushan.jpg': '2026-03-20 10:30:00',
  'DCIM/Camera/IMG_20260417_181200.jpg': '2026-04-17 18:12:00',
  'DCIM/Camera/IMG_20260417_181500.jpg': '2026-04-17 18:15:00',
  'DCIM/Camera/IMG_20260417_184226.jpg': '2026-04-17 18:42:26',
  'DCIM/Camera/IMG_20260418_091544.jpg': '2026-04-18 09:15:44',
  'DCIM/Camera/IMG_20260418_093000.jpg': '2026-04-18 09:30:00',
  'DCIM/Camera/IMG_20260423_191032.jpg': '2026-04-23 19:10:32',
  'DCIM/Camera/IMG_8041.jpg': '2026-05-06 14:02:10',
  'DCIM/Camera/IMG_8042.jpg': '2026-05-06 14:03:10',
  'DCIM/Camera/IMG_8043.jpg': '2026-05-06 14:04:10',
  'DCIM/Camera/IMG_8044.jpg': '2026-05-06 14:05:10',
  'DCIM/Camera/IMG_8045.jpg': '2026-05-06 14:06:10',
  'DCIM/Camera/IMG_8046.jpg': '2026-05-06 14:07:10',
  'DCIM/Camera/IMG_8051.jpg': '2026-05-07 20:30:00',
  'DCIM/Camera/IMG_8052.jpg': '2026-05-07 20:31:00',
  'DCIM/Camera/IMG_8131.jpg': '2026-05-08 12:15:00',
  'DCIM/Camera/IMG_8132.jpg': '2026-05-08 12:16:00',
  'Documents/会议纪要_0215.txt': '2026-02-15 17:40:00',
  'Documents/工作周报_2026W03.docx': '2026-01-16 18:20:00',
  'Documents/租房合同_2025.pdf': '2025-08-30 15:00:00',
  'Documents/身份证正反面.pdf': '2025-06-12 10:20:00',
  'Download/downloaded_image.jpg': '2024-07-10 12:00:00',
  'Download/pdf_preview_demo.pdf': '2026-03-05 09:40:00',
  'Download/text_preview_demo.txt': '2026-03-05 09:42:00',
  'Movies/Screen_Recording_20260118.mp4': '2026-01-18 21:05:00',
  'Movies/VID_20260201_120530.mp4': '2026-02-01 12:05:30',
  'Music/Taylor Swift - Anti-Hero.mp3': '2025-09-12 22:10:00',
  'Music/周杰伦 - 晴天.mp3': '2025-09-12 22:12:00',
  'Music/陈奕迅 - 富士山下.mp3': '2025-09-12 22:14:00',
  'Notifications/wechat_notify.ogg': '2025-03-02 07:05:00',
  // mmexport<epoch ms> is WeChat's export time.
  'Pictures/WeChat/mmexport1737200000001.jpg': '2025-01-18 19:33:20.001',
  'Pictures/WeChat/mmexport1737200000002.jpg': '2025-01-18 19:33:20.002',
  'Pictures/downloaded_image_copy.jpg': '2024-07-10 12:05:00',
  'Pictures/photo_001.jpg': '2024-03-01 09:00:00',
  'Podcasts/故事FM_EP203.mp3': '2026-02-22 08:15:00',
  'README.md': '2026-01-01 00:00:00',
  'Ringtones/mi_ringtone_custom.ogg': '2025-03-02 07:10:00',
};

function shanghaiToEpoch(local: string): number {
  return Date.parse(`${local.replace(' ', 'T')}+08:00`);
}

export const SDCARD_DEFAULT_MODIFIED_AT = shanghaiToEpoch('2026-01-01 00:00:00');

export const SDCARD_MODIFIED_AT: Record<string, number> = Object.fromEntries(
  Object.entries(TABLE).map(([p, local]) => [p, shanghaiToEpoch(local)]),
);
