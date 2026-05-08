import React, { useState, useCallback } from 'react';
import { useRailwayGestures } from '../../hooks/useRailwayGestures';
import { IcNavBack, IcScan } from '../../res/icons';

// ── Validation helpers ──────────────────────────────────────────────

const RE_USERNAME = /^[a-zA-Z][a-zA-Z0-9_]{5,29}$/;

function validateUsername(v: string): string | null {
  if (!v.trim()) return '请输入用户名!';
  if (!RE_USERNAME.test(v))
    return '用户名只能填写字母数字下划线,开头必须为字母,且长度必须在6-30位内!';
  return null;
}

function validatePassword(v: string): string | null {
  if (!v) return '请输入密码!';
  if (v.length < 6 || v.length > 30) return '密码格式错误，必须且只能包含字母,数字,下划线中的两种或两种以上!';
  if (!/^[a-zA-Z0-9_]+$/.test(v)) return '密码格式错误，必须且只能包含字母,数字,下划线中的两种或两种以上!';
  let kinds = 0;
  if (/[a-zA-Z]/.test(v)) kinds++;
  if (/[0-9]/.test(v)) kinds++;
  if (/_/.test(v)) kinds++;
  if (kinds < 2) return '密码格式错误，必须且只能包含字母,数字,下划线中的两种或两种以上!';
  return null;
}

function validateConfirmPassword(pwd: string, confirm: string): string | null {
  if (!confirm) return '请再次输入密码!';
  if (pwd !== confirm) return '两次密码输入不一致!';
  return null;
}

function validateName(v: string): string | null {
  if (!v.trim()) return '请输入姓名!';
  return null;
}

function validateIdNo(v: string): string | null {
  if (!v.trim()) return '请输入证件号码!';
  if (!/^\d{17}[\dXx]$/.test(v)) return '请正确输入18位的身份证号!';
  return null;
}

function validatePhone(v: string): string | null {
  if (!v.trim()) return '请输入手机号码!';
  if (!/^1\d{10}$/.test(v)) return '请输入正确的手机号码!';
  return null;
}

function validateEmail(v: string): string | null {
  if (!v.trim()) return null; // optional
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return '请输入正确的邮箱地址!';
  return null;
}

type FieldKey = 'username' | 'password' | 'confirmPassword' | 'name' | 'idNo' | 'phone' | 'email';

interface ValidationError { field: FieldKey; message: string }

function validateAll(form: Record<FieldKey, string>): ValidationError[] {
  const checks: [FieldKey, string | null][] = [
    ['username', validateUsername(form.username)],
    ['password', validatePassword(form.password)],
    ['confirmPassword', validateConfirmPassword(form.password, form.confirmPassword)],
    ['name', validateName(form.name)],
    ['idNo', validateIdNo(form.idNo)],
    ['phone', validatePhone(form.phone)],
    ['email', validateEmail(form.email)],
  ];
  return checks
    .filter((c): c is [FieldKey, string] => c[1] !== null)
    .map(([field, message]) => ({ field, message }));
}

const PASSENGER_TYPES = ['成人', '儿童', '学生', '残疾军人'] as const;

// ── Component ───────────────────────────────────────────────────────

export const RailwayRegisterPage: React.FC = () => {
  const { go, bindBack } = useRailwayGestures();

  const [formData, setFormData] = useState<Record<FieldKey, string>>({
    username: '',
    password: '',
    confirmPassword: '',
    name: '',
    idNo: '',
    phone: '',
    email: '',
  });
  const [agreed, setAgreed] = useState(true);
  const [passengerType, setPassengerType] = useState('成人');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [errorFields, setErrorFields] = useState<Set<FieldKey>>(new Set());
  const [dialogMsg, setDialogMsg] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = useCallback((key: FieldKey, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setErrorFields(prev => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    const errors = validateAll(formData);
    if (errors.length > 0) {
      setErrorFields(new Set(errors.map(e => e.field)));
      setDialogMsg(errors[0].message);
      return;
    }
    setErrorFields(new Set());
    setShowConfirm(true);
  }, [formData]);

  const handleConfirmRegister = useCallback(() => {
    setShowConfirm(false);
    go('auth.register.verify', {}, {
      state: {
        username: formData.username,
        password: formData.password,
        name: formData.name,
        idNo: formData.idNo,
        phone: formData.phone,
        email: formData.email,
      },
    });
  }, [formData, go]);

  const labelCls = (field: FieldKey) =>
    `w-24 text-[14px] ${errorFields.has(field) ? 'text-red-500 font-medium' : 'text-gray-800'}`;

  return (
    <div className="h-full bg-[#f2f2f2] flex flex-col">
      {/* Header */}
      <div className="bg-app-primary pt-10 pb-3 min-h-[48px] flex items-center px-4 text-white">
        <button {...bindBack()} className="p-2 -ml-2">
          <IcNavBack size={24} className="text-white" />
        </button>
        <div className="flex-1 text-center text-[18px] font-medium pr-8">注册</div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Scan tip */}
        <div className="bg-white px-4 py-3">
          <div className="border border-app-primary/30 bg-app-primary/5 rounded-md px-4 py-3 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 text-app-primary">
                <IcScan size={20} />
              </div>
              <div>
                <div className="text-app-primary font-medium text-[15px]">扫描/上传证件快速填写</div>
                <div className="text-[12px] text-gray-500 mt-1">
                  您可以通过扫描证件或上传证件照片快速填写信息，建议您使用此方式自动填写。 <span className="text-app-primary">查看示例</span>
                </div>
              </div>
            </div>
            <div className="shrink-0 bg-[#ff7a1a] text-white text-[10px] px-1.5 py-0.5 rounded-sm">推荐</div>
          </div>
        </div>

        {/* Basic info */}
        <div className="bg-white mb-3">
          <div className="px-4 py-2 text-[12px] text-gray-500 bg-[#f2f2f2]">基本信息</div>
          <div className="px-4 border-b border-gray-200 py-3 flex items-center">
            <label className={labelCls('username')}>用 户 名：</label>
            <input
              className="flex-1 outline-none text-right text-[14px] text-gray-800 placeholder-gray-400"
              placeholder='字母、数字或"_"，6-30位'
              value={formData.username}
              onChange={e => handleChange('username', e.target.value)}
            />
          </div>
          <div className="px-4 border-b border-gray-200 py-3 flex items-center">
            <label className={labelCls('password')}>密　　码：</label>
            <input
              className="flex-1 outline-none text-right text-[14px] text-gray-800 placeholder-gray-400"
              placeholder='字母、数字或"_"组合，6-30位'
              type="password"
              value={formData.password}
              onChange={e => handleChange('password', e.target.value)}
            />
          </div>
          <div className="px-4 py-3 flex items-center">
            <label className={labelCls('confirmPassword')}>确认密码：</label>
            <input
              className="flex-1 outline-none text-right text-[14px] text-gray-800 placeholder-gray-400"
              placeholder="请再次输入密码"
              type="password"
              value={formData.confirmPassword}
              onChange={e => handleChange('confirmPassword', e.target.value)}
            />
          </div>
        </div>

        {/* Detail info */}
        <div className="bg-white mb-3">
          <div className="px-4 py-2 text-[12px] text-gray-500 bg-[#f2f2f2]">详细信息（用于身份核验，请务必正确填写）</div>
          <div className="px-4 border-b border-gray-200 py-3 flex items-center justify-between">
            <label className="text-[14px] text-gray-800">证件类型：</label>
            <div className="text-[14px] text-gray-500 flex items-center gap-1">
              中国居民身份证
              <IcNavBack size={16} className="rotate-180 text-gray-300" />
            </div>
          </div>
          <div className="px-4 border-b border-gray-200 py-3 flex items-center">
            <label className={labelCls('name')}>姓　　名：</label>
            <input
              className="flex-1 outline-none text-right text-[14px] text-gray-800 placeholder-gray-400"
              placeholder="请输入真实姓名，以便购票"
              value={formData.name}
              onChange={e => handleChange('name', e.target.value)}
            />
          </div>
          <div className="px-4 py-3 flex items-center">
            <label className={labelCls('idNo')}>证件号码：</label>
            <input
              className="flex-1 outline-none text-right text-[14px] text-gray-800 placeholder-gray-400"
              placeholder="请输入证件号码"
              value={formData.idNo}
              onChange={e => handleChange('idNo', e.target.value)}
            />
          </div>
        </div>

        {/* Contact info */}
        <div className="bg-white mb-3">
          <div className="px-4 py-2 text-[12px] text-gray-500 bg-[#f2f2f2]">联系方式</div>
          <div className="px-4 border-b border-gray-200 py-3 flex items-center">
            <label className={labelCls('phone')}>手机号码：</label>
            <div className="mr-2 text-[14px] text-gray-800">+86</div>
            <div className="mr-2 text-gray-300">|</div>
            <input
              className="flex-1 outline-none text-[14px] text-gray-800 placeholder-gray-400"
              placeholder="请输入手机号码"
              value={formData.phone}
              onChange={e => handleChange('phone', e.target.value)}
            />
          </div>
          <div className="px-4 py-3 flex items-center">
            <label className={labelCls('email')}>电子邮箱：</label>
            <input
              className="flex-1 outline-none text-right text-[14px] text-gray-800 placeholder-gray-400"
              placeholder="请输入邮箱地址 (选填)"
              value={formData.email}
              onChange={e => handleChange('email', e.target.value)}
            />
          </div>
        </div>

        {/* Extra info */}
        <div className="bg-white mb-6">
          <div className="px-4 py-2 text-[12px] text-gray-500 bg-[#f2f2f2]">附加信息</div>
          <button
            className="w-full px-4 py-3 flex items-center justify-between"
            onClick={() => setShowTypePicker(true)}
          >
            <label className="text-[14px] text-gray-800">旅客类型：</label>
            <div className="text-[14px] text-gray-800">{passengerType}</div>
          </button>
        </div>

        {/* Agreement */}
        <div className="px-4 py-3 flex items-center gap-2">
          <button
            className={`w-5 h-5 border rounded-sm flex items-center justify-center ${agreed ? 'bg-app-primary border-app-primary' : 'bg-white border-gray-400'}`}
            onClick={() => setAgreed(!agreed)}
          >
            {agreed ? <span className="text-white text-[12px] leading-none">✓</span> : null}
          </button>
          <div className="text-[13px] text-gray-600">
            同意 <span className="text-app-primary">服务条款</span>、<span className="text-app-primary">隐私权政策</span>
          </div>
        </div>

        {/* Submit */}
        <div className="px-4 pb-4">
          <button
            className="w-full h-11 rounded text-white font-medium bg-app-primary active:opacity-90"
            onClick={handleSubmit}
          >
            下一步
          </button>
        </div>
      </div>

      {/* Error dialog */}
      {dialogMsg && (
        <div className="fixed inset-0 z-[120] bg-black/45 flex items-center justify-center px-10">
          <div className="bg-white rounded-xl w-full max-w-[280px] overflow-hidden">
            <div className="px-5 pt-5 pb-4 text-center">
              <p className="text-[16px] font-bold text-[#2B3038]">温馨提示</p>
              <p className="mt-3 text-[14px] text-[#333] leading-relaxed">{dialogMsg}</p>
            </div>
            <button
              className="w-full py-3 text-[16px] text-white font-medium bg-[#4B9AFF] rounded-b-xl"
              onClick={() => setDialogMsg(null)}
            >
              确定
            </button>
          </div>
        </div>
      )}

      {/* Passenger type picker */}
      {showTypePicker && (
        <div className="fixed inset-0 z-[110] bg-black/45 flex items-center justify-center px-10" onClick={() => setShowTypePicker(false)}>
          <div className="bg-white rounded-xl w-full max-w-[280px] overflow-hidden" onClick={e => e.stopPropagation()}>
            {PASSENGER_TYPES.map(t => (
              <button
                key={t}
                className="w-full px-6 py-4 flex items-center justify-between border-b border-gray-100 last:border-b-0"
                onClick={() => { setPassengerType(t); setShowTypePicker(false); }}
              >
                <span className="text-[16px] text-[#333]">{t}</span>
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${passengerType === t ? 'border-[#4CD964]' : 'border-gray-300'}`}>
                  {passengerType === t && <span className="w-2.5 h-2.5 rounded-full bg-[#4CD964]" />}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-[120] bg-black/45 flex items-center justify-center px-8">
          <div className="bg-white rounded-xl w-full max-w-[300px] overflow-hidden">
            <div className="px-5 pt-5 pb-4">
              <p className="text-[16px] font-bold text-[#2B3038] text-center mb-4">请仔细核对个人信息</p>

              <div className="text-[13px] text-gray-500 font-medium mb-1">基本信息</div>
              <div className="flex mb-1.5 text-[14px]">
                <span className="text-gray-500 w-[72px] shrink-0">用 户 名：</span>
                <span className="text-[#333]">{formData.username}</span>
              </div>

              <div className="text-[13px] text-gray-500 font-medium mt-3 mb-1">详细信息</div>
              <div className="flex mb-1.5 text-[14px]">
                <span className="text-gray-500 w-[72px] shrink-0">证件类型：</span>
                <span className="text-[#333]">中国居民身份证</span>
              </div>
              <div className="flex mb-1.5 text-[14px]">
                <span className="text-gray-500 w-[72px] shrink-0">姓　　名：</span>
                <span className="text-[#333]">{formData.name}</span>
              </div>
              <div className="flex mb-1.5 text-[14px]">
                <span className="text-gray-500 w-[72px] shrink-0">证件号码：</span>
                <span className="text-[#333]">{formData.idNo}</span>
              </div>

              <div className="text-[13px] text-gray-500 font-medium mt-3 mb-1">联系信息</div>
              <div className="flex mb-1.5 text-[14px]">
                <span className="text-gray-500 w-[72px] shrink-0">手机号码：</span>
                <span className="text-[#333]">(+86) {formData.phone}</span>
              </div>

              <div className="text-[13px] text-gray-500 font-medium mt-3 mb-1">附加信息</div>
              <div className="flex mb-1.5 text-[14px]">
                <span className="text-gray-500 w-[72px] shrink-0">旅客类型：</span>
                <span className="text-[#333]">{passengerType}</span>
              </div>
            </div>

            <div className="flex border-t border-[#F0F2F5]">
              <button
                className="flex-1 py-3 text-[16px] text-[#8C95A3] border-r border-[#F0F2F5]"
                onClick={() => setShowConfirm(false)}
              >
                取消
              </button>
              <button
                className="flex-1 py-3 text-[16px] text-white font-medium bg-[#4B9AFF] rounded-br-xl"
                onClick={handleConfirmRegister}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RailwayRegisterPage;
