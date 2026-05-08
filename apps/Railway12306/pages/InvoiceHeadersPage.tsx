import React from 'react';
import { IcNavBack, IcAdd, IcEdit, IcInfo } from '../res/icons';
import { useRailwayStore } from '../state';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useLocale } from '../../../os/locale';
import { localizeRailwayText } from '../utils/localizeRailwayItem';

export const InvoiceHeadersPage: React.FC = () => {
  const { bindBack, bindTap } = useRailwayGestures();
  const invoiceHeaders = useRailwayStore(s => s.invoiceHeaders);
  const isEnglish = useLocale() === 'en';

  // 按类型分组
  const grouped = invoiceHeaders.reduce<Record<string, typeof invoiceHeaders>>((acc, h) => {
    const key = h.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(h);
    return acc;
  }, {});

  const isEmpty = invoiceHeaders.length === 0;

  return (
    <div className="min-h-full bg-app-bg flex flex-col">
      {/* 顶栏 */}
      <div className="bg-app-primary pt-10 pb-3 px-4 flex items-center relative sticky top-0 z-20">
        <button className="absolute left-3" {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">{isEnglish ? 'Invoice headers' : '发票抬头管理'}</span>
      </div>

      <div className="flex-1">
        {isEmpty ? (
          /* 空状态 */
          <div className="flex flex-col items-center justify-center pt-32">
            <div className="w-28 h-28 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <rect x="12" y="8" width="32" height="40" rx="3" fill="#E5E7EB" />
                <rect x="18" y="18" width="20" height="2" rx="1" fill="#D1D5DB" />
                <rect x="18" y="24" width="20" height="2" rx="1" fill="#D1D5DB" />
                <rect x="18" y="30" width="14" height="2" rx="1" fill="#D1D5DB" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm mb-6">{isEnglish ? 'No invoice headers yet' : '当前暂无发票抬头'}</p>
            <button
              className="flex items-center gap-2 bg-app-primary text-white px-8 py-3 rounded-full text-base font-medium active:opacity-80"
              {...bindTap<HTMLButtonElement>('invoice.addHeader' as any)}
            >
              <IcAdd size={20} />
              <span>{isEnglish ? 'Add invoice header' : '添加发票抬头'}</span>
            </button>
          </div>
        ) : (
          /* 列表状态 */
          <>
            {Object.entries(grouped).map(([groupName, items]) => (
              <div key={groupName} className="bg-app-surface mx-3 mt-3 rounded-lg overflow-hidden">
                <div className="px-4 pt-4 pb-2">
                  <span className="text-base font-bold text-gray-900">{isEnglish ? `Header - ${localizeRailwayText(groupName, true)}` : `发票抬头-${groupName}`}</span>
                </div>
                {items.map((h, i) => (
                  <div
                    key={h.id}
                    className={`flex items-center justify-between px-4 py-3 ${i < items.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-900">{h.name}</span>
                        {h.isDefault && (
                          <span className="text-[11px] text-app-primary border border-app-primary rounded px-1.5 py-0.5">{isEnglish ? 'Default' : '默认'}</span>
                        )}
                      </div>
                      {h.type === '企业' && h.taxNo && (
                        <p className="text-xs text-gray-400 mt-0.5">{h.taxNo}</p>
                      )}
                    </div>
                    <IcEdit size={18} className="text-gray-400 shrink-0" />
                  </div>
                ))}
              </div>
            ))}

            {/* 温馨提示 */}
            <div className="mx-3 mt-4 bg-app-surface rounded-lg px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <IcInfo size={14} className="text-app-primary shrink-0" />
                <span className="text-sm text-app-primary font-medium">{isEnglish ? 'Notes:' : '温馨提示：'}</span>
              </div>
              <p className="text-xs text-gray-400 ml-5">{isEnglish ? 'You can add up to 5 invoice headers here.' : '发票抬头管理中最多可添加5个发票抬头。'}</p>
            </div>
          </>
        )}
      </div>

      {/* 底部添加按钮（有数据时显示） */}
      {!isEmpty && (
        <div className="px-3 pb-4 pt-4 mt-auto">
          <button
            className="w-full flex items-center justify-center gap-2 bg-app-primary text-white py-3 rounded-full text-base font-medium active:opacity-80"
            {...bindTap<HTMLButtonElement>('invoice.addHeader' as any)}
          >
            <IcAdd size={20} />
            <span>{isEnglish ? 'Add invoice header' : '添加发票抬头'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
