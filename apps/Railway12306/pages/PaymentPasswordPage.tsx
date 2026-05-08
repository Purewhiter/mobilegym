import React, { useState } from 'react';
import { IcNavBack } from '../res/icons';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useRailwayStrings } from '../hooks/useRailwayStrings';

export const PaymentPasswordPage: React.FC = () => {
  const { bindBack } = useRailwayGestures();
  const s = useRailwayStrings();
  const [activeTab, setActiveTab] = useState<'change' | 'reset'>('change');
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  return (
    <div className="min-h-full bg-app-bg" data-status-bar-foreground="light">
      <div className="bg-app-primary pt-10 pb-3 px-4 flex items-center relative sticky top-0 z-20">
        <button className="absolute left-3" {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">
          {s.payment_password_title}
        </span>
      </div>

      <div className="bg-app-surface mx-4 mt-4 rounded-xl overflow-hidden">
        <div className="flex">
          <button
            className={`flex-1 py-3 text-center text-sm font-medium relative ${activeTab === 'change' ? 'text-app-primary' : 'text-gray-400 bg-gray-100'}`}
            onClick={() => setActiveTab('change')}
          >
            {s.payment_password_change_tab}
            {activeTab === 'change' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-app-primary" />}
          </button>
          <button
            className={`flex-1 py-3 text-center text-sm font-medium relative ${activeTab === 'reset' ? 'text-app-primary' : 'text-gray-400 bg-gray-100'}`}
            onClick={() => setActiveTab('reset')}
          >
            {s.payment_password_reset_tab}
            {activeTab === 'reset' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-app-primary" />}
          </button>
        </div>

        <div className="px-4 py-2">
          <div className="flex items-center py-4 border-b border-gray-100">
            <span className="w-16 text-sm text-gray-900 font-medium">{s.payment_password_old_label}</span>
            <input
              type="password"
              placeholder={s.payment_password_old_placeholder}
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              maxLength={6}
              className="flex-1 text-sm text-gray-500 outline-none"
            />
          </div>
          <div className="flex items-center py-4 border-b border-gray-100">
            <span className="w-16 text-sm text-gray-900 font-medium">{s.payment_password_new_label}</span>
            <input
              type="password"
              placeholder={s.payment_password_new_placeholder}
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              maxLength={6}
              className="flex-1 text-sm text-gray-500 outline-none"
            />
          </div>
          <div className="flex items-center py-4 border-b border-gray-100">
            <span className="w-16 text-sm text-gray-900 font-medium">{s.payment_password_confirm_label}</span>
            <input
              type="password"
              placeholder={s.payment_password_confirm_placeholder}
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              maxLength={6}
              className="flex-1 text-sm text-gray-500 outline-none"
            />
          </div>

          <div className="py-4">
            <button className="w-full py-3 bg-[#6BB5FD] rounded-lg text-white text-base font-medium">
              {s.action_confirm}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 mt-6">
        <p className="text-sm font-bold text-gray-700">{s.add_passenger_tips_title}</p>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
          {s.payment_password_tips_body}
        </p>
      </div>
    </div>
  );
};
