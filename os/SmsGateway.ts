import BroadcastBus from './BroadcastBus';
import { digits, nextStream } from './RandomService';

export interface SmsGatewayIncomingMessage {
  from: string;
  body: string;
}

export interface SmsGatewayVerificationOptions {
  from: string;
  codeLength?: number;
  template?: string;
}

function clampInt(n: unknown, fallback: number, min: number, max: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : fallback;
  return Math.max(min, Math.min(max, v));
}

function generateNumericCode(len: number): string {
  return digits(nextStream('os.smsCode'), clampInt(len, 6, 4, 10));
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{${key}}`, value);
  }
  return out;
}

export const SmsGateway = {
  /**
   * Simulate receiving an SMS verification code (returns the generated code).
   */
  sendVerificationCode(opts: SmsGatewayVerificationOptions): { code: string } {
    const from = String(opts?.from ?? '').trim();
    if (!from) throw new Error('[SmsGateway] "from" is required');

    const code = generateNumericCode(opts?.codeLength ?? 6);
    const tpl = typeof opts?.template === 'string' && opts.template.trim()
      ? opts.template
      : '【{app}】验证码：{code}，5分钟内有效';
    const body = renderTemplate(tpl, { app: from, code });

    SmsGateway.receiveMessage({ from, body });
    return { code };
  },

  /**
   * Deliver a generic SMS to the SMS app via BroadcastBus.
   *
   * The lightweight receiver bootstrap in `os/providers/SmsReceiverBootstrap.ts`
   * keeps SMS delivery available even when the SMS app UI has not been mounted yet.
   */
  receiveMessage(opts: SmsGatewayIncomingMessage): void {
    const from = String(opts?.from ?? '').trim();
    const body = String(opts?.body ?? '').trim();
    if (!from || !body) return;
    if (typeof window === 'undefined') return;

    BroadcastBus.sendBroadcast({
      action: 'android.provider.Telephony.SMS_RECEIVED',
      extras: { from, body },
    });
  },
};


export default SmsGateway;
