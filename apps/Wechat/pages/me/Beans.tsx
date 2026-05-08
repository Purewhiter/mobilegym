import React from 'react';
import { useWechatStrings } from '../../hooks/useWechatStrings';

export const BeansPage = () => {
  const t = useWechatStrings();
  return (
    <div className="min-h-screen bg-(--app-c-common-green) flex flex-col items-center pt-20">
         <div className="bg-app-surface p-6 rounded-lg shadow-sm w-[90%] min-h-(--app-item-height-400) flex flex-col items-center justify-center">
             <div className="bg-(--app-c-common-green) w-12 h-12 rounded-full flex items-center justify-center mb-4 rounded-tl-none transform rotate-45">
                 {/* Abstract Bean Icon */}
                 <div className="w-6 h-6 bg-app-surface rounded-full opacity-30 transform -rotate-45"></div>
             </div>
             <div className="text-xl font-medium text-app-text mb-2">{t.settings_wechat_beans}</div>
             <div className="text-(--app-c-tw-text-gray-400) text-lg mb-12">暂无微信豆</div>

             <button className="w-40 bg-app-primary text-white py-2.5 rounded font-medium">
                 充值
             </button>
         </div>
         <div className="mt-auto mb-8 flex gap-4 text-sm text-white opacity-80">
             <span>了解微信豆</span>
             <span>|</span>
             <span>常见问题</span>
         </div>
    </div>
  );
};