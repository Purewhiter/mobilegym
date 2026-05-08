import React, { useState } from 'react';
import { IcNavBack } from '../res/icons';
import { useRailwayStore } from '../state';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useLocale } from '../../../os/locale';
import { localizeRailwayText } from '../utils/localizeRailwayItem';

export const AddInvoiceHeaderPage: React.FC = () => {
  const { bindBack, back } = useRailwayGestures();
  const addInvoiceHeader = useRailwayStore(s => s.addInvoiceHeader);
  const isEnglish = useLocale() === 'en';

  const [headerType, setHeaderType] = useState<'企业' | '个人/非企业'>('企业');
  const [name, setName] = useState('');
  const [taxNo, setTaxNo] = useState('');
  const [isDefault, setIsDefault] = useState(true);

  const handleSave = () => {
    if (!name.trim()) return;
    if (headerType === '企业' && !taxNo.trim()) return;
    addInvoiceHeader({
      type: headerType,
      name: name.trim(),
      taxNo: headerType === '企业' ? taxNo.trim() : undefined,
      isDefault,
    });
    back();
  };

  return (
    <div className="min-h-full bg-app-bg flex flex-col" data-keep-keyboard>
      {/* 顶栏 */}
      <div className="bg-app-primary pt-10 pb-3 px-4 flex items-center gap-3 relative sticky top-0 z-20">
        <button className="absolute left-3" {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">{isEnglish ? 'Add invoice header' : '添加发票抬头'}</span>
      </div>

      {/* 表单 */}
      <div className="bg-app-surface mt-2">
        {/* 抬头类型 */}
        <div className="flex items-center px-4 py-4 border-b border-gray-100">
          <span className="text-base text-gray-900 font-bold w-[112px] shrink-0 whitespace-normal leading-tight">{isEnglish ? 'Type' : '抬头类型'}</span>
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <label className="flex items-center gap-1.5 cursor-pointer" onClick={() => setHeaderType('企业')}>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${headerType === '企业' ? 'border-app-primary bg-app-primary' : 'border-gray-300'}`}>
                {headerType === '企业' && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
              <span className="text-base text-gray-900">{localizeRailwayText('企业', isEnglish)}</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer" onClick={() => setHeaderType('个人/非企业')}>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${headerType === '个人/非企业' ? 'border-app-primary bg-app-primary' : 'border-gray-300'}`}>
                {headerType === '个人/非企业' && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
              <span className="text-base text-gray-900">{localizeRailwayText('个人/非企业', isEnglish)}</span>
            </label>
          </div>
        </div>

        {/* 发票抬头 */}
        <div className="flex items-center px-4 py-4 border-b border-gray-100">
          <span className="text-base text-gray-900 font-bold w-[112px] shrink-0 whitespace-normal leading-tight">{isEnglish ? 'Header' : '发票抬头'}</span>
          <input
            className="flex-1 text-base text-gray-900 outline-none bg-transparent placeholder:text-gray-300"
            placeholder={isEnglish ? 'Enter invoice header' : '请填写发票抬头'}
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        {/* 纳税人识别号 - 仅企业时显示 */}
        {headerType === '企业' && (
          <div className="flex items-center px-4 py-4 border-b border-gray-100">
            <span className="text-base text-gray-900 font-bold w-[112px] shrink-0 whitespace-normal leading-tight">{isEnglish ? 'Tax ID' : '纳税人识别号'}</span>
            <input
              className="flex-1 text-base text-gray-900 outline-none bg-transparent placeholder:text-gray-300"
              placeholder={isEnglish ? 'Enter taxpayer ID' : '请填写纳税人识别号'}
              value={taxNo}
              onChange={e => setTaxNo(e.target.value)}
            />
          </div>
        )}

        {/* 设为默认抬头 */}
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-base text-gray-900">{isEnglish ? 'Set as default' : '设为默认抬头'}</span>
          <button
            className={`w-12 h-7 rounded-full relative transition-colors ${isDefault ? 'bg-app-primary' : 'bg-gray-300'}`}
            onClick={() => setIsDefault(!isDefault)}
          >
            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${isDefault ? 'right-0.5' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      {/* 保存按钮 */}
      <div className="px-4 mt-auto pb-6 pt-8">
        <button
          className="w-full py-3 bg-app-primary rounded-full text-white text-base font-medium active:opacity-80"
          onClick={handleSave}
        >
          {isEnglish ? 'Save' : '保存'}
        </button>
      </div>
    </div>
  );
};
