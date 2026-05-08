import React, { useState, useEffect } from 'react';
import { IcNavBack } from '../res/icons';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
import { useBilibiliStore } from '../state';
import * as TimeService from '../../../os/TimeService';

interface VipPackage {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  badge?: string;
  desc?: string;
  period: string; // 'month', 'quarter', 'year'
}

const PACKAGES: VipPackage[] = [
  { id: 'year_auto', title: '连续包年', price: 148, originalPrice: 233, badge: '赠', desc: '已优惠¥85', period: 'year' },
  { id: 'year_super', title: '超大连续包年', price: 178, originalPrice: 388, badge: '限时红包', desc: '已优惠¥210 | 含电视端', period: 'year' },
  { id: 'month_auto', title: '连续包月', price: 15, originalPrice: 25, badge: '限时红包', desc: '已优惠¥10', period: 'month' },
  { id: 'quarter_auto', title: '连续包季', price: 45, originalPrice: 68, badge: '限时红包', desc: '已优惠¥23', period: 'quarter' },
  { id: 'quarter_super', title: '超大连续包季', price: 83, originalPrice: 118, badge: '限时红包', desc: '已优惠¥35 | 含电视端', period: 'quarter' },
];

export const VipPage: React.FC = () => {
  const { user } = useBilibiliStore();
  const updateUser = useBilibiliStore(s => s.updateUser);
  const { bindBack, bindTap } = useBilibiliGestures();
  const [selectedId, setSelectedId] = useState('year_auto');
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'alipay' | 'wechat' | 'huabei'>('alipay');

  useEffect(() => {
    const unregister = window.__OS__?.broadcast.registerReceiver(
      'bilibili.PAY_RESULT',
      (intent) => {
        if (intent.data?.resultCode === 'OK') {
          const now = TimeService.now();
          const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
          updateUser({ isVip: true, vipExpireAt: now + oneMonthMs });
        }
      },
    );
    return () => unregister?.();
  }, [updateUser]);

  const selectedPkg = PACKAGES.find(p => p.id === selectedId) || PACKAGES[0];

  const openPaymentSelection = () => {
    setShowPayment(true);
  };

  const executePay = () => {
    if (paymentMethod === 'wechat') {
        const os = window.__OS__;
        if (os?.startActivity) {
            setTimeout(() => {
                try {
                    const currentOs = window.__OS__;
                    currentOs?.startActivity(
                        {
                            action: 'ACTION_PAY',
                            scheme: 'weixin',
                            data: {
                                amount: selectedPkg.price,
                                source: 'bilibili',
                                subject: `哔哩哔哩大会员${selectedPkg.title}`,
                                period: selectedPkg.period,
                                userName: user.name,
                                merchantName: '哔哩哔哩弹幕网',
                            },
                        },
                        { newTask: true },
                    );
                } catch (e) {
                    console.error('Failed to open wechat pay:', e);
                }
            }, 300);
        } else {
            console.warn('OS startActivity not found');
        }
    } else {
        alert('请选择微信支付以体验完整流程');
    }
  };

  const getPaymentMethodInfo = () => {
      if (paymentMethod === 'wechat') {
          return {
              icon: <span className="bg-[#07c160] text-white px-0.5 rounded mx-0.5">微</span>,
              name: '微信支付',
              desc: '，已阅读并同意《付款授权服务协议》，开通后到期前24小时将自动发起续费，可随时取消自动续费'
          };
      } else if (paymentMethod === 'alipay') {
          return {
              icon: <span className="bg-[#1677ff] text-white px-0.5 rounded mx-0.5">支</span>,
              name: '支付宝',
              desc: '，已阅读并同意《付款授权服务协议》，开通后到期前24小时将自动发起续费，可随时取消自动续费'
          };
      } else {
          return {
              icon: <span className="bg-[#1677ff] text-white px-0.5 rounded mx-0.5">花</span>,
              name: '花呗',
              desc: '，已阅读并同意《付款授权服务协议》，开通后到期前24小时将自动发起续费，可随时取消自动续费'
          };
      }
  };

  const payInfo = getPaymentMethodInfo();
  const vipExpireText = (() => {
    if (!user.vipExpireAt) return '';
    const d = TimeService.fromTimestamp(user.vipExpireAt);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  })();

  return (
    <div className="bg-[#f5f5f5] min-h-full pb-32 relative font-sans">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 pt-8">
        <div className="flex items-center px-4 h-12">
          <button {...bindBack()}>
            <IcNavBack size={24} />
          </button>
          <div className="flex-1 text-center font-medium text-lg">成为大会员</div>
          <div className="w-6"></div>
        </div>
      </div>

      {/* User Info */}
      <div className="px-4 py-6 flex items-center bg-white mb-2">
        <img src={user.avatar} className="w-14 h-14 rounded-full border border-gray-200" referrerPolicy="no-referrer" />
        <div className="ml-3 flex-1">
          <div className="flex items-center gap-2">
            <div className="font-bold text-lg">{user.name}</div>
            {user.uid && <div className="text-xs text-gray-400">{user.uid}</div>}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {user.isVip && vipExpireText
              ? `大会员：有效期至${vipExpireText}`
              : '你还不是大会员，开通福利多多 ①'}
          </div>
        </div>
      </div>

      {/* Packages */}
      <div className="bg-white px-4 py-4 mb-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center text-sm font-bold text-[#fb7299]">
            <span className="bg-[#fb7299] text-white text-[10px] px-1 rounded mr-1 leading-none py-0.5">大</span>
            手机/电脑/Pad上可用
          </div>
          <div className="text-xs text-gray-400">切换普通套餐 ⇌</div>
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {PACKAGES.map(p => {
            const isSelected = selectedId === p.id;
            return (
              <div
                key={p.id}
                className={`flex-shrink-0 w-[104px] h-[130px] rounded-lg border-2 relative flex flex-col items-center justify-center transition-all ${
                  isSelected ? 'border-[#fb7299] bg-[#fff0f6]' : 'border-gray-100 bg-white'
                }`}
                onClick={() => setSelectedId(p.id)}
              >
                {p.badge && (
                  <div className="absolute -top-[1px] -right-[1px] bg-[#fb7299] text-white text-[10px] px-1.5 py-0.5 rounded-bl-lg rounded-tr-md">
                    {p.badge}
                  </div>
                )}
                <div className="text-sm font-medium mb-1 mt-2">{p.title}</div>
                <div className="flex items-baseline text-[#fb7299]">
                  <span className="text-xs">¥</span>
                  <span className="text-3xl font-bold">{p.price}</span>
                </div>
                {p.originalPrice && <div className="text-[10px] text-gray-400 line-through decoration-gray-400">已优惠¥{p.originalPrice - p.price}</div>}
                {p.badge === '限时红包' && <div className="bg-[#fb7299] text-white text-[10px] px-1 rounded mt-1">限时红包</div>}
              </div>
            );
          })}
        </div>
        
        <div className="bg-[#fff9fa] rounded-lg p-3 mt-4 flex items-center gap-2">
             <div className="bg-[#fb7299] text-white text-xs px-1 rounded">赠</div>
             <div className="text-xs text-gray-700">本次送网易严选Pro纯享会员月卡</div>
        </div>

        <div className="text-xs text-gray-500 mt-3">
            每月按{selectedPkg.price}元自动续费，可随时取消自动续费
        </div>
        
        <div className="flex justify-between items-center mt-4 py-3 border-t border-dashed border-gray-200">
            <span className="text-sm font-bold">代金券</span>
            <span className="text-xs text-[#fb7299]">不使用代金券 &gt;</span>
        </div>

        <div className="bg-[#fffcf2] p-3 rounded-lg flex items-start mt-2" onClick={openPaymentSelection}>
            <div className="flex-1 text-xs text-[#b88347]">
                使用 {payInfo.icon} {payInfo.name}{payInfo.desc}
            </div>
            <div className="text-[#b88347] ml-2">&gt;</div>
        </div>
      </div>
      
      {/* Joint Membership (Mock) */}
      <div className="bg-white p-4 mt-2">
          <div className="flex justify-between items-center mb-3">
              <div className="font-bold text-sm">联合会员</div>
              <div className="text-xs text-gray-400">查看更多 &gt;</div>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar">
              <div className="flex-shrink-0 w-28 h-32 border border-gray-100 rounded-lg bg-[#f6f7f9]"></div>
              <div className="flex-shrink-0 w-28 h-32 border border-gray-100 rounded-lg bg-[#f6f7f9]"></div>
              <div className="flex-shrink-0 w-28 h-32 border border-gray-100 rounded-lg bg-[#f6f7f9]"></div>
          </div>
      </div>

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white px-4 py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-20">
         <div className="flex items-start gap-2 mb-3">
             <input type="checkbox" defaultChecked className="mt-0.5 w-3.5 h-3.5 rounded-full text-[#fb7299] border-gray-300 focus:ring-[#fb7299]" />
             <div className="text-[10px] text-gray-400 leading-tight">
                 开通前请阅读《大会员服务协议》《大会员自动续费服务规则》
             </div>
         </div>
         <button
            className="w-full bg-[#fb7299] text-white font-bold py-2.5 rounded-full text-lg shadow-lg shadow-pink-200 active:scale-98 transition-transform"
            {...bindTap<HTMLButtonElement>('vip.pay.confirm', { onTrigger: executePay })}
         >
             确认协议并支付 ¥{selectedPkg.price}
         </button>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" onClick={() => setShowPayment(false)} />
            <div className="bg-white rounded-t-xl p-4 animate-slide-up relative z-10 pb-8">
                <div className="flex justify-between items-center mb-6">
                    <span className="text-lg font-bold">支付方式</span>
                    <button onClick={() => setShowPayment(false)} className="text-gray-400 text-2xl leading-none">&times;</button>
                </div>
                
                {/* Alipay Option */}
                <div className="flex items-center justify-between py-3.5 border-b border-gray-50" onClick={() => { setPaymentMethod('alipay'); setShowPayment(false); }}>
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-[#1677ff] rounded flex items-center justify-center text-white text-xs">支</div>
                        <div>
                            <div className="text-[15px]">支付宝</div>
                            <div className="text-[10px] text-gray-400 mt-0.5 leading-tight max-w-[240px]">
                                已阅读并同意《付款授权服务协议》，开通后到期前24小时将自动发起续费，可随时取消自动续费
                            </div>
                        </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${paymentMethod === 'alipay' ? 'border-[#fb7299] bg-white' : 'border-gray-300'}`}>
                        {paymentMethod === 'alipay' && <div className="w-3 h-3 bg-[#fb7299] rounded-full" />}
                    </div>
                </div>

                {/* WeChat Option */}
                <div className="flex items-center justify-between py-3.5 border-b border-gray-50" onClick={() => { setPaymentMethod('wechat'); setShowPayment(false); }}>
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-[#07c160] rounded flex items-center justify-center text-white text-xs">微</div>
                        <span className="text-[15px]">微信支付</span>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${paymentMethod === 'wechat' ? 'border-[#fb7299] bg-white' : 'border-gray-300'}`}>
                        {paymentMethod === 'wechat' && <div className="w-3 h-3 bg-[#fb7299] rounded-full" />}
                    </div>
                </div>

                {/* Huabei Option */}
                <div className="flex items-center justify-between py-3.5" onClick={() => { setPaymentMethod('huabei'); setShowPayment(false); }}>
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-[#1677ff] rounded flex items-center justify-center text-white text-xs">花</div>
                        <span className="text-[15px]">花呗</span>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${paymentMethod === 'huabei' ? 'border-[#fb7299] bg-white' : 'border-gray-300'}`}>
                        {paymentMethod === 'huabei' && <div className="w-3 h-3 bg-[#fb7299] rounded-full" />}
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
