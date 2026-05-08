import React from 'react';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { IcNavBack, IcMore, IcQrCode, IcImage } from '../res/icons';

export const ScanPage: React.FC = () => {
  const s = useAlipayStrings();
  const { bindTap, bindBack } = useAlipayGestures();

  return (
    <div
      className="h-full flex flex-col bg-black pt-10"
      data-status-bar-foreground="light"
      data-navigation-bar-foreground="light"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 z-20">
        <button {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
        <button>
          <IcMore size={24} className="text-white" />
        </button>
      </div>

      {/* Camera viewfinder area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Simulated camera background with noise */}
        <div className="absolute inset-0 bg-gradient-to-b from-gray-700 via-gray-600 to-gray-500 opacity-60" />

        {/* Scan frame area */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-56 h-56 relative">
            {/* Corner markers */}
            <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-blue-400" />
            <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-blue-400" />
            <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-blue-400" />
            <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-blue-400" />

            {/* Scan line animation */}
            <div
              className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-400 to-transparent"
              style={{
                animation: 'alipay-scan-line 2s ease-in-out infinite',
              }}
            />
            <style>{`
              @keyframes alipay-scan-line {
                0%, 100% { top: 0; }
                50% { top: 100%; }
              }
            `}</style>
          </div>
        </div>

        {/* Help text */}
        <div className="absolute bottom-28 left-0 right-0 flex justify-center">
          <div className="bg-black/50 rounded-full px-6 py-2">
            <span className="text-white/80 text-sm">{s.scan_no_qr_found} &raquo;</span>
          </div>
        </div>

        {/* Bottom action buttons */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-between px-12">
          {/* 收付款 button */}
          <button
            className="flex flex-col items-center"
            {...bindTap<HTMLButtonElement>('scan.pay')}
          >
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-1">
              <IcQrCode size={28} className="text-white" />
            </div>
            <span className="text-white/90 text-xs">{s.pay_and_receive}</span>
          </button>

          {/* 相册 button */}
          <button className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-1">
              <IcImage size={28} className="text-white" />
            </div>
            <span className="text-white/90 text-xs">{s.scan_album}</span>
          </button>
        </div>
      </div>

      {/* Bottom tab bar: 扫码 | 灵光 */}
      <div className="flex-shrink-0 bg-[#1a1a1a] flex justify-center items-center py-3 gap-12">
        <button className="flex flex-col items-center">
          <span className="text-blue-400 text-base font-medium">{s.scan_code}</span>
          <div className="w-6 h-[3px] bg-blue-500 rounded-full mt-1" />
        </button>
        <button className="flex flex-col items-center">
          <span className="text-white/60 text-base font-medium">{s.scan_light}</span>
          <div className="w-6 h-[3px] bg-transparent rounded-full mt-1" />
        </button>
      </div>
    </div>
  );
};
