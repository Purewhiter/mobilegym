import { useRedBookStrings } from '../hooks/useRedBookStrings';
import React from 'react';
import { IcNavBack, IcNavForward } from '../res/icons';
const ChevronLeft = IcNavBack, ChevronRight = IcNavForward;
import { useRedBookGestures } from '../hooks/useRedBookGestures';
export const AccountSecurityPage: React.FC = () => {
  const s = useRedBookStrings();
  const { bindBack } = useRedBookGestures();

  const ListItem = ({
      label,
      onClick,
      isLast = false,
      rightText,
      subtitle
  }: {
      label: string,
      onClick?: () => void,
      isLast?: boolean,
      rightText?: string,
      subtitle?: string
  }) => (
      <div
        className={`flex items-center justify-between px-4 py-[18px] active:bg-gray-50 bg-app-surface ${!isLast ? 'border-b border-gray-50' : ''}`}
        onClick={onClick}
      >
          <div className="flex flex-col gap-1">
              <span className="text-[16px] text-app-text">{label}</span>
              {subtitle && <span className="text-[12px] text-app-text-muted">{subtitle}</span>}
          </div>
          <div className="flex items-center gap-2">
              {rightText && <span className="text-[14px] text-app-text-muted">{rightText}</span>}
              <ChevronRight size={18} className="text-[#ccc]" />
          </div>
      </div>
  );

  return (
    <div className="h-full flex flex-col bg-[#f5f5f5]">
      {/* Header */}
      <div className="pt-10 px-4 pb-3 flex items-center bg-app-surface sticky top-0 z-20">
        <div className="active:opacity-60 absolute left-4 p-1" {...bindBack()}>
             <ChevronLeft size={24} className="text-app-text" />
        </div>
        <div className="flex-1 text-center">
             <span className="text-[17px] font-medium text-app-text">{s.account_and_security}</span>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto px-3 pt-4"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
          {/* Group 1 */}
          <div className="bg-app-surface rounded-xl mb-5 overflow-hidden">
               <ListItem label={s.phone_number} rightText="+86182****0221" />
               <ListItem label={s.login_password} rightText={s.not_set} isLast />
          </div>

          {/* Group 2 */}
          <div className="bg-app-surface rounded-xl mb-5 overflow-hidden">
               <ListItem label={s.wechat_account} rightText={s.not_linked} />
               <ListItem label={s.weibo_account} rightText={s.not_linked} />
               <ListItem label={s.qq_account} rightText={s.not_linked} isLast />
          </div>

          {/* Group 3 */}
          <div className="bg-app-surface rounded-xl mb-5 overflow-hidden">
               <ListItem label={s.id_verification} rightText={s.not_verified} />
               <ListItem
                  label={s.official_verification}
                  rightText={s.not_verified}
                  subtitle={s.professional_org_or_business_verification}
                  isLast
               />
          </div>

          {/* Group 4 */}
          <div className="bg-app-surface rounded-xl mb-5 overflow-hidden">
               <ListItem label={s.device_management} isLast />
          </div>

          {/* Group 5 */}
          <div className="bg-app-surface rounded-xl mb-5 overflow-hidden">
               <ListItem
                  label={s.account_recovery}
                  subtitle={s.recover_and_log_in_to_another_account}
                  isLast
               />
          </div>

          {/* Group 6 */}
          <div className="bg-app-surface rounded-xl mb-5 overflow-hidden">
               <ListItem label={s.pro_account} rightText={s.not_upgraded} isLast />
          </div>

          {/* Group 7 */}
          <div className="bg-app-surface rounded-xl mb-20 overflow-hidden">
               <ListItem label={s.delete_account} isLast />
          </div>
      </div>
    </div>
  );
};