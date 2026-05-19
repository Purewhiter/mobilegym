# 短信网关（SmsGateway）与验证码服务使用说明

本项目在浏览器里模拟手机系统。各 App 之间不共享 React Context，因此短信的收发和验证码下发需要通过 **OS 层的短信网关** 来完成。

---

## 1. 你应该怎么写（App 开发者速查）

### 1.1 "获取验证码"按钮的标准写法

```tsx
import SmsGateway from '@/os/SmsGateway';
import { strings } from './res/strings';   // 验证码模板放在 res/strings.ts

const [pendingCode, setPendingCode] = useState<string | null>(null);

const handleSendCode = () => {
  const { code } = SmsGateway.sendVerificationCode({
    from: '支付宝',          // 短信发送方名称（将替换模板中的 {app}）
    codeLength: 6,           // 可选，默认 6，范围 4–10
    template: strings.sms_verif_template,  // 可选，不传则用系统默认模板
  });
  setPendingCode(code);     // 保存，用于后续校验用户输入
};

// 校验用户填入的验证码
const handleVerify = (input: string) => {
  return input === pendingCode;
};
```

### 1.2 在 `res/strings.ts` 里定义各 App 自己的模板

```ts
// apps/Alipay/res/strings.ts
export const strings = {
  sms_verif_template: '【支付宝】您的验证码是{code}，请在5分钟内完成验证，切勿告知他人。',
  // ...
};

// apps/Railway12306/res/strings.ts
export const strings = {
  sms_verif_template: '【铁路12306】验证码：{code}，您正在进行身份验证，10分钟内有效。',
  // ...
};
```

**模板变量**：`{app}` 替换为 `from` 字段，`{code}` 替换为生成的验证码。

### 1.3 只想注入一条普通短信（不走验证码模板）

```ts
import SmsGateway from '@/os/SmsGateway';

SmsGateway.receiveMessage({
  from: '建设银行',
  body: '您的账户于今日 14:32 发生一笔消费 ¥128.00，如非本人操作请联系客服。',
});
```

---

## 2. API 参考

### `SmsGateway.sendVerificationCode(opts)`

模拟系统向用户手机发送验证码短信，**返回生成的验证码字符串**（供 App 端校验用户输入）。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `opts.from` | `string` | ✅ | 短信发送方名称（会注入 `{app}` 占位符） |
| `opts.codeLength` | `number` | 可选 | 验证码位数，默认 `6`，范围 `[4, 10]` |
| `opts.template` | `string` | 可选 | 自定义短信模板，支持 `{app}` 和 `{code}` 占位符 |

**返回值**：`{ code: string }` — 生成的验证码（调用方负责保存，用于校验）

**默认模板**（不传 `template` 时使用）：
```
【{app}】验证码：{code}，5分钟内有效
```

### `SmsGateway.receiveMessage(opts)`

向短信 App 注入一条任意内容的普通短信。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `opts.from` | `string` | ✅ | 短信发送方（显示为会话名称） |
| `opts.body` | `string` | ✅ | 短信正文 |

---

## 3. 工作原理（架构说明）

```
App 侧（React）
    │  SmsGateway.sendVerificationCode({ from, codeLength, template })
    │
    ▼
os/SmsGateway.ts
  ① 生成随机验证码（优先 crypto.getRandomValues，降级 Math.random）
  ② 渲染模板（replaceAll {app} {code}）
  ③ 调用 receiveMessage({ from, body })
    │
    │  BroadcastBus.sendBroadcast({ action: 'SMS_RECEIVED', extras: { from, body } })
    ▼
apps/Sms/state.ts（模块加载时注册静态 BroadcastReceiver，不依赖 UI 挂载）
  → store.receiveMessage(from, body)
  → 创建/更新会话与消息，标记未读
  → NotificationService.push({ appId: 'sms', route: '/conversation/${id}', ... })   ← 触发 OS 通知栏与桌面角标
    ▼
短信 App UI（会话列表 / 会话详情）+ OS 通知栏 / 悬浮通知
```

**通知与角标联动（对齐 Android）：**

- 推送时可为通知指定 `route`，点击通知会打开对应会话。
- 通知默认 `autoCancel: true`：用户点击悬浮通知或通知中心条目时，该条通知会被**移除**（不再仅标记已读），桌面角标同步减少。
- 用户**直接打开短信 App 并进入某会话**时，`markConversationRead` 会调用 `NotificationService.dismissByRoute('sms', '/conversation/${id}')`，精确移除该会话对应的通知，角标与通知中心保持一致。
- 用户**全部标为已读**时，`markAllRead` 会调用 `NotificationService.clearForApp('sms')`，清除该 App 在通知中心的所有通知。

### 为什么是 OS 层而不是短信 App 内部？

验证码下发是"电话/系统服务"，不是"短信 App 的业务逻辑"。类比真实 Android：
- `TelephonyManager` 在系统层
- 短信 App（`com.android.mms`）只负责展示 UI

`SmsGateway` 扮演的正是 `TelephonyManager` 的角色，因此它放在 `os/` 而不是 `apps/Sms/`。

---

## 4. 全局入口（Benchmark / 外部 Agent）

`OSContext.tsx` 启动时会将 `SmsGateway` 挂载到 `window`：

```js
window.__SMS_GATEWAY__ = SmsGateway;
```

外部 Agent（Python / Playwright）可直接调用：

```python
# 触发验证码下发
page.evaluate("""
  window.__SMS_GATEWAY__.sendVerificationCode({
    from: '支付宝',
    codeLength: 6,
    template: '【支付宝】验证码{code}，5分钟内有效。'
  })
""")

# 验证：从 SMS App 状态中读取收到的短信
state = page.evaluate("__SIM__.getState().apps.sms")
messages = state["messagesByConversationId"].get("支付宝", [])
latest_body = messages[-1]["content"] if messages else None
```

---

## 5. 各 App 验证码接入状态

| App | 文件 | 状态 |
|-----|------|------|
| 支付宝 | — | 🔲 未接入（待实现） |
| 12306 | `pages/ChangePasswordPage.tsx` | 🔲 有 UI 但按钮无 `onClick` |
| 12306 | `pages/ChangePhonePage.tsx` | 🔲 有 UI 但无触发逻辑 |
| 腾讯会议 | `pages/AccountSecurityPage.tsx` | 🔲 待实现 |

> 接入方法：参见第 1 节。在对应页面引入 `SmsGateway`，给"获取验证码"按钮加 `onClick`，在 `res/strings.ts` 里添加模板字符串即可。

---

## 6. 给新 App 的最小规范

- 验证码模板字符串放在 `res/strings.ts`（中文）和 `res/strings.en.ts`（英文），不要硬编码在组件里
- `from` 字段使用 App 的品牌名（如 `'支付宝'`、`'铁路12306'`），与短信 App 里的会话名一致
- 调用 `sendVerificationCode` 返回的 `code` 要保存在本地 state，用于校验用户输入，不要再从 SMS App 状态里反读
- 验证码有效期提示（"5分钟内有效"）写在 **模板字符串**里，而不是写死在 UI 里

---

## 7. 常见问题

### 7.1 短信发出去了但 App 里看不到？

短信 App 的接收逻辑在 **state.ts 的静态 BroadcastReceiver** 中注册（模块加载即生效，由 `index.tsx` 的 eager 加载所有 `apps/*/state.ts` 保证），**不依赖用户是否打开过短信 App**。只要页面已加载，SmsGateway 发广播后短信会写入 store 并持久化；用户随时打开短信 App 都能看到。若仍看不到，请检查 SmsGateway 是否在页面加载之后调用、以及 BroadcastBus 是否正常派发。

### 7.2 验证码是真随机的吗？

优先使用 `crypto.getRandomValues`（密码学安全随机数），在不支持的环境里降级到 `Math.random`。`codeLength` 被强制限制在 `[4, 10]` 范围内。

### 7.3 可以自定义模板里除 `{app}` `{code}` 之外的变量吗？

目前 `renderTemplate` 只支持 `{app}` 和 `{code}` 两个占位符（见 [os/SmsGateway.ts:37](os/SmsGateway.ts#L37)）。如需扩展，在该函数中添加新的 `vars` 键即可。
