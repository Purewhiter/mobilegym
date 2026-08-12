# SMS Gateway

`os/SmsGateway.ts` simulates an external SMS provider — the thing that injects messages into the device from "outside". Apps subscribe to incoming SMS via the system content provider, not by talking to the gateway directly.

The two write entry points are:

```ts
SmsGateway.sendVerificationCode({
  from,                              // sender display name (e.g. '12306')
  codeLength?: number,               // default 6, clamped to [4, 10]
  template?: string,                 // default '【{app}】验证码：{code}，5分钟内有效'
}): { code: string };

SmsGateway.receiveMessage({
  from,                              // sender
  body,                              // raw message body
}): void;
```

`sendVerificationCode` generates a random numeric code (using `crypto.getRandomValues` when available, falling back to `Math.random`), renders the template, delivers the SMS, and **returns the code** so the calling app can store and verify it locally. The template interpolates only `{app}` (substituted with `from`) and `{code}`; any other `{...}` placeholder is left literal.

`receiveMessage` injects an arbitrary SMS body — no template, no verification semantics.

## Delivery path

Both entry points dispatch through the broadcast bus:

```
SmsGateway.{sendVerificationCode,receiveMessage}
  → BroadcastBus.sendBroadcast({
      action: 'android.provider.Telephony.SMS_RECEIVED',
      extras: { from, body },
    })
  → SmsReceiverBootstrap   (registered at boot from os/providers/bootstrap.ts)
      → SmsProvider.receiveIncomingSms({ from, body })
          → writes to provider store (conversations + messages)
          → NotificationService.push({
              appId: 'sms',
              route: `/conversation/<conversationId>`,
              … })
```

Two consequences:

- **The SMS app does not have to be mounted** for messages to arrive. `index.tsx` directly imports `os/providers/SmsReceiverBootstrap`, whose top-level `registerSmsReceiverBootstrap()` call subscribes to the broadcast at process start — independent of any app UI. (This is separate from `os/providers/bootstrap.ts`, which only handles the persistent provider stores for Contacts / Media / Sms.) The SMS app, when opened, queries the provider via `ContentResolver` and sees the accumulated history.
- **The broadcast action is the literal Android string `android.provider.Telephony.SMS_RECEIVED`** — keep this fixed; the receiver registration matches on it exactly.

### Contact reverse-match

When a message arrives, `SmsProvider` queries the contacts provider:

```ts
ContentResolver.query('content://contacts/contacts?phone=<from>')
```

If a contact matches, the conversation's `senderName` is set to the contact's `displayName`. Otherwise it stays as the raw `from` (e.g. `'12306'`).

## Reading SMS from an App

Apps must access SMS through `ContentResolver`, not by importing the provider store:

```ts
ContentResolver.query('content://sms/conversations');
ContentResolver.query(`content://sms/messages?conversationId=${id}`);
ContentResolver.registerContentObserver('content://sms/conversations', notify);
```

Direct `import` of `os/providers/SmsProvider` from an app is forbidden — same rule as Contacts and Media providers. The provider's persistent store is implementation detail; the URI surface is the public API.

## Notifications and badges

`SmsProvider` pushes notifications with `route: '/conversation/<id>'`, so taps deep-link into the right conversation. The system SMS app keeps the badge / notification center in sync by calling:

| When | Call |
|---|---|
| User opens a conversation (any read trigger) | `NotificationService.dismissByRoute('sms', '/conversation/<id>')` |
| User taps "mark all read" | `NotificationService.clearForApp('sms')` |

There is no global `autoCancel` default in the push call — the SMS app does the cleanup explicitly through these two paths.

## Outgoing SMS (App → "gateway")

When an app's own UI sends a message (e.g. the SMS app's compose screen, or a Railway12306 register-verify page that pretends to talk to the SMS network), the convention is to dispatch a window event:

```ts
window.dispatchEvent(new CustomEvent('sms-outgoing', {
  detail: { to, content },
}));
```

Listeners — typically test harnesses or other apps simulating the upstream SMS network — pick this up and may respond by calling `SmsGateway.receiveMessage(...)` to inject a reply. This is how Railway12306's auto-reply verification flow works without coupling the two apps directly.

`SmsGateway` itself does not auto-listen to `sms-outgoing`; that's an app-level convention.

## External / bench entry points

Bench harnesses and external orchestrators call:

```ts
window.__OS__.sms.sendVerificationCode({ from: '12306', … });
window.__OS__.sms.receiveMessage({ from: 'Mom', body: 'on my way' });
```

(The older `window.__SMS_GATEWAY__` global has been removed — use `__OS__.sms` instead.)

## Verification code template storage

The default template lives inside `SmsGateway`. Apps that customize the message (e.g. their own brand wrapper) should keep the literal in `res/strings.ts` + `res/strings.en.ts`, not hardcoded in `state.ts` / page components. (Older apps such as Wechat / Railway12306 still hardcode templates — a known legacy inconsistency, not a pattern to copy.)

## Related Docs

- Service index → [README.md](README.md)
- Broadcast bus and intent system → [`../intent-system.md`](../intent-system.md)
- ContentResolver semantics → [`../../state/os-state.md`](../../state/os-state.md)
