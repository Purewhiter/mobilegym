下面给你一套**从零可落地**的 OS 层方案。核心目标是：

1. **只有一份规范化的可序列化状态** ，React UI、App、`window.__SIM__`、持久化都围绕它工作。
2. **系统能力按服务切分，UI 不拥有业务数据** 。
3. **`reset()` 恢复“当前评测 episode 的初始快照”** ，不是仅恢复出厂默认。
4. **App 自动发现、自动注册、独立持久化，但共享的系统数据必须由 OS 服务持有** 。

---

# 1. 总体架构

<pre class="overflow-visible! px-0!" data-start="248" data-end="2083"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>┌─────────────────────────────────────────────────────────────┐</span><br/><span>│                    Python + Playwright                     │</span><br/><span>│      page.evaluate(() => window.__SIM__.setState(...))    │</span><br/><span>└──────────────────────────────┬──────────────────────────────┘</span><br/><span>                               │</span><br/><span>                               ▼</span><br/><span>┌─────────────────────────────────────────────────────────────┐</span><br/><span>│                       window.__SIM__                        │</span><br/><span>│   getState / setState / reset / loadTask / whenReady       │</span><br/><span>└──────────────────────────────┬──────────────────────────────┘</span><br/><span>                               │</span><br/><span>                               ▼</span><br/><span>┌─────────────────────────────────────────────────────────────┐</span><br/><span>│                         SimKernel                           │</span><br/><span>│  - Store（唯一真相）                                         │</span><br/><span>│  - ScenarioController（baseline/reset）                    │</span><br/><span>│  - PersistenceEngine（localStorage）                       │</span><br/><span>│  - AppRegistry / PackageManager                            │</span><br/><span>│  - Domain Services                                         │</span><br/><span>└───────────────┬───────────────────────────────┬─────────────┘</span><br/><span>                │                               │</span><br/><span>                ▼                               ▼</span><br/><span>┌──────────────────────────┐      ┌──────────────────────────┐</span><br/><span>│     React System UI      │      │        App Runtime       │</span><br/><span>│  状态栏/QS/通知栏/导航栏    │      │  Settings/Phone/WeChat… │</span><br/><span>│  只读 selector + command   │      │  通过 AppContext 调 OS   │</span><br/><span>└──────────────┬───────────┘      └──────────────┬───────────┘</span><br/><span>               │                                  │</span><br/><span>               └──────────────┬───────────────────┘</span><br/><span>                              ▼</span><br/><span>                     Canonical SimSnapshot</span><br/><span>                              │</span><br/><span>                              ▼</span><br/><span>                        localStorage</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

# 2. 最重要的设计原则

## 2.1 单一真相：只有一个 Canonical Snapshot

所有可被评测、可被恢复、可被持久化的数据，都必须落在一个纯 JSON 的状态树里：

* 不放函数
* 不放 class 实例
* 不放 `Date`，统一用时间戳/ISO 字符串
* 不放 DOM 引用
* 不放不可重建的临时缓存

这能保证：

* `getState()` 直接可序列化
* `setState()` 可完整注入
* `reset()` 可无损恢复
* 页面刷新后可恢复

---

## 2.2 “系统设置”不是一个单独的大对象服务

不要做一个超级 `SettingsService` 去拥有所有设置。

正确做法是： **谁的能力，谁拥有数据** 。

例如：

* WiFi / 蓝牙 / 飞行模式 → `ConnectivityService`
* 亮度 / 字体大小 / 显示缩放 / 护眼模式 / 主题壁纸 → `DisplayService`
* 音量 / 振动 / 静音 → `AudioService`
* 电量 / 充电 → `PowerService`
* 权限 → `PermissionService`
* 定位 → `LocationService`

 **Settings App 只是这些服务的 UI 壳** ，不拥有底层数据。

这点非常关键，不然后面系统 UI、第三方 App、评测框架都会和 Settings App 产生耦合。

---

## 2.3 区分四层：定义、基线、运行态、易失态

### A. 定义层（代码内，不持久化）

不可变、版本化、由源码提供：

* 设备 Profile
* App Manifest
* 权限声明
* 默认值工厂
* schema / migration

### B. 基线层 baseline（持久化）

表示“本次 episode 的初始状态”。

`reset()` 恢复到它。

### C. 运行态 live state（持久化）

当前手机真实状态。

Agent 操作修改的是它。

### D. 易失态 ephemeral session（不持久化）

只存在内存里，页面刷新可以丢失：

* 手势进行中
* 动画中间帧
* 定时器句柄
* 未提交的网络请求 promise
* devtools 面板开关

---

# 3. 数据模型设计

我建议把顶层状态组织成下面这样。

<pre class="overflow-visible! px-0!" data-start="3140" data-end="4488"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">export</span><span></span><span class="ͼg">interface</span><span></span><span class="ͼm">SimSnapshot</span><span> {</span><br/><span>  schemaVersion: </span><span class="ͼm">number</span><span>;</span><br/><span>  buildVersion: </span><span class="ͼm">string</span><span>;</span><br/><br/><span>  scenario: {</span><br/><span>    id: </span><span class="ͼm">string</span><span>;              </span><span class="ͼe">// 当前 episode / task id</span><br/><span>    seed?: </span><span class="ͼm">string</span><span>;</span><br/><span>    startedAt?: </span><span class="ͼm">number</span><span>;</span><br/><span>  };</span><br/><br/><span>  device: {</span><br/><span>    profileId: </span><span class="ͼm">string</span><span>;</span><br/><span>    info: </span><span class="ͼm">DeviceInfoState</span><span>;   </span><span class="ͼe">// 型号、Android 版本、IMEI、存储等</span><br/><span>  };</span><br/><br/><span>  system: {</span><br/><span>    connectivity: </span><span class="ͼm">ConnectivityState</span><span>; </span><span class="ͼe">// wifi/bluetooth/cellular/airplane/proxy</span><br/><span>    display: </span><span class="ͼm">DisplayState</span><span>;           </span><span class="ͼe">// brightness/fontScale/displayScale/theme/wallpaper/eyeComfort</span><br/><span>    audio: </span><span class="ͼm">AudioState</span><span>;               </span><span class="ͼe">// media/ring/alarm volumes, vibrate, silent</span><br/><span>    power: </span><span class="ͼm">PowerState</span><span>;               </span><span class="ͼe">// battery/charging/battery saver</span><br/><span>    telephony: </span><span class="ͼm">TelephonyState</span><span>;       </span><span class="ͼe">// sim cards, carrier, signal, phone number, call state</span><br/><span>    location: </span><span class="ͼm">LocationState</span><span>;         </span><span class="ͼe">// enabled/currentPosition/mock mode</span><br/><span>    notifications: </span><span class="ͼm">NotificationState</span><span>;</span><br/><span>    clipboard: </span><span class="ͼm">ClipboardState</span><span>;</span><br/><span>    inputMethod: </span><span class="ͼm">InputMethodState</span><span>;</span><br/><span>    permissions: </span><span class="ͼm">PermissionState</span><span>;</span><br/><span>    shell: </span><span class="ͼm">ShellState</span><span>;               </span><span class="ͼe">// 前台 app、任务栈、launcher、recents、QS/通知栏展开状态</span><br/><span>    clock: </span><span class="ͼm">ClockState</span><span>;               </span><span class="ͼe">// 时间/时区/是否自动时间</span><br/><span>  };</span><br/><br/><span>  providers: {</span><br/><span>    contacts: </span><span class="ͼm">ContactsProviderState</span><span>; </span><span class="ͼe">// 共享数据，不属于某个 app</span><br/><span>    sms: </span><span class="ͼm">SmsProviderState</span><span>;           </span><span class="ͼe">// 共享数据</span><br/><span>    calls: </span><span class="ͼm">CallLogProviderState</span><span>;     </span><span class="ͼe">// 共享数据</span><br/><span>    media: </span><span class="ͼm">MediaLibraryState</span><span>;        </span><span class="ͼe">// 如相册/文件</span><br/><span>  };</span><br/><br/><span>  apps: </span><span class="ͼm">Record</span><span><</span><span class="ͼm">string</span><span>, </span><span class="ͼm">AppPersistedState</span><span>>;</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## 3.1 为什么要单独放 `providers`

很多数据看起来像 “某个 App 的数据”，其实不是。

例如：

* 联系人：不该属于 Contacts App，而应属于 `contacts provider`
* 短信线程：不该属于 SMS App，而应属于 `sms provider`
* 通话记录：不该属于 Phone App，而应属于 `call log provider`

因为：

1. 它们是**系统级共享数据**
2. 多个 App 会读它们
3. 评测时常常需要直接注入
4. reset / migration / 权限管理会更清晰

所以：

* **共享内容** → `providers/*`
* **App 私有内容** → `apps[appId]`

---

## 3.2 `shell` 里只放“真正的系统 UI 状态”

例如：

<pre class="overflow-visible! px-0!" data-start="4891" data-end="5318"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">export</span><span></span><span class="ͼg">interface</span><span></span><span class="ͼm">ShellState</span><span> {</span><br/><span>  foregroundAppId: </span><span class="ͼm">string</span><span>;</span><br/><span>  appStack: </span><span class="ͼm">AppStackEntry</span><span>[];</span><br/><span>  recents: </span><span class="ͼm">RecentTaskEntry</span><span>[];</span><br/><br/><span>  launcher: {</span><br/><span>    currentPage: </span><span class="ͼm">number</span><span>;</span><br/><span>    icons: </span><span class="ͼm">LauncherIconEntry</span><span>[];</span><br/><span>  };</span><br/><br/><span>  panels: {</span><br/><span>    notificationShadeExpanded: </span><span class="ͼm">boolean</span><span>;</span><br/><span>    quickSettingsExpanded: </span><span class="ͼm">boolean</span><span>;</span><br/><span>    quickSettingsPage: </span><span class="ͼm">number</span><span>;</span><br/><span>  };</span><br/><br/><span>  navigation: {</span><br/><span>    mode: </span><span class="ͼk">'gesture'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'3button'</span><span>;</span><br/><span>  };</span><br/><br/><span>  lockscreen: {</span><br/><span>    locked: </span><span class="ͼm">boolean</span><span>;</span><br/><span>  };</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

但 **状态栏图标不要在 state 里存一份** 。

状态栏应是 **派生视图模型** ：

* 电池图标来自 `system.power`
* WiFi 图标来自 `system.connectivity`
* 蜂窝图标来自 `system.telephony`
* 时钟来自 `system.clock`
* 通知点来自 `system.notifications`

也就是说：

* `shell` 只存“展开/折叠/前后台/导航模式”之类的 UI 自身状态
* 图标内容通过 selector 派生，不冗余存储

---

# 4. 默认值与配置管理

默认值不要写成一堆分散的 JSON。

建议做成 **工厂函数 + profile 覆盖** 。

<pre class="overflow-visible! px-0!" data-start="5650" data-end="5903"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">export</span><span></span><span class="ͼg">interface</span><span></span><span class="ͼm">DeviceProfile</span><span> {</span><br/><span>  id: </span><span class="ͼm">string</span><span>;</span><br/><span>  name: </span><span class="ͼm">string</span><span>;</span><br/><span>  viewport: { width: </span><span class="ͼm">number</span><span>; height: </span><span class="ͼm">number</span><span>; dpr: </span><span class="ͼm">number</span><span> };</span><br/><span>  deviceInfoDefaults: </span><span class="ͼm">Partial</span><span><</span><span class="ͼm">DeviceInfoState</span><span>>;</span><br/><span>  systemDefaults?: </span><span class="ͼm">Partial</span><span><</span><span class="ͼm">SystemDefaults</span><span>>;</span><br/><span>  installedApps: </span><span class="ͼm">string</span><span>[];</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

<pre class="overflow-visible! px-0!" data-start="5905" data-end="7228"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">export</span><span></span><span class="ͼg">function</span><span></span><span class="ͼm">createFactorySnapshot</span><span>(</span><span class="ͼm">profile</span><span>: </span><span class="ͼm">DeviceProfile</span><span>): </span><span class="ͼm">SimSnapshot</span><span> {</span><br/><span></span><span class="ͼg">return</span><span> {</span><br/><span>    schemaVersion: </span><span class="ͼj">1</span><span>,</span><br/><span>    buildVersion: </span><span class="ͼm">__APP_VERSION__</span><span>,</span><br/><span>    scenario: { id: </span><span class="ͼk">'factory-default'</span><span> },</span><br/><br/><span>    device: {</span><br/><span>      profileId: </span><span class="ͼm">profile</span><span class="ͼg">.</span><span>id,</span><br/><span>      info: {</span><br/><span>        model: </span><span class="ͼk">'Pixel 7'</span><span>,</span><br/><span>        androidVersion: </span><span class="ͼk">'14'</span><span>,</span><br/><span>        imei: </span><span class="ͼk">'860000000000001'</span><span>,</span><br/><span>        totalStorageMb: </span><span class="ͼj">128000</span><span>,</span><br/><span>        usedStorageMb: </span><span class="ͼj">42000</span><span>,</span><br/><span>        ...</span><span class="ͼm">profile</span><span class="ͼg">.</span><span>deviceInfoDefaults,</span><br/><span>      },</span><br/><span>    },</span><br/><br/><span>    system: {</span><br/><span>      connectivity: </span><span class="ͼm">createDefaultConnectivityState</span><span>(),</span><br/><span>      display: </span><span class="ͼm">createDefaultDisplayState</span><span>(),</span><br/><span>      audio: </span><span class="ͼm">createDefaultAudioState</span><span>(),</span><br/><span>      power: </span><span class="ͼm">createDefaultPowerState</span><span>(),</span><br/><span>      telephony: </span><span class="ͼm">createDefaultTelephonyState</span><span>(),</span><br/><span>      location: </span><span class="ͼm">createDefaultLocationState</span><span>(),</span><br/><span>      notifications: </span><span class="ͼm">createDefaultNotificationState</span><span>(),</span><br/><span>      clipboard: </span><span class="ͼm">createDefaultClipboardState</span><span>(),</span><br/><span>      inputMethod: </span><span class="ͼm">createDefaultInputMethodState</span><span>(),</span><br/><span>      permissions: </span><span class="ͼm">createDefaultPermissionState</span><span>(</span><span class="ͼm">profile</span><span class="ͼg">.</span><span>installedApps),</span><br/><span>      shell: </span><span class="ͼm">createDefaultShellState</span><span>(</span><span class="ͼm">profile</span><span class="ͼg">.</span><span>installedApps),</span><br/><span>      clock: </span><span class="ͼm">createDefaultClockState</span><span>(),</span><br/><span>    },</span><br/><br/><span>    providers: {</span><br/><span>      contacts: </span><span class="ͼm">createDefaultContactsProviderState</span><span>(),</span><br/><span>      sms: </span><span class="ͼm">createDefaultSmsProviderState</span><span>(),</span><br/><span>      calls: </span><span class="ͼm">createDefaultCallLogProviderState</span><span>(),</span><br/><span>      media: </span><span class="ͼm">createDefaultMediaLibraryState</span><span>(),</span><br/><span>    },</span><br/><br/><span>    apps: {},</span><br/><span>  };</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

然后把 App 的默认值合并进去：

<pre class="overflow-visible! px-0!" data-start="7249" data-end="7821"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">export</span><span></span><span class="ͼg">function</span><span></span><span class="ͼm">withAppDefaults</span><span>(</span><br/><span></span><span class="ͼm">base</span><span>: </span><span class="ͼm">SimSnapshot</span><span>,</span><br/><span></span><span class="ͼm">manifests</span><span>: </span><span class="ͼm">AppManifest</span><span>[],</span><br/><span>): </span><span class="ͼm">SimSnapshot</span><span> {</span><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">apps</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">Object</span><span class="ͼg">.</span><span>fromEntries(</span><br/><span></span><span class="ͼm">manifests</span><span class="ͼg">.</span><span>map((</span><span class="ͼm">m</span><span>) => [</span><span class="ͼm">m</span><span class="ͼg">.</span><span>id, </span><span class="ͼm">m</span><span class="ͼg">.</span><span>createDefaultState()])</span><br/><span>  );</span><br/><br/><span></span><span class="ͼg">return</span><span> {</span><br/><span>    ...</span><span class="ͼm">base</span><span>,</span><br/><span>    apps,</span><br/><span>    system: {</span><br/><span>      ...</span><span class="ͼm">base</span><span class="ͼg">.</span><span>system,</span><br/><span>      shell: {</span><br/><span>        ...</span><span class="ͼm">base</span><span class="ͼg">.</span><span>system</span><span class="ͼg">.</span><span>shell,</span><br/><span>        launcher: {</span><br/><span>          ...</span><span class="ͼm">base</span><span class="ͼg">.</span><span>system</span><span class="ͼg">.</span><span>shell</span><span class="ͼg">.</span><span>launcher,</span><br/><span>          icons: </span><span class="ͼm">manifests</span><span class="ͼg">.</span><span>map((</span><span class="ͼm">m</span><span>) => ({</span><br/><span>            appId: </span><span class="ͼm">m</span><span class="ͼg">.</span><span>id,</span><br/><span>            label: </span><span class="ͼm">m</span><span class="ͼg">.</span><span>displayName,</span><br/><span>            system: </span><span class="ͼm">m</span><span class="ͼg">.</span><span>kind </span><span class="ͼg">===</span><span></span><span class="ͼk">'system'</span><span>,</span><br/><span>          })),</span><br/><span>        },</span><br/><span>      },</span><br/><span>    },</span><br/><span>  };</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

# 5. localStorage 持久化架构

我建议用  **5 类 key** ，不是一个大 key，也不是每个小字段一个 key。

## 5.1 key 设计

<pre class="overflow-visible! px-0!" data-start="7912" data-end="7998"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>sim:v1:meta</span><br/><span>sim:v1:baseline</span><br/><span>sim:v1:os</span><br/><span>sim:v1:providers</span><br/><span>sim:v1:apps:<appId></span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

可选调试：

<pre class="overflow-visible! px-0!" data-start="8007" data-end="8039"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>sim:v1:debug:journal</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## 5.2 各 key 存什么

### `sim:v1:meta`

很小，负责描述整个存储集：

<pre class="overflow-visible! px-0!" data-start="8097" data-end="8242"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">type</span><span></span><span class="ͼm">PersistMeta</span><span></span><span class="ͼg">=</span><span> {</span><br/><span>  schemaVersion: </span><span class="ͼm">number</span><span>;</span><br/><span>  revision: </span><span class="ͼm">number</span><span>;</span><br/><span>  profileId: </span><span class="ͼm">string</span><span>;</span><br/><span>  installedApps: </span><span class="ͼm">string</span><span>[];</span><br/><span>  savedAt: </span><span class="ͼm">number</span><span>;</span><br/><span>};</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

用途：

* schema migration 入口
* revision 一致性检查
* 确认有哪些 app key 应存在
* 启动时快速判断存储是否可用

---

### `sim:v1:baseline`

存 **完整标准化快照** ，用于 `reset()`。

这是必须单独存的，因为 reset 的语义是恢复“episode 初始状态”，不能依赖实时 state 倒推。

---

### `sim:v1:os`

存：

* `scenario`
* `device`
* `system`

因为这些是 OS 核心共享状态，系统 UI 高频读取。

---

### `sim:v1:providers`

存共享 provider：

* contacts
* sms
* calls
* media

这些虽然不是 OS 外壳，但也不是 app 私有。

---

### `sim:v1:apps:<appId>`

每个 app 独立持久化自身私有数据，例如：

* 微信聊天草稿、已读位置、tab 状态
* 支付宝首页推荐卡片状态
* B 站播放进度

---

## 5.3 为什么不只用一个大 key

只用一个大 key 的问题：

1. 任意一个 app 改动都要重写整个大 JSON
2. App 独立迁移困难
3. 调试时不清晰
4. 某个 app 崩坏会污染整份数据
5. 自动发现 app 后删除/新增不灵活

---

## 5.4 为什么也不建议每个 service 一个 key

key 太碎会导致：

* commit 难以原子化
* reset 写回成本更高
* boot 恢复复杂
* 调试上并没有明显收益

所以最平衡的是：

* **OS 核心共享状态：少量共享 key**
* **App 私有状态：按 app 独立 key**

---

## 5.5 持久化写入策略

`localStorage` 是同步 API，不要每次点击都立即写。

建议：

* store mutation 后标记 dirty slice
* `queueMicrotask` / `requestIdleCallback` / 50ms debounce 写盘
* 写盘时只写 dirty 的 key

<pre class="overflow-visible! px-0!" data-start="9223" data-end="9650"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">class</span><span></span><span class="ͼl">PersistenceEngine</span><span> {</span><br/><span></span><span class="ͼg">private</span><span> dirty </span><span class="ͼg">=</span><span></span><span class="ͼg">new</span><span></span><span class="ͼm">Set</span><span><</span><span class="ͼm">string</span><span>>();</span><br/><span></span><span class="ͼg">private</span><span> scheduled </span><span class="ͼg">=</span><span></span><span class="ͼj">false</span><span>;</span><br/><br/><span>  markDirty(</span><span class="ͼm">key</span><span>: </span><span class="ͼm">string</span><span>) {</span><br/><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>dirty</span><span class="ͼg">.</span><span>add(</span><span class="ͼm">key</span><span>);</span><br/><span></span><span class="ͼg">if</span><span> (</span><span class="ͼj">this</span><span class="ͼg">.</span><span>scheduled) </span><span class="ͼg">return</span><span>;</span><br/><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>scheduled </span><span class="ͼg">=</span><span></span><span class="ͼj">true</span><span>;</span><br/><span></span><span class="ͼm">queueMicrotask</span><span>(() => </span><span class="ͼj">this</span><span class="ͼg">.</span><span>flush());</span><br/><span>  }</span><br/><br/><span>  flush() {</span><br/><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>scheduled </span><span class="ͼg">=</span><span></span><span class="ͼj">false</span><span>;</span><br/><span></span><span class="ͼg">for</span><span> (</span><span class="ͼg">const</span><span></span><span class="ͼm">key</span><span></span><span class="ͼg">of</span><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>dirty) {</span><br/><span></span><span class="ͼm">localStorage</span><span class="ͼg">.</span><span>setItem(</span><span class="ͼm">key</span><span>, </span><span class="ͼj">this</span><span class="ͼg">.</span><span>serializeKey(</span><span class="ͼm">key</span><span>));</span><br/><span>    }</span><br/><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>dirty</span><span class="ͼg">.</span><span>clear();</span><br/><span>  }</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

# 6. 服务 / 模块划分与职责边界

下面这个边界是关键。

## 6.1 核心控制模块

### `SimKernel`

整个 OS 的根对象：

* 持有 Store
* 注册所有服务
* 持有 AppRegistry
* 暴露 `getState/setState/reset`
* 启动/销毁 runtime side effects

### `ScenarioController`

负责：

* baseline 管理
* `setState` 标准化
* `reset` 恢复
* episode/task 载入

### `PersistenceEngine`

负责：

* 从 snapshot 分拆到多个 localStorage key
* 从多个 key 恢复并合并
* migration
* dirty write

---

## 6.2 状态拥有型服务

### `ConnectivityService`

拥有：

* WiFi 开关 / 已连接 SSID / 附近 WiFi 列表
* 蓝牙开关 / 配对设备 / 附近设备
* 飞行模式
* 蜂窝数据 / 信号
* 代理配置

### `DisplayService`

拥有：

* 亮度
* 自动亮度
* 字体大小
* 显示缩放
* 主题
* 壁纸
* 护眼模式

### `AudioService`

拥有：

* 媒体/铃声/闹钟音量
* 静音 / 振动

### `PowerService`

拥有：

* 电量
* 充电状态
* 电池节能

### `TelephonyService`

拥有：

* SIM 卡信息
* 运营商
* 电话号码
* 通话状态
* 信号强度

### `LocationService`

拥有：

* 定位总开关
* 当前位置
* mock location 配置

### `NotificationService`

拥有：

* 所有通知
* 渠道配置
* heads-up / 未读数量

### `ClipboardService`

拥有剪贴板内容。

### `InputMethodService`

拥有：

* 当前输入法
* 键盘显示状态
* 输入语言

### `PermissionService`

拥有：

* 每个 app 的权限授予状态
* 特殊权限（通知、定位、读取联系人等）

### `ShellService`

拥有：

* 当前前台 app
* 任务栈
* recents
* QS/通知栏展开状态
* 导航模式
* 锁屏状态

---

## 6.3 共享内容 Provider

这些不是 UI 服务，而是“系统数据提供者”。

### `ContactsProvider`

联系人主数据。

### `SmsProvider`

短信线程、消息状态、未读数。

### `CallLogProvider`

通话记录。

### `MediaProvider`

相册、下载文件等。

这些 provider 可以被多个 app 使用：

* Contacts App
* Phone App
* SMS App
* 第三方社交 App（经权限控制）

---

## 6.4 只读 / 派生模块

这些模块 **不拥有数据** ，只做 projection。

### `StatusBarModel`

把多个 slice 组合成状态栏显示数据。

### `QuickSettingsModel`

把多个 service 的状态组合成 tile 列表。

### `NotificationShadeModel`

从 `NotificationService + ShellService` 生成 UI 视图模型。

这类模块非常适合写 selector，不要反向写数据。

---

# 7. 系统 UI 与服务的关系

这部分建议你强制执行一个规则：

> **系统 UI 组件只调用 command，不直接改 state。**

例如状态栏、快捷设置面板：

<pre class="overflow-visible! px-0!" data-start="11372" data-end="11579"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>QuickSettingsTile(WiFi)</span><br/><span>  └─ onClick -> connectivityService.toggleWifi()</span><br/><span>                  └─ mutate system.connectivity</span><br/><span>                      └─ status bar / settings page / app network状态 全部自动刷新</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

所以关系应当是：

<pre class="overflow-visible! px-0!" data-start="11591" data-end="11709"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>UI组件 -> hooks/selectors 读取</span><br/><span>UI事件 -> service command 写入</span><br/><span>service -> store transaction</span><br/><span>store -> React rerender</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## 7.1 状态栏

状态栏几乎不拥有状态，只有极少 UI 交互态。

大部分都应该是 selector：

<pre class="overflow-visible! px-0!" data-start="11772" data-end="12198"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">export</span><span></span><span class="ͼg">const</span><span></span><span class="ͼm">selectStatusBarModel</span><span></span><span class="ͼg">=</span><span> (</span><span class="ͼm">s</span><span>: </span><span class="ͼm">SimSnapshot</span><span>) => ({</span><br/><span>  timeText: </span><span class="ͼm">formatClock</span><span>(</span><span class="ͼm">s</span><span class="ͼg">.</span><span>system</span><span class="ͼg">.</span><span>clock),</span><br/><span>  batteryLevel: </span><span class="ͼm">s</span><span class="ͼg">.</span><span>system</span><span class="ͼg">.</span><span>power</span><span class="ͼg">.</span><span>batteryLevel,</span><br/><span>  charging: </span><span class="ͼm">s</span><span class="ͼg">.</span><span>system</span><span class="ͼg">.</span><span>power</span><span class="ͼg">.</span><span>charging,</span><br/><span>  wifiEnabled: </span><span class="ͼm">s</span><span class="ͼg">.</span><span>system</span><span class="ͼg">.</span><span>connectivity</span><span class="ͼg">.</span><span>wifi</span><span class="ͼg">.</span><span>enabled,</span><br/><span>  wifiSignal: </span><span class="ͼm">s</span><span class="ͼg">.</span><span>system</span><span class="ͼg">.</span><span>connectivity</span><span class="ͼg">.</span><span>wifi</span><span class="ͼg">.</span><span>signalLevel,</span><br/><span>  cellularSignal: </span><span class="ͼm">s</span><span class="ͼg">.</span><span>system</span><span class="ͼg">.</span><span>telephony</span><span class="ͼg">.</span><span>signalLevel,</span><br/><span>  hasNotifications: </span><span class="ͼm">s</span><span class="ͼg">.</span><span>system</span><span class="ͼg">.</span><span>notifications</span><span class="ͼg">.</span><span>items</span><span class="ͼg">.</span><span>some((</span><span class="ͼm">n</span><span>) => </span><span class="ͼg">!</span><span class="ͼm">n</span><span class="ͼg">.</span><span>dismissed),</span><br/><span>});</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## 7.2 快捷设置面板

快捷设置 tile 的“值”来自 service，面板自身的展开页码来自 `ShellService`。

* tile 状态：派生
* panel 展开：shell 拥有
* tile 点击：发 command

---

## 7.3 通知下拉栏

* 通知数据：`NotificationService`
* 下拉是否展开：`ShellService`
* 点击通知跳转 app：`ShellService + AppManager`

---

# 8. App 与 OS 的交互模式

建议统一成  **App Manifest + AppContext** 。

## 8.1 App Manifest

<pre class="overflow-visible! px-0!" data-start="12525" data-end="12925"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">export</span><span></span><span class="ͼg">interface</span><span></span><span class="ͼm">AppManifest</span><span><</span><span class="ͼm">TState</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">unknown</span><span>> {</span><br/><span>  id: </span><span class="ͼm">string</span><span>;</span><br/><span>  kind: </span><span class="ͼk">'system'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'user'</span><span>;</span><br/><span>  displayName: </span><span class="ͼm">string</span><span>;</span><br/><span>  icon: </span><span class="ͼm">string</span><span>;</span><br/><br/><span>  capabilities: </span><span class="ͼm">AppCapability</span><span>[];</span><br/><span>  requestedPermissions: </span><span class="ͼm">PermissionName</span><span>[];</span><br/><br/><span>  createDefaultState(): </span><span class="ͼm">TState</span><span>;</span><br/><span>  migrateState?(</span><span class="ͼm">raw</span><span>: </span><span class="ͼm">unknown</span><span>): </span><span class="ͼm">TState</span><span>;</span><br/><br/><span>  routes: </span><span class="ͼm">AppRouteDefinition</span><span>[];</span><br/><span>  createRoot(): </span><span class="ͼm">React</span><span class="ͼg">.</span><span class="ͼm">ComponentType</span><span>;</span><br/><br/><span>  onInstall?(</span><span class="ͼm">ctx</span><span>: </span><span class="ͼm">InstallContext</span><span>): </span><span class="ͼg">void</span><span>;</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## 8.2 AppContext

所有 app 都通过 `AppContext` 访问 OS，而不是直接 import 某个 store。

<pre class="overflow-visible! px-0!" data-start="13004" data-end="13387"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">export</span><span></span><span class="ͼg">interface</span><span></span><span class="ͼm">AppContext</span><span> {</span><br/><span>  appId: </span><span class="ͼm">string</span><span>;</span><br/><br/><span>  state: {</span><br/><span>    getAppState<</span><span class="ͼm">T</span><span>>(): </span><span class="ͼm">T</span><span>;</span><br/><span>    setAppState<</span><span class="ͼm">T</span><span>>(</span><span class="ͼm">updater</span><span>: (</span><span class="ͼm">draft</span><span>: </span><span class="ͼm">T</span><span>) => </span><span class="ͼg">void</span><span>): </span><span class="ͼg">void</span><span>;</span><br/><span>  };</span><br/><br/><span>  os: {</span><br/><span>    notifications: </span><span class="ͼm">NotificationApi</span><span>;</span><br/><span>    clipboard: </span><span class="ͼm">ClipboardApi</span><span>;</span><br/><span>    intents: </span><span class="ͼm">IntentApi</span><span>;</span><br/><span>    providers: </span><span class="ͼm">ProviderApi</span><span>;</span><br/><span>    shell: </span><span class="ͼm">ShellApi</span><span>;</span><br/><span>    network: </span><span class="ͼm">NetworkApi</span><span>;</span><br/><span>  };</span><br/><br/><span>  privileged?: </span><span class="ͼm">PrivilegedOsApi</span><span>; </span><span class="ͼe">// 仅 system app 有</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## 8.3 System App 与 Third-party App 的差异

### System App

如 Settings / Phone / SMS / Contacts：

* 可以拿到 `privileged` API
* 可直接调用系统服务 command
* 可读写共享 provider
* 默认有更多预授予权限

### Third-party App

如 微信 / 支付宝 / B站：

* 只能拿公共 API
* 必须经过权限检查
* 不能直接改系统设置
* 可以通过 intent、通知、剪贴板、provider（受权限）与 OS 交互

---

## 8.4 一个很重要的边界

例如“微信想读取联系人”：

* 不应该直接读 `apps.contacts`
* 应该通过 `contacts provider + permissionService`

这样架构会非常稳定。

---

# 9. 评测框架集成：`getState / setState / reset`

我建议把三者定义得非常明确。

## 9.1 `getState()`

返回 **完整标准化快照** 。

* 包含 system + providers + apps
* 不包含动画帧、promise、DOM 引用等易失态
* 一定是深拷贝后的纯 JSON

<pre class="overflow-visible! px-0!" data-start="13977" data-end="14010"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼm">getState</span><span>(): </span><span class="ͼm">SimSnapshot</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## 9.2 `setState(snapshot, options)`

默认行为建议是：

* `mode: 'replace'`
* `setAsBaseline: true`

也就是：评测框架注入的通常就是 episode 初始状态。

<pre class="overflow-visible! px-0!" data-start="14140" data-end="14313"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼm">setState</span><span>(</span><br/><span></span><span class="ͼm">partialOrFullSnapshot</span><span>: DeepPartial</span><span class="ͼg"><</span><span class="ͼm">SimSnapshot</span><span class="ͼg">></span><span>,</span><br/><span></span><span class="ͼm">options</span><span class="ͼg">?</span><span>: {</span><br/><span>    mode?: </span><span class="ͼk">'replace'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'merge'</span><span>;</span><br/><span></span><span class="ͼm">setAsBaseline</span><span class="ͼg">?</span><span>: </span><span class="ͼm">boolean</span><span>; </span><span class="ͼe">// default true</span><br/><span>  }</span><br/><span>): </span><span class="ͼg">void</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

### 实现流程

1. 用 factory defaults 构造完整 state
2. 按 `replace/merge` 规则合并注入内容
3. 跑 schema normalize / migration / invariant 修正
4. 停止所有易失 side effects
5. 原子替换 store
6. 如 `setAsBaseline=true`，同时写入 baseline
7. 重新启动 runtime side effects
8. 触发 React 刷新

---

## 9.3 `reset()`

语义必须是：

> 恢复到最近一次 baseline，而不是恢复到源码默认值。

实现流程：

<pre class="overflow-visible! px-0!" data-start="14642" data-end="14825"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼm">reset</span><span>():</span><br/><span></span><span class="ͼj">1.</span><span></span><span class="ͼm">读取 persisted baseline</span><br/><span></span><span class="ͼj">2.</span><span></span><span class="ͼm">停止 timers</span><span></span><span class="ͼg">/</span><span></span><span class="ͼg">in-</span><span class="ͼm">flight runtime</span><br/><span></span><span class="ͼj">3.</span><span></span><span class="ͼm">用 baseline 全量 replace 当前 store</span><br/><span></span><span class="ͼj">4.</span><span></span><span class="ͼm">清理不存在于 baseline 的 app key</span><br/><span></span><span class="ͼj">5.</span><span></span><span class="ͼm">重启 runtime</span><br/><span></span><span class="ͼj">6.</span><span></span><span class="ͼm">持久化 live state</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

## 9.4 推荐额外提供的 API

虽然你只问了 3 个，但评测层通常很需要这几个：

<pre class="overflow-visible! px-0!" data-start="14877" data-end="15095"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼm">window</span><span class="ͼg">.</span><span>__SIM__ </span><span class="ͼg">=</span><span> {</span><br/><span>  getState,</span><br/><span>  setState,</span><br/><span>  reset,</span><br/><span>  whenReady,</span><br/><span>  getScreenshotMeta, </span><span class="ͼe">// 例如 viewport、状态栏高度、dpr</span><br/><span>  launchApp(</span><span class="ͼm">appId</span><span>),</span><br/><span>  pressHome(),</span><br/><span>  pressBack(),</span><br/><span>  openQuickSettings(),</span><br/><span>  loadTask(</span><span class="ͼm">taskSpec</span><span>),</span><br/><span>};</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

# 10. `window.__SIM__` 的实现示例

<pre class="overflow-visible! px-0!" data-start="15132" data-end="15982"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">declare</span><span></span><span class="ͼg">global</span><span> {</span><br/><span></span><span class="ͼg">interface</span><span></span><span class="ͼm">Window</span><span> {</span><br/><span>    __SIM__?: </span><span class="ͼm">SimBridge</span><span>;</span><br/><span>  }</span><br/><span>}</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">interface</span><span></span><span class="ͼm">SimBridge</span><span> {</span><br/><span>  getState(): </span><span class="ͼm">SimSnapshot</span><span>;</span><br/><span>  setState(</span><br/><span></span><span class="ͼm">snapshot</span><span>: </span><span class="ͼm">DeepPartial</span><span><</span><span class="ͼm">SimSnapshot</span><span>>,</span><br/><span></span><span class="ͼm">options</span><span>?: { mode?: </span><span class="ͼk">'replace'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'merge'</span><span>; setAsBaseline?: </span><span class="ͼm">boolean</span><span> }</span><br/><span>  ): </span><span class="ͼm">Promise</span><span><</span><span class="ͼg">void</span><span>>;</span><br/><span>  reset(): </span><span class="ͼm">Promise</span><span><</span><span class="ͼg">void</span><span>>;</span><br/><span>  whenReady(): </span><span class="ͼm">Promise</span><span><</span><span class="ͼg">void</span><span>>;</span><br/><span>}</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">function</span><span></span><span class="ͼm">installSimBridge</span><span>(</span><span class="ͼm">kernel</span><span>: </span><span class="ͼm">SimKernel</span><span>) {</span><br/><span></span><span class="ͼm">window</span><span class="ͼg">.</span><span>__SIM__ </span><span class="ͼg">=</span><span> {</span><br/><span>    getState() {</span><br/><span></span><span class="ͼg">return</span><span></span><span class="ͼm">structuredClone</span><span>(</span><span class="ͼm">kernel</span><span class="ͼg">.</span><span>exportSnapshot());</span><br/><span>    },</span><br/><br/><span></span><span class="ͼg">async</span><span> setState(</span><span class="ͼm">snapshot</span><span>, </span><span class="ͼm">options</span><span>) {</span><br/><span></span><span class="ͼg">await</span><span></span><span class="ͼm">kernel</span><span class="ͼg">.</span><span>scenarioController</span><span class="ͼg">.</span><span>setState(</span><span class="ͼm">snapshot</span><span>, {</span><br/><span>        mode: </span><span class="ͼm">options</span><span>?.mode </span><span class="ͼg">??</span><span></span><span class="ͼk">'replace'</span><span>,</span><br/><span>        setAsBaseline: </span><span class="ͼm">options</span><span>?.setAsBaseline </span><span class="ͼg">??</span><span></span><span class="ͼj">true</span><span>,</span><br/><span>      });</span><br/><span>    },</span><br/><br/><span></span><span class="ͼg">async</span><span> reset() {</span><br/><span></span><span class="ͼg">await</span><span></span><span class="ͼm">kernel</span><span class="ͼg">.</span><span>scenarioController</span><span class="ͼg">.</span><span>reset();</span><br/><span>    },</span><br/><br/><span></span><span class="ͼg">async</span><span> whenReady() {</span><br/><span></span><span class="ͼg">await</span><span></span><span class="ͼm">kernel</span><span class="ͼg">.</span><span>whenReady();</span><br/><span>    },</span><br/><span>  };</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

# 11. App 自动发现与注册

你的约束是 `import.meta.glob` 自动发现，不手工维护列表。

建议每个 app 暴露统一 `manifest.ts`。

<pre class="overflow-visible! px-0!" data-start="16079" data-end="16354"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼe">// apps/web/src/bootstrap/discoverApps.ts</span><br/><span class="ͼg">const</span><span></span><span class="ͼm">modules</span><span></span><span class="ͼg">=</span><span></span><span class="ͼg">import.</span><span>meta</span><span class="ͼg">.</span><span>glob(</span><br/><span></span><span class="ͼk">'../../../../packages/apps/*/src/manifest.ts'</span><span>,</span><br/><span>  { eager: </span><span class="ͼj">true</span><span>, import: </span><span class="ͼk">'default'</span><span> }</span><br/><span>);</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">function</span><span></span><span class="ͼm">discoverApps</span><span>(): </span><span class="ͼm">AppManifest</span><span>[] {</span><br/><span></span><span class="ͼg">return</span><span></span><span class="ͼm">Object</span><span class="ͼg">.</span><span>values(</span><span class="ͼm">modules</span><span>) </span><span class="ͼg">as</span><span></span><span class="ͼm">AppManifest</span><span>[];</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

然后在 kernel 启动时：

<pre class="overflow-visible! px-0!" data-start="16373" data-end="16461"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">const</span><span></span><span class="ͼm">manifests</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">discoverApps</span><span>();</span><br/><span class="ͼg">const</span><span></span><span class="ͼm">registry</span><span></span><span class="ͼg">=</span><span></span><span class="ͼg">new</span><span></span><span class="ͼm">AppRegistry</span><span>(</span><span class="ͼm">manifests</span><span>);</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

注意：

* manifest 路径要固定
* 每个 manifest 必须导出 `id`
* 注册时检查重复 `id`
* manifest 应自带默认 state / migration

---

# 12. 推荐目录结构

我建议这样拆。

<pre class="overflow-visible! px-0!" data-start="16588" data-end="18698"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span>repo/</span><br/><span>├─ apps/</span><br/><span>│  └─ web/</span><br/><span>│     ├─ src/</span><br/><span>│     │  ├─ main.tsx</span><br/><span>│     │  ├─ App.tsx</span><br/><span>│     │  ├─ bootstrap/</span><br/><span>│     │  │  ├─ bootSim.ts</span><br/><span>│     │  │  ├─ discoverApps.ts</span><br/><span>│     │  │  └─ installSimBridge.ts</span><br/><span>│     │  ├─ ui/</span><br/><span>│     │  │  ├─ system/</span><br/><span>│     │  │  │  ├─ StatusBar.tsx</span><br/><span>│     │  │  │  ├─ QuickSettingsPanel.tsx</span><br/><span>│     │  │  │  ├─ NotificationShade.tsx</span><br/><span>│     │  │  │  └─ NavigationBar.tsx</span><br/><span>│     │  │  └─ phone-frame/</span><br/><span>│     │  └─ hooks/</span><br/><span>│     │     ├─ useSimSelector.ts</span><br/><span>│     │     └─ useSimCommand.ts</span><br/><span>│     └─ vite.config.ts</span><br/><span>│</span><br/><span>├─ packages/</span><br/><span>│  ├─ sim-core/</span><br/><span>│  │  └─ src/</span><br/><span>│  │     ├─ kernel/</span><br/><span>│  │     │  ├─ SimKernel.ts</span><br/><span>│  │     │  ├─ Store.ts</span><br/><span>│  │     │  └─ transactions.ts</span><br/><span>│  │     ├─ schema/</span><br/><span>│  │     │  ├─ types.ts</span><br/><span>│  │     │  ├─ guards.ts</span><br/><span>│  │     │  └─ migrations.ts</span><br/><span>│  │     ├─ defaults/</span><br/><span>│  │     │  ├─ deviceProfiles.ts</span><br/><span>│  │     │  ├─ createFactorySnapshot.ts</span><br/><span>│  │     │  └─ systemDefaults/</span><br/><span>│  │     ├─ persistence/</span><br/><span>│  │     │  ├─ keys.ts</span><br/><span>│  │     │  ├─ PersistenceEngine.ts</span><br/><span>│  │     │  └─ hydrate.ts</span><br/><span>│  │     ├─ scenario/</span><br/><span>│  │     │  └─ ScenarioController.ts</span><br/><span>│  │     ├─ services/</span><br/><span>│  │     │  ├─ connectivity/</span><br/><span>│  │     │  ├─ display/</span><br/><span>│  │     │  ├─ audio/</span><br/><span>│  │     │  ├─ power/</span><br/><span>│  │     │  ├─ telephony/</span><br/><span>│  │     │  ├─ location/</span><br/><span>│  │     │  ├─ notifications/</span><br/><span>│  │     │  ├─ clipboard/</span><br/><span>│  │     │  ├─ permissions/</span><br/><span>│  │     │  ├─ input-method/</span><br/><span>│  │     │  └─ shell/</span><br/><span>│  │     ├─ providers/</span><br/><span>│  │     │  ├─ contacts/</span><br/><span>│  │     │  ├─ sms/</span><br/><span>│  │     │  ├─ calls/</span><br/><span>│  │     │  └─ media/</span><br/><span>│  │     ├─ selectors/</span><br/><span>│  │     │  ├─ statusBar.ts</span><br/><span>│  │     │  ├─ quickSettings.ts</span><br/><span>│  │     │  └─ notifications.ts</span><br/><span>│  │     ├─ registry/</span><br/><span>│  │     │  ├─ AppRegistry.ts</span><br/><span>│  │     │  └─ PackageManager.ts</span><br/><span>│  │     └─ api/</span><br/><span>│  │        └─ bridge.ts</span><br/><span>│  │</span><br/><span>│  ├─ app-sdk/</span><br/><span>│  │  └─ src/</span><br/><span>│  │     ├─ manifest.ts</span><br/><span>│  │     ├─ context.ts</span><br/><span>│  │     ├─ permissions.ts</span><br/><span>│  │     └─ hooks.ts</span><br/><span>│  │</span><br/><span>│  └─ apps/</span><br/><span>│     ├─ settings/</span><br/><span>│     │  └─ src/</span><br/><span>│     │     ├─ manifest.ts</span><br/><span>│     │     ├─ routes/</span><br/><span>│     │     └─ components/</span><br/><span>│     ├─ phone/</span><br/><span>│     ├─ sms/</span><br/><span>│     ├─ contacts/</span><br/><span>│     ├─ wechat/</span><br/><span>│     ├─ alipay/</span><br/><span>│     └─ bilibili/</span><br/><span>│</span><br/><span>└─ package.json</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

# 13. Store 设计建议

建议自己做一个很薄的 store，配合 `useSyncExternalStore`，不要把系统架构绑死在某个 React 状态库上。

<pre class="overflow-visible! px-0!" data-start="18792" data-end="19433"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">type</span><span></span><span class="ͼm">Listener</span><span></span><span class="ͼg">=</span><span> () => </span><span class="ͼg">void</span><span>;</span><br/><br/><span class="ͼg">export</span><span></span><span class="ͼg">class</span><span></span><span class="ͼl">SimStore</span><span> {</span><br/><span></span><span class="ͼg">private</span><span> state: </span><span class="ͼm">SimSnapshot</span><span>;</span><br/><span></span><span class="ͼg">private</span><span> listeners </span><span class="ͼg">=</span><span></span><span class="ͼg">new</span><span></span><span class="ͼm">Set</span><span><</span><span class="ͼm">Listener</span><span>>();</span><br/><br/><span>  constructor(</span><span class="ͼm">initial</span><span>: </span><span class="ͼm">SimSnapshot</span><span>) {</span><br/><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>state </span><span class="ͼg">=</span><span></span><span class="ͼm">initial</span><span>;</span><br/><span>  }</span><br/><br/><span>  getState(): </span><span class="ͼm">SimSnapshot</span><span> {</span><br/><span></span><span class="ͼg">return</span><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>state;</span><br/><span>  }</span><br/><br/><span>  replace(</span><span class="ͼm">next</span><span>: </span><span class="ͼm">SimSnapshot</span><span>) {</span><br/><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>state </span><span class="ͼg">=</span><span></span><span class="ͼm">next</span><span>;</span><br/><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>emit();</span><br/><span>  }</span><br/><br/><span>  update(</span><span class="ͼm">recipe</span><span>: (</span><span class="ͼm">draft</span><span>: </span><span class="ͼm">SimSnapshot</span><span>) => </span><span class="ͼm">SimSnapshot</span><span>) {</span><br/><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>state </span><span class="ͼg">=</span><span></span><span class="ͼm">recipe</span><span>(</span><span class="ͼj">this</span><span class="ͼg">.</span><span>state);</span><br/><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>emit();</span><br/><span>  }</span><br/><br/><span>  subscribe(</span><span class="ͼm">listener</span><span>: </span><span class="ͼm">Listener</span><span>) {</span><br/><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>listeners</span><span class="ͼg">.</span><span>add(</span><span class="ͼm">listener</span><span>);</span><br/><span></span><span class="ͼg">return</span><span> () => </span><span class="ͼj">this</span><span class="ͼg">.</span><span>listeners</span><span class="ͼg">.</span><span>delete(</span><span class="ͼm">listener</span><span>);</span><br/><span>  }</span><br/><br/><span></span><span class="ͼg">private</span><span> emit() {</span><br/><span></span><span class="ͼg">for</span><span> (</span><span class="ͼg">const</span><span></span><span class="ͼm">l</span><span></span><span class="ͼg">of</span><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>listeners) </span><span class="ͼm">l</span><span>();</span><br/><span>  }</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

React hook：

<pre class="overflow-visible! px-0!" data-start="19448" data-end="19727"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">export</span><span></span><span class="ͼg">function</span><span></span><span class="ͼm">useSimSelector</span><span><</span><span class="ͼm">T</span><span>>(</span><span class="ͼm">selector</span><span>: (</span><span class="ͼm">s</span><span>: </span><span class="ͼm">SimSnapshot</span><span>) => </span><span class="ͼm">T</span><span>): </span><span class="ͼm">T</span><span> {</span><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">kernel</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">useKernel</span><span>();</span><br/><span></span><span class="ͼg">return</span><span></span><span class="ͼm">useSyncExternalStore</span><span>(</span><br/><span>    (</span><span class="ͼm">cb</span><span>) => </span><span class="ͼm">kernel</span><span class="ͼg">.</span><span>store</span><span class="ͼg">.</span><span>subscribe(</span><span class="ͼm">cb</span><span>),</span><br/><span>    () => </span><span class="ͼm">selector</span><span>(</span><span class="ͼm">kernel</span><span class="ͼg">.</span><span>store</span><span class="ͼg">.</span><span>getState()),</span><br/><span>    () => </span><span class="ͼm">selector</span><span>(</span><span class="ͼm">kernel</span><span class="ͼg">.</span><span>store</span><span class="ͼg">.</span><span>getState()),</span><br/><span>  );</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

# 14. 一个服务的写法示例

<pre class="overflow-visible! px-0!" data-start="19751" data-end="20814"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">export</span><span></span><span class="ͼg">class</span><span></span><span class="ͼl">ConnectivityService</span><span> {</span><br/><span>  constructor(</span><span class="ͼg">private</span><span></span><span class="ͼm">kernel</span><span>: </span><span class="ͼm">SimKernel</span><span>) {}</span><br/><br/><span>  toggleWifi(</span><span class="ͼm">enabled</span><span>: </span><span class="ͼm">boolean</span><span>) {</span><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">prev</span><span></span><span class="ͼg">=</span><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>kernel</span><span class="ͼg">.</span><span>store</span><span class="ͼg">.</span><span>getState();</span><br/><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">next</span><span>: </span><span class="ͼm">SimSnapshot</span><span></span><span class="ͼg">=</span><span> {</span><br/><span>      ...</span><span class="ͼm">prev</span><span>,</span><br/><span>      system: {</span><br/><span>        ...</span><span class="ͼm">prev</span><span class="ͼg">.</span><span>system,</span><br/><span>        connectivity: {</span><br/><span>          ...</span><span class="ͼm">prev</span><span class="ͼg">.</span><span>system</span><span class="ͼg">.</span><span>connectivity,</span><br/><span>          wifi: {</span><br/><span>            ...</span><span class="ͼm">prev</span><span class="ͼg">.</span><span>system</span><span class="ͼg">.</span><span>connectivity</span><span class="ͼg">.</span><span>wifi,</span><br/><span>            enabled,</span><br/><span>            connectedSsid: </span><span class="ͼm">enabled</span><span></span><span class="ͼg">?</span><span></span><span class="ͼm">prev</span><span class="ͼg">.</span><span>system</span><span class="ͼg">.</span><span>connectivity</span><span class="ͼg">.</span><span>wifi</span><span class="ͼg">.</span><span>connectedSsid </span><span class="ͼg">:</span><span></span><span class="ͼj">null</span><span>,</span><br/><span>          },</span><br/><span>        },</span><br/><span>      },</span><br/><span>    };</span><br/><br/><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>kernel</span><span class="ͼg">.</span><span>store</span><span class="ͼg">.</span><span>replace(</span><span class="ͼm">next</span><span>);</span><br/><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>kernel</span><span class="ͼg">.</span><span>persistence</span><span class="ͼg">.</span><span>markDirty(</span><span class="ͼk">'sim:v1:os'</span><span>);</span><br/><span>  }</span><br/><br/><span>  setNearbyWifiNetworks(</span><span class="ͼm">networks</span><span>: </span><span class="ͼm">WifiNetwork</span><span>[]) {</span><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">s</span><span></span><span class="ͼg">=</span><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>kernel</span><span class="ͼg">.</span><span>store</span><span class="ͼg">.</span><span>getState();</span><br/><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>kernel</span><span class="ͼg">.</span><span>store</span><span class="ͼg">.</span><span>replace({</span><br/><span>      ...</span><span class="ͼm">s</span><span>,</span><br/><span>      system: {</span><br/><span>        ...</span><span class="ͼm">s</span><span class="ͼg">.</span><span>system,</span><br/><span>        connectivity: {</span><br/><span>          ...</span><span class="ͼm">s</span><span class="ͼg">.</span><span>system</span><span class="ͼg">.</span><span>connectivity,</span><br/><span>          wifi: {</span><br/><span>            ...</span><span class="ͼm">s</span><span class="ͼg">.</span><span>system</span><span class="ͼg">.</span><span>connectivity</span><span class="ͼg">.</span><span>wifi,</span><br/><span>            nearbyNetworks: </span><span class="ͼm">networks</span><span>,</span><br/><span>          },</span><br/><span>        },</span><br/><span>      },</span><br/><span>    });</span><br/><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>kernel</span><span class="ͼg">.</span><span>persistence</span><span class="ͼg">.</span><span>markDirty(</span><span class="ͼk">'sim:v1:os'</span><span>);</span><br/><span>  }</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

真正项目里你可以再包一层 transaction helper，避免手写太多 spread。

---

# 15. `setState()` 的关键点：不是简单 merge

这个接口一定要做三件事：

1. **补全默认值**
2. **修复 invariant**
3. **重建派生运行时**

例如：

* 飞行模式开启后，蜂窝/WiFi/蓝牙如何处理
* 当前前台 app 不在已安装列表时怎么办
* `foregroundAppId` 被删除后是否回 Launcher
* 权限引用了不存在的 app 如何处理

<pre class="overflow-visible! px-0!" data-start="21080" data-end="22202"><div class="relative w-full mt-4 mb-1"><div class=""><div class="relative"><div class="h-full min-h-0 min-w-0"><div class="h-full min-h-0 min-w-0"><div class="border border-token-border-light border-radius-3xl corner-superellipse/1.1 rounded-3xl"><div class="h-full w-full border-radius-3xl bg-token-bg-elevated-secondary corner-superellipse/1.1 overflow-clip rounded-3xl lxnfua_clipPathFallback"><div class="pointer-events-none absolute inset-x-4 top-12 bottom-4"><div class="pointer-events-none sticky z-40 shrink-0 z-1!"><div class="sticky bg-token-border-light"></div></div></div><div class=""><div class="relative z-0 flex max-w-full"><div id="code-block-viewer" dir="ltr" class="q9tKkq_viewer cm-editor z-10 light:cm-light dark:cm-light flex h-full w-full flex-col items-stretch ͼd ͼr"><div class="cm-scroller"><div class="cm-content q9tKkq_readonly"><span class="ͼg">export</span><span></span><span class="ͼg">class</span><span></span><span class="ͼl">ScenarioController</span><span> {</span><br/><span>  constructor(</span><span class="ͼg">private</span><span></span><span class="ͼm">kernel</span><span>: </span><span class="ͼm">SimKernel</span><span>) {}</span><br/><br/><span></span><span class="ͼg">async</span><span> setState(</span><br/><span></span><span class="ͼm">input</span><span>: </span><span class="ͼm">DeepPartial</span><span><</span><span class="ͼm">SimSnapshot</span><span>>,</span><br/><span></span><span class="ͼm">options</span><span>: { mode: </span><span class="ͼk">'replace'</span><span></span><span class="ͼg">|</span><span></span><span class="ͼk">'merge'</span><span>; setAsBaseline: </span><span class="ͼm">boolean</span><span> },</span><br/><span>  ) {</span><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">current</span><span></span><span class="ͼg">=</span><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>kernel</span><span class="ͼg">.</span><span>store</span><span class="ͼg">.</span><span>getState();</span><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">factory</span><span></span><span class="ͼg">=</span><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>kernel</span><span class="ͼg">.</span><span>createFactorySnapshot();</span><br/><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">merged</span><span></span><span class="ͼg">=</span><br/><span></span><span class="ͼm">options</span><span class="ͼg">.</span><span>mode </span><span class="ͼg">===</span><span></span><span class="ͼk">'replace'</span><br/><span></span><span class="ͼg">?</span><span></span><span class="ͼm">deepMerge</span><span>(</span><span class="ͼm">factory</span><span>, </span><span class="ͼm">input</span><span>)</span><br/><span></span><span class="ͼg">:</span><span></span><span class="ͼm">deepMerge</span><span>(</span><span class="ͼm">current</span><span>, </span><span class="ͼm">input</span><span>);</span><br/><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">normalized</span><span></span><span class="ͼg">=</span><span></span><span class="ͼm">normalizeSnapshot</span><span>(</span><span class="ͼm">merged</span><span>, </span><span class="ͼj">this</span><span class="ͼg">.</span><span>kernel</span><span class="ͼg">.</span><span>registry);</span><br/><br/><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>kernel</span><span class="ͼg">.</span><span>stopEphemeralRuntimes();</span><br/><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>kernel</span><span class="ͼg">.</span><span>store</span><span class="ͼg">.</span><span>replace(</span><span class="ͼm">normalized</span><span>);</span><br/><br/><span></span><span class="ͼg">if</span><span> (</span><span class="ͼm">options</span><span class="ͼg">.</span><span>setAsBaseline) {</span><br/><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>kernel</span><span class="ͼg">.</span><span>persistence</span><span class="ͼg">.</span><span>saveBaseline(</span><span class="ͼm">normalized</span><span>);</span><br/><span>    }</span><br/><br/><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>kernel</span><span class="ͼg">.</span><span>persistence</span><span class="ͼg">.</span><span>saveLive(</span><span class="ͼm">normalized</span><span>);</span><br/><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>kernel</span><span class="ͼg">.</span><span>startEphemeralRuntimes();</span><br/><span>  }</span><br/><br/><span></span><span class="ͼg">async</span><span> reset() {</span><br/><span></span><span class="ͼg">const</span><span></span><span class="ͼm">baseline</span><span></span><span class="ͼg">=</span><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>kernel</span><span class="ͼg">.</span><span>persistence</span><span class="ͼg">.</span><span>loadBaseline()</span><br/><span></span><span class="ͼg">??</span><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>kernel</span><span class="ͼg">.</span><span>createFactorySnapshot();</span><br/><br/><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>kernel</span><span class="ͼg">.</span><span>stopEphemeralRuntimes();</span><br/><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>kernel</span><span class="ͼg">.</span><span>store</span><span class="ͼg">.</span><span>replace(</span><span class="ͼm">structuredClone</span><span>(</span><span class="ͼm">baseline</span><span>));</span><br/><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>kernel</span><span class="ͼg">.</span><span>persistence</span><span class="ͼg">.</span><span>saveLive(</span><span class="ͼm">baseline</span><span>);</span><br/><span></span><span class="ͼj">this</span><span class="ͼg">.</span><span>kernel</span><span class="ͼg">.</span><span>startEphemeralRuntimes();</span><br/><span>  }</span><br/><span>}</span></div></div></div></div></div></div></div></div></div><div class=""><div class=""></div></div></div></div></div></pre>

---

# 16. 你这个项目里最值得坚持的几个“不变量”

建议在 `normalizeSnapshot()` 里强制维护这些约束：

* `foregroundAppId` 必须存在于已安装 app 或 `launcher`
* `batteryLevel` 必须在 `0~100`
* 飞行模式开启时：
  * 蜂窝应断开
  * WiFi/蓝牙可按你模拟策略决定是否保留，但要全局一致
* 被卸载 app 的权限、通知、task stack 必须被清理
* provider 中引用的联系人 / thread / media id 必须存在
* `apps[appId]` 必须都能被对应 manifest 迁移成功

---

# 17. 对“截图驱动 Agent”特别有帮助的两个建议

## 17.1 让 shell 状态足够显式

Agent 只能看图，所以系统 UI 切换要稳定、可重现：

* QS 是半展开还是全展开
* 通知栏是否遮挡前台 app
* 键盘是否弹出
* 前台 app 是否有 modal

这些都应该有明确状态字段。

---

## 17.2 所有视觉变化都应由 snapshot 决定

不要让 UI 中存在大量“组件内部私有状态”。

否则：

* `getState()` 看不到
* `setState()` 复现不了
* 刷新恢复不一致
* 评测结果不稳定

React 组件本地 state 只保留极短生命周期的纯动画态。

---

# 18. 最后给一个实际落地建议

如果现在就开始搭，我会按这个顺序做：

1. `SimSnapshot` schema + factory defaults
2. `SimStore + PersistenceEngine + ScenarioController`
3. `window.__SIM__`
4. `ShellService + Connectivity/Display/Power/Notification`
5. 状态栏 / QS / 通知栏
6. AppManifest / AppRegistry / `import.meta.glob`
7. Settings App
8. Phone/SMS/Contacts 的 shared providers
9. 第三方 App capability model
10. 网络代理 / 定位 / 权限弹窗等高级能力

这样你会很快得到一个已经可评测的最小闭环。

如果你愿意，我下一条可以继续直接给你一版  **“最小可运行骨架代码”** ，包括 `SimKernel`、`PersistenceEngine`、`AppRegistry`、`__SIM__`、以及一个可跑的 Settings/WiFi 示例。
