import React from 'react';
import { dimens } from '../../res/dimens';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { IcClose, IcMore, IcQrCode, IcImage } from '../../res/icons';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useAppNavigate } from '../../navigation';

export const ScanPage: React.FC = () => {
  const t = useWechatStrings();
  const { bindBack } = useWechatGestures();
  const { go } = useAppNavigate();

  return (
    <div
      className="absolute inset-0 flex flex-col bg-(--app-c-misc-moments-cover-bg)"
      data-status-bar-foreground="light"
    >
      {/* 顶部栏：与下方扫描区同色，无单独色块；仅关闭与更多按钮 */}
      <div className="flex items-center justify-between px-6 pt-12 pb-3 z-10">
        <button
          type="button"
          {...bindBack<HTMLButtonElement>({ stopPropagation: true })}
          className="w-6 h-6 rounded-full bg-app-surface/90 flex items-center justify-center active:opacity-80"
        >
          <IcClose size={dimens.icSizeTiny} className="text-(--app-c-common-text-secondary)" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          className="w-9 h-9 flex items-center justify-center active:opacity-80 text-white"
        >
          <IcMore size={dimens.icSizeTab} className="text-white" strokeWidth={dimens.icStrokeWidth} />
        </button>
      </div>

      {/* 扫描区域占位 + 绿色扫描线（与顶部同属相机色块） */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 bg-(--app-c-misc-moments-cover-bg) relative min-h-0">
        <div className="w-full flex-1 flex flex-col items-center justify-center relative max-w-lg">
          {/* 绿色扫描线 */}
          <div
            className="absolute left-0 right-0 h-(--app-divider-height-2) rounded-full z-10"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, var(--app-primary) 15%, var(--app-primary) 50%, var(--app-primary) 85%, transparent 100%)',
              boxShadow: '0 0 12px var(--app-primary)',
            }}
          />
        </div>
      </div>

      {/* 提示文案：仅比我的二维码/相册高一点 */}
      <p className="text-white text-(--app-settings-group-title-size) text-center pb-2 bg-(--app-c-misc-moments-cover-bg)">
        识别二维码  /  花草  /  动物  /  商品等
      </p>

      {/* 底部：我的二维码靠左、相册靠右 */}
      <div className="flex justify-between items-center px-8 pb-6 pt-0 bg-(--app-c-misc-moments-cover-bg)">
        <button
          type="button"
          onClick={() => go('scan.qrcode.open')}
          className="flex flex-col items-center gap-2 active:opacity-80"
        >
          <div className="w-11 h-11 rounded-full bg-app-surface/40 flex items-center justify-center">
            <IcQrCode size={dimens.icSizePlusMenu} className="text-white/70" strokeWidth={1.5} />
          </div>
          <span className="text-(--app-chat-system-msg-text-size) text-white">我的二维码</span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center gap-2 active:opacity-80"
        >
          <div className="w-11 h-11 rounded-full bg-app-surface/40 flex items-center justify-center">
            <IcImage size={dimens.icSizeCheck} className="text-white/70" strokeWidth={1.5} />
          </div>
          <span className="text-(--app-chat-system-msg-text-size) text-white">{t.me_album}</span>
        </button>
      </div>

      {/* 底部 Tab：扫一扫 | 翻译 */}
      <div className="h-20 bg-black flex items-center relative">
        {/* 扫一扫 Tab (居中) */}
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
          <span className="text-(--app-settings-group-title-size) text-white font-medium">{t.discover_scan}</span>
          <div className="mt-1 w-1.5 h-1.5 bg-app-surface rounded-full" />
        </div>
        {/* 翻译 Tab (右侧) */}
        <span className="text-(--app-settings-group-title-size) text-(--app-c-search-empty-text) absolute right-28">翻译</span>
      </div>
    </div>
  );
};
