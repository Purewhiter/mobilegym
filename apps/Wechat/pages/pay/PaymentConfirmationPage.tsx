import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IcNavBack } from '../../res/icons';
import * as TimeService from '../../../../os/TimeService';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useWechatStore } from '../../state';
import { BackDispatcher } from '../../../../os/BackDispatcher';
import { useActivityContext } from '../../../../os/ActivityContext';
import { useWechatStrings } from '../../hooks/useWechatStrings';

export const PaymentConfirmationPage: React.FC = () => {
  const { bindBack, bindTap } = useWechatGestures();
  const addSubscription = useWechatStore(s => s.addSubscription);
  const { activityId } = useActivityContext();
  const [searchParams] = useSearchParams();
  const t = useWechatStrings();

  const intentData = useMemo(() => {
    const os = window.__OS__;
    const payload = os?.getIntentPayload?.(activityId) ?? os?.getIntentPayload?.('wechat');
    return (payload as { data?: Record<string, any> } | null)?.data ?? null;
  }, [activityId]);

  const source = intentData?.source ?? searchParams.get('source') ?? t.pay_unknown_app;
  const price = String(intentData?.amount ?? searchParams.get('price') ?? '0.00');
  const type = intentData?.subject ?? searchParams.get('type') ?? t.pay_default_type;
  const period = intentData?.period ?? searchParams.get('period') ?? 'month';
  const userName = intentData?.userName ?? searchParams.get('userName') ?? t.pay_default_user;
  const titleName = source === 'bilibili' ? t.pay_bilibili_monthly : type;
  const merchantName = source === 'bilibili' ? t.pay_bilibili_site : source;

  const [paying, setPaying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [password, setPassword] = useState('');

  const showPasswordRef = useRef(false);
  const payingRef = useRef(false);
  showPasswordRef.current = showPassword;
  payingRef.current = paying;

  useEffect(() => {
    return BackDispatcher.register('wechat.pay.cancelDialog', () => {
      const latestState = window.__OS__?.getState?.();
      const activeTask = latestState?.activeTaskId
        ? latestState.tasks.find((task) => task.taskId === latestState.activeTaskId)
        : null;
      const activeActivityId = activeTask?.stack[activeTask.stack.length - 1]?.activityId;
      if (activeActivityId !== activityId) return false;
      if (payingRef.current) return true;
      if (showPasswordRef.current) {
        setShowPassword(false);
        setPassword('');
        return true;
      }
      setShowCancelDialog(true);
      return true;
    }, 150);
  }, [activityId]);

  const returnToCaller = () => {
    window.__OS__?.finishActivity();
  };

  const handleAbandon = () => {
    setShowCancelDialog(false);
    returnToCaller();
  };

  const handlePay = () => {
    setShowPassword(true);
  };

  const periodLabel = period === 'year' ? t.pay_period_year : period === 'quarter' ? t.pay_period_quarter : t.pay_period_month;

  const onPasswordComplete = () => {
    setPaying(true);
    setShowPassword(false);
    setTimeout(() => {
        const nowTs = TimeService.now();
        const newId = `sub_${nowTs}`;
        addSubscription({
            id: newId,
            membershipType: source === 'bilibili' ? t.pay_bilibili_membership : type,
            price: parseFloat(price),
            billingCycle: periodLabel,
            autoRenew: true,
            createdAt: nowTs,
            source: source === 'bilibili' ? t.pay_source_bilibili : source,
        });

        window.__OS__?.broadcast.sendBroadcast({
            action: `${source}.PAY_RESULT`,
            data: { resultCode: 'OK', tradeNo: newId, amount: parseFloat(price), subject: type },
        });

        returnToCaller();
    }, 1000);
  };

  const handlePasswordInput = (num: string) => {
    if (password.length < 6) {
        const next = password + num;
        setPassword(next);
        if (next.length === 6) {
            setTimeout(onPasswordComplete, 300);
        }
    }
  };

  const handlePasswordDelete = () => {
    setPassword(p => p.slice(0, -1));
  };

  return (
    <div className="bg-white h-full flex flex-col font-sans pt-10">
      <div className="flex items-center px-4 h-12 border-b border-gray-100 relative">
        <button {...bindBack<HTMLButtonElement>()} className="absolute left-4">
          <IcNavBack size={24} />
        </button>
        <div className="flex-1 text-center font-medium text-[17px]">{t.pay_title_prefix}{titleName}</div>
      </div>

      <div className="flex-1 flex flex-col items-center pt-12 px-8">
         <div className="text-[15px] text-gray-500 mb-2">{merchantName}</div>
         <div className="text-[40px] font-bold mb-12 flex items-baseline">
             <span className="text-2xl mr-1">¥</span>
             {parseFloat(price).toFixed(2)}
         </div>

         <div className="w-full space-y-6">
             <div className="flex justify-between text-[15px]">
                 <span className="text-gray-500 min-w-[80px]">{t.pay_account}</span>
                 <span className="text-right">{userName}</span>
             </div>
             <div className="flex justify-between text-[15px]">
                 <span className="text-gray-500 min-w-[80px]">{t.pay_service_name}</span>
                 <span className="text-right">{type}</span>
             </div>
             <div className="flex justify-between text-[15px]">
                 <span className="text-gray-500 min-w-[80px]">{t.pay_description}</span>
                 <div className="text-right text-gray-500 leading-relaxed max-w-[220px]">
                    {source === 'bilibili' ? t.pay_bilibili_description : t.pay_auto_renew_description}
                 </div>
             </div>
             <div className="flex justify-between text-[15px]">
                 <span className="text-gray-500 min-w-[80px]">{t.pay_payment_method}</span>
                 <div className="text-right text-gray-500 leading-relaxed max-w-[220px]">
                    {t.pay_payment_method_description}
                 </div>
             </div>
         </div>
      </div>

      <div className="p-8 pb-safe">
          <div className="text-[12px] text-gray-400 text-center mb-6">
              {t.pay_agreement_prefix}<span className="text-[#576b95]">{t.pay_agreement}</span>
          </div>
          <button
            className="w-full bg-[#07c160] text-white font-bold py-3 rounded-lg text-[17px] active:bg-[#06ad56] transition-colors"
            disabled={paying}
            {...bindTap<HTMLButtonElement>({ kind: 'action', id: 'wechat.pay.confirm' }, { onTrigger: handlePay })}
          >
              {paying ? t.pay_paying : t.pay_and_open}
          </button>
      </div>

      {showCancelDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" />
            <div className="bg-white rounded-xl w-[280px] overflow-hidden relative z-10">
                <div className="px-6 pt-7 pb-5 text-center">
                    <div className="text-[17px] font-medium text-[#333]">{t.pay_give_up_payment}</div>
                </div>
                <div className="border-t border-gray-200 flex">
                    <button
                        className="flex-1 py-3.5 text-[16px] font-medium text-[#07c160] active:bg-gray-50 border-r border-gray-200"
                        onClick={() => setShowCancelDialog(false)}
                    >
                        {t.pay_continue_pay}
                    </button>
                    <button
                        className="flex-1 py-3.5 text-[16px] text-[#576b95] active:bg-gray-50"
                        onClick={handleAbandon}
                    >
                        {t.pay_abandon}
                    </button>
                </div>
            </div>
        </div>
      )}

      {showPassword && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowPassword(false)} />
            <div className="bg-white rounded-t-xl animate-slide-up relative z-10 w-full pb-safe">
                <div className="flex justify-between items-center p-4 border-b border-gray-100">
                    <button className="text-gray-400 text-2xl leading-none" {...bindTap<HTMLButtonElement>({ kind: 'action', id: 'wechat.pay.cancel' }, { onTrigger: () => setShowPassword(false) })}>&times;</button>
                    <span className="text-[17px] font-bold">{t.pay_enter_password}</span>
                    <div className="w-6"></div>
                </div>

                <div className="py-8 flex justify-center">
                    <div className="flex border border-gray-300 rounded overflow-hidden">
                        {[0, 1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="w-12 h-12 border-r border-gray-300 last:border-r-0 flex items-center justify-center">
                                {password.length > i && <div className="w-2 h-2 bg-black rounded-full" />}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-[#f2f2f2] grid grid-cols-3 gap-[1px]">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                        <button
                            key={n}
                            className="bg-white py-4 text-2xl font-medium active:bg-gray-200"
                            {...bindTap<HTMLButtonElement>({ kind: 'action', id: `wechat.pay.num.${n}` as any }, { onTrigger: () => handlePasswordInput(n.toString()) })}
                        >
                            {n}
                        </button>
                    ))}
                    <div className="bg-[#f2f2f2]" />
                    <button
                        className="bg-white py-4 text-2xl font-medium active:bg-gray-200"
                        {...bindTap<HTMLButtonElement>({ kind: 'action', id: 'wechat.pay.num.0' }, { onTrigger: () => handlePasswordInput('0') })}
                    >
                        0
                    </button>
                    <button
                        className="bg-white py-4 flex items-center justify-center active:bg-gray-200"
                        {...bindTap<HTMLButtonElement>({ kind: 'action', id: 'wechat.pay.delete' }, { onTrigger: handlePasswordDelete })}
                    >
                        <span className="text-lg">☒</span>
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
