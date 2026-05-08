import BroadcastBus from '../BroadcastBus';

let unregisterSmsReceiver: (() => void) | null = null;

function registerSmsReceiverBootstrap(): void {
  unregisterSmsReceiver?.();
  unregisterSmsReceiver = BroadcastBus.registerReceiver('android.provider.Telephony.SMS_RECEIVED', (intent) => {
    const from = String(intent?.extras?.from ?? '').trim();
    const body = String(intent?.extras?.body ?? '').trim();
    if (!from || !body) return;
    void import('./SmsProvider')
      .then(({ receiveIncomingSms }) => {
        receiveIncomingSms(from, body);
      })
      .catch((error) => {
        console.error('[SmsReceiverBootstrap] failed to handle incoming sms', error);
      });
  });
}

registerSmsReceiverBootstrap();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unregisterSmsReceiver?.();
    unregisterSmsReceiver = null;
  });
}
