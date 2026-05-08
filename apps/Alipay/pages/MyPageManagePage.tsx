import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { IcNavBack, IcNavForward, IcMore, IcDot } from '../res/icons';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
type ToggleKey =
  | 'documents'
  | 'yuebao'
  | 'huabei'
  | 'antInsure'
  | 'sesame'
  | 'yulibao'
  | 'mybankLoan'
  | 'mybank'
  | 'civic'
  | 'orders'
  | 'moreServices';

type IcSettings = Record<ToggleKey, boolean>;

const Toggle: React.FC<{ checked: boolean; tapProps: any }> = ({ checked, tapProps }) => {
  return (
    <button
      {...tapProps}
 className={`w-12 h-7 rounded-full flex items-center p-1 ${checked ? 'bg-app-primary justify-end' : 'bg-gray-300 justify-start'}`}
 style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard)' }}
    >
      <div className="w-5 h-5 bg-app-surface rounded-full shadow" />
    </button>
  );
};

export const MyPageManagePage: React.FC = () => {
  const s = useAlipayStrings();
  const appSettings = useAlipayStore(s => s.settings);
  const setSettings = useAlipayStore(s => s.setSettings);
  const myManage = appSettings.general.myManage as IcSettings;
  const { bindTap, bindBack } = useAlipayGestures();
  const setFlag = (key: ToggleKey) =>
    setSettings((prev) => ({ ...prev, general: { ...prev.general, myManage: { ...prev.general.myManage, [key]: !prev.general.myManage[key] } } }));

  return (
    <div className="bg-app-bg h-full w-full flex flex-col pt-10">
      <div className="fixed top-0 left-0 right-0 h-10 bg-app-surface z-10 pointer-events-none"></div>
      <div className="sticky top-0 z-20 bg-app-surface px-4 pt-4 pb-2 flex items-center justify-between border-b border-gray-100">
        <button {...bindBack<HTMLButtonElement>()} className="p-1 -ml-1">
          <IcNavBack size={24} className="text-gray-800" />
        </button>
        <span className="text-lg font-medium text-gray-800">{s.my_page_management}</span>
        <div className="flex items-center gap-3">
          <button className="p-1">
            <IcMore size={22} className="text-gray-800" />
          </button>
          <button className="p-1">
            <IcDot size={22} className="text-gray-800" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar px-4 py-4">
        <div className="flex justify-center">
          <div className="w-44 h-72 bg-app-surface rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute top-4 left-8 right-8 h-2 bg-gray-100 rounded-full"></div>
            <div className="absolute top-10 left-10 right-10 h-10 bg-gradient-to-b from-[#DCEAFC] to-[#F1F6FE] rounded-xl"></div>
            <div className="absolute top-24 left-8 right-8 bg-gray-50 rounded-xl p-2 space-y-2">
              <div className="h-3 bg-gray-100 rounded"></div>
              <div className="h-3 bg-gray-100 rounded w-4/5"></div>
              <div className="h-3 bg-gray-100 rounded w-2/3"></div>
            </div>
            <div className="absolute bottom-5 left-6 right-6 h-12 bg-gray-50 rounded-2xl"></div>
          </div>
        </div>

        <div className="text-gray-500 text-sm mt-4 leading-relaxed">
          {s.mypage_manage_description}
        </div>

        <div className="mt-4 bg-app-surface rounded-xl overflow-hidden shadow-sm divide-y divide-gray-100">
          <div className="flex items-center justify-between px-4 py-4 active:bg-gray-50">
            <span className="text-sm font-medium text-gray-800">{s.service_reminders}</span>
            <IcNavForward size={16} className="text-gray-300" />
          </div>
          <div className="flex items-center justify-between px-4 py-4 active:bg-gray-50">
            <span className="text-sm font-medium text-gray-800">{s.merchant_services}</span>
            <IcNavForward size={16} className="text-gray-300" />
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <span className="text-sm font-medium text-gray-800">{s.mypage_id}</span>
            <Toggle
              checked={myManage.documents}
              tapProps={bindTap<HTMLButtonElement>({ kind: 'action', id: 'myManage.documents.toggle' }, { onTrigger: () => setFlag('documents') })}
            />
          </div>
        </div>

        <div className="mt-3 bg-app-surface rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 text-xs text-gray-400">{s.my_assets}</div>
          <div className="divide-y divide-gray-100">
            <div className="flex items-center justify-between px-4 py-4">
              <span className="text-sm font-medium text-gray-800">{s.yue_bao}</span>
              <Toggle
                checked={myManage.yuebao}
                tapProps={bindTap<HTMLButtonElement>({ kind: 'action', id: 'myManage.asset.yuebao.toggle' }, { onTrigger: () => setFlag('yuebao') })}
              />
            </div>
            <div className="flex items-center justify-between px-4 py-4">
              <span className="text-sm font-medium text-gray-800">{s.huabei}</span>
              <Toggle
                checked={myManage.huabei}
                tapProps={bindTap<HTMLButtonElement>({ kind: 'action', id: 'myManage.asset.huabei.toggle' }, { onTrigger: () => setFlag('huabei') })}
              />
            </div>
            <div className="flex items-center justify-between px-4 py-4">
              <span className="text-sm font-medium text-gray-800">{s.antsure}</span>
              <Toggle
                checked={myManage.antInsure}
                tapProps={bindTap<HTMLButtonElement>({ kind: 'action', id: 'myManage.asset.antInsure.toggle' }, { onTrigger: () => setFlag('antInsure') })}
              />
            </div>
            <div className="flex items-center justify-between px-4 py-4">
              <span className="text-sm font-medium text-gray-800">{s.zhima_credit}</span>
              <Toggle
                checked={myManage.sesame}
                tapProps={bindTap<HTMLButtonElement>({ kind: 'action', id: 'myManage.asset.sesame.toggle' }, { onTrigger: () => setFlag('sesame') })}
              />
            </div>
            <div className="flex items-center justify-between px-4 py-4">
              <span className="text-sm font-medium text-gray-800">{s.yu_li_bao}</span>
              <Toggle
                checked={myManage.yulibao}
                tapProps={bindTap<HTMLButtonElement>({ kind: 'action', id: 'myManage.asset.yulibao.toggle' }, { onTrigger: () => setFlag('yulibao') })}
              />
            </div>
            <div className="flex items-center justify-between px-4 py-4">
              <span className="text-sm font-medium text-gray-800">{s.sme_loan}</span>
              <Toggle
                checked={myManage.mybankLoan}
                tapProps={bindTap<HTMLButtonElement>({ kind: 'action', id: 'myManage.asset.mybankLoan.toggle' }, { onTrigger: () => setFlag('mybankLoan') })}
              />
            </div>
            <div className="flex items-center justify-between px-4 py-4">
              <span className="text-sm font-medium text-gray-800">{s.mybank}</span>
              <Toggle
                checked={myManage.mybank}
                tapProps={bindTap<HTMLButtonElement>({ kind: 'action', id: 'myManage.asset.mybank.toggle' }, { onTrigger: () => setFlag('mybank') })}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 bg-app-surface rounded-xl overflow-hidden shadow-sm divide-y divide-gray-100">
          <div className="flex items-center justify-between px-4 py-4">
            <span className="text-sm font-medium text-gray-800">{s.my_social_services}</span>
            <Toggle
              checked={myManage.civic}
              tapProps={bindTap<HTMLButtonElement>({ kind: 'action', id: 'myManage.civic.toggle' }, { onTrigger: () => setFlag('civic') })}
            />
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <span className="text-sm font-medium text-gray-800">{s.my_orders}</span>
            <Toggle
              checked={myManage.orders}
              tapProps={bindTap<HTMLButtonElement>({ kind: 'action', id: 'myManage.orders.toggle' }, { onTrigger: () => setFlag('orders') })}
            />
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <span className="text-sm font-medium text-gray-800">{s.more_services}</span>
            <Toggle
              checked={myManage.moreServices}
              tapProps={bindTap<HTMLButtonElement>({ kind: 'action', id: 'myManage.moreServices.toggle' }, { onTrigger: () => setFlag('moreServices') })}
            />
          </div>
        </div>

        <div className="text-xs text-gray-400 mt-3 px-1 leading-relaxed">
          {s.mypage_manage_basic_note}
        </div>

        <div className="h-10" />
      </div>
    </div>
  );
};

