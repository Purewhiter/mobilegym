# 📋 bench_env 任务列表

> **总任务数 440** · **26 个应用套件** · **带参数 355**（模板参数 353 · 仅内部 2）

---

## 📊 总览

### 难度分布

| 难度 | 分布 | 数量 | 占比 |
| :--- | :--- | ---: | ---: |
| 🟢 **L1** Easy | `██░░░░░░░░░░░░░░░░░░` | **42** | 10% |
| 🔵 **L2** Medium | `██████░░░░░░░░░░░░░░` | **139** | 32% |
| 🟡 **L3** Hard | `███████░░░░░░░░░░░░░` | **145** | 33% |
| 🔴 **L4** Expert | `█████░░░░░░░░░░░░░░░` | **114** | 26% |

### 应用任务统计

| 应用 | 任务数 | 带参数 | 🟢 L1 | 🔵 L2 | 🟡 L3 | 🔴 L4 |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| 🔐 **account** | 5 | 4 | · | 2 | 2 | 1 |
| 💰 **alipay** | 19 | 8 | 4 | 5 | 7 | 3 |
| 📺 **bilibili** | 20 | 18 | 3 | 11 | 4 | 2 |
| 📦 **calendar** | 21 | 21 | 3 | 8 | 7 | 3 |
| 📦 **clock** | 18 | 15 | 1 | 9 | 5 | 3 |
| 🛍️ **crossapp_commerce** | 20 | 15 | · | 2 | 6 | 12 |
| 📰 **crossapp_content** | 30 | 25 | · | 3 | 10 | 17 |
| 🌤️ **crossapp_life** | 33 | 31 | · | 1 | 15 | 17 |
| 💼 **crossapp_work** | 22 | 13 | · | 1 | 7 | 14 |
| 🛒 **ebay** | 8 | 8 | 1 | 2 | 4 | 1 |
| 📦 **file_manager** | 3 | 0 | · | · | · | 3 |
| 📦 **launcher** | 2 | 0 | · | · | 1 | 1 |
| 🗺️ **map** | 17 | 15 | 1 | 7 | 7 | 2 |
| 📦 **notes** | 15 | 12 | 2 | 9 | 2 | 2 |
| 💳 **payment** | 7 | 7 | · | · | 2 | 5 |
| 🚄 **railway12306** | 16 | 10 | 1 | 4 | 7 | 4 |
| 📕 **redbook** | 17 | 15 | 1 | 7 | 6 | 3 |
| 📦 **reddit** | 16 | 11 | 3 | 5 | 6 | 2 |
| 📦 **rednote** | 17 | 15 | 2 | 6 | 6 | 3 |
| 📦 **sms** | 10 | 8 | 1 | 4 | 3 | 2 |
| 🎵 **spotify** | 22 | 21 | 1 | 12 | 7 | 2 |
| 📹 **tencent_meeting** | 21 | 16 | 2 | 10 | 5 | 4 |
| 🌤️ **weather** | 22 | 21 | 3 | 10 | 5 | 4 |
| 💬 **wechat** | 26 | 18 | 7 | 9 | 9 | 1 |
| 📖 **wechat_reading** | 22 | 20 | 4 | 8 | 9 | 1 |
| 🐦 **x** | 11 | 8 | 2 | 4 | 3 | 2 |

### 参数标记说明

| 样式 | 含义 |
| :--- | :--- |
| **粗体** 参数名 | 出现在任务模板 `{param}` 占位符中，Agent 可见 |
| *斜体* 参数名 | 仅用于环境准备 / 判题 / 采样，不出现在指令中 |
| `默认值` | 列举时使用的默认值（运行时可能被采样覆盖） |
| ←source | 从环境状态采样的路径 |

---

## 🔐 account

> **5** 个任务 · **带参数 4** · 🔵 L2×2 🟡 L3×2 🔴 L4×1

### 🔵 **L2** Medium (2)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>account.Railway12306ChangePassword</code></b><br><sub>帮我把铁路12306的登录密码从123456改成Abc@5678</sub><br><code>settings</code> <code>edit</code></td><td><b>oldPassword</b> <sub>string</sub> <code>123456</code><br><b>newPassword</b> <sub>string</sub> <code>Abc@5678</code></td><td>railway12306</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>account.WechatAccountCancellation</code></b><br><sub>帮我把微信账号注销掉</sub><br><code>settings</code> <code>delete</code></td><td>—</td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🟡 **L3** Hard (2)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>account.Railway12306ForgotPasswordReset</code></b><br><sub>帮我用手机号17366666695和证件号110101199001011234找回 12306 密码，把新密码设成NewP@ssw0rd123，再用新密码登录一次</sub><br><code>settings</code> <code>edit</code></td><td><b>accountPhone</b> <sub>string</sub> <code>17366666695</code><br><b>idNo</b> <sub>string</sub> <code>110101199001011234</code><br><b>newPassword</b> <sub>string</sub> <code>NewP@ssw0rd123</code></td><td>railway12306</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>account.Railway12306LoginWithAccount</code></b><br><sub>备忘录里标题为12306账号密码的笔记记着铁路12306账号user_123的几个候选密码，帮我试出哪个能登录，并把笔记改成只保留正确密码</sub><br><code>search</code> <code>edit</code> <code>handoff</code></td><td><b>noteTitle</b> <sub>string</sub> <code>12306账号密码</code><br><b>username</b> <sub>string</sub> <code>user_123</code><br><i>correctPassword</i> <sub>string</sub> <code>123456</code><br><i>otherPasswords</i> <sub>string</sub> <code>111111,888888,password</code></td><td>railway12306, notes</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
</table>

### 🔴 **L4** Expert (1)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>account.Railway12306RegisterThenLogin</code></b><br><sub>帮我注册一个新的铁路12306账号new_user_001，密码是Reg2026x，姓名张三，身份证110101199001011234，手机号13800000000，邮箱new_user_001@example.com，然后登陆</sub><br><code>create</code> <code>edit</code></td><td><b>username</b> <sub>string</sub> <code>new_user_001</code><br><b>password</b> <sub>string</sub> <code>Reg2026x</code><br><b>name</b> <sub>string</sub> <code>张三</code><br><b>idNo</b> <sub>string</sub> <code>110101199001011234</code><br><b>phone</b> <sub>string</sub> <code>13800000000</code><br><b>email</b> <sub>string</sub> <code>new_user_001@example.com</code></td><td>railway12306</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

---

## 💰 alipay

> **19** 个任务 · **带参数 8** · 🟢 L1×4 🔵 L2×5 🟡 L3×7 🔴 L4×3

### 🟢 **L1** Easy (4)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>alipay.CheckBalance</code></b><br><sub>看看我理财总资产有多少钱</sub><br><code>extract</code></td><td>—</td><td>alipay</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">2</td><td><b><code>alipay.CheckDailyIncome</code></b><br><sub>在支付宝查看昨日理财收益是多少</sub><br><code>extract</code></td><td>—</td><td>alipay</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">3</td><td><b><code>alipay.EnableDarkMode</code></b><br><sub>给支付宝开启深色模式</sub><br><code>finance</code> <code>settings</code></td><td>—</td><td>alipay</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">4</td><td><b><code>alipay.ShowReceiveQRCode</code></b><br><sub>打开支付宝的收钱二维码</sub><br><code>nav</code></td><td>—</td><td>alipay</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>atomic</code></td></tr>
</table>

### 🔵 **L2** Medium (5)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>alipay.CheckLatestMessageContent</code></b><br><sub>在支付宝里查看'正中'最近发来了什么</sub><br><code>extract</code></td><td><b>name</b> <sub>string</sub> <code>正中</code> <sub title="sampled from">←apps.alipay.conversations[name]</sub></td><td>alipay</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>alipay.EnableRefreshSound</code></b><br><sub>在支付宝中开启刷新音效</sub><br><code>settings</code></td><td>—</td><td>alipay</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">3</td><td><b><code>alipay.MonthlyIncomeByCounterparty</code></b><br><sub>在支付宝账单中查看2026年1月里来自'Hui'的收入一共有多少</sub><br><code>extract</code> <code>reasoning</code></td><td><b>month</b> <sub>string</sub> <code>2026年1月</code><br><b>name</b> <sub>string</sub> <code>Hui</code><br><i>_income</i> <sub>?</sub></td><td>alipay</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>alipay.SendMessageToContact</code></b><br><sub>在支付宝给'老王(王建国)'发一条消息，'发票抬头是XX公司'</sub><br><code>create</code></td><td><b>contact</b> <sub>string</sub> <code>老王(王建国)</code> <sub title="sampled from">←apps.alipay.contacts[name]</sub><br><b>text</b> <sub>string</sub> <code>发票抬头是XX公司</code></td><td>alipay</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">5</td><td><b><code>alipay.SetPayOrderCcbYuebaoBalance</code></b><br><sub>在支付宝支付设置里，把支付顺序改成建设银行储蓄卡、余额宝、账户余额</sub><br><code>settings</code></td><td>—</td><td>alipay</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🟡 **L3** Hard (7)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>alipay.AnalyzeSpending</code></b><br><sub>在支付宝账单里看最近 5 笔记录，一共花了多少钱</sub><br><code>extract</code> <code>reasoning</code></td><td>—</td><td>alipay</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">2</td><td><b><code>alipay.ConfigureLanguageAndFastPay</code></b><br><sub>在支付宝中把语言切换为英文，同时开启极速付款并关闭付款彩蛋</sub><br><code>settings</code></td><td>—</td><td>alipay</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>alipay.CountLargeTransferIncomes</code></b><br><sub>在支付宝账单中，有多少笔转账收入超过 1000 元</sub><br><code>extract</code> <code>reasoning</code></td><td><b>amount</b> <sub>enum</sub> <code>1000</code></td><td>alipay</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">4</td><td><b><code>alipay.DisableAllNotifications</code></b><br><sub>关闭支付宝的所有新消息提醒</sub><br><code>settings</code></td><td>—</td><td>alipay</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">5</td><td><b><code>alipay.FindFriend</code></b><br><sub>在支付宝里找到好友'阿明'，告诉我他的电话号码</sub><br><code>nav</code> <code>extract</code></td><td><b>name</b> <sub>string</sub> <code>阿明</code> <sub title="sampled from">←apps.alipay.contacts[name]</sub></td><td>alipay</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">6</td><td><b><code>alipay.FindLargestTransferPartner</code></b><br><sub>在支付宝账单里统计累计金额，告诉我总金额最大的交易对象是什么</sub><br><code>extract</code> <code>reasoning</code></td><td>—</td><td>alipay</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">7</td><td><b><code>alipay.SetFontSizeLevel</code></b><br><sub>把支付宝字体大小调到比标准大一档</sub><br><code>settings</code></td><td><b>font_size_level</b> <sub>enum</sub> <code>比标准大一档</code></td><td>alipay</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>atomic</code></td></tr>
</table>

### 🔴 **L4** Expert (3)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>alipay.CalculateMonthlyExpenseTrend</code></b><br><sub>在支付宝账单中对比2026年1月和2025年12月的总支出，哪个月花得多</sub><br><code>extract</code> <code>reasoning</code></td><td><b>month1</b> <sub>string</sub> <code>2026年1月</code><br><b>month2</b> <sub>string</sub> <code>2025年12月</code></td><td>alipay</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">2</td><td><b><code>alipay.CheckUnreadMessageCount</code></b><br><sub>我支付宝里有多少条好友发来的未读消息</sub><br><code>extract</code></td><td>—</td><td>alipay</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>alipay.SearchTransferRecords</code></b><br><sub>看看支付宝账单里'转账'有多少条记录</sub><br><code>search</code> <code>extract</code></td><td><b>keyword</b> <sub>string</sub> <code>转账</code></td><td>alipay</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
</table>

---

## 📺 bilibili

> **20** 个任务 · **带参数 18** · 🟢 L1×3 🔵 L2×11 🟡 L3×4 🔴 L4×2

### 🟢 **L1** Easy (3)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>bilibili.OpenRankingTask</code></b><br><sub>打开B站排行榜。</sub><br><code>nav</code></td><td>—</td><td>bilibili</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>bilibili.SetSexTask</code></b><br><sub>把B站账号资料里的性别改成'男'。</sub><br><code>edit</code></td><td><b>sex</b> <sub>enum</sub> <code>男</code></td><td>bilibili</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>bilibili.ViewProfileStatTask</code></b><br><sub>我B站现在有多少硬币？</sub><br><code>extract</code></td><td><b>stat</b> <sub>enum</sub> <code>硬币</code></td><td>bilibili</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🔵 **L2** Medium (11)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>bilibili.CoinVideoTask</code></b><br><sub>给B站视频'盘点某国令人啼笑皆非的荒诞瞬间'投1个币，不要点赞。</sub><br><code>social</code></td><td><b>title</b> <sub>string</sub> <code>盘点某国令人啼笑皆非的荒诞瞬间</code></td><td>bilibili</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>bilibili.SanlianTask</code></b><br><sub>在B站排行榜里找到视频'盘点某国令人啼笑皆非的荒诞瞬间'，给它一键三连。</sub><br><code>social</code></td><td><b>title</b> <sub>string</sub> <code>盘点某国令人啼笑皆非的荒诞瞬间</code></td><td>bilibili</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>bilibili.SearchUserFollowerCountTask</code></b><br><sub>在B站搜一下'流光视界'，ta现在有多少粉丝？</sub><br><code>search</code> <code>extract</code></td><td><b>up_name</b> <sub>enum</sub> <code>流光视界</code></td><td>bilibili</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>bilibili.SubscribeTask</code></b><br><sub>在B站关注UP主'流光视界'。</sub><br><code>search</code> <code>social</code></td><td><b>up_name</b> <sub>string</sub> <code>流光视界</code> <sub title="sampled from">←apps.bilibili.recommendedUp[name]</sub></td><td>bilibili</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">5</td><td><b><code>bilibili.UnfollowAndClearHistoryTask</code></b><br><sub>取消关注UP主'铁壁观察'，并把B站搜索记录清空。</sub><br><code>social</code> <code>search</code></td><td><b>up_name</b> <sub>string</sub> <code>铁壁观察</code> <sub title="sampled from">←apps.bilibili.user.followingList[name]</sub></td><td>bilibili</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">6</td><td><b><code>bilibili.UpdateNicknameTask</code></b><br><sub>把我的B站昵称改成'xiaoming2026'。</sub><br><code>edit</code></td><td><b>new_name</b> <sub>string</sub> <code>xiaoming2026</code></td><td>bilibili</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">7</td><td><b><code>bilibili.UpdateSignTask</code></b><br><sub>在B站把个人签名改成'学习B站'。</sub><br><code>edit</code></td><td><b>new_sign</b> <sub>string</sub> <code>学习B站</code></td><td>bilibili</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">8</td><td><b><code>bilibili.VideoAnswerOnlineTask</code></b><br><sub>打开b站视频'盘点某国令人啼笑皆非的荒诞瞬间'，看看现在有多少人在线。</sub><br><code>extract</code></td><td><b>title</b> <sub>string</sub> <code>盘点某国令人啼笑皆非的荒诞瞬间</code></td><td>bilibili</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">9</td><td><b><code>bilibili.VideoCommentContainsAnswerUidTask</code></b><br><sub>帮我在b站视频'盘点某国令人啼笑皆非的荒诞瞬间'的评论区里找到提到'十二小时'的那条评论，告诉我评论者的UID。</sub><br><code>extract</code> <code>reasoning</code> <code>explore</code></td><td><b>title</b> <sub>string</sub> <code>盘点某国令人啼笑皆非的荒诞瞬间</code><br><b>snippet</b> <sub>string</sub> <code>十二小时</code></td><td>bilibili</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">10</td><td><b><code>bilibili.ViewFavoritesFolderCountTask</code></b><br><sub>看看我B站的'默认收藏夹'收藏夹里有多少个内容。</sub><br><code>extract</code></td><td><b>folder_title</b> <sub>enum</sub> <code>默认收藏夹</code></td><td>bilibili</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">11</td><td><b><code>bilibili.ViewMyUidTask</code></b><br><sub>去看看我的b站UID是多少？</sub><br><code>extract</code></td><td>—</td><td>bilibili</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🟡 **L3** Hard (4)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>bilibili.FavVideoAndCountTask</code></b><br><sub>把B站'全站'排行榜的第1名收藏到默认收藏夹，然后告诉我默认收藏夹现在有多少个内容。</sub><br><code>social</code> <code>extract</code></td><td><b>partition</b> <sub>enum</sub> <code>全站</code><br><b>rank</b> <sub>int</sub> <code>1</code></td><td>bilibili</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>bilibili.FollowRecommendationTask</code></b><br><sub>先关注UP主'流光视界'，再从推荐列表里关注一位不同的UP主。</sub><br><code>social</code></td><td><b>target_up_name</b> <sub>string</sub> <code>流光视界</code> <sub title="sampled from">←apps.bilibili.recommendedUp[name]</sub></td><td>bilibili</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>bilibili.SetBirthdayTask</code></b><br><sub>在B站个人资料里把生日设为1980年8月13日。</sub><br><code>edit</code></td><td><b>month</b> <sub>int</sub> <code>8</code><br><b>day</b> <sub>int</sub> <code>13</code></td><td>bilibili</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>bilibili.VideoAnswerTagsTask</code></b><br><sub>打开b站视频'盘点某国令人啼笑皆非的荒诞瞬间'，说出其中任意3个标签。</sub><br><code>extract</code></td><td><b>title</b> <sub>string</sub> <code>盘点某国令人啼笑皆非的荒诞瞬间</code></td><td>bilibili</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🔴 **L4** Expert (2)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>bilibili.ToggleAnimeSubscriptionTask</code></b><br><sub>帮我追番'鬼灭之刃 游郭篇 中配版'。</sub><br><code>social</code></td><td><b>anime_title</b> <sub>string</sub> <code>鬼灭之刃 游郭篇 中配版</code></td><td>bilibili</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>bilibili.VideoCommentContainsAnswerLocationTask</code></b><br><sub>在b站视频'把老式音乐盒改造成 AI 作曲机：从硬件到算法全流程'的评论区找到提到'整活达人'的那条评论，告诉我它显示的IP属地。</sub><br><code>extract</code> <code>reasoning</code> <code>explore</code></td><td><b>title</b> <sub>string</sub> <code>把老式音乐盒改造成 AI 作曲机：从硬件到算法…</code><br><b>snippet</b> <sub>string</sub> <code>整活达人</code></td><td>bilibili</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
</table>

---

## 📦 calendar

> **21** 个任务 · **带参数 21** · 🟢 L1×3 🔵 L2×8 🟡 L3×7 🔴 L4×3

### 🟢 **L1** Easy (3)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>calendar.ChangeDefaultReminder</code></b><br><sub>把日历默认提前提醒改成15分钟前</sub><br><code>settings</code></td><td><b>reminder</b> <sub>enum</sub> <code>15分钟前</code></td><td>calendar</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">2</td><td><b><code>calendar.ConfigAllReminders</code></b><br><sub>把日历默认提前提醒改成30分钟前，全天提醒改成当天零点，稍后提醒改成30分钟后</sub><br><code>settings</code></td><td><b>r1</b> <sub>enum</sub> <code>30分钟前</code><br><b>r2</b> <sub>enum</sub> <code>当天零点</code><br><b>r3</b> <sub>enum</sub> <code>30分钟后</code></td><td>calendar</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>calendar.ToggleShowWeekNumber</code></b><br><sub>打开日历的显示周数</sub><br><code>settings</code></td><td><b>toggle</b> <sub>bool</sub> <code>打开</code></td><td>calendar</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>atomic</code></td></tr>
</table>

### 🔵 **L2** Medium (8)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>calendar.CalculateDateInterval</code></b><br><sub>5月16号到6月29号隔了多少天</sub><br><code>extract</code> <code>reasoning</code></td><td><b>date1</b> <sub>string</sub> <code>5月16号</code><br><b>date2</b> <sub>string</sub> <code>6月29号</code><br><i>_interval</i> <sub>?</sub></td><td>calendar</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>calendar.CreateBirthdayEvent</code></b><br><sub>帮我在日历里记一下爸爸生日，设置个生日日程，日期是5月16号</sub><br><code>create</code></td><td><b>title</b> <sub>string</sub> <code>爸爸生日</code><br><b>date</b> <sub>string</sub> <code>5月16号</code></td><td>calendar</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>calendar.CreateEvent</code></b><br><sub>帮我在5月16号创建一个名为牙医复诊的日程</sub><br><code>create</code></td><td><b>date</b> <sub>string</sub> <code>5月16号</code><br><b>title</b> <sub>string</sub> <code>牙医复诊</code></td><td>calendar</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>calendar.DateCalcForward</code></b><br><sub>从5月16号往后数35天是几月几号</sub><br><code>extract</code> <code>reasoning</code></td><td><b>date</b> <sub>string</sub> <code>5月16号</code><br><b>days</b> <sub>int</sub> <code>35</code><br><i>_calc</i> <sub>?</sub></td><td>calendar</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">5</td><td><b><code>calendar.DeleteEvent</code></b><br><sub>帮我把团队周会那个日程删了</sub><br><code>edit</code></td><td><b>title</b> <sub>enum</sub> <code>团队周会</code></td><td>calendar</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">6</td><td><b><code>calendar.MakeupDayReminder</code></b><br><sub>看看今年春节放假结束后有没有补班，有就在那天创建一个名为补班提醒的日程，没有就直接告诉我不用</sub><br><code>create</code> <code>reasoning</code> <code>explore</code></td><td><b>holiday</b> <sub>enum</sub> <code>春节</code><br><b>title</b> <sub>string</sub> <code>补班提醒</code></td><td>calendar</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">7</td><td><b><code>calendar.QueryMakeupWorkday</code></b><br><sub>今年春节放假结束后第一个补班日是哪天</sub><br><code>extract</code> <code>reasoning</code> <code>explore</code></td><td><b>holiday</b> <sub>enum</sub> <code>春节</code></td><td>calendar</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">8</td><td><b><code>calendar.SearchEventTitle</code></b><br><sub>日历里关于项目的日程，最早的是哪个</sub><br><code>search</code> <code>extract</code></td><td><b>keyword</b> <sub>enum</sub> <code>项目</code></td><td>calendar</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🟡 **L3** Hard (7)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>calendar.CreateEventWithReminder</code></b><br><sub>5月16号有个安排，帮我创建一个名为出差提醒的日程，提前30分钟前提醒</sub><br><code>create</code> <code>settings</code></td><td><b>date</b> <sub>string</sub> <code>5月16号</code><br><b>title</b> <sub>string</sub> <code>出差提醒</code><br><b>reminder</b> <sub>enum</sub> <code>30分钟前</code></td><td>calendar</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>calendar.CreateTimedEvent</code></b><br><sub>5月16号09:00到10:30有个安排，帮我创建一个名为面试的日程</sub><br><code>create</code></td><td><b>date</b> <sub>string</sub> <code>5月16号</code><br><b>title</b> <sub>string</sub> <code>面试</code><br><b>start</b> <sub>string</sub> <code>09:00</code><br><b>end</b> <sub>string</sub> <code>10:30</code><br><i>_time_range</i> <sub>?</sub></td><td>calendar</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>calendar.DateCalcThenCreate</code></b><br><sub>从5月16号往后数35天是几号，顺手帮我在那天创建一个名为出发提醒的日程，最后告诉我具体是哪天</sub><br><code>create</code> <code>reasoning</code></td><td><b>date</b> <sub>string</sub> <code>5月16号</code><br><b>days</b> <sub>int</sub> <code>35</code><br><b>title</b> <sub>string</sub> <code>出发提醒</code><br><i>_calc</i> <sub>?</sub></td><td>calendar</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">4</td><td><b><code>calendar.EditEventTime</code></b><br><sub>把项目汇报那个日程改到11:00</sub><br><code>edit</code></td><td><b>title</b> <sub>enum</sub> <code>项目汇报</code><br><b>new_time</b> <sub>enum</sub> <code>11:00</code></td><td>calendar</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">5</td><td><b><code>calendar.QueryFirstEventOnDate</code></b><br><sub>5月16号最早的安排是什么，几点开始</sub><br><code>extract</code> <code>reasoning</code></td><td><b>date</b> <sub>string</sub> <code>5月16号</code></td><td>calendar</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">6</td><td><b><code>calendar.QueryHolidayLength</code></b><br><sub>今年春节一共放几天假</sub><br><code>extract</code> <code>reasoning</code> <code>explore</code></td><td><b>holiday</b> <sub>enum</sub> <code>春节</code></td><td>calendar</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">7</td><td><b><code>calendar.SearchDeleteAll</code></b><br><sub>帮我把日历里所有和项目有关的日程都删掉，删完告诉我一共删了几个</sub><br><code>search</code> <code>delete</code> <code>reasoning</code> <code>extract</code></td><td><b>keyword</b> <sub>enum</sub> <code>项目</code></td><td>calendar</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>deep_dive</code></td></tr>
</table>

### 🔴 **L4** Expert (3)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>calendar.CompareScheduleDensity</code></b><br><sub>5月16号和5月27号哪天安排更多</sub><br><code>extract</code> <code>reasoning</code></td><td><b>date1</b> <sub>string</sub> <code>5月16号</code><br><b>date2</b> <sub>string</sub> <code>5月27号</code><br><i>_dates</i> <sub>?</sub></td><td>calendar</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">2</td><td><b><code>calendar.CreateEventWithAlarmAndConfirm</code></b><br><sub>5月16号的晚上6点半到8点，帮我在日历里安排一个日程叫&quot;面试&quot;，再顺手加个提前30分钟提醒，闹钟提醒打开。</sub><br><code>create</code> <code>settings</code></td><td><b>date</b> <sub>string</sub> <code>5月16号</code><br><b>title</b> <sub>string</sub> <code>面试</code></td><td>calendar</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>calendar.EditAndReportNewTime</code></b><br><sub>把团队周会改到5月16号 10:30，改完告诉我新的结束时间</sub><br><code>edit</code> <code>reasoning</code></td><td><b>title</b> <sub>enum</sub> <code>团队周会</code><br><b>new_date</b> <sub>string</sub> <code>5月16号</code><br><b>new_time</b> <sub>enum</sub> <code>10:30</code></td><td>calendar</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>deep_dive</code></td></tr>
</table>

---

## 📦 clock

> **18** 个任务 · **带参数 15** · 🟢 L1×1 🔵 L2×9 🟡 L3×5 🔴 L4×3

### 🟢 **L1** Easy (1)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>clock.ToggleAlarm</code></b><br><sub>关闭04:30的闹钟</sub><br><code>edit</code></td><td><i>alarm_id</i> <sub>string</sub> <code>a1</code><br><b>time</b> <sub>string</sub> <code>04:30</code><br><b>toggle</b> <sub>bool</sub> <code>关闭</code><br><i>_alarm</i> <sub>?</sub></td><td>clock</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>atomic</code></td></tr>
</table>

### 🔵 **L2** Medium (9)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>clock.AddAlarm</code></b><br><sub>帮我设一个07:10的闹钟</sub><br><code>create</code></td><td><b>time</b> <sub>string</sub> <code>07:10</code><br><i>hour</i> <sub>int</sub> <code>7</code><br><i>minute</i> <sub>int</sub> <code>10</code><br><i>_time</i> <sub>?</sub></td><td>clock</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>clock.AddCityAndCheckTime</code></b><br><sub>在世界时钟里加上北京，然后告诉我那边现在几点</sub><br><code>nav</code> <code>search</code> <code>extract</code></td><td><b>city</b> <sub>string</sub> <code>北京</code><br><i>_city</i> <sub>?</sub></td><td>clock</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>clock.AddCityAndCompareTimeDiff</code></b><br><sub>把北京加到世界时钟，然后告诉我北京和巴黎差几个小时</sub><br><code>nav</code> <code>search</code> <code>extract</code> <code>reasoning</code></td><td><b>new_city</b> <sub>string</sub> <code>北京</code><br><b>existing_city</b> <sub>string</sub> <code>巴黎</code><br><i>_cities</i> <sub>?</sub></td><td>clock</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">4</td><td><b><code>clock.AddWorldCity</code></b><br><sub>在世界时钟里添加北京</sub><br><code>nav</code> <code>search</code></td><td><b>city</b> <sub>string</sub> <code>北京</code><br><i>_city</i> <sub>?</sub></td><td>clock</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">5</td><td><b><code>clock.CheckAlarmNote</code></b><br><sub>时钟里04:30的闹钟备注写的什么</sub><br><code>extract</code></td><td><i>alarm_id</i> <sub>string</sub> <code>a1</code><br><b>time</b> <sub>string</sub> <code>04:30</code><br><i>_alarm</i> <sub>?</sub></td><td>clock</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">6</td><td><b><code>clock.CompareCityTimeDiff</code></b><br><sub>巴黎和纽约现在差几个小时</sub><br><code>extract</code> <code>reasoning</code></td><td><b>city1</b> <sub>string</sub> <code>巴黎</code><br><b>city2</b> <sub>string</sub> <code>纽约</code><br><i>_cities</i> <sub>?</sub></td><td>clock</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">7</td><td><b><code>clock.DeleteAlarm</code></b><br><sub>帮我把04:30的闹钟删掉</sub><br><code>edit</code></td><td><i>alarm_id</i> <sub>string</sub> <code>a1</code><br><b>time</b> <sub>string</sub> <code>04:30</code><br><i>_alarm</i> <sub>?</sub></td><td>clock</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">8</td><td><b><code>clock.RemoveWorldCity</code></b><br><sub>把伦敦从世界时钟里删掉</sub><br><code>edit</code></td><td><b>city</b> <sub>string</sub> <code>伦敦</code><br><i>_city</i> <sub>?</sub></td><td>clock</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">9</td><td><b><code>clock.SetAlarmRepeat</code></b><br><sub>把04:30的闹钟改成每天</sub><br><code>edit</code></td><td><i>alarm_id</i> <sub>string</sub> <code>a1</code><br><b>time</b> <sub>string</sub> <code>04:30</code><br><b>repeat</b> <sub>enum</sub> <code>每天</code><br><i>_alarm</i> <sub>?</sub></td><td>clock</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🟡 **L3** Hard (5)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>clock.CheckCityTime</code></b><br><sub>帮我看看世界时钟里巴黎现在几点</sub><br><code>extract</code></td><td><b>city</b> <sub>string</sub> <code>巴黎</code><br><i>_city</i> <sub>?</sub></td><td>clock</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>clock.CityLocalTimeDiff</code></b><br><sub>世界时钟里巴黎比咱们这儿快还是慢，差多久</sub><br><code>extract</code> <code>reasoning</code></td><td><b>city</b> <sub>string</sub> <code>巴黎</code><br><i>_city</i> <sub>?</sub></td><td>clock</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>clock.CountAlarms</code></b><br><sub>时钟里一共有几个闹钟</sub><br><code>extract</code></td><td>—</td><td>clock</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">4</td><td><b><code>clock.LatestTimezoneCity</code></b><br><sub>世界时钟里的城市，哪个现在时间最晚</sub><br><code>extract</code> <code>reasoning</code></td><td>—</td><td>clock</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">5</td><td><b><code>clock.SetupMorningAlarms</code></b><br><sub>帮我设两个起床闹钟：07:10的设成每天，07:20的设成周一至周五</sub><br><code>create</code></td><td><b>time1</b> <sub>string</sub> <code>07:10</code><br><i>h1</i> <sub>int</sub> <code>7</code><br><i>m1</i> <sub>int</sub> <code>10</code><br><b>time2</b> <sub>string</sub> <code>07:20</code><br><i>h2</i> <sub>int</sub> <code>7</code><br><i>m2</i> <sub>int</sub> <code>20</code><br><b>repeat1</b> <sub>enum</sub> <code>每天</code><br><b>repeat2</b> <sub>enum</sub> <code>周一至周五</code><br><i>_times</i> <sub>?</sub></td><td>clock</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🔴 **L4** Expert (3)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>clock.AddAlarmWithSettings</code></b><br><sub>设一个07:10的闹钟，重复模式每天，备注写“晨练”</sub><br><code>create</code></td><td><b>time</b> <sub>string</sub> <code>07:10</code><br><i>hour</i> <sub>int</sub> <code>7</code><br><i>minute</i> <sub>int</sub> <code>10</code><br><b>repeat</b> <sub>enum</sub> <code>每天</code><br><b>note</b> <sub>enum</sub> <code>晨练</code><br><i>_time</i> <sub>?</sub></td><td>clock</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>clock.EnableAllAlarms</code></b><br><sub>帮我把时钟里所有闹钟都打开</sub><br><code>edit</code></td><td>—</td><td>clock</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>clock.ReorganizeWorldClock</code></b><br><sub>把世界时钟里的伦敦删掉，换成北京</sub><br><code>edit</code> <code>search</code></td><td><b>remove_city</b> <sub>string</sub> <code>伦敦</code><br><b>add_city</b> <sub>string</sub> <code>北京</code><br><i>_cities</i> <sub>?</sub></td><td>clock</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

---

## 🛍️ crossapp_commerce

> **20** 个任务 · **带参数 15** · 🔵 L2×2 🟡 L3×6 🔴 L4×12

### 🔵 **L2** Medium (2)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>crossapp_commerce.AlipayBalanceToWechat</code></b><br><sub>查一下我支付宝余额，发微信告诉陈静</sub><br><code>extract</code> <code>handoff</code></td><td><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>alipay, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">2</td><td><b><code>crossapp_commerce.AlipayShareBillDetail</code></b><br><sub>在支付宝看最近一笔支出账单，把交易标题和交易金额微信发给陈静</sub><br><code>extract</code> <code>handoff</code></td><td><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>alipay, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
</table>

### 🟡 **L3** Hard (6)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>crossapp_commerce.AlipayMonthlySpendToWechat</code></b><br><sub>看看我支付宝这个月花了多少钱，发微信告诉陈静</sub><br><code>extract</code> <code>handoff</code></td><td><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>alipay, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">2</td><td><b><code>crossapp_commerce.AlipayMonthlyToNotesAndWechat</code></b><br><sub>查支付宝这个月总支出，在笔记新建一条记录，再发微信告诉陈静花了多少</sub><br><code>extract</code> <code>create</code> <code>handoff</code></td><td><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>alipay, notes, wechat</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">3</td><td><b><code>crossapp_commerce.AlipayRecentTransactionsToNotes</code></b><br><sub>查看我支付宝最近5笔交易，在笔记里记录每笔的金额和交易内容</sub><br><code>extract</code> <code>create</code> <code>handoff</code></td><td>—</td><td>alipay, notes</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">4</td><td><b><code>crossapp_commerce.AlipayYearCompareTopExpenseToWechat</code></b><br><sub>比较我支付宝去年支出最高的一笔和今年支出最高的一笔，哪个金额更大，把较大的金额和交易对象名称微信发给“陈静”。</sub><br><code>extract</code> <code>reasoning</code> <code>handoff</code></td><td><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>alipay, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">5</td><td><b><code>crossapp_commerce.EbayDualItemCompareToNotes</code></b><br><sub>分别在eBay搜电脑和电视的最低价，在笔记里记下哪个更便宜、便宜多少</sub><br><code>search</code> <code>reasoning</code> <code>create</code></td><td><b>item1</b> <sub>string</sub> <code>电脑</code><br><b>item2</b> <sub>string</sub> <code>电视</code><br><i>_items</i> <sub>?</sub></td><td>ebay, notes</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">6</td><td><b><code>crossapp_commerce.EbayLowestPriceToNotes</code></b><br><sub>在eBay搜电风扇，找到最便宜的那个，把标题和价格记到笔记里</sub><br><code>search</code> <code>create</code> <code>handoff</code></td><td><b>query</b> <sub>enum</sub> <code>电风扇</code></td><td>ebay, notes</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
</table>

### 🔴 **L4** Expert (12)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>crossapp_commerce.AlipayLargestExpenseToMoments</code></b><br><sub>翻翻支付宝账单，找到花钱最多的那笔，发条朋友圈吐槽一下</sub><br><code>extract</code> <code>reasoning</code> <code>social</code> <code>handoff</code></td><td>—</td><td>alipay, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">2</td><td><b><code>crossapp_commerce.AlipayLargestExpenseToNotes</code></b><br><sub>查查支付宝交易记录里支出金额最大的一笔是什么、花了多少钱，在笔记里记录下来，提醒自己控制开支</sub><br><code>extract</code> <code>reasoning</code> <code>create</code></td><td>—</td><td>alipay, notes</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">3</td><td><b><code>crossapp_commerce.AlipayThankTopIncomeTransfer</code></b><br><sub>在支付宝看看我一共收到过多少笔转账，其中最高的一笔是谁转给我的，转了多少钱，把转账笔数和最高金额依次分行记到笔记里，然后去微信谢谢他。</sub><br><code>extract</code> <code>reasoning</code> <code>create</code> <code>handoff</code></td><td>—</td><td>alipay, notes, wechat</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">4</td><td><b><code>crossapp_commerce.BillTypeYearSummaryToWechat</code></b><br><sub>去支付宝账单里查一下&quot;订单&quot;类型今年一共有多少笔，花了多少钱，微信告诉陈静。</sub><br><code>extract</code> <code>reasoning</code> <code>handoff</code></td><td><b>bill_type</b> <sub>string</sub> <code>订单</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>alipay, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">5</td><td><b><code>crossapp_commerce.EbayBalanceDiffToNotes</code></b><br><sub>在eBay查一下最便宜的全新电风扇，看看我用支付宝余额买的话还剩多少钱，在笔记把这个商品、价格和剩余余额写下来</sub><br><code>search</code> <code>extract</code> <code>reasoning</code> <code>create</code></td><td><b>query</b> <sub>enum</sub> <code>电风扇</code></td><td>ebay, alipay, notes</td><td align="center"><code>S3</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">6</td><td><b><code>crossapp_commerce.EbayDualItemBalanceToNotes</code></b><br><sub>分别在eBay搜电脑和电视最便宜的，看看都买的话支付宝还剩多少钱，在笔记里记下两个商品名、各自价格和剩余余额</sub><br><code>search</code> <code>extract</code> <code>reasoning</code> <code>create</code></td><td><b>item1</b> <sub>string</sub> <code>电脑</code><br><b>item2</b> <sub>string</sub> <code>电视</code><br><i>_items</i> <sub>?</sub></td><td>ebay, alipay, notes</td><td align="center"><code>S3</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">7</td><td><b><code>crossapp_commerce.EbayPriceBelowBudgetToNotes</code></b><br><sub>帮我在Ebay看看相机现在最便宜要多少钱，如果低于我的预算1000.0元就记到备忘录里。</sub><br><code>search</code> <code>reasoning</code> <code>create</code></td><td><b>product</b> <sub>string</sub> <code>相机</code><br><b>price_limit</b> <sub>float</sub> <code>1000.0</code></td><td>ebay, notes</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">8</td><td><b><code>crossapp_commerce.EbayProductShareToWechat</code></b><br><sub>帮我在eBay找最便宜的全新电风扇，把商品名称和价格(包含运费)微信发给陈静，问问他觉得怎么样</sub><br><code>search</code> <code>extract</code> <code>handoff</code></td><td><b>query</b> <sub>enum</sub> <code>电风扇</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>ebay, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">9</td><td><b><code>crossapp_commerce.FinancialReportToNotes</code></b><br><sub>帮我查一下支付宝的余额和最近一笔消费，记到笔记里。</sub><br><code>extract</code> <code>finance</code> <code>create</code> <code>handoff</code></td><td>—</td><td>alipay, notes</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">10</td><td><b><code>crossapp_commerce.FullShoppingDecisionFlow</code></b><br><sub>帮我在eBay找最便宜的全新电风扇，看购买后支付宝余额还剩下多少，在笔记记录下商品和余额，然后给微信陈静发消息看他要不要一起买这款商品</sub><br><code>search</code> <code>create</code> <code>reasoning</code> <code>handoff</code></td><td><b>query</b> <sub>enum</sub> <code>电风扇</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>ebay, alipay, notes, wechat</td><td align="center"><code>S3</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">11</td><td><b><code>crossapp_commerce.MonthCompareThenExplainToNote</code></b><br><sub>你去支付宝看一下，2026年1月和2025年12月哪个月总花销更高，顺便把差额也算出来。然后在笔记新建一条&quot;月度花销对比&quot;，写上两个月的各自花销、哪个月花得更多、差多少。</sub><br><code>extract</code> <code>reasoning</code> <code>create</code></td><td><b>month1</b> <sub>string</sub> <code>2026年1月</code><br><b>month2</b> <sub>string</sub> <code>2025年12月</code></td><td>alipay, notes</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">12</td><td><b><code>crossapp_commerce.Top3ExpenseSummaryToWechat</code></b><br><sub>去支付宝看看最近30天里金额最大的3笔支出分别是什么，把交易标题和金额发微信告诉黄勇，最后一句加上&quot;我最近得省着点了&quot;。</sub><br><code>extract</code> <code>reasoning</code> <code>handoff</code></td><td><b>contact</b> <sub>string</sub> <code>黄勇</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>alipay, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>deep_dive</code></td></tr>
</table>

---

## 📰 crossapp_content

> **30** 个任务 · **带参数 25** · 🔵 L2×3 🟡 L3×10 🔴 L4×17

### 🔵 **L2** Medium (3)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>crossapp_content.NotesContentToRedbookAndX</code></b><br><sub>在笔记里写一段关于AI代理的想法，然后分别在小红书和X上发布出来</sub><br><code>create</code> <code>handoff</code></td><td><b>topic</b> <sub>string</sub> <code>AI代理</code></td><td>notes, redbook, x</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">2</td><td><b><code>crossapp_content.SpotifyNowPlayingToWechat</code></b><br><sub>把 Spotify 当前播放的歌加入喜欢，再把歌名微信发给陈静</sub><br><code>extract</code> <code>social</code> <code>handoff</code></td><td><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>spotify, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">3</td><td><b><code>crossapp_content.SpotifySaveCurrentSongToNotes</code></b><br><sub>把 Spotify 正在播放的歌名和歌手记到笔记里</sub><br><code>extract</code> <code>create</code> <code>handoff</code></td><td>—</td><td>spotify, notes</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
</table>

### 🟡 **L3** Hard (10)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>crossapp_content.BilibiliRankAuthorLastNovToWechat</code></b><br><sub>看看B站“舞蹈”分区排行榜第 10 名作者去年 11月发过多少个视频，把粉丝数量和发过的视频数量、这里面播放量最多的视频名称发给微信联系人“陈静”。</sub><br><code>extract</code> <code>reasoning</code> <code>handoff</code></td><td><b>category</b> <sub>enum</sub> <code>舞蹈</code><br><b>rank</b> <sub>enum</sub> <code>10</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>bilibili, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">2</td><td><b><code>crossapp_content.BilibiliRankingToWechat</code></b><br><sub>看看B站全站区排行榜第1名是什么视频，把标题微信发给陈静</sub><br><code>extract</code> <code>handoff</code></td><td><b>partition</b> <sub>enum</sub> <code>全站</code><br><b>rank</b> <sub>int</sub> <code>1</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>bilibili, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">3</td><td><b><code>crossapp_content.BilibiliTripleLikeThenMoments</code></b><br><sub>在B站全站排行榜找到第1名给它一键三连，然后发个纯文字朋友圈推荐这个视频</sub><br><code>social</code> <code>create</code> <code>handoff</code></td><td><b>partition</b> <sub>enum</sub> <code>全站</code><br><b>rank</b> <sub>int</sub> <code>1</code></td><td>bilibili, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>crossapp_content.EbayCheapToRedbook</code></b><br><sub>帮我在 eBay 看看电风扇里最便宜的那款，然后发一篇小红书商品推荐笔记。</sub><br><code>search</code> <code>create</code> <code>handoff</code></td><td><b>product</b> <sub>enum</sub> <code>电风扇</code></td><td>ebay, redbook</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">5</td><td><b><code>crossapp_content.RedbookAuthorFollowersToWechat</code></b><br><sub>在小红书搜'数分'，关注第一篇笔记的作者，并将作者名字和粉丝数微信发给陈静</sub><br><code>search</code> <code>extract</code> <code>social</code> <code>handoff</code></td><td><b>keyword</b> <sub>enum</sub> <code>数分</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>redbook, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">6</td><td><b><code>crossapp_content.RedbookDmThenWechatReport</code></b><br><sub>给小红书上我关注的'西柚慢行'发私信'你好呀'，然后在微信告诉陈静已经联系他了</sub><br><code>social</code> <code>handoff</code></td><td><b>username</b> <sub>enum</sub> <code>西柚慢行</code><br><b>message</b> <sub>string</sub> <code>你好呀</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>redbook, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">7</td><td><b><code>crossapp_content.RedbookSearchTitleToWechat</code></b><br><sub>在小红书搜'数分'，把第一篇笔记的标题微信发给陈静</sub><br><code>search</code> <code>extract</code> <code>handoff</code></td><td><b>keyword</b> <sub>enum</sub> <code>数分</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>redbook, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">8</td><td><b><code>crossapp_content.RedbookUserTopCollectToWechat</code></b><br><sub>查看小红书用户“铁铁健身日记”的主页，找到点赞数最高的那篇帖子，收藏它，把它的标题和作者的获赞与收藏数微信发给“陈静”。</sub><br><code>search</code> <code>extract</code> <code>social</code> <code>handoff</code></td><td><b>user</b> <sub>enum</sub> <code>铁铁健身日记</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>redbook, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">9</td><td><b><code>crossapp_content.WechatReadingBestBookToWechat</code></b><br><sub>帮我在微信读书历史分类下找推荐值最高的书，把书名和推荐值微信发给陈静</sub><br><code>search</code> <code>extract</code> <code>handoff</code></td><td><b>category</b> <sub>enum</sub> <code>历史</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>wechat_reading, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">10</td><td><b><code>crossapp_content.WechatReadingShareBookList</code></b><br><sub>把微信读书书架前3本书的名字微信发给陈静</sub><br><code>extract</code> <code>handoff</code> <code>reasoning</code></td><td><b>n</b> <sub>int</sub> <code>3</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>wechat_reading, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
</table>

### 🔴 **L4** Expert (17)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>crossapp_content.BilibiliRankTop3FolderAndWechat</code></b><br><sub>把 B 站“娱乐”分区排行榜前 20 名中播放量最多的三个视频收藏到名叫热门视频的新建收藏夹里面，然后把其中播放量最高的视频名称和播放量微信发给“陈静”。</sub><br><code>extract</code> <code>create</code> <code>social</code> <code>handoff</code></td><td><b>category</b> <sub>enum</sub> <code>娱乐</code><br><b>rank</b> <sub>enum</sub> <code>20</code><br><b>folder</b> <sub>enum</sub> <code>热门视频</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>bilibili, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>crossapp_content.CulturalChecklistToRedbook</code></b><br><sub>看看Spotify我今天最早听的那首歌是什么，再看看微信读书热搜第一本书叫什么，在笔记里记一份'今日文化清单'，然后在小红书发一篇笔记分享</sub><br><code>extract</code> <code>create</code> <code>handoff</code></td><td>—</td><td>spotify, wechat_reading, notes, redbook</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">3</td><td><b><code>crossapp_content.DailyLogToMoments</code></b><br><sub>把我笔记里最新两条笔记简单汇总一下，发一条朋友圈。</sub><br><code>extract</code> <code>reasoning</code> <code>social</code> <code>handoff</code></td><td>—</td><td>notes, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">4</td><td><b><code>crossapp_content.FavoriteWaterSceneryPhotos</code></b><br><sub>打开相册，把所有具有水景观的照片都收藏起来，并把其中最新的一张微信发给陈静。</sub><br><code>image</code> <code>edit</code> <code>handoff</code></td><td><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>gallery, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">5</td><td><b><code>crossapp_content.FileManagerSendFileToWechatContact</code></b><br><sub>我有一张图片分别在两个目录下各有一张不同名的副本，帮我找出他们，并把这两个文件名发给微信联系人陈静</sub><br><code>extract</code> <code>social</code> <code>handoff</code></td><td><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>file_manager, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">6</td><td><b><code>crossapp_content.NotesToWechatAndRedbook</code></b><br><sub>把包含&quot;今天心情很好&quot;的内容记到笔记后，再用微信同步发给王芳，并发布一条对应的小红书笔记。</sub><br><code>create</code> <code>social</code> <code>handoff</code></td><td><b>text_keyword</b> <sub>string</sub> <code>今天心情很好</code><br><b>contact</b> <sub>string</sub> <code>王芳</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>notes, wechat, redbook</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">7</td><td><b><code>crossapp_content.ReadingPlanToNotes</code></b><br><sub>看看微信读书里我正在读的书，然后在笔记里制定一个本周的阅读计划。</sub><br><code>extract</code> <code>create</code> <code>handoff</code></td><td>—</td><td>wechat_reading, notes</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">8</td><td><b><code>crossapp_content.RedbookAuthorTopCollectToWechat</code></b><br><sub>在小红书搜索“旅行”，把前 10 篇帖子中点赞最多的一个帖子的作者主页发过的收藏最多的帖子的标题和这个作者的昵称和获赞与收藏数微信发给“陈静”。</sub><br><code>search</code> <code>extract</code> <code>reasoning</code> <code>handoff</code></td><td><b>query</b> <sub>enum</sub> <code>旅行</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>redbook, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">9</td><td><b><code>crossapp_content.RedbookFollowingNoteCountToSms</code></b><br><sub>查小红书我关注的'西柚慢行'发了多少篇笔记，发短信告诉张三</sub><br><code>extract</code> <code>handoff</code></td><td><b>username</b> <sub>enum</sub> <code>西柚慢行</code><br><b>contact</b> <sub>enum</sub> <code>张三</code></td><td>redbook, sms</td><td align="center"><code>S2</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">10</td><td><b><code>crossapp_content.RedbookTopLikedToNotes</code></b><br><sub>在小红书搜索“旅行”，把前 10 篇帖子中点赞最多的两篇的标题写到笔记，一行一条。</sub><br><code>search</code> <code>reasoning</code> <code>create</code> <code>handoff</code></td><td><b>query</b> <sub>enum</sub> <code>旅行</code></td><td>redbook, notes</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">11</td><td><b><code>crossapp_content.RedbookUserBestWorstToNotes</code></b><br><sub>把小红书用户“铁铁健身日记”发过的帖子里，点赞数最高的那篇帖子和收藏数最低的那篇帖子的标题都写到笔记里，一行一条。</sub><br><code>search</code> <code>reasoning</code> <code>create</code> <code>handoff</code></td><td><b>user</b> <sub>enum</sub> <code>铁铁健身日记</code></td><td>redbook, notes</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">12</td><td><b><code>crossapp_content.SpotifySongFullDetailsToRedbook</code></b><br><sub>在Spotify搜'搁浅'查下是谁唱的、几分钟，在小红书发一篇听歌笔记把这些写进去</sub><br><code>search</code> <code>extract</code> <code>create</code> <code>handoff</code></td><td><b>song</b> <sub>enum</sub> <code>搁浅</code></td><td>spotify, redbook</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">13</td><td><b><code>crossapp_content.SpotifyTodayNthPlayToRedbook</code></b><br><sub>查看我今天在 Spotify 听的第一首歌，在小红书发一篇推荐笔记，标题或正文包含歌名和艺人</sub><br><code>extract</code> <code>create</code> <code>handoff</code></td><td><b>nth</b> <sub>enum</sub> <code>一</code></td><td>spotify, redbook</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">14</td><td><b><code>crossapp_content.ThirdSpotifyPlayRecommendOnRedbookAndPlaylist</code></b><br><sub>看一下我今天在Spotify听的第三首歌是什么，然后去小红书发一条推荐，正文里带上歌名和歌手；发完以后再把这首歌加进一个新歌单&quot;今天爱听&quot;。</sub><br><code>extract</code> <code>create</code> <code>handoff</code></td><td><b>playlist</b> <sub>string</sub> <code>今天爱听</code></td><td>spotify, redbook</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">15</td><td><b><code>crossapp_content.WechatReadingStatsToWechat</code></b><br><sub>查微信读书最近一周内阅读时长最多的一天是哪天读了多久，告诉微信好友陈静</sub><br><code>extract</code> <code>handoff</code></td><td><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>wechat_reading, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">16</td><td><b><code>crossapp_content.WeeklyReadingAndLikedSpotifySongsToMoment</code></b><br><sub>帮我看微信读书最近一周哪天读得最久，再把Spotify今天听过且已经点赞的歌的歌名和作者汇总一下，最后发条朋友圈，把&quot;最近阅读最投入的一天&quot;和&quot;现在在听的歌&quot;都带上。</sub><br><code>create</code> <code>reasoning</code> <code>social</code> <code>handoff</code></td><td>—</td><td>wechat_reading, spotify, wechat</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">17</td><td><b><code>crossapp_content.XLatestPostToReddit_WithTitleFormat</code></b><br><sub>把 X 用户 elonmusk 最新一条推文的文字内容，以&quot;elonmusk:&quot;开头发到 Reddit 的 r/China_irl。</sub><br><code>extract</code> <code>create</code> <code>social</code> <code>handoff</code></td><td><b>user</b> <sub>string</sub> <code>elonmusk</code><br><b>subreddit</b> <sub>enum</sub> <code>China_irl</code></td><td>x, reddit</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
</table>

---

## 🌤️ crossapp_life

> **33** 个任务 · **带参数 31** · 🔵 L2×1 🟡 L3×15 🔴 L4×17

### 🔵 **L2** Medium (1)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>crossapp_life.WeatherFilterNonRainyDays</code></b><br><sub>查北京未来五天天气，把不下雨的日期记在笔记里，标题写'适合出行的日子'</sub><br><code>extract</code> <code>create</code> <code>handoff</code></td><td><b>city</b> <sub>enum</sub> <code>北京</code></td><td>weather, notes</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
</table>

### 🟡 **L3** Hard (15)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>crossapp_life.CalendarEventToWechat</code></b><br><sub>看看日历明天有什么安排，把第一个事件的主题和时间发给微信好友陈静</sub><br><code>extract</code> <code>handoff</code></td><td><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>calendar, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">2</td><td><b><code>crossapp_life.CalendarFreeWeatherInvite</code></b><br><sub>看看日历下周末哪天没安排，查那天北京天气，有一天没有安排而且不下雨就给陈静发消息约出去玩</sub><br><code>extract</code> <code>reasoning</code> <code>handoff</code></td><td><b>city</b> <sub>enum</sub> <code>北京</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>calendar, weather, wechat</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">3</td><td><b><code>crossapp_life.MapPlaceToWechat</code></b><br><sub>帮我在地图上搜一下故宫的地址，发给微信好友陈静</sub><br><code>search</code> <code>handoff</code></td><td><b>place</b> <sub>enum</sub> <code>故宫</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>map, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">4</td><td><b><code>crossapp_life.RailwayDestWeatherQuery</code></b><br><sub>我买了张去上海的火车票，帮我查一下到达那天上海的天气和温度</sub><br><code>extract</code> <code>handoff</code></td><td><b>city</b> <sub>enum</sub> <code>上海</code></td><td>railway12306, weather</td><td align="center"><code>S2</code></td><td align="center"><code>query</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">5</td><td><b><code>crossapp_life.RailwayTomorrowMomBookingToWechat</code></b><br><sub>我妈妈明天要从上海 来 南京，在12306 查一下车票，把最早一趟高铁的车次号发给她</sub><br><code>search</code> <code>extract</code> <code>reasoning</code> <code>handoff</code></td><td><b>from_city</b> <sub>string</sub> <code>上海</code><br><b>to_city</b> <sub>string</sub> <code>南京</code><br><i>_route</i> <sub>?</sub></td><td>railway12306, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">6</td><td><b><code>crossapp_life.RailwayTrainInfoToWechat</code></b><br><sub>帮我查2026-05-16从上海到南京最早的高铁，把车次和发车时间发给微信好友陈静</sub><br><code>search</code> <code>extract</code> <code>handoff</code></td><td><b>from_station</b> <sub>string</sub> <code>上海</code><br><b>to_station</b> <sub>string</sub> <code>南京</code><br><i>_route</i> <sub>?</sub><br><b>date</b> <sub>string</sub> <code>2026-05-16</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>railway12306, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">7</td><td><b><code>crossapp_life.RailwayWeatherToWechat</code></b><br><sub>查2026-05-16从北京到上海的最早高铁和上海那天天气，把车次和天气一起发给陈静</sub><br><code>search</code> <code>extract</code> <code>handoff</code></td><td><b>city</b> <sub>enum</sub> <code>上海</code><br><b>from_station</b> <sub>enum</sub> <code>北京</code><br><b>date</b> <sub>string</sub> <code>2026-05-16</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>railway12306, weather, wechat</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">8</td><td><b><code>crossapp_life.RealisticTrip001</code></b><br><sub>我后天想去上海出差，你先帮我看那天杭州到上海最早的高铁，再看看上海天气。如果不下雨，就把车次和天气写进一个标题为 上海出差备忘 的笔记里，再微信告诉陈静我几点到，让她安排接站；如果下雨，就在消息里提醒她来时带伞。</sub><br><code>search</code> <code>reasoning</code> <code>create</code> <code>handoff</code></td><td><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>railway12306, weather, notes, wechat</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">9</td><td><b><code>crossapp_life.RestaurantRatingInviteCalendar</code></b><br><sub>在地图搜沸腾鱼乡西直门分店看看评分，超过4.0分就给陈静发微信约今晚去吃，顺便在日历建个聚餐日程</sub><br><code>search</code> <code>reasoning</code> <code>handoff</code> <code>create</code></td><td><b>restaurant</b> <sub>enum</sub> <code>沸腾鱼乡西直门分店</code><br><b>rating</b> <sub>enum</sub> <code>4.0</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>map, wechat, calendar</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">10</td><td><b><code>crossapp_life.TravelPlanToWechat</code></b><br><sub>帮我查一下中国国家博物馆的详细地址和那边城市的当前天气，一起微信发给陈静。</sub><br><code>search</code> <code>extract</code> <code>handoff</code></td><td><b>dest</b> <sub>string</sub> <code>中国国家博物馆</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>map, weather, wechat</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">11</td><td><b><code>crossapp_life.TripMemoAndNotify</code></b><br><sub>2026-05-16从北京去上海出差，查最快的高铁和当天天气，在笔记记个出行备忘，发微信通知陈静接站</sub><br><code>search</code> <code>extract</code> <code>create</code> <code>handoff</code></td><td><b>city</b> <sub>enum</sub> <code>上海</code><br><b>from_station</b> <sub>enum</sub> <code>北京</code><br><b>date</b> <sub>string</sub> <code>2026-05-16</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>railway12306, weather, notes, wechat</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">12</td><td><b><code>crossapp_life.WeatherCalendar_CreateEventIfNotSunny</code></b><br><sub>查询 北京 的天气，如果不是晴天，则在日历中创建一个全天日程，标题为 带伞，并在备注中写入当前的温度和天气状况。</sub><br><code>extract</code> <code>create</code> <code>handoff</code></td><td><b>city</b> <sub>string</sub> <code>北京</code><br><b>event_title</b> <sub>string</sub> <code>带伞</code></td><td>weather, calendar</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">13</td><td><b><code>crossapp_life.WeatherFirstNonRainyToCalendarAndSms</code></b><br><sub>在“北京”未来一周里找第一个不下雨的日期，在日历上新建“户外跑步”事件，并短信告知“张三”这一天的日期和天气，约他一起跑步。</sub><br><code>extract</code> <code>reasoning</code> <code>create</code> <code>handoff</code></td><td><b>city</b> <sub>enum</sub> <code>北京</code><br><b>contact</b> <sub>enum</sub> <code>张三</code></td><td>weather, calendar, sms</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">14</td><td><b><code>crossapp_life.WeatherRainBranchNotify</code></b><br><sub>北京明天要是下雨，给陈静发消息提醒带伞；不下雨就说'明天天气不错'</sub><br><code>extract</code> <code>reasoning</code> <code>handoff</code></td><td><b>city</b> <sub>enum</sub> <code>北京</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>weather, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">15</td><td><b><code>crossapp_life.WeekendTripFullPlan</code></b><br><sub>看看下周六北京下不下雨，不下雨就查开车去颐和园要多久，在日历建个标题出游的日程，发微信约陈静一起去</sub><br><code>extract</code> <code>search</code> <code>create</code> <code>handoff</code></td><td><b>city</b> <sub>enum</sub> <code>北京</code><br><b>destination</b> <sub>enum</sub> <code>颐和园</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>weather, map, calendar, wechat</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
</table>

### 🔴 **L4** Expert (17)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>crossapp_life.FullTripPlanWeatherDriven</code></b><br><sub>我想去上海出差，查未来两周里第一个不下雨且日历没有安排的日期，给我买从北京出发的最早高铁提交订单即可，并设一个出发前一小时的闹钟</sub><br><code>extract</code> <code>reasoning</code> <code>search</code> <code>create</code></td><td><b>city</b> <sub>enum</sub> <code>上海</code><br><b>from_station</b> <sub>enum</sub> <code>北京</code></td><td>weather, railway12306, calendar, clock</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">2</td><td><b><code>crossapp_life.MapNearbyBestToWechat</code></b><br><sub>在地图搜2公里内评分最高的咖啡馆，把名字、评分和地址微信发给陈静，评分一样的话优先最近的</sub><br><code>search</code> <code>extract</code> <code>handoff</code></td><td><b>radius</b> <sub>enum</sub> <code>2公里</code><br><b>category</b> <sub>enum</sub> <code>咖啡馆</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>map, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">3</td><td><b><code>crossapp_life.MapRatingConditionBuyTicket</code></b><br><sub>帮我在地图看看故宫的评分，如果超过4分就买明天从上海过去的最早高铁，提交订单即可。</sub><br><code>search</code> <code>reasoning</code> <code>extract</code></td><td><b>place</b> <sub>enum</sub> <code>故宫</code><br><b>from_station</b> <sub>string</sub> <code>上海</code></td><td>map, railway12306</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">4</td><td><b><code>crossapp_life.OpenedFridgeFoodsToMom</code></b><br><sub>相册里有我拍的冰箱照片，去看看现在有哪些开了还没吃完的东西，微信发消息提醒妈妈记得吃。</sub><br><code>image</code> <code>reasoning</code> <code>handoff</code></td><td>—</td><td>wechat, gallery</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">5</td><td><b><code>crossapp_life.RailwayBalanceConditionalBuyNotify</code></b><br><sub>查2026-05-16从北京到上海最便宜的高铁票，看支付宝余额够不够，够就直接买票提交订单，微信告诉陈静我要去上海，不够就告诉TA没钱了</sub><br><code>search</code> <code>reasoning</code> <code>extract</code> <code>handoff</code></td><td><b>city</b> <sub>enum</sub> <code>上海</code><br><b>from_station</b> <sub>enum</sub> <code>北京</code><br><b>date</b> <sub>string</sub> <code>2026-05-16</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>railway12306, alipay, wechat</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">6</td><td><b><code>crossapp_life.RailwayEarliestGTrainToWechat</code></b><br><sub>在 12306 查询 2026-05-16 从 上海 到 南京 的车票，把最早一趟高铁的车次号和二等座票价发给微信联系人“陈静”。</sub><br><code>search</code> <code>extract</code> <code>reasoning</code> <code>handoff</code></td><td><b>from_city</b> <sub>string</sub> <code>上海</code><br><b>to_city</b> <sub>string</sub> <code>南京</code><br><i>_route</i> <sub>?</sub><br><b>date</b> <sub>string</sub> <code>2026-05-16</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>railway12306, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">7</td><td><b><code>crossapp_life.RailwayMyAccountToWechat</code></b><br><sub>把我的 12306 账号微信发给陈静</sub><br><code>extract</code> <code>handoff</code></td><td><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>railway12306, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">8</td><td><b><code>crossapp_life.RailwayPriceVsBalance</code></b><br><sub>查2026-05-16从上海到南京最便宜的高铁票多少钱，再看看支付宝余额够不够买</sub><br><code>search</code> <code>extract</code> <code>reasoning</code></td><td><b>from_station</b> <sub>string</sub> <code>上海</code><br><b>to_station</b> <sub>string</sub> <code>南京</code><br><i>_route</i> <sub>?</sub><br><b>date</b> <sub>string</sub> <code>2026-05-16</code></td><td>railway12306, alipay</td><td align="center"><code>S2</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">9</td><td><b><code>crossapp_life.RecommendMenuDishesToXiaozhou</code></b><br><sub>相册里有我之前拍的菜单，按小周刚说的不吃辣的那些要求，帮她挑几道能吃的菜，微信发给她。</sub><br><code>image</code> <code>reasoning</code> <code>handoff</code></td><td>—</td><td>wechat, gallery</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">10</td><td><b><code>crossapp_life.TopRatedNearbyPlaceConditionalWechatOrSmsInvite</code></b><br><sub>帮我找附近3公里内评分最高的肯德基，评分相同优先选距离近的；如果开车不到2公里，就微信问李娜和杨杰要不要一起去；如果太远，就把地址发短信给张三问TA要不要去。</sub><br><code>search</code> <code>reasoning</code> <code>handoff</code></td><td><b>radius</b> <sub>enum</sub> <code>3公里</code><br><b>category</b> <sub>enum</sub> <code>肯德基</code><br><b>target</b> <sub>string</sub> <code>李娜</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub><br><b>notify_to</b> <sub>string</sub> <code>杨杰</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub><br><i>_contact_pair</i> <sub>?</sub><br><b>sms_contact</b> <sub>enum</sub> <code>张三</code></td><td>map, wechat, sms</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">11</td><td><b><code>crossapp_life.TripClosedLoopNotify</code></b><br><sub>查2026-05-16从上海到南京最早的高铁，在日历建标题为出行的事件，设个出发前1小时的闹钟，最后把车次信息微信发给陈静</sub><br><code>search</code> <code>create</code> <code>handoff</code></td><td><b>from_station</b> <sub>string</sub> <code>上海</code><br><b>to_station</b> <sub>string</sub> <code>南京</code><br><i>_route</i> <sub>?</sub><br><b>date</b> <sub>string</sub> <code>2026-05-16</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>railway12306, calendar, clock, wechat</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">12</td><td><b><code>crossapp_life.WeatherFirstNonRainyDayBuyTicket</code></b><br><sub>查上海未来三天天气，找到第一个不下雨的天，帮我买那天从北京到上海的高铁票,提交订单即可。</sub><br><code>extract</code> <code>reasoning</code> <code>search</code></td><td><b>city</b> <sub>enum</sub> <code>上海</code><br><b>from_station</b> <sub>enum</sub> <code>北京</code></td><td>weather, railway12306</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">13</td><td><b><code>crossapp_life.WeatherFirstSunnyDayCalendarAlarm</code></b><br><sub>查北京未来两周的天气，找到第一个不下雨的天，在那天日历建个户外运动日程，设个早上8点的闹钟</sub><br><code>extract</code> <code>reasoning</code> <code>create</code></td><td><b>city</b> <sub>enum</sub> <code>北京</code></td><td>weather, calendar, clock</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">14</td><td><b><code>crossapp_life.WeatherReportToNotes</code></b><br><sub>帮我查一下北京现在的温度和天气，简单整理成一条记录保存到备忘录。</sub><br><code>extract</code> <code>create</code> <code>handoff</code></td><td><b>city</b> <sub>string</sub> <code>北京</code></td><td>weather, notes</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">15</td><td><b><code>crossapp_life.WeatherShareMetric</code></b><br><sub>查一下北京的温度和体感，把结果微信发给陈静</sub><br><code>extract</code> <code>handoff</code></td><td><b>city</b> <sub>string</sub> <code>北京</code><br><b>metric</b> <sub>enum</sub> <code>温度和体感</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>weather, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">16</td><td><b><code>crossapp_life.WechatFoodExtractMapSms</code></b><br><sub>看看陈静在微信里最近说想吃什么，搜附近最近的那家，把地址用短信发给张三</sub><br><code>extract</code> <code>reasoning</code> <code>search</code> <code>handoff</code></td><td><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub><br><i>brand</i> <sub>enum</sub> <code>麦当劳</code><br><b>sms_contact</b> <sub>string</sub> <code>张三</code> <sub title="sampled from">←os.providers.contacts.contacts[displayName]</sub></td><td>wechat, map, sms</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">17</td><td><b><code>crossapp_life.WeekendShanghaiTripIfClearAndFree</code></b><br><sub>我想把下周末的成都行先大概定下来。你先查下周六北京到成都最早的高铁和成都当天的天气，再看看我日历那天上午有没有别的安排；如果天气不是雨天而且日历不冲突，就把车次、天气、出发时间写进一个&quot;周末成都计划&quot;的笔记，再给我设一个出发前1小时的闹钟，最后微信发给陈静，问她那天见面方不方便。</sub><br><code>search</code> <code>reasoning</code> <code>create</code> <code>handoff</code></td><td><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>railway12306, weather, calendar, clock, notes, wechat</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
</table>

---

## 💼 crossapp_work

> **22** 个任务 · **带参数 13** · 🔵 L2×1 🟡 L3×7 🔴 L4×14

### 🔵 **L2** Medium (1)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>crossapp_work.MeetingLongestInfoToWechat</code></b><br><sub>帮我看看2月3日腾讯会议哪场开得最久，把那场的会议号和主题用微信告诉陈静</sub><br><code>extract</code> <code>reasoning</code> <code>handoff</code></td><td><b>date</b> <sub>string</sub> <code>2月3日</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>tencent_meeting, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
</table>

### 🟡 **L3** Hard (7)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>crossapp_work.CalendarEarliestToAlarm</code></b><br><sub>看看我明天日历上最早的日程几点开始，提前半小时帮我设个闹钟</sub><br><code>extract</code> <code>reasoning</code> <code>create</code></td><td>—</td><td>calendar, clock</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">2</td><td><b><code>crossapp_work.MeetingDurationToWechat</code></b><br><sub>查看腾讯会议2月3日这天我一共开了多久的会，把总时长发给微信好友陈静</sub><br><code>extract</code> <code>reasoning</code> <code>handoff</code></td><td><b>date</b> <sub>string</sub> <code>2月3日</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>tencent_meeting, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">3</td><td><b><code>crossapp_work.MeetingJoinAndNotifySms</code></b><br><sub>加入'老王的快速会议'会议，把昵称改成访客小王，然后发短信给张三告知已入会</sub><br><code>nav</code> <code>edit</code> <code>handoff</code></td><td><b>topic</b> <sub>enum</sub> <code>老王的快速会议</code><br><b>name</b> <sub>string</sub> <code>访客小王</code><br><b>contact</b> <sub>enum</sub> <code>张三</code></td><td>tencent_meeting, sms</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">4</td><td><b><code>crossapp_work.MeetingRouteEtaToWechat</code></b><br><sub>查一下我下一场腾讯会议几点开始，搜一下走到故宫要多久，发微信告诉陈静我还有多久到和会议时间</sub><br><code>extract</code> <code>search</code> <code>reasoning</code> <code>handoff</code></td><td><b>place</b> <sub>enum</sub> <code>故宫</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>tencent_meeting, map, wechat</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">5</td><td><b><code>crossapp_work.SmsAndCalendarOnDate</code></b><br><sub>给 张三 发短信 明天见，并在明天创建标题为 约会 的日历日程。</sub><br><code>create</code> <code>handoff</code></td><td><b>contact</b> <sub>enum</sub> <code>张三</code><br><b>message</b> <sub>string</sub> <code>明天见</code><br><b>event_title</b> <sub>string</sub> <code>约会</code></td><td>sms, calendar</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">6</td><td><b><code>crossapp_work.SubmitRequestedAttachmentsToBoss</code></b><br><sub>在微信看看老板最近让我补交的材料，然后在 Download/待提交 里找到对应文件，移动到 Documents/submission，并把文件名微信回复给老板。</sub><br><code>search</code> <code>reasoning</code> <code>handoff</code></td><td>—</td><td>wechat, file_manager</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">7</td><td><b><code>crossapp_work.WeatherConditionalCancelMeeting</code></b><br><sub>看北京明天天气，如果有雨就在腾讯会议取消主题为'项目例会'的会议；如果不下雨就保留该会议并设置一个该会议开始前半小时的闹钟</sub><br><code>extract</code> <code>reasoning</code> <code>edit</code> <code>create</code></td><td><b>city</b> <sub>string</sub> <code>北京</code> <sub title="sampled from">←apps.weather.savedCities[name]</sub><br><b>topic</b> <sub>string</sub> <code>项目例会</code> <sub title="sampled from">←apps.tencent_meeting.scheduledMeetings[title]</sub></td><td>weather, tencent_meeting, clock</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
</table>

### 🔴 **L4** Expert (14)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>crossapp_work.CountCurrentLogErrorsToWechat</code></b><br><sub>打开文件管理器，查看 Download/排障包 里的所有当前日志文件，统计这些日志里 ERROR 一共出现了多少次，把次数微信发给老板。</sub><br><code>extract</code> <code>search</code> <code>reasoning</code> <code>handoff</code></td><td>—</td><td>file_manager, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">2</td><td><b><code>crossapp_work.CountOpenWorkOrdersFromPhotosToWechat</code></b><br><sub>打开微信看看陈静让你处理的现场工单表口径，去查看相关照片，统计后微信回给陈静。</sub><br><code>image</code> <code>extract</code> <code>reasoning</code> <code>handoff</code></td><td>—</td><td>wechat, gallery</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">3</td><td><b><code>crossapp_work.ExistingMeetingToCalendar</code></b><br><sub>查一下'项目例会'会议几点开始，帮我在日历里加个事件提醒,开始时间跟会议开始时间一致</sub><br><code>extract</code> <code>create</code> <code>handoff</code></td><td><b>topic</b> <sub>string</sub> <code>项目例会</code> <sub title="sampled from">←apps.tencent_meeting.scheduledMeetings[title]</sub></td><td>tencent_meeting, calendar</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">4</td><td><b><code>crossapp_work.FullMeetingConflictCheckBroadcast</code></b><br><sub>检查日历上明天03:30有没有安排，如果有空就在腾讯会议预约主题为「临时协调会」的会议，日历创建同名日程（开始时间与会议一致，设提前15分钟的提醒闹钟），会议号微信发给陈静，短信发给张三；有安排的话微信告诉陈静那个时间不行</sub><br><code>extract</code> <code>reasoning</code> <code>create</code> <code>handoff</code></td><td><b>time</b> <sub>string</sub> <code>03:30</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub><br><b>contact2</b> <sub>enum</sub> <code>张三</code><br><b>flow_topic</b> <sub>string</sub> <code>临时协调会</code></td><td>calendar, tencent_meeting, wechat, sms</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">5</td><td><b><code>crossapp_work.InspectionReportToWechat</code></b><br><sub>打开文件里的 Download/巡检记录，查看昨天的巡检情况。如果还有没处理的异常，把设备编号和异常项微信发给老板，同时也同步给今天的巡检人；如果都已处理或正常，就微信告诉今天的巡检人昨天巡检正常。</sub><br><code>extract</code> <code>reasoning</code> <code>handoff</code></td><td>—</td><td>file_manager, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">6</td><td><b><code>crossapp_work.MeetingFullFlowToWechat</code></b><br><sub>帮我在腾讯会议预约明天10:00的项目周会，在日历上加个日程提醒，日程设一个提前15分钟的闹钟，最后把会议号微信发给陈静</sub><br><code>create</code> <code>handoff</code></td><td><b>time</b> <sub>string</sub> <code>10:00</code><br><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>tencent_meeting, calendar, wechat</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">7</td><td><b><code>crossapp_work.MeetingMultiChannelNotify</code></b><br><sub>帮我在腾讯会议创建一个会议，然后把会议号通过微信发给张伟，通过短信发给张三</sub><br><code>create</code> <code>handoff</code></td><td><b>contact1</b> <sub>string</sub> <code>张伟</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub><br><b>contact2</b> <sub>enum</sub> <code>张三</code></td><td>tencent_meeting, wechat, sms</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">8</td><td><b><code>crossapp_work.MeetingReminderToNotes</code></b><br><sub>看看腾讯会议有没有待开始的会议，把会议主题和开始时间记到笔记 APP里。如果没有待开的，就把进行中的记下来。</sub><br><code>extract</code> <code>create</code> <code>handoff</code></td><td>—</td><td>tencent_meeting, notes</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">9</td><td><b><code>crossapp_work.OrganizeMeetingMaterialsToWechat</code></b><br><sub>打开日历看看最近需要补资料的会议，然后在 Download/会议资料 里找到相关材料，整理到 Documents/meeting_pack，并把整理过去的文件名微信发给老板。</sub><br><code>extract</code> <code>search</code> <code>reasoning</code> <code>handoff</code></td><td>—</td><td>calendar, file_manager, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">10</td><td><b><code>crossapp_work.OrganizePdfReportsToWechat</code></b><br><sub>把 Documents 目录下的所有 PDF 报告整理到 这个目录下的final_reports 文件夹中，然后把整理过去的文件名微信发给老板。</sub><br><code>search</code> <code>reasoning</code> <code>handoff</code></td><td>—</td><td>file_manager, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">11</td><td><b><code>crossapp_work.OrganizeReimbursementPhotosToWechat</code></b><br><sub>把老板要补的报销凭证整理到 Documents/reimburse_photos，处理好后微信回给老板。</sub><br><code>image</code> <code>search</code> <code>reasoning</code> <code>handoff</code></td><td>—</td><td>wechat, gallery, file_manager</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">12</td><td><b><code>crossapp_work.ScheduleReleaseMeetingAndNotifyViaNotesWechatSms</code></b><br><sub>帮我建一个明天早上 9 点的 版本发布会 ，时长15分钟，密码123456；建好以后把会议信息记进笔记，再微信发给陈静，短信发给张三。</sub><br><code>create</code> <code>handoff</code></td><td><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub><br><b>sms_contact</b> <sub>enum</sub> <code>张三</code></td><td>tencent_meeting, notes, wechat, sms</td><td align="center"><code>S3</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">13</td><td><b><code>crossapp_work.TencentMeetingKeywordLongestParticipationToNotes</code></b><br><sub>统计腾讯会议历史里名称包含“快速会议”的会议数量，并把这些会议里参会时长最长的那场会议名一起写到笔记里。</sub><br><code>extract</code> <code>reasoning</code> <code>create</code> <code>handoff</code></td><td><b>keyword</b> <sub>enum</sub> <code>快速会议</code></td><td>tencent_meeting, notes</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">14</td><td><b><code>crossapp_work.TencentMeetingLongestPlannedToWechat</code></b><br><sub>在腾讯会议历史会议里，找预定时长最长的一场，把会议名称和主持人姓名发给微信联系人“陈静”。</sub><br><code>extract</code> <code>reasoning</code> <code>handoff</code></td><td><b>contact</b> <sub>string</sub> <code>陈静</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>tencent_meeting, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
</table>

---

## 🛒 ebay

> **8** 个任务 · **带参数 8** · 🟢 L1×1 🔵 L2×2 🟡 L3×4 🔴 L4×1

### 🟢 **L1** Easy (1)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>ebay.SwitchTheme</code></b><br><sub>把 eBay 的主题切换成深色。</sub><br><code>settings</code></td><td><b>theme</b> <sub>enum</sub> <code>深色</code></td><td>ebay</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>atomic</code></td></tr>
</table>

### 🔵 **L2** Medium (2)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>ebay.SearchFirstResult</code></b><br><sub>在 eBay 搜索「电风扇」，告诉我第一个商品叫什么。</sub><br><code>search</code> <code>extract</code></td><td><b>query</b> <sub>enum</sub> <code>电风扇</code><br><b>metric</b> <sub>enum</sub> <code>叫什么</code></td><td>ebay</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>ebay.SortSearchResults</code></b><br><sub>在 eBay 搜索「电风扇」，按最低价 + 运费优先排序。</sub><br><code>search</code></td><td><b>query</b> <sub>enum</sub> <code>电风扇</code><br><b>sort</b> <sub>enum</sub> <code>最低价 + 运费优先</code></td><td>ebay</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🟡 **L3** Hard (4)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>ebay.CompareTwoGroupCounts</code></b><br><sub>帮我比较两组筛选结果：欧洲发货的全新 Sony 耳机里，620 到 690 块的；以及欧洲发货的全新 Nike 运动鞋里，510 到 540 块的。哪个选择更多，各有多少个？</sub><br><code>search</code> <code>extract</code> <code>reasoning</code></td><td><b>query1</b> <sub>string</sub> <code>耳机</code><br><b>brand1</b> <sub>string</sub> <code>Sony</code><br><b>location1</b> <sub>string</sub> <code>欧洲</code><br><b>condition1</b> <sub>string</sub> <code>全新</code><br><b>price_min1</b> <sub>string</sub> <code>620</code><br><b>price_max1</b> <sub>string</sub> <code>690</code><br><b>query2</b> <sub>string</sub> <code>运动鞋</code><br><b>brand2</b> <sub>string</sub> <code>Nike</code><br><b>location2</b> <sub>string</sub> <code>欧洲</code><br><b>condition2</b> <sub>string</sub> <code>全新</code><br><b>price_min2</b> <sub>string</sub> <code>510</code><br><b>price_max2</b> <sub>string</sub> <code>540</code><br><i>_groups</i> <sub>?</sub></td><td>ebay</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">2</td><td><b><code>ebay.CompareTwoProductPrices</code></b><br><sub>帮我在 eBay 上分别搜亚洲发货的电脑和电视，要全新的，看看各自最便宜的算上运费多少钱，哪个更便宜？</sub><br><code>search</code> <code>extract</code> <code>reasoning</code></td><td><b>item1</b> <sub>string</sub> <code>电脑</code><br><b>item2</b> <sub>string</sub> <code>电视</code><br><i>sort_id</i> <sub>string</sub> <code>priceLow</code><br><b>extreme</b> <sub>string</sub> <code>最便宜</code><br><b>comparison</b> <sub>string</sub> <code>更便宜</code><br><i>_pair</i> <sub>?</sub></td><td>ebay</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">3</td><td><b><code>ebay.CountNikeSneakersInRange</code></b><br><sub>eBay 上欧洲发货的Nike运动鞋，要全新的，510 到 540 块之间的有多少个？</sub><br><code>search</code> <code>extract</code></td><td><b>query</b> <sub>string</sub> <code>运动鞋</code><br><b>brand</b> <sub>string</sub> <code>Nike</code><br><b>location</b> <sub>string</sub> <code>欧洲</code><br><b>condition</b> <sub>string</sub> <code>全新</code><br><b>price_min</b> <sub>string</sub> <code>510</code><br><b>price_max</b> <sub>string</sub> <code>540</code><br><i>_case</i> <sub>?</sub></td><td>ebay</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>ebay.CountSonyHeadphonesEurope</code></b><br><sub>帮我看看 eBay 上欧洲发货的全新Sony耳机，有多少个。</sub><br><code>search</code> <code>extract</code></td><td><b>query</b> <sub>string</sub> <code>耳机</code><br><b>brand</b> <sub>string</sub> <code>Sony</code><br><b>location</b> <sub>string</sub> <code>欧洲</code><br><b>condition</b> <sub>string</sub> <code>全新</code><br><i>_case</i> <sub>?</sub></td><td>ebay</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🔴 **L4** Expert (1)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>ebay.FindCheapestProduct</code></b><br><sub>我想买个亚洲发货的Dyson吸尘器，要全新的，最便宜的是哪一个，算上运费多少钱？</sub><br><code>search</code> <code>extract</code></td><td><b>query</b> <sub>string</sub> <code>吸尘器</code><br><b>brand</b> <sub>string</sub> <code>Dyson</code><br><b>location</b> <sub>string</sub> <code>亚洲</code><br><b>condition</b> <sub>string</sub> <code>全新</code><br><i>_case</i> <sub>?</sub></td><td>ebay</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
</table>

---

## 📦 file_manager

> **3** 个任务 · **带参数 0** · 🔴 L4×3

### 🔴 **L4** Expert (3)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>file_manager.CleanObsoleteHandoffFiles</code></b><br><sub>打开文件里的 Download/项目交接，把旧的草稿、报价和备份文件清理掉，只保留当前版本；正式合同、上线计划和供应商清单不要动。</sub><br><code>search</code> <code>delete</code> <code>reasoning</code></td><td>—</td><td>file_manager</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">2</td><td><b><code>file_manager.CreateKeepFolderAndDeleteRawLogs</code></b><br><sub>打开文件里的 Download/日志导出，新建一个名叫「保留-已汇总」的文件夹，然后删除 raw_ 开头的原始日志。</sub><br><code>create</code> <code>delete</code></td><td>—</td><td>file_manager</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">3</td><td><b><code>file_manager.RenameEvidenceFilesByDate</code></b><br><sub>打开文件里的 Download/事故证据，把里面所有的证据文件按修改的先后顺序改名为 evidence_数字顺序.txt，从 1 开始</sub><br><code>edit</code> <code>reasoning</code></td><td>—</td><td>file_manager</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
</table>

---

## 📦 launcher

> **2** 个任务 · **带参数 0** · 🟡 L3×1 🔴 L4×1

### 🟡 **L3** Hard (1)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>launcher.ChangeWallpaperAndAddWidget</code></b><br><sub>把桌面背景换一下，然后添加大桔观小组件</sub><br><code>settings</code> <code>nav</code></td><td>—</td><td>—</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🔴 **L4** Expert (1)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>launcher.DesktopAppsToFolder</code></b><br><sub>帮我把桌面上主要用来刷内容、看视频、听音乐或阅读的娱乐内容类应用整理到同一个文件夹里，命名为 摸鱼专区。</sub><br><code>nav</code> <code>create</code> <code>edit</code></td><td>—</td><td>—</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

---

## 🗺️ map

> **17** 个任务 · **带参数 15** · 🟢 L1×1 🔵 L2×7 🟡 L3×7 🔴 L4×2

### 🟢 **L1** Easy (1)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>map.CheckDriveRoute</code></b><br><sub>帮我查一下到故宫的驾车路线</sub><br><code>search</code> <code>nav</code></td><td><b>place</b> <sub>enum</sub> <code>故宫</code></td><td>map</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>atomic</code></td></tr>
</table>

### 🔵 **L2** Medium (7)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>map.CheckHighestRatedPlace</code></b><br><sub>附近2公里内评分最高的咖啡馆是哪家，优先告诉我离我最近的</sub><br><code>search</code> <code>extract</code></td><td><b>category</b> <sub>enum</sub> <code>咖啡馆</code><br><b>radius</b> <sub>enum</sub> <code>2公里</code></td><td>map</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>map.CompareRouteDuration</code></b><br><sub>查一下去故宫步行和开车哪个更快，各要多久</sub><br><code>extract</code> <code>reasoning</code></td><td><b>place</b> <sub>enum</sub> <code>故宫</code></td><td>map</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>map.DarkModeSettings</code></b><br><sub>把地图主题设为深色主题</sub><br><code>settings</code></td><td><b>theme</b> <sub>enum</sub> <code>深色主题</code></td><td>map</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>map.EstimateDrivingCost</code></b><br><sub>帮我算一下开车去故宫的油费，按每公里0.8元元算</sub><br><code>nav</code> <code>extract</code> <code>reasoning</code></td><td><b>place</b> <sub>enum</sub> <code>故宫</code><br><b>rate</b> <sub>enum</sub> <code>0.8元</code></td><td>map</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">5</td><td><b><code>map.FindNearestAndRoute</code></b><br><sub>帮我找最近的咖啡馆，看看开车过去怎么走</sub><br><code>search</code> <code>nav</code></td><td><b>category</b> <sub>enum</sub> <code>咖啡馆</code></td><td>map</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">6</td><td><b><code>map.ModifyMultiSettings</code></b><br><sub>把地图停车位置通知设为仅限应用，并将保存近期搜索设为关闭</sub><br><code>settings</code></td><td><b>parking_pref</b> <sub>enum</sub> <code>仅限应用</code><br><b>save_recent_searches</b> <sub>bool</sub> <code>关闭</code></td><td>map</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">7</td><td><b><code>map.QueryDrivingDistance</code></b><br><sub>故宫离这儿开车有多远</sub><br><code>nav</code> <code>extract</code></td><td><b>place</b> <sub>enum</sub> <code>故宫</code></td><td>map</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🟡 **L3** Hard (7)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>map.BestRatedWithWalkRoute</code></b><br><sub>帮我找附近2公里内的咖啡馆里评分最高且最近的，看看走过去多远</sub><br><code>search</code> <code>nav</code> <code>extract</code></td><td><b>category</b> <sub>enum</sub> <code>咖啡馆</code><br><b>radius</b> <sub>enum</sub> <code>2公里</code></td><td>map</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">2</td><td><b><code>map.CheckNearestPlaceAddress</code></b><br><sub>离我最近的咖啡馆在什么地址</sub><br><code>search</code> <code>extract</code></td><td><b>category</b> <sub>enum</sub> <code>咖啡馆</code></td><td>map</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>map.FindBestRatedAndRoute</code></b><br><sub>附近2公里内评分最高且最近的咖啡馆是哪家，开车过去大概多远</sub><br><code>search</code> <code>nav</code> <code>extract</code></td><td><b>category</b> <sub>enum</sub> <code>咖啡馆</code><br><b>radius</b> <sub>enum</sub> <code>2公里</code></td><td>map</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>map.FindNearestWithRating</code></b><br><sub>最近的咖啡馆叫什么、评分多少</sub><br><code>search</code> <code>extract</code></td><td><b>category</b> <sub>enum</sub> <code>咖啡馆</code></td><td>map</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">5</td><td><b><code>map.NearestDetailAndWalkRoute</code></b><br><sub>最近的有评分的咖啡馆叫什么、评分多少，走过去要多久</sub><br><code>search</code> <code>nav</code> <code>extract</code></td><td><b>category</b> <sub>enum</sub> <code>咖啡馆</code></td><td>map</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">6</td><td><b><code>map.NearestInRadiusRatingRank</code></b><br><sub>最近的有评分的咖啡馆在附近2公里内同类评分里排第几</sub><br><code>search</code> <code>extract</code> <code>reasoning</code></td><td><b>category</b> <sub>enum</sub> <code>咖啡馆</code><br><b>radius</b> <sub>enum</sub> <code>2公里</code></td><td>map</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">7</td><td><b><code>map.SetMapNorthUp</code></b><br><sub>把地图设置成始终上北下南</sub><br><code>settings</code></td><td>—</td><td>map</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🔴 **L4** Expert (2)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>map.CheckRouteSuccess</code></b><br><sub>从故宫开车去天安门广场怎么走，前几步告诉我</sub><br><code>nav</code> <code>extract</code></td><td><b>origin</b> <sub>string</sub> <code>故宫</code><br><b>destination</b> <sub>string</sub> <code>天安门广场</code><br><i>_check_route_od</i> <sub>?</sub></td><td>map</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>map.NorthResearchInstituteAnswer</code></b><br><sub>我所在位置正北边的研究所是什么</sub><br><code>search</code> <code>extract</code> <code>reasoning</code></td><td>—</td><td>map</td><td align="center"><code>S2</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
</table>

---

## 📦 notes

> **15** 个任务 · **带参数 12** · 🟢 L1×2 🔵 L2×9 🟡 L3×2 🔴 L4×2

### 🟢 **L1** Easy (2)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>notes.CreateFolderAndMoveNote</code></b><br><sub>在笔记里新建一个「重要」文件夹，然后把「购物清单」移到这个文件夹里</sub><br><code>create</code> <code>edit</code> <code>nav</code></td><td><b>folder_name</b> <sub>enum</sub> <code>重要</code><br><b>note_title</b> <sub>string</sub> <code>购物清单</code><br><i>_note</i> <sub>?</sub></td><td>notes</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>notes.ReadNotesCount</code></b><br><sub>看看笔记里有几条便签</sub><br><code>extract</code></td><td>—</td><td>notes</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>atomic</code></td></tr>
</table>

### 🔵 **L2** Medium (9)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>notes.AddNewTodo</code></b><br><sub>在笔记的待办里添加一条「买菜」</sub><br><code>create</code></td><td><b>text</b> <sub>enum</sub> <code>买菜</code></td><td>notes</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>notes.ChangeViewMode</code></b><br><sub>把笔记的视图模式改成列表</sub><br><code>settings</code> <code>nav</code></td><td><b>mode</b> <sub>enum</sub> <code>列表</code></td><td>notes</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">3</td><td><b><code>notes.CreateNewNote</code></b><br><sub>在笔记里新建一条便签，标题写「下周计划」</sub><br><code>create</code></td><td><b>title</b> <sub>enum</sub> <code>下周计划</code></td><td>notes</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>notes.CreateNoteWithReminder</code></b><br><sub>在笔记里新建一条标题为「明天开会」的便签，写上「记得带文件」，设一个提醒，然后告诉我提醒时间</sub><br><code>create</code> <code>edit</code> <code>extract</code></td><td><b>title</b> <sub>enum</sub> <code>明天开会</code><br><b>content</b> <sub>enum</sub> <code>记得带文件</code></td><td>notes</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">5</td><td><b><code>notes.DeleteAllCompletedTodos</code></b><br><sub>把笔记待办里已完成的事项全部删掉</sub><br><code>delete</code> <code>nav</code></td><td>—</td><td>notes</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">6</td><td><b><code>notes.DeleteTodo</code></b><br><sub>把笔记待办里的「预约牙医」删掉</sub><br><code>delete</code> <code>nav</code></td><td><b>todo_text</b> <sub>string</sub> <code>预约牙医</code><br><i>_todo</i> <sub>?</sub></td><td>notes</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">7</td><td><b><code>notes.PinNote</code></b><br><sub>把笔记里标题为「购物清单」的便签置顶</sub><br><code>edit</code></td><td><b>note_title</b> <sub>string</sub> <code>购物清单</code><br><i>_note</i> <sub>?</sub></td><td>notes</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">8</td><td><b><code>notes.ReadNoteContent</code></b><br><sub>看看笔记里标题为「购物清单」的便签写了什么内容</sub><br><code>extract</code></td><td><b>note_title</b> <sub>string</sub> <code>购物清单</code><br><i>keyword1</i> <sub>string</sub> <code>牛奶</code><br><i>keyword2</i> <sub>string</sub> <code>鸡蛋</code><br><i>_note_target</i> <sub>?</sub></td><td>notes</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">9</td><td><b><code>notes.ReadTodoText</code></b><br><sub>看看笔记里的待办事项有哪些</sub><br><code>extract</code> <code>nav</code></td><td>—</td><td>notes</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>atomic</code></td></tr>
</table>

### 🟡 **L3** Hard (2)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>notes.RestoreFromTrash</code></b><br><sub>把笔记回收站里的「购物清单」恢复回来</sub><br><code>edit</code> <code>nav</code></td><td><b>note_title</b> <sub>string</sub> <code>购物清单</code><br><i>_note</i> <sub>?</sub></td><td>notes</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>notes.SearchNoteTitle</code></b><br><sub>在笔记里搜索「购物」，告诉我搜到的便签标题</sub><br><code>search</code> <code>extract</code></td><td><b>keyword</b> <sub>string</sub> <code>购物</code><br><i>note_title</i> <sub>string</sub> <code>购物清单</code><br><i>_search_target</i> <sub>?</sub></td><td>notes</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
</table>

### 🔴 **L4** Expert (2)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>notes.PrivateNotesWorkflow</code></b><br><sub>把笔记里「购物清单」设为私密，然后告诉我现在私密便签里总共有几条</sub><br><code>edit</code> <code>nav</code> <code>extract</code></td><td><b>note_title</b> <sub>string</sub> <code>购物清单</code><br><i>_note</i> <sub>?</sub></td><td>notes</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">2</td><td><b><code>notes.TodoBatchWorkflow</code></b><br><sub>在笔记待办里加一条「整理衣柜」，然后把「明天去车站」标为已完成，最后告诉我还有几条没完成的待办</sub><br><code>create</code> <code>edit</code> <code>extract</code></td><td><b>new_todo</b> <sub>enum</sub> <code>整理衣柜</code><br><b>existing_todo</b> <sub>string</sub> <code>明天去车站</code><br><i>_todo</i> <sub>?</sub></td><td>notes</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>deep_dive</code></td></tr>
</table>

---

## 💳 payment

> **7** 个任务 · **带参数 7** · 🟡 L3×2 🔴 L4×5

### 🟡 **L3** Hard (2)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>payment.AlipayTransferAndNotify</code></b><br><sub>我的支付宝密码是123456。请你用支付宝给浩杰(李浩杰)转66.0元，备注写“午饭AA”，然后在微信里把这笔转账告知张伟</sub><br><code>finance</code> <code>handoff</code></td><td><b>alipay_contact</b> <sub>string</sub> <code>浩杰(李浩杰)</code><br><b>contact</b> <sub>string</sub> <code>张伟</code><br><b>amount</b> <sub>float</sub> <code>66.0</code><br><b>note</b> <sub>string</sub> <code>午饭AA</code></td><td>alipay, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>payment.TransferToContactWithNote</code></b><br><sub>我的密码是123456。请你用支付宝给浩杰(李浩杰)转150.0元，备注写“书本费”</sub><br><code>finance</code> <code>handoff</code></td><td><b>name</b> <sub>string</sub> <code>浩杰(李浩杰)</code> <sub title="sampled from">←apps.alipay.contacts[name]</sub><br><b>amount</b> <sub>float</sub> <code>150.0</code><br><b>note</b> <sub>string</sub> <code>书本费</code></td><td>alipay</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🔴 **L4** Expert (5)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>payment.AlipayBindMultipleCardsTransferAndRecordSuccessfulCards</code></b><br><sub>我的支付宝密码是123456。帮我在支付宝绑定工商银行储蓄卡和农业银行储蓄卡，再按银行卡绑定顺序用三张银行卡分别向13856785678转账3500、4500、6500，并把转账成功的银行卡记到标题为银行卡转账结果的备忘录里</sub><br><code>finance</code> <code>handoff</code> <code>create</code></td><td><b>targetAccount</b> <sub>string</sub> <code>13856785678</code><br><b>amount1</b> <sub>int</sub> <code>3500</code><br><b>amount2</b> <sub>int</sub> <code>4500</code><br><b>amount3</b> <sub>int</sub> <code>6500</code><br><b>noteTitle</b> <sub>string</sub> <code>银行卡转账结果</code></td><td>alipay, notes</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">2</td><td><b><code>payment.AlipayChangePaymentPasswordThenPay</code></b><br><sub>我现在的密码是000000。帮我把支付宝支付密码改成123456，然后马上转账19.9元给浩杰(李浩杰)</sub><br><code>finance</code> <code>settings</code></td><td><b>newPassword</b> <sub>string</sub> <code>123456</code><br><b>contact</b> <sub>string</sub> <code>浩杰(李浩杰)</code> <sub title="sampled from">←apps.alipay.contacts[name]</sub><br><b>amount</b> <sub>float</sub> <code>19.9</code></td><td>alipay</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>payment.AlipayContinuousPaymentsToContactsRecordBalances</code></b><br><sub>我的密码是123456。帮我用支付宝连续给锐(郭锐)、于奶奶(于桂兰)、浩杰(李浩杰)、老王(王建国)、阿明(张明)转账，金额依次是88.0、120.0、96.0、156.0、110.0，备注都写“发工资”，并把每次转账后的余额记到标题为工资支付记录的备忘录里</sub><br><code>finance</code> <code>handoff</code> <code>create</code> <code>reasoning</code></td><td><b>amount1</b> <sub>float</sub> <code>88.0</code><br><b>amount2</b> <sub>float</sub> <code>120.0</code><br><b>amount3</b> <sub>float</sub> <code>96.0</code><br><b>amount4</b> <sub>float</sub> <code>156.0</code><br><b>amount5</b> <sub>float</sub> <code>110.0</code><br><b>contact1</b> <sub>string</sub> <code>锐(郭锐)</code> <sub title="sampled from">←apps.alipay.contacts[name]</sub><br><b>contact2</b> <sub>string</sub> <code>于奶奶(于桂兰)</code> <sub title="sampled from">←apps.alipay.contacts[name]</sub><br><b>contact3</b> <sub>string</sub> <code>浩杰(李浩杰)</code> <sub title="sampled from">←apps.alipay.contacts[name]</sub><br><b>contact4</b> <sub>string</sub> <code>老王(王建国)</code> <sub title="sampled from">←apps.alipay.contacts[name]</sub><br><b>contact5</b> <sub>string</sub> <code>阿明(张明)</code> <sub title="sampled from">←apps.alipay.contacts[name]</sub><br><b>noteTitle</b> <sub>string</sub> <code>工资支付记录</code></td><td>alipay, notes</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">4</td><td><b><code>payment.SubscribeMembershipAutoRenewThenCancelInWechat</code></b><br><sub>帮我使用微信支付开通哔哩哔哩大会员连月自动续费，然后到微信把这项自动续费关闭</sub><br><code>finance</code> <code>settings</code> <code>handoff</code></td><td><i>membershipType</i> <sub>string</sub> <code>哔哩哔哩大会员</code><br><i>price</i> <sub>float</sub> <code>15.0</code><br><i>billingCycle</i> <sub>string</sub> <code>月</code></td><td>bilibili, wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">5</td><td><b><code>payment.WechatExtractAmountTransfer</code></b><br><sub>看看微信里张伟最近发来的消息，对方让你转多少钱，你就用支付宝转给浩杰(李浩杰)多少，然后回复已经转了</sub><br><code>extract</code> <code>reasoning</code> <code>finance</code></td><td><b>contact</b> <sub>string</sub> <code>张伟</code><br><b>alipay_contact</b> <sub>string</sub> <code>浩杰(李浩杰)</code><br><i>requestAmount</i> <sub>float</sub> <code>66.0</code><br><b>reply</b> <sub>string</sub> <code>已经转了</code></td><td>wechat, alipay</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
</table>

---

## 🚄 railway12306

> **16** 个任务 · **带参数 10** · 🟢 L1×1 🔵 L2×4 🟡 L3×7 🔴 L4×4

### 🟢 **L1** Easy (1)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>railway12306.CheckDefaultPassengerName</code></b><br><sub>看看12306里默认乘车人叫什么名字</sub><br><code>extract</code></td><td>—</td><td>railway12306</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>atomic</code></td></tr>
</table>

### 🔵 **L2** Medium (4)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>railway12306.CheckTicketPriceByDate</code></b><br><sub>看看我2月9号坐的那趟车花了多少钱</sub><br><code>extract</code></td><td><b>date</b> <sub>string</sub> <code>2月9号</code></td><td>railway12306</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">2</td><td><b><code>railway12306.FindTrainByDate</code></b><br><sub>看看我2月9号坐了哪趟车</sub><br><code>extract</code></td><td><b>date</b> <sub>string</sub> <code>2月9号</code></td><td>railway12306</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">3</td><td><b><code>railway12306.OpenInvoice</code></b><br><sub>在12306里添加一个发票抬头赵宇轩，设为默认，并把发票邮箱设置为ticket_demo01@example.com</sub><br><code>nav</code> <code>create</code></td><td><b>name</b> <sub>enum</sub> <code>赵宇轩</code><br><b>make_default</b> <sub>bool</sub> <code>设为</code><br><b>email</b> <sub>enum</sub> <code>ticket_demo01@example.c…</code></td><td>railway12306</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>railway12306.OpenServicePhone</code></b><br><sub>在12306中查一下上海的客服电话区号是多少</sub><br><code>nav</code> <code>extract</code></td><td><b>region</b> <sub>enum</sub> <code>上海</code></td><td>railway12306</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🟡 **L3** Hard (7)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>railway12306.BuyReturnTicketFromLatestOrder</code></b><br><sub>看看我最新的一张车票，给我买一张明天任意时间的返程票，提交订单即可</sub><br><code>search</code> <code>create</code> <code>reasoning</code></td><td>—</td><td>railway12306</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>railway12306.BuyTicketForNewPassenger</code></b><br><sub>帮我给周若涵买一张2026-05-16从上海到南京的高铁票，要最早的有票的班次，二等座，他的身份证号是320106199612183428，手机号是13912345678,提交订单即可</sub><br><code>search</code> <code>create</code></td><td><b>name</b> <sub>string</sub> <code>周若涵</code><br><b>id_no</b> <sub>string</sub> <code>320106199612183428</code><br><b>phone</b> <sub>string</sub> <code>13912345678</code><br><i>_identity</i> <sub>?</sub><br><b>from_station</b> <sub>string</sub> <code>上海</code><br><b>to_station</b> <sub>string</sub> <code>南京</code><br><b>date</b> <sub>string</sub> <code>2026-05-16</code><br><b>schedule_pref</b> <sub>enum</sub> <code>最早</code><br><b>seat_type</b> <sub>enum</sub> <code>二等座</code><br><i>_bookable_trip</i> <sub>?</sub></td><td>railway12306</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>railway12306.CheckIdVerificationStatus</code></b><br><sub>进入人证核验页面，看看我的12306是否人证核验成功</sub><br><code>nav</code> <code>extract</code></td><td>—</td><td>railway12306</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>railway12306.CheckPassengerCount</code></b><br><sub>看看12306里一共添加了几个乘车人</sub><br><code>extract</code></td><td>—</td><td>railway12306</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">5</td><td><b><code>railway12306.CheckRecentTripCities</code></b><br><sub>看看我最近的车票，我都从哪些城市出发过</sub><br><code>extract</code></td><td><b>direction</b> <sub>enum</sub> <code>从哪些城市出发过</code></td><td>railway12306</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">6</td><td><b><code>railway12306.CheckStudentVerify</code></b><br><sub>看看我的学生票优惠区间是哪里</sub><br><code>nav</code> <code>extract</code></td><td>—</td><td>railway12306</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">7</td><td><b><code>railway12306.OpenAllApps</code></b><br><sub>找到12306的全部应用页面</sub><br><code>nav</code></td><td>—</td><td>railway12306</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>atomic</code></td></tr>
</table>

### 🔴 **L4** Expert (4)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>railway12306.BuyTicketForPassenger</code></b><br><sub>帮我给赵宇轩买一张2026-05-16从上海到南京的高铁票，要有票的最早的班次，二等座，提交订单即可</sub><br><code>search</code> <code>create</code></td><td><b>name</b> <sub>string</sub> <code>赵宇轩</code> <sub title="sampled from">←apps.railway12306.passengers[name]</sub><br><b>from_station</b> <sub>string</sub> <code>上海</code><br><b>to_station</b> <sub>string</sub> <code>南京</code><br><b>date</b> <sub>string</sub> <code>2026-05-16</code><br><b>schedule_pref</b> <sub>enum</sub> <code>最早</code><br><b>seat_type</b> <sub>enum</sub> <code>二等座</code><br><i>_bookable_trip</i> <sub>?</sub></td><td>railway12306</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>railway12306.BuyTicketsForTwoPassengers</code></b><br><sub>帮我给赵宇轩和王思雨各买一张2026-05-16从上海到南京的高铁票，要有票的最早的班次，二等座，提交订单即可</sub><br><code>search</code> <code>create</code></td><td><b>name</b> <sub>string</sub> <code>赵宇轩</code><br><b>name2</b> <sub>string</sub> <code>王思雨</code><br><i>_passengers</i> <sub>?</sub><br><b>from_station</b> <sub>string</sub> <code>上海</code><br><b>to_station</b> <sub>string</sub> <code>南京</code><br><b>date</b> <sub>string</sub> <code>2026-05-16</code><br><b>schedule_pref</b> <sub>enum</sub> <code>最早</code><br><b>seat_type</b> <sub>enum</sub> <code>二等座</code><br><i>_bookable_trip</i> <sub>?</sub></td><td>railway12306</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>railway12306.QueryAndCheckRoute</code></b><br><sub>帮我看看明天上海到南京的所有车次，其中发车最晚的是哪一趟</sub><br><code>search</code> <code>extract</code></td><td><b>from_station</b> <sub>string</sub> <code>上海</code><br><b>to_station</b> <sub>string</sub> <code>南京</code><br><i>_route</i> <sub>?</sub></td><td>railway12306</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>railway12306.QueryFastestTrainDetails</code></b><br><sub>帮我看看2026-05-16从上海到南京的车票，最快的车是哪一趟，要多久，始发站是哪里，几点到地方</sub><br><code>search</code> <code>extract</code></td><td><b>from_station</b> <sub>string</sub> <code>上海</code><br><b>to_station</b> <sub>string</sub> <code>南京</code><br><i>_route</i> <sub>?</sub><br><b>date</b> <sub>string</sub> <code>2026-05-16</code></td><td>railway12306</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
</table>

---

## 📕 redbook

> **17** 个任务 · **带参数 15** · 🟢 L1×1 🔵 L2×7 🟡 L3×6 🔴 L4×3

### 🟢 **L1** Easy (1)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>redbook.CheckMyProfileField</code></b><br><sub>帮我看看我的小红书粉丝数</sub><br><code>extract</code></td><td><b>field</b> <sub>enum</sub> <code>粉丝数</code></td><td>redbook</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>atomic</code></td></tr>
</table>

### 🔵 **L2** Medium (7)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>redbook.CheckFirstChatLastMessage</code></b><br><sub>帮我看下小红书最新的那条对话最后发的是什么</sub><br><code>extract</code></td><td>—</td><td>redbook</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>redbook.CheckFollowingUserNoteCount</code></b><br><sub>看看小红书我关注列表里的&quot;西柚慢行&quot;发了多少篇笔记</sub><br><code>extract</code></td><td><b>username</b> <sub>string</sub> <code>西柚慢行</code></td><td>redbook</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>redbook.CheckSearchNoteField</code></b><br><sub>在小红书搜&quot;OOTD&quot;，告诉我第一篇笔记的标题</sub><br><code>search</code> <code>extract</code></td><td><b>keyword</b> <sub>enum</sub> <code>OOTD</code><br><b>field</b> <sub>enum</sub> <code>标题</code></td><td>redbook</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>redbook.CollectFeedNoteAndDMAuthor</code></b><br><sub>收藏推荐页标题含&quot;分享&quot;的笔记，给作者发一句&quot;这篇内容很有启发，谢谢分享&quot;</sub><br><code>explore</code> <code>social</code> <code>create</code></td><td><b>keyword</b> <sub>string</sub> <code>分享</code><br><b>message</b> <sub>string</sub> <code>这篇内容很有启发，谢谢分享</code></td><td>redbook</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">5</td><td><b><code>redbook.CollectSearchNote</code></b><br><sub>在小红书搜&quot;教程&quot;，收藏排在最前面的那篇笔记</sub><br><code>search</code> <code>social</code></td><td><b>keyword</b> <sub>enum</sub> <code>教程</code></td><td>redbook</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">6</td><td><b><code>redbook.LikeFeedNoteAndReportLikes</code></b><br><sub>给小红书推荐页标题含&quot;分享&quot;的笔记点赞，告诉我它一共多少赞</sub><br><code>explore</code> <code>social</code> <code>extract</code></td><td><b>keyword</b> <sub>string</sub> <code>分享</code></td><td>redbook</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">7</td><td><b><code>redbook.LikeFirstFeedNote</code></b><br><sub>在小红书首页切到&quot;美食&quot;这个分类，给这个分类里排最前面的笔记点个赞</sub><br><code>social</code></td><td><b>category</b> <sub>enum</sub> <code>美食</code></td><td>redbook</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🟡 **L3** Hard (6)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>redbook.CheckSearchUserField</code></b><br><sub>在小红书搜用户&quot;海边小橘子&quot;，看看 TA 的IP属地</sub><br><code>search</code> <code>extract</code></td><td><b>username</b> <sub>string</sub> <code>海边小橘子</code><br><b>field</b> <sub>enum</sub> <code>IP属地</code></td><td>redbook</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>redbook.DMFollowedUser</code></b><br><sub>给我关注的&quot;海边小橘子&quot;发条私信&quot;你好呀，最近更新很不错&quot;</sub><br><code>social</code> <code>create</code></td><td><b>username</b> <sub>string</sub> <code>海边小橘子</code><br><b>message</b> <sub>string</sub> <code>你好呀，最近更新很不错</code></td><td>redbook</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>redbook.PublishAndShareToFollowing</code></b><br><sub>在小红书发一篇标题叫&quot;春日散步计划&quot;的笔记，然后把这个标题私信给&quot;海边小橘子&quot;</sub><br><code>create</code> <code>social</code></td><td><b>title</b> <sub>string</sub> <code>春日散步计划</code><br><b>username</b> <sub>string</sub> <code>海边小橘子</code></td><td>redbook</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">4</td><td><b><code>redbook.PublishNoteWithTitleAndContent</code></b><br><sub>发一篇小红书笔记，标题写&quot;周末逛展记录&quot;，正文写&quot;今天看了两个展，最喜欢第二个沉浸式空间，照片晚点整理。&quot;</sub><br><code>create</code></td><td><b>title</b> <sub>string</sub> <code>周末逛展记录</code><br><b>content</b> <sub>string</sub> <code>今天看了两个展，最喜欢第二个沉浸式空间，照片晚…</code></td><td>redbook</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">5</td><td><b><code>redbook.SearchFirstNoteAuthorTopLikedTitle</code></b><br><sub>在小红书搜&quot;探店&quot;，看看第一篇笔记的作者获赞最多的笔记标题是什么</sub><br><code>search</code> <code>extract</code> <code>reasoning</code></td><td><b>keyword</b> <sub>enum</sub> <code>探店</code></td><td>redbook</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">6</td><td><b><code>redbook.UncollectFirstCollectedNote</code></b><br><sub>把我小红书收藏列表最前面的那篇笔记取消收藏</sub><br><code>nav</code> <code>social</code></td><td>—</td><td>redbook</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🔴 **L4** Expert (3)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>redbook.CheckFirstCollectedAuthorField</code></b><br><sub>去我小红书【收藏】列表里排在最前面的那篇笔记，告诉我作者的IP属地</sub><br><code>nav</code> <code>extract</code></td><td><b>field</b> <sub>enum</sub> <code>IP属地</code></td><td>redbook</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">2</td><td><b><code>redbook.ReplyToFeedNoteFirstComment</code></b><br><sub>在小红书推荐页找标题含&quot;分享&quot;的笔记，回复第一条评论&quot;这个回复我也很认同&quot;</sub><br><code>explore</code> <code>social</code> <code>create</code></td><td><b>keyword</b> <sub>string</sub> <code>分享</code><br><b>reply</b> <sub>string</sub> <code>这个回复我也很认同</code></td><td>redbook</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">3</td><td><b><code>redbook.SearchCollectAndReportAuthor</code></b><br><sub>搜索&quot;读书&quot;，收藏第一篇笔记，告诉我作者有多少粉丝和获赞</sub><br><code>search</code> <code>social</code> <code>extract</code></td><td><b>keyword</b> <sub>enum</sub> <code>读书</code></td><td>redbook</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>deep_dive</code></td></tr>
</table>

---

## 📦 reddit

> **16** 个任务 · **带参数 11** · 🟢 L1×3 🔵 L2×5 🟡 L3×6 🔴 L4×2

### 🟢 **L1** Easy (3)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>reddit.Reddit_CreatePostToCommunity</code></b><br><sub>帮我在 Reddit 向 r/China_irl 社区发布一篇帖子，标题包含 Bench post，内容包含 This is a benchmark post body</sub><br><code>nav</code> <code>create</code></td><td><b>community</b> <sub>enum</sub> <code>r/China_irl</code><br><b>title</b> <sub>string</sub> <code>Bench post</code><br><b>body</b> <sub>string</sub> <code>This is a benchmark pos…</code></td><td>reddit</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>reddit.Reddit_DeleteSeededChatMessage</code></b><br><sub>在 Reddit 聊天里打开和 Objective-Skill-2591 的对话，把我发的 我等下去把快递拿一下，晚点回你。 这条消息删掉</sub><br><code>nav</code> <code>delete</code> <code>social</code></td><td><b>username</b> <sub>string</sub> <code>Objective-Skill-2591</code><br><b>seed_message</b> <sub>string</sub> <code>我等下去把快递拿一下，晚点回你。</code><br><i>_pair</i> <sub>?</sub></td><td>reddit</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>reddit.Reddit_UpdateProfileBio</code></b><br><sub>帮我进入 Reddit 个人资料编辑页面，把个人简介改成包含 最近在学做家常川菜，也在练早起打卡。 的内容并保存</sub><br><code>nav</code> <code>edit</code></td><td><b>bio</b> <sub>string</sub> <code>最近在学做家常川菜，也在练早起打卡。</code></td><td>reddit</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🔵 **L2** Medium (5)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>reddit.Reddit_AdvancedPrivacyToggles</code></b><br><sub>帮我在 Reddit 设置里调整隐私选项，打开显示成人内容，关闭模糊成人图片，同时关闭社区主题</sub><br><code>settings</code></td><td>—</td><td>reddit</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>reddit.Reddit_DisableCommunityThemes</code></b><br><sub>帮我在 Reddit 设置里关闭社区主题</sub><br><code>settings</code></td><td>—</td><td>reddit</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">3</td><td><b><code>reddit.Reddit_JoinCommunityFromFeed</code></b><br><sub>在 Reddit 首页动态里找到 r/memes 社区的帖子，先加入这个社区，再给里面任意一条帖子点赞</sub><br><code>nav</code> <code>social</code></td><td><b>community</b> <sub>string</sub> <code>r/memes</code></td><td>reddit</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>reddit.Reddit_OpenLinksOutsideApp</code></b><br><sub>帮我在 Reddit 设置里把链接打开方式改成用外部默认浏览器打开，不要在应用内打开</sub><br><code>settings</code></td><td>—</td><td>reddit</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">5</td><td><b><code>reddit.Reddit_UpvoteAnyComment</code></b><br><sub>在 Reddit 随便一个帖子的评论区，给任意一条评论点赞</sub><br><code>nav</code> <code>social</code></td><td>—</td><td>reddit</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🟡 **L3** Hard (6)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>reddit.Reddit_AddCommentToPost</code></b><br><sub>在 Reddit 打开标题为 {post_title} 的帖子，发表一条评论 {comment}</sub><br><code>nav</code> <code>social</code> <code>create</code></td><td><i>post</i> <sub>?</sub><br><b>comment</b> <sub>string</sub> <code>Nice post!</code></td><td>reddit</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>reddit.Reddit_DeleteSeededOwnComment</code></b><br><sub>在 Reddit 打开标题是 People who have tried Padel recently, what have you enjoyed the most about it to make you go back ? 的帖子，把我刚才发的 我也遇到过类似情况，先从每天提前 10 分钟开始会更容易坚持。 这条评论删掉</sub><br><code>nav</code> <code>delete</code> <code>social</code></td><td><b>post_title</b> <sub>string</sub> <code>People who have tried P…</code><br><b>seed_comment</b> <sub>string</sub> <code>我也遇到过类似情况，先从每天提前 10 分钟开…</code></td><td>reddit</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>reddit.Reddit_DeleteSeededOwnPost</code></b><br><sub>在 Reddit 个人主页里，把我之前发的标题是 有没有人也会半夜突然想整理房间? 的帖子删掉</sub><br><code>nav</code> <code>edit</code></td><td><b>seed_title</b> <sub>string</sub> <code>有没有人也会半夜突然想整理房间?</code></td><td>reddit</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>reddit.Reddit_EditSeededOwnComment</code></b><br><sub>在 Reddit 找到我之前发的 补充一点：晚上早点放下手机真的有用。 评论，把它修改成包含 我后来发现把早起目标拆成两步：先固定起床时间，再慢慢提前入睡，更容易坚持。 的内容</sub><br><code>nav</code> <code>edit</code></td><td><b>seed_comment</b> <sub>string</sub> <code>补充一点：晚上早点放下手机真的有用。</code><br><b>new_comment</b> <sub>string</sub> <code>我后来发现把早起目标拆成两步：先固定起床时间，…</code></td><td>reddit</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">5</td><td><b><code>reddit.Reddit_SendChatMessage</code></b><br><sub>在 Reddit 聊天里，给用户 Intelligent_Drama_46 发送消息 hello from bench</sub><br><code>social</code> <code>create</code></td><td><b>username</b> <sub>enum</sub> <code>Intelligent_Drama_46</code><br><b>message</b> <sub>string</sub> <code>hello from bench</code></td><td>reddit</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">6</td><td><b><code>reddit.Reddit_UpvoteSpecificFeedPost</code></b><br><sub>在 Reddit 首页动态里找到标题是 {post_title} 的帖子，给这条帖子点赞</sub><br><code>nav</code> <code>social</code></td><td><i>post</i> <sub>?</sub></td><td>reddit</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🔴 **L4** Expert (2)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>reddit.Reddit_DeepThreadReplyAndDeleteSeedMessage</code></b><br><sub>在 Reddit 聊天里打开和 Objective-Skill-2591 的对话，找到对方发的 你上次推荐的那家店我去了,味道确实不错! 消息，在这条消息的子对话里回复包含 哈哈同感！我也觉得他们家辣度刚刚好，下次一起去试试新菜。 的内容，然后回到聊天列表，删掉我之前发的 我等下去把快递拿一下,晚点回你。 这条消息</sub><br><code>nav</code> <code>social</code> <code>create</code> <code>edit</code></td><td><b>username</b> <sub>enum</sub> <code>Objective-Skill-2591</code><br><b>thread_seed_message</b> <sub>string</sub> <code>你上次推荐的那家店我去了,味道确实不错!</code><br><b>delete_seed_message</b> <sub>string</sub> <code>我等下去把快递拿一下,晚点回你。</code><br><b>reply</b> <sub>string</sub> <code>哈哈同感！我也觉得他们家辣度刚刚好，下次一起去…</code><br><i>_deep_thread_pair</i> <sub>?</sub></td><td>reddit</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>reddit.Reddit_TurnOffMatureContentButKeepUnblurred</code></b><br><sub>帮我在 Reddit 设置里关闭显示成人内容，并且保持不模糊成人媒体</sub><br><code>settings</code> <code>reasoning</code></td><td>—</td><td>reddit</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

---

## 📦 rednote

> **17** 个任务 · **带参数 15** · 🟢 L1×2 🔵 L2×6 🟡 L3×6 🔴 L4×3

### 🟢 **L1** Easy (2)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>rednote.CheckMyProfileField</code></b><br><sub>帮我看看我的小红书粉丝数</sub><br><code>query</code></td><td><b>field</b> <sub>enum</sub> <code>粉丝数</code></td><td>rednote</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">2</td><td><b><code>rednote.LikeFeedNoteAndReportLikes</code></b><br><sub>给小红书推荐页标题含&quot;分享&quot;的笔记点赞，告诉我它一共多少赞</sub><br><code>explore</code> <code>social</code> <code>query</code></td><td><b>keyword</b> <sub>string</sub> <code>分享</code></td><td>rednote</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🔵 **L2** Medium (6)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>rednote.CheckFirstChatLastMessage</code></b><br><sub>帮我看下小红书最新的那条对话最后发的是什么</sub><br><code>query</code></td><td>—</td><td>rednote</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>rednote.CheckFollowingUserNoteCount</code></b><br><sub>看看小红书我关注列表里的&quot;西柚慢行&quot;发了多少篇笔记</sub><br><code>query</code></td><td><b>username</b> <sub>string</sub> <code>西柚慢行</code></td><td>rednote</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>rednote.CheckSearchNoteField</code></b><br><sub>在小红书搜&quot;OOTD&quot;，告诉我第一篇笔记的标题</sub><br><code>search</code> <code>query</code></td><td><b>keyword</b> <sub>enum</sub> <code>OOTD</code><br><b>field</b> <sub>enum</sub> <code>标题</code></td><td>rednote</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>rednote.CollectFeedNoteAndDMAuthor</code></b><br><sub>收藏推荐页标题含&quot;分享&quot;的笔记，给作者发一句&quot;这篇内容很有启发，谢谢分享&quot;</sub><br><code>explore</code> <code>social</code> <code>create</code></td><td><b>keyword</b> <sub>string</sub> <code>分享</code><br><b>message</b> <sub>string</sub> <code>这篇内容很有启发，谢谢分享</code></td><td>rednote</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">5</td><td><b><code>rednote.CollectSearchNote</code></b><br><sub>在小红书搜&quot;教程&quot;，收藏排在最前面的那篇笔记</sub><br><code>search</code> <code>social</code></td><td><b>keyword</b> <sub>enum</sub> <code>教程</code></td><td>rednote</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">6</td><td><b><code>rednote.LikeFirstFeedNote</code></b><br><sub>在小红书首页切到&quot;美食&quot;这个分类，给这个分类里排最前面的笔记点个赞</sub><br><code>social</code></td><td><b>category</b> <sub>enum</sub> <code>美食</code></td><td>rednote</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🟡 **L3** Hard (6)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>rednote.CheckSearchUserField</code></b><br><sub>在小红书搜用户&quot;海边小橘子&quot;，看看 TA 的IP属地</sub><br><code>search</code> <code>query</code></td><td><b>username</b> <sub>string</sub> <code>海边小橘子</code><br><b>field</b> <sub>enum</sub> <code>IP属地</code></td><td>rednote</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>rednote.DMFollowedUser</code></b><br><sub>给我关注的&quot;海边小橘子&quot;发条私信&quot;你好呀，最近更新很不错&quot;</sub><br><code>social</code> <code>create</code></td><td><b>username</b> <sub>string</sub> <code>海边小橘子</code><br><b>message</b> <sub>string</sub> <code>你好呀，最近更新很不错</code></td><td>rednote</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>rednote.PublishAndShareToFollowing</code></b><br><sub>在小红书发一篇标题叫&quot;春日散步计划&quot;的笔记，然后把这个标题私信给&quot;海边小橘子&quot;</sub><br><code>create</code> <code>social</code></td><td><b>title</b> <sub>string</sub> <code>春日散步计划</code><br><b>username</b> <sub>string</sub> <code>海边小橘子</code></td><td>rednote</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">4</td><td><b><code>rednote.PublishNoteWithTitleAndContent</code></b><br><sub>发一篇小红书笔记，标题写&quot;周末逛展记录&quot;，正文写&quot;今天看了两个展，最喜欢第二个沉浸式空间，照片晚点整理。&quot;</sub><br><code>create</code></td><td><b>title</b> <sub>string</sub> <code>周末逛展记录</code><br><b>content</b> <sub>string</sub> <code>今天看了两个展，最喜欢第二个沉浸式空间，照片晚…</code></td><td>rednote</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">5</td><td><b><code>rednote.SearchFirstNoteAuthorTopLikedTitle</code></b><br><sub>在小红书搜&quot;探店&quot;，看看第一篇笔记的作者获赞最多的笔记标题是什么</sub><br><code>search</code> <code>query</code> <code>reasoning</code></td><td><b>keyword</b> <sub>enum</sub> <code>探店</code></td><td>rednote</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">6</td><td><b><code>rednote.UncollectFirstCollectedNote</code></b><br><sub>把我小红书收藏列表最前面的那篇笔记取消收藏</sub><br><code>nav</code> <code>social</code></td><td>—</td><td>rednote</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🔴 **L4** Expert (3)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>rednote.CheckFirstCollectedAuthorField</code></b><br><sub>去我小红书【收藏】列表里排在最前面的那篇笔记，告诉我作者的IP属地</sub><br><code>nav</code> <code>query</code></td><td><b>field</b> <sub>enum</sub> <code>IP属地</code></td><td>rednote</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">2</td><td><b><code>rednote.ReplyToFeedNoteFirstComment</code></b><br><sub>在小红书推荐页找标题含&quot;分享&quot;的笔记，回复第一条评论&quot;这个回复我也很认同&quot;</sub><br><code>explore</code> <code>social</code> <code>create</code></td><td><b>keyword</b> <sub>string</sub> <code>分享</code><br><b>reply</b> <sub>string</sub> <code>这个回复我也很认同</code></td><td>rednote</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">3</td><td><b><code>rednote.SearchCollectAndReportAuthor</code></b><br><sub>搜索&quot;读书&quot;，收藏第一篇笔记，告诉我作者有多少粉丝和获赞</sub><br><code>search</code> <code>social</code> <code>query</code></td><td><b>keyword</b> <sub>enum</sub> <code>读书</code></td><td>rednote</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>deep_dive</code></td></tr>
</table>

---

## 📦 sms

> **10** 个任务 · **带参数 8** · 🟢 L1×1 🔵 L2×4 🟡 L3×3 🔴 L4×2

### 🟢 **L1** Easy (1)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>sms.OpenConversationBySender</code></b><br><sub>打开来自中国电信的短信会话</sub><br><code>nav</code></td><td><b>conversation_id</b> <sub>enum</sub> <code>中国电信</code></td><td>sms</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>atomic</code></td></tr>
</table>

### 🔵 **L2** Medium (4)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>sms.CompareConversationMessageCount</code></b><br><sub>中国电信和中国联通这两个短信会话里，哪个消息更多</sub><br><code>extract</code> <code>reasoning</code></td><td><b>sender1</b> <sub>string</sub> <code>中国电信</code><br><b>sender2</b> <sub>string</sub> <code>中国联通</code><br><i>_pair</i> <sub>?</sub></td><td>sms</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">2</td><td><b><code>sms.ReadUnreadConversationCount</code></b><br><sub>数一下短信里现在有几个未读会话</sub><br><code>extract</code></td><td>—</td><td>sms</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">3</td><td><b><code>sms.ToggleFreeNetworkSetting</code></b><br><sub>把短信里屏蔽陌生人的网络短信设为关闭</sub><br><code>settings</code></td><td><b>setting_key</b> <sub>enum</sub> <code>屏蔽陌生人的网络短信</code><br><b>enabled</b> <sub>bool</sub> <code>关闭</code></td><td>sms</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>sms.ToggleMainSetting</code></b><br><sub>把短信的列表中显示头像设为关闭</sub><br><code>settings</code></td><td><b>setting_key</b> <sub>enum</sub> <code>列表中显示头像</code><br><b>enabled</b> <sub>bool</sub> <code>关闭</code></td><td>sms</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🟡 **L3** Hard (3)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>sms.FindAndReplySendersByKeyword</code></b><br><sub>把之前给我发过提到套餐短信的人都找出来，统一回一句拒收</sub><br><code>extract</code> <code>create</code></td><td><b>keyword</b> <sub>string</sub> <code>套餐</code><br><b>reply</b> <sub>string</sub> <code>拒收</code></td><td>sms</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">2</td><td><b><code>sms.MarkAllConversationsRead</code></b><br><sub>把短信里的所有会话都标成已读</sub><br><code>edit</code></td><td>—</td><td>sms</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">3</td><td><b><code>sms.ReplyToConversation</code></b><br><sub>给中国联通回复一条短信，内容是&quot;我知道了&quot;</sub><br><code>create</code></td><td><b>sender</b> <sub>enum</sub> <code>中国联通</code><br><b>content</b> <sub>string</sub> <code>我知道了</code></td><td>sms</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🔴 **L4** Expert (2)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>sms.DeleteConversation</code></b><br><sub>帮我把建设银行的短信会话删掉</sub><br><code>edit</code></td><td><b>sender</b> <sub>enum</sub> <code>建设银行</code></td><td>sms</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">2</td><td><b><code>sms.ReplyToLatestUnread</code></b><br><sub>看看最新的未读短信是哪个发来的，帮我回复他「好的收到」</sub><br><code>extract</code> <code>create</code></td><td><b>content</b> <sub>string</sub> <code>好的收到</code></td><td>sms</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
</table>

---

## 🎵 spotify

> **22** 个任务 · **带参数 21** · 🟢 L1×1 🔵 L2×12 🟡 L3×7 🔴 L4×2

### 🟢 **L1** Easy (1)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>spotify.TogglePrivacy</code></b><br><sub>关闭Spotify的向他人展示收听活动</sub><br><code>settings</code></td><td><b>toggle</b> <sub>bool</sub> <code>关闭</code></td><td>spotify</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>atomic</code></td></tr>
</table>

### 🔵 **L2** Medium (12)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>spotify.AddArtistSongsToPlaylist</code></b><br><sub>给Spotify创建一个歌单叫 华语R&amp;B精选 ，并往里补至少1首周杰伦的歌。</sub><br><code>search</code> <code>nav</code></td><td><b>playlist</b> <sub>string</sub> <code>华语R&amp;B精选</code><br><b>artist</b> <sub>string</sub> <code>周杰伦</code><br><b>min_count</b> <sub>integer</sub> <code>1</code></td><td>spotify</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>spotify.AddToQueueAndPlay</code></b><br><sub>把青花瓷加到Spotify的待播清单，然后直接切过去播放</sub><br><code>search</code> <code>nav</code></td><td><b>song</b> <sub>string</sub> <code>青花瓷</code></td><td>spotify</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>spotify.BuildPlaylistFromTwoArtists</code></b><br><sub>建一个叫《双艺人精选》的歌单，搜周杰伦和林俊杰各加2首歌进去，然后播放</sub><br><code>search</code> <code>create</code> <code>nav</code></td><td><b>playlist</b> <sub>string</sub> <code>双艺人精选</code><br><b>artist1</b> <sub>string</sub> <code>周杰伦</code><br><b>artist2</b> <sub>string</sub> <code>林俊杰</code><br><b>count</b> <sub>integer</sub> <code>2</code></td><td>spotify</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">4</td><td><b><code>spotify.CreateNewPlaylist</code></b><br><sub>在Spotify中创建一个名为 周末精选 的新歌单</sub><br><code>create</code></td><td><b>name</b> <sub>string</sub> <code>周末精选</code></td><td>spotify</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">5</td><td><b><code>spotify.DiscoverSaveAndReport</code></b><br><sub>在Spotify搜一下周杰伦，把搜索结果里最靠前的前3首歌收藏起来，告诉我分别叫什么</sub><br><code>search</code> <code>social</code> <code>extract</code></td><td><b>artist</b> <sub>?</sub> <code>周杰伦</code><br><b>count</b> <sub>integer</sub> <code>3</code></td><td>spotify</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">6</td><td><b><code>spotify.LikeSongFromSearch</code></b><br><sub>在Spotify帮我把青花瓷加到喜欢的歌里</sub><br><code>search</code> <code>social</code></td><td><b>song</b> <sub>string</sub> <code>青花瓷</code></td><td>spotify</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">7</td><td><b><code>spotify.PlaySongFromSearch</code></b><br><sub>帮我在Spotify播放《青花瓷》</sub><br><code>search</code> <code>nav</code></td><td><b>song</b> <sub>string</sub> <code>青花瓷</code></td><td>spotify</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">8</td><td><b><code>spotify.QueueAndLikeSong</code></b><br><sub>帮我在Spotify搜一下青花瓷，加到播放队列并收藏到我喜欢的歌里</sub><br><code>search</code> <code>social</code></td><td><b>song</b> <sub>string</sub> <code>青花瓷</code></td><td>spotify</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">9</td><td><b><code>spotify.SearchBuildPlaylistAndPlay</code></b><br><sub>在Spotify里搜索 周杰伦，把搜到的前3首歌加入一个叫 搜索精选 的新歌单，然后播放这个歌单并设为循环模式</sub><br><code>search</code> <code>create</code> <code>nav</code></td><td><b>keyword</b> <sub>string</sub> <code>周杰伦</code><br><b>count</b> <sub>integer</sub> <code>3</code><br><b>playlist</b> <sub>string</sub> <code>搜索精选</code></td><td>spotify</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">10</td><td><b><code>spotify.SearchPlayAndReport</code></b><br><sub>在Spotify中搜索《青花瓷》播放起来，告诉我这首歌的艺人名和时长</sub><br><code>search</code> <code>nav</code> <code>extract</code></td><td><b>song</b> <sub>string</sub> <code>青花瓷</code></td><td>spotify</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">11</td><td><b><code>spotify.SetSleepTimer</code></b><br><sub>帮我设一个30分钟的Spotify睡眠定时器</sub><br><code>settings</code> <code>nav</code></td><td><b>minutes</b> <sub>integer</sub> <code>30</code></td><td>spotify</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">12</td><td><b><code>spotify.SwapSongInPlaylist</code></b><br><sub>把歌单《华语R&amp;B精选》里的《搁浅》换成《晴天》</sub><br><code>search</code> <code>edit</code></td><td><b>playlist</b> <sub>string</sub> <code>华语R&amp;B精选</code><br><b>old_song</b> <sub>string</sub> <code>搁浅</code><br><b>new_song</b> <sub>string</sub> <code>晴天</code></td><td>spotify</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🟡 **L3** Hard (7)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>spotify.CollectLikedRecentAndPlay</code></b><br><sub>把Spotify我今天听过的歌里面我收藏过的歌整理到歌单《收藏精选》里，然后播放这个歌单</sub><br><code>nav</code> <code>create</code></td><td><b>playlist</b> <sub>string</sub> <code>收藏精选</code></td><td>spotify</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">2</td><td><b><code>spotify.FilterLikedSongsToPlaylist</code></b><br><sub>帮我把已收藏里所有Taylor Swift的歌移动到一个叫 精选收藏 的新歌单里</sub><br><code>nav</code> <code>create</code></td><td><b>artist</b> <sub>?</sub> <code>Taylor Swift</code><br><b>playlist</b> <sub>string</sub> <code>精选收藏</code></td><td>spotify</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">3</td><td><b><code>spotify.FollowAndPlayArtist</code></b><br><sub>Spotify搜一下周杰伦，关注TA，然后播TA最火的一首歌</sub><br><code>search</code> <code>social</code> <code>nav</code></td><td><b>artist</b> <sub>string</sub> <code>周杰伦</code></td><td>spotify</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>spotify.LikeAndAddToPlaylist</code></b><br><sub>把Spotify现在放的歌收藏一下，再加到歌单《我的最爱》里</sub><br><code>social</code> <code>nav</code></td><td><b>playlist</b> <sub>string</sub> <code>我的最爱</code></td><td>spotify</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">5</td><td><b><code>spotify.ListLibraryArtists</code></b><br><sub>Spotify音乐库里收藏了哪些艺人，帮我列出来</sub><br><code>extract</code> <code>nav</code></td><td>—</td><td>spotify</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">6</td><td><b><code>spotify.QueueTopArtistSongs</code></b><br><sub>在Spotify中搜一下最近播放中《Shape of You》的作者，进入艺人页把最靠前的3首歌加入播放队列。</sub><br><code>search</code> <code>nav</code></td><td><b>song</b> <sub>string</sub> <code>Shape of You</code> <sub title="sampled from">←apps.spotify.recentPlays[title]</sub><br><b>count</b> <sub>integer</sub> <code>3</code></td><td>spotify</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">7</td><td><b><code>spotify.SearchAlbumInfo</code></b><br><sub>搜索Spotify的专辑Thriller，告诉我这张专辑一共有多少首歌，是哪年发行的</sub><br><code>search</code> <code>extract</code></td><td><b>album</b> <sub>string</sub> <code>Thriller</code></td><td>spotify</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🔴 **L4** Expert (2)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>spotify.FindRecentArtistSongs</code></b><br><sub>Spotify最近播放里有没有Taylor Swift的歌，有的话告诉我歌名</sub><br><code>extract</code> <code>nav</code></td><td><b>artist</b> <sub>?</sub> <code>Taylor Swift</code> <sub title="sampled from">←apps.spotify.recentPlays[artist]</sub></td><td>spotify</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">2</td><td><b><code>spotify.MoveArtistToNewPlaylist</code></b><br><sub>看看歌单《华语R&amp;B精选》里有没有周杰伦的歌，有的话移到新歌单《杰伦专辑》里</sub><br><code>nav</code> <code>create</code> <code>edit</code></td><td><b>playlist</b> <sub>string</sub> <code>华语R&amp;B精选</code><br><b>artist</b> <sub>string</sub> <code>周杰伦</code><br><b>new_playlist</b> <sub>string</sub> <code>杰伦专辑</code></td><td>spotify</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
</table>

---

## 📹 tencent_meeting

> **21** 个任务 · **带参数 16** · 🟢 L1×2 🔵 L2×10 🟡 L3×5 🔴 L4×4

### 🟢 **L1** Easy (2)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>tencent_meeting.CheckContactCount</code></b><br><sub>我腾讯会议的通讯录里有多少位好友</sub><br><code>extract</code></td><td>—</td><td>tencent_meeting</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">2</td><td><b><code>tencent_meeting.CheckPersonalRoomId</code></b><br><sub>我的腾讯会议个人会议室号是多少</sub><br><code>extract</code></td><td>—</td><td>tencent_meeting</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>atomic</code></td></tr>
</table>

### 🔵 **L2** Medium (10)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>tencent_meeting.CalculateTotalMeetingDuration</code></b><br><sub>帮我算一下2月3日这天我一共开了多久会议，多少分钟</sub><br><code>extract</code> <code>reasoning</code></td><td><b>date</b> <sub>enum</sub> <code>2月3日</code></td><td>tencent_meeting</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">2</td><td><b><code>tencent_meeting.ChatInMeeting</code></b><br><sub>进入老王的老王的快速会议会议，在群里发一条消息：大家好，我到了</sub><br><code>social</code></td><td><b>host_name</b> <sub>string</sub> <code>老王</code><br><b>topic</b> <sub>string</sub> <code>老王的快速会议</code><br><b>message</b> <sub>string</sub> <code>大家好，我到了</code></td><td>tencent_meeting</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>tencent_meeting.CheckPendingMeetingId</code></b><br><sub>帮我查一下预约会议项目例会的会议号是多少</sub><br><code>extract</code></td><td><b>topic</b> <sub>enum</sub> <code>项目例会</code></td><td>tencent_meeting</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>tencent_meeting.CheckScheduledMeetingEndTime</code></b><br><sub>帮我看看预约会议项目例会几点结束</sub><br><code>extract</code></td><td><b>topic</b> <sub>enum</sub> <code>项目例会</code></td><td>tencent_meeting</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">5</td><td><b><code>tencent_meeting.ConfigAudioSettings</code></b><br><sub>帮我设置一下腾讯会议，入会时麦克风打开，扬声器关闭</sub><br><code>settings</code></td><td><b>mic_on</b> <sub>boolean</sub> <code>打开</code><br><b>speaker_on</b> <sub>boolean</sub> <code>关闭</code></td><td>tencent_meeting</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">6</td><td><b><code>tencent_meeting.ConfigPrivacySettings</code></b><br><sub>帮我设置一下，隐藏非视频参会者打开，隐藏自己打开</sub><br><code>settings</code></td><td><b>hide_non_video</b> <sub>boolean</sub> <code>打开</code><br><b>hide_self</b> <sub>boolean</sub> <code>打开</code></td><td>tencent_meeting</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">7</td><td><b><code>tencent_meeting.ConfigShowIdentity</code></b><br><sub>帮我设置一下，对外展示认证身份打开</sub><br><code>settings</code></td><td><b>show_identity</b> <sub>boolean</sub> <code>打开</code></td><td>tencent_meeting</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">8</td><td><b><code>tencent_meeting.FindMeetingHistory</code></b><br><sub>帮我查一下历史会议里小明的快速会议的开始时间和预定的会议时长</sub><br><code>extract</code></td><td><b>topic</b> <sub>enum</sub> <code>小明的快速会议</code></td><td>tencent_meeting</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">9</td><td><b><code>tencent_meeting.StartFastMeeting</code></b><br><sub>帮我开一个快速会议，打开视频，麦克风静音，不使用个人会议号</sub><br><code>create</code></td><td><b>video_on</b> <sub>boolean</sub> <code>打开</code><br><b>mute_on</b> <sub>boolean</sub> <code>静音</code><br><b>use_personal_room</b> <sub>boolean</sub> <code>不使用</code></td><td>tencent_meeting</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">10</td><td><b><code>tencent_meeting.ToggleNotification</code></b><br><sub>帮我把腾讯会议的消息通知关闭</sub><br><code>settings</code></td><td><b>notifications</b> <sub>boolean</sub> <code>关闭</code></td><td>tencent_meeting</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>atomic</code></td></tr>
</table>

### 🟡 **L3** Hard (5)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>tencent_meeting.CountFriendMeetings</code></b><br><sub>历史会议里有多少场是我腾讯会议的通讯录好友发起的</sub><br><code>extract</code> <code>reasoning</code></td><td>—</td><td>tencent_meeting</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">2</td><td><b><code>tencent_meeting.FindLongestMeeting</code></b><br><sub>历史会议里开得最久的是哪一场</sub><br><code>extract</code> <code>reasoning</code></td><td>—</td><td>tencent_meeting</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">3</td><td><b><code>tencent_meeting.FindMeetingWithMostParticipants</code></b><br><sub>历史会议里我开的哪一场会议参加的人最多，总共有多少人</sub><br><code>extract</code> <code>reasoning</code></td><td>—</td><td>tencent_meeting</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">4</td><td><b><code>tencent_meeting.GetSecondParticipationTime</code></b><br><sub>帮我查一下长时间研讨会这场会议我第二次加入是几点</sub><br><code>extract</code> <code>reasoning</code></td><td><b>topic</b> <sub>enum</sub> <code>长时间研讨会</code></td><td>tencent_meeting</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">5</td><td><b><code>tencent_meeting.JoinMeetingAndRename</code></b><br><sub>加入李四的技术方案评审会议，把昵称改成小明-北京，麦克风静音</sub><br><code>edit</code></td><td><b>host_name</b> <sub>string</sub> <code>李四</code><br><b>topic</b> <sub>string</sub> <code>技术方案评审</code><br><b>name</b> <sub>string</sub> <code>小明-北京</code><br><b>mute_on</b> <sub>boolean</sub> <code>静音</code></td><td>tencent_meeting</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🔴 **L4** Expert (4)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>tencent_meeting.ChatWithSpecificUser</code></b><br><sub>进入李四的技术方案评审会议，单独给李四发一条消息：我单独发你一下</sub><br><code>social</code></td><td><b>host_name</b> <sub>string</sub> <code>李四</code><br><b>topic</b> <sub>string</sub> <code>技术方案评审</code><br><b>target_user</b> <sub>string</sub> <code>李四</code><br><b>message</b> <sub>string</sub> <code>我单独发你一下</code></td><td>tencent_meeting</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>tencent_meeting.CompareParticipationDurations</code></b><br><sub>小明的快速会议和长时间研讨会这两场会议，我哪一场参加的时间更长</sub><br><code>extract</code> <code>reasoning</code></td><td><b>topic1</b> <sub>string</sub> <code>小明的快速会议</code><br><b>topic2</b> <sub>string</sub> <code>长时间研讨会</code><br><i>_topics</i> <sub>?</sub></td><td>tencent_meeting</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">3</td><td><b><code>tencent_meeting.ScheduleMeeting</code></b><br><sub>帮我预约一个会议，主题是预算评审会，时长60分钟，密码设为2468，然后告诉我会议号</sub><br><code>create</code> <code>extract</code></td><td><b>topic</b> <sub>enum</sub> <code>预算评审会</code><br><b>duration</b> <sub>enum</sub> <code>60</code><br><b>pin</b> <sub>string</sub> <code>2468</code></td><td>tencent_meeting</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>tencent_meeting.ShareScreenAndConfirm</code></b><br><sub>加入张三的产品需求讨论会议，先共享屏幕，然后给所有人发消息：我开始共享屏幕了</sub><br><code>social</code></td><td><b>host_name</b> <sub>string</sub> <code>张三</code><br><b>topic</b> <sub>string</sub> <code>产品需求讨论</code><br><b>message</b> <sub>string</sub> <code>我开始共享屏幕了</code></td><td>tencent_meeting</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

---

## 🌤️ weather

> **22** 个任务 · **带参数 21** · 🟢 L1×3 🔵 L2×10 🟡 L3×5 🔴 L4×4

### 🟢 **L1** Easy (3)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>weather.CheckCurrentTemp</code></b><br><sub>帮我看看北京现在多少度</sub><br><code>extract</code></td><td><b>city</b> <sub>enum</sub> <code>北京</code></td><td>weather</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">2</td><td><b><code>weather.CheckCurrentWeather</code></b><br><sub>上海当前天气怎么样</sub><br><code>extract</code></td><td><b>city</b> <sub>enum</sub> <code>上海</code></td><td>weather</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">3</td><td><b><code>weather.EnableNightDnd</code></b><br><sub>打开天气的夜间免打扰</sub><br><code>settings</code></td><td>—</td><td>weather</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>atomic</code></td></tr>
</table>

### 🔵 **L2** Medium (10)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>weather.AddCityAndFindWarmestDay</code></b><br><sub>把南京加到天气里，然后看看那边未来一周哪天最暖和</sub><br><code>search</code> <code>extract</code> <code>reasoning</code></td><td><b>city</b> <sub>enum</sub> <code>南京</code></td><td>weather</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>weather.AddCityFullReport</code></b><br><sub>把武汉加到天气里，告诉我那边现在的温度、湿度和空气质量</sub><br><code>search</code> <code>extract</code></td><td><b>city</b> <sub>enum</sub> <code>武汉</code></td><td>weather</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>weather.CheckAQIPollutant</code></b><br><sub>查看上海当前PM2.5是多少</sub><br><code>extract</code></td><td><b>city</b> <sub>enum</sub> <code>上海</code><br><b>pollutant</b> <sub>enum</sub> <code>PM2.5</code></td><td>weather</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>weather.CheckDetailCard</code></b><br><sub>帮我看看北京的湿度多少</sub><br><code>extract</code></td><td><b>city</b> <sub>enum</sub> <code>北京</code><br><b>metric</b> <sub>enum</sub> <code>湿度多少</code></td><td>weather</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">5</td><td><b><code>weather.CheckLifeIndex</code></b><br><sub>杭州今天洗车指数怎么样</sub><br><code>extract</code></td><td><b>city</b> <sub>enum</sub> <code>杭州</code><br><b>index_type</b> <sub>enum</sub> <code>洗车指数怎么样</code></td><td>weather</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">6</td><td><b><code>weather.CompareCityTemp</code></b><br><sub>帮我看看北京和上海哪个城市现在更热</sub><br><code>extract</code> <code>reasoning</code></td><td><b>city1</b> <sub>string</sub> <code>北京</code><br><b>city2</b> <sub>string</sub> <code>上海</code><br><i>_cities</i> <sub>?</sub></td><td>weather</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">7</td><td><b><code>weather.OpenDailyForecast</code></b><br><sub>看看北京2026-03-23的天气怎么样</sub><br><code>extract</code></td><td><b>city</b> <sub>enum</sub> <code>北京</code><br><b>date</b> <sub>string</sub> <code>2026-03-23</code></td><td>weather</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">8</td><td><b><code>weather.SwitchTempUnit</code></b><br><sub>把天气的温度单位改成华氏度</sub><br><code>settings</code></td><td><b>unit</b> <sub>enum</sub> <code>华氏度</code></td><td>weather</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">9</td><td><b><code>weather.SwitchUnitAndReport</code></b><br><sub>把温度单位切到华氏度，然后告诉我上海现在华氏多少度</sub><br><code>settings</code> <code>extract</code></td><td><b>city</b> <sub>enum</sub> <code>上海</code></td><td>weather</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">10</td><td><b><code>weather.SwitchWindUnit</code></b><br><sub>把天气的风速单位改成米/秒</sub><br><code>settings</code></td><td><b>unit</b> <sub>enum</sub> <code>米/秒</code></td><td>weather</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🟡 **L3** Hard (5)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>weather.ColdestDayIn14</code></b><br><sub>成都未来两周最冷的是哪天（当日最低温最低的一天），最低温是多少</sub><br><code>extract</code> <code>reasoning</code></td><td><b>city</b> <sub>enum</sub> <code>成都</code></td><td>weather</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">2</td><td><b><code>weather.CompareHumidity</code></b><br><sub>北京和上海哪个城市现在更潮湿</sub><br><code>extract</code> <code>reasoning</code></td><td><b>city1</b> <sub>string</sub> <code>北京</code><br><b>city2</b> <sub>string</sub> <code>上海</code><br><i>_cities</i> <sub>?</sub></td><td>weather</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>weather.CompareTempRange</code></b><br><sub>北京和上海哪个城市明天温差更大</sub><br><code>extract</code> <code>reasoning</code></td><td><b>city1</b> <sub>string</sub> <code>北京</code><br><b>city2</b> <sub>string</sub> <code>上海</code><br><i>_cities</i> <sub>?</sub></td><td>weather</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>weather.FeelsLikeDiff</code></b><br><sub>北京现在体感温度和实际温度差几度</sub><br><code>extract</code> <code>reasoning</code></td><td><b>city</b> <sub>enum</sub> <code>北京</code></td><td>weather</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">5</td><td><b><code>weather.WarmestDayInWeek</code></b><br><sub>深圳未来五天里哪天的最高温是最高的，这天天气怎么样</sub><br><code>extract</code> <code>reasoning</code></td><td><b>city</b> <sub>enum</sub> <code>深圳</code></td><td>weather</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🔴 **L4** Expert (4)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>weather.ConditionalAction</code></b><br><sub>如果深圳现在超过30度就把天气预警提醒打开，没超过就关掉</sub><br><code>extract</code> <code>settings</code> <code>reasoning</code></td><td><b>city</b> <sub>enum</sub> <code>深圳</code><br><b>temp</b> <sub>enum</sub> <code>30</code></td><td>weather</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>weather.NightLowTemp</code></b><br><sub>帮我看看广州今晚18点到次日4点的最低气温是多少</sub><br><code>extract</code> <code>reasoning</code></td><td><b>city</b> <sub>enum</sub> <code>广州</code></td><td>weather</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">3</td><td><b><code>weather.ThreeCityRainCheck</code></b><br><sub>北京、上海和广州未来一周哪个城市最不容易下雨</sub><br><code>extract</code> <code>reasoning</code></td><td><b>city1</b> <sub>string</sub> <code>北京</code><br><b>city2</b> <sub>string</sub> <code>上海</code><br><b>city3</b> <sub>string</sub> <code>广州</code><br><i>_cities</i> <sub>?</sub></td><td>weather</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">4</td><td><b><code>weather.WeekendTempRange3City</code></b><br><sub>周末想出去玩，帮我看看北京、上海、广州周末哪个城市温差小</sub><br><code>extract</code> <code>reasoning</code></td><td><b>city1</b> <sub>string</sub> <code>北京</code><br><b>city2</b> <sub>string</sub> <code>上海</code><br><b>city3</b> <sub>string</sub> <code>广州</code><br><i>_cities</i> <sub>?</sub></td><td>weather</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
</table>

---

## 💬 wechat

> **26** 个任务 · **带参数 18** · 🟢 L1×7 🔵 L2×9 🟡 L3×9 🔴 L4×1

### 🟢 **L1** Easy (7)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>wechat.DeauthorizeApp</code></b><br><sub>取消微信对拼多多的授权</sub><br><code>nav</code> <code>settings</code></td><td><b>app_name</b> <sub>string</sub> <code>拼多多</code> <sub title="sampled from">←apps.wechat.authorizedApps[name]</sub></td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>wechat.EnableDarkMode</code></b><br><sub>开启微信深色模式</sub><br><code>settings</code></td><td>—</td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">3</td><td><b><code>wechat.OpenNewFriends</code></b><br><sub>打开微信好友添加验证记录页面</sub><br><code>nav</code></td><td>—</td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">4</td><td><b><code>wechat.OpenRadarAddFriend</code></b><br><sub>打开微信雷达加好友页面</sub><br><code>nav</code></td><td>—</td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">5</td><td><b><code>wechat.ReadContactRegion</code></b><br><sub>帮我看看微信里blank.是哪里人</sub><br><code>nav</code> <code>extract</code></td><td><b>contact</b> <sub>string</sub> <code>blank.</code> <sub title="sampled from">←apps.wechat.contacts[name]</sub></td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">6</td><td><b><code>wechat.ReadMyWxid</code></b><br><sub>帮我看看微信里我的微信号是多少</sub><br><code>nav</code> <code>extract</code></td><td>—</td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">7</td><td><b><code>wechat.ToggleFriendConfirmation</code></b><br><sub>不需要开启微信加好友验证</sub><br><code>settings</code></td><td><b>toggle</b> <sub>bool</sub> <code>不需要开启</code></td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>atomic</code></td></tr>
</table>

### 🔵 **L2** Medium (9)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>wechat.ConditionalReplyToBoss</code></b><br><sub>在微信里看看Boss之前有没有问过关于项目进度的消息，有的话给他发上次的项目一切顺利，没有就发项目进展正常</sub><br><code>extract</code> <code>reasoning</code> <code>edit</code></td><td><b>keyword</b> <sub>string</sub> <code>项目进度</code><br><b>yes_reply</b> <sub>string</sub> <code>上次的项目一切顺利</code><br><b>no_reply</b> <sub>string</sub> <code>项目进展正常</code></td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">2</td><td><b><code>wechat.OpenBlacklist</code></b><br><sub>打开微信通讯录黑名单页面</sub><br><code>nav</code></td><td>—</td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">3</td><td><b><code>wechat.PostMomentsText</code></b><br><sub>发一条朋友圈，内容为'Hello World!'</sub><br><code>create</code></td><td><b>content</b> <sub>string</sub> <code>Hello World!</code></td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>wechat.PostMomentsTextWithCity</code></b><br><sub>发一条朋友圈，内容为'Hello World!'，定位到 北京市</sub><br><code>create</code></td><td><b>content</b> <sub>string</sub> <code>Hello World!</code><br><b>location</b> <sub>string</sub> <code>北京市</code></td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">5</td><td><b><code>wechat.SetMomentsVisibleRange</code></b><br><sub>设置微信朋友查看我朋友圈的范围为最近半年可见</sub><br><code>nav</code> <code>settings</code></td><td><b>range</b> <sub>enum</sub> <code>最近半年</code></td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">6</td><td><b><code>wechat.SetPatText</code></b><br><sub>设置微信拍一拍昵称为'并笑了一下'</sub><br><code>edit</code></td><td><b>text</b> <sub>string</sub> <code>并笑了一下</code></td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">7</td><td><b><code>wechat.SetSignature</code></b><br><sub>把微信里的个性签名改成享受每一天</sub><br><code>nav</code> <code>edit</code></td><td><b>text</b> <sub>enum</sub> <code>享受每一天</code></td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">8</td><td><b><code>wechat.ToggleMobileAutoPlayMomentsVideo</code></b><br><sub>关闭微信移动网络下朋友圈视频自动播放</sub><br><code>nav</code> <code>settings</code></td><td><b>toggle</b> <sub>bool</sub> <code>关闭</code></td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">9</td><td><b><code>wechat.ToggleStrangerViewMoments</code></b><br><sub>关闭微信允许陌生人查看十条朋友圈</sub><br><code>nav</code> <code>settings</code></td><td><b>toggle</b> <sub>bool</sub> <code>关闭</code></td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🟡 **L3** Hard (9)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>wechat.BlacklistContact</code></b><br><sub>把微信里的刘浪加入黑名单</sub><br><code>nav</code> <code>settings</code></td><td><b>contact</b> <sub>string</sub> <code>刘浪</code></td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>wechat.DisableWechatSportsLeaderboard</code></b><br><sub>开启微信运动功能但是关闭加入步数排行榜</sub><br><code>nav</code> <code>settings</code></td><td>—</td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>wechat.PostMomentFromChat</code></b><br><sub>看看微信里张伟最近给我发了什么消息，把那条消息的内容原封不动发到朋友圈</sub><br><code>extract</code> <code>create</code> <code>social</code> <code>handoff</code></td><td><b>contact</b> <sub>enum</sub> <code>张伟</code></td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">4</td><td><b><code>wechat.ReadStepsLeaderboardTop</code></b><br><sub>打开微信运动功能，然后看看谁走的步数最多</sub><br><code>nav</code> <code>settings</code> <code>extract</code></td><td>—</td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">5</td><td><b><code>wechat.ScenicPhotoToMomentsWithPhrase</code></b><br><sub>把上周拍的颐和园万寿山照片发到朋友圈，配文带上春天真好</sub><br><code>social</code> <code>handoff</code></td><td><b>time_hint</b> <sub>string</sub> <code>上周</code><br><b>place_name</b> <sub>string</sub> <code>颐和园万寿山</code><br><b>required_phrase</b> <sub>string</sub> <code>春天真好</code><br><i>_photo_path</i> <sub>string</sub> <code>/sdcard/DCIM/Camera/IMG…</code></td><td>wechat</td><td align="center"><code>S2</code></td><td align="center"><code>operate</code></td><td align="center"><code>transfer</code></td></tr>
<tr><td align="right">6</td><td><b><code>wechat.SetAddMeSearch</code></b><br><sub>设置微信添加好友时仅能通过微信号搜索到我</sub><br><code>settings</code></td><td>—</td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">7</td><td><b><code>wechat.SetFriendChatOnly</code></b><br><sub>把微信联系人blank.的权限改成仅聊天</sub><br><code>nav</code> <code>settings</code></td><td><b>contact</b> <sub>string</sub> <code>blank.</code></td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">8</td><td><b><code>wechat.ToggleDiscoverEntry</code></b><br><sub>关闭微信发现页的朋友圈入口</sub><br><code>nav</code> <code>settings</code></td><td><b>entry</b> <sub>enum</sub> <code>朋友圈</code><br><b>toggle</b> <sub>bool</sub> <code>关闭</code></td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">9</td><td><b><code>wechat.ToggleWechatSports</code></b><br><sub>开启微信运动功能</sub><br><code>nav</code> <code>settings</code></td><td><b>toggle</b> <sub>bool</sub> <code>开启</code></td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🔴 **L4** Expert (1)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>wechat.StarAndRestrictFriend</code></b><br><sub>把微信联系人blank.设为星标好友，不让他看我的朋友圈，也不看他朋友圈</sub><br><code>nav</code> <code>settings</code></td><td><b>contact</b> <sub>string</sub> <code>blank.</code></td><td>wechat</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

---

## 📖 wechat_reading

> **22** 个任务 · **带参数 20** · 🟢 L1×4 🔵 L2×8 🟡 L3×9 🔴 L4×1

### 🟢 **L1** Easy (4)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>wechat_reading.CheckBookRating</code></b><br><sub>帮我看看微信读书里《活着》推荐值多少</sub><br><code>extract</code></td><td><b>book_title</b> <sub>string</sub> <code>活着</code> <sub title="sampled from">←apps.wechat_reading.store[title]</sub></td><td>wechat_reading</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>wechat_reading.CheckCoinBalance</code></b><br><sub>微信读书里书币还有多少</sub><br><code>extract</code></td><td>—</td><td>wechat_reading</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">3</td><td><b><code>wechat_reading.ManageShelf</code></b><br><sub>把微信读书书架里《红楼梦》移出去</sub><br><code>delete</code></td><td><b>book_title</b> <sub>string</sub> <code>红楼梦</code></td><td>wechat_reading</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>wechat_reading.UnfollowUser</code></b><br><sub>在微信读书取消关注508</sub><br><code>edit</code></td><td><i>user_id</i> <sub>string</sub> <code>user_508</code><br><b>user_name</b> <sub>string</sub> <code>508</code><br><i>_following_user</i> <sub>?</sub></td><td>wechat_reading</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🔵 **L2** Medium (8)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>wechat_reading.AddBookAndReadTo</code></b><br><sub>帮我在微信读书找到《三体》加到书架，调整读书进度到20%</sub><br><code>search</code> <code>create</code> <code>edit</code></td><td><b>book_title</b> <sub>string</sub> <code>三体</code><br><b>percentage</b> <sub>integer</sub> <code>20</code><br><i>_add_read</i> <sub>?</sub></td><td>wechat_reading</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>wechat_reading.AddBookToShelf</code></b><br><sub>把《三体》加到微信读书书架</sub><br><code>search</code> <code>create</code></td><td><b>book_title</b> <sub>string</sub> <code>三体</code></td><td>wechat_reading</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>wechat_reading.CompareBookLengths</code></b><br><sub>对比微信读书里《三体》和《活着》的字数，告诉我字数多的那本，然后加到书架</sub><br><code>extract</code> <code>reasoning</code> <code>create</code></td><td><b>book1</b> <sub>string</sub> <code>三体</code><br><b>book2</b> <sub>string</sub> <code>活着</code><br><i>_book_pair</i> <sub>?</sub></td><td>wechat_reading</td><td align="center"><code>S1</code></td><td align="center"><code>hybrid</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">4</td><td><b><code>wechat_reading.ConfigureReaderSettings</code></b><br><sub>把微信读书的阅读器字体大小调成22，翻页方式改成仿真翻页</sub><br><code>settings</code></td><td><b>font_size</b> <sub>enum</sub> <code>22</code><br><b>style</b> <sub>enum</sub> <code>仿真翻页</code></td><td>wechat_reading</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">5</td><td><b><code>wechat_reading.EditProfileName</code></b><br><sub>把微信读书的昵称改成阿青</sub><br><code>edit</code></td><td><b>new_name</b> <sub>enum</sub> <code>阿青</code></td><td>wechat_reading</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">6</td><td><b><code>wechat_reading.FindAudiobookPlays</code></b><br><sub>微信读书里《红楼梦》有声版播放量多少</sub><br><code>search</code> <code>extract</code></td><td><b>book_title</b> <sub>string</sub> <code>红楼梦</code> <sub title="sampled from">←apps.wechat_reading.audiobooks[title]</sub></td><td>wechat_reading</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">7</td><td><b><code>wechat_reading.SearchBookAuthor</code></b><br><sub>微信读书里《活着》是谁写的</sub><br><code>search</code> <code>extract</code></td><td><b>book_title</b> <sub>string</sub> <code>活着</code> <sub title="sampled from">←apps.wechat_reading.store[title]</sub></td><td>wechat_reading</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">8</td><td><b><code>wechat_reading.SetProfileVisibility</code></b><br><sub>把微信读书主页可见范围改成仅自己可见</sub><br><code>settings</code></td><td><b>visibility</b> <sub>enum</sub> <code>仅自己可见</code></td><td>wechat_reading</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🟡 **L3** Hard (9)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>wechat_reading.AnalyzeReadingHabit</code></b><br><sub>最近一周在微信读书上哪天读的时间最长</sub><br><code>extract</code> <code>reasoning</code></td><td>—</td><td>wechat_reading</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">2</td><td><b><code>wechat_reading.CheckCalendarMonthReading</code></b><br><sub>微信读书2026年1月总共读了多少天</sub><br><code>extract</code> <code>reasoning</code></td><td><b>year</b> <sub>integer</sub> <code>2026</code><br><b>month</b> <sub>integer</sub> <code>1</code><br><i>_record_month</i> <sub>?</sub></td><td>wechat_reading</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">3</td><td><b><code>wechat_reading.CheckHotSearchRank</code></b><br><sub>微信读书热搜榜第1名是什么书</sub><br><code>extract</code></td><td><b>rank</b> <sub>integer</sub> <code>1</code></td><td>wechat_reading</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>atomic</code></td></tr>
<tr><td align="right">4</td><td><b><code>wechat_reading.FindHighestRatedBookInCategory</code></b><br><sub>微信读书文学分类里评分最高的书是哪本</sub><br><code>extract</code> <code>reasoning</code></td><td><b>category</b> <sub>string</sub> <code>文学</code></td><td>wechat_reading</td><td align="center"><code>S1</code></td><td align="center"><code>query</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">5</td><td><b><code>wechat_reading.FindLowestProgressAndRead</code></b><br><sub>微信读书书架里哪本书我读的进度最低，帮我翻到50%的位置</sub><br><code>reasoning</code> <code>edit</code></td><td><b>percentage</b> <sub>integer</sub> <code>50</code><br><i>_lowest_pct</i> <sub>?</sub></td><td>wechat_reading</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
<tr><td align="right">6</td><td><b><code>wechat_reading.PrivacyAndThemeBundle</code></b><br><sub>把微信读书的阅读颜色换成米黄，开启&quot;关注你须获得你的同意&quot;，再把翻页方式改成仿真翻页</sub><br><code>settings</code></td><td><b>theme_color</b> <sub>enum</sub> <code>米黄</code><br><b>privacy_label</b> <sub>string</sub> <code>关注你须获得你的同意</code><br><i>setting_key</i> <sub>string</sub> <code>requireFollowRequest</code><br><b>style</b> <sub>enum</sub> <code>仿真翻页</code><br><i>_privacy_setting</i> <sub>?</sub></td><td>wechat_reading</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">7</td><td><b><code>wechat_reading.ReadBookProgress</code></b><br><sub>把微信读书里《红楼梦》翻到20%的位置</sub><br><code>edit</code></td><td><b>book_title</b> <sub>string</sub> <code>红楼梦</code><br><b>percentage</b> <sub>integer</sub> <code>20</code><br><i>_progress_target</i> <sub>?</sub></td><td>wechat_reading</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">8</td><td><b><code>wechat_reading.SetDarkMode</code></b><br><sub>把微信读书深色模式改成深色模式</sub><br><code>settings</code></td><td><b>dark_mode</b> <sub>enum</sub> <code>深色模式</code></td><td>wechat_reading</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">9</td><td><b><code>wechat_reading.TogglePrivateReading</code></b><br><sub>把书架里的《苏菲的世界》设成私密阅读</sub><br><code>settings</code> <code>edit</code></td><td><b>book_title</b> <sub>string</sub> <code>苏菲的世界</code></td><td>wechat_reading</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🔴 **L4** Expert (1)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>wechat_reading.OrganizeShelfByRecommendation</code></b><br><sub>整理微信读书书架，把推荐值不高于95.0%的书都删掉</sub><br><code>delete</code> <code>reasoning</code></td><td><b>recommendation</b> <sub>float</sub> <code>95.0</code></td><td>wechat_reading</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>deep_dive</code></td></tr>
</table>

---

## 🐦 x

> **11** 个任务 · **带参数 8** · 🟢 L1×2 🔵 L2×4 🟡 L3×3 🔴 L4×2

### 🟢 **L1** Easy (2)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>x.PostWithImageAndReply</code></b><br><sub>我想在X发一条推文说「今天天气真不错。」，再给自己这条推文回复一句「这是我对自己这条推文的回复。」</sub><br><code>create</code> <code>social</code></td><td><b>content</b> <sub>string</sub> <code>今天天气真不错。</code><br><b>reply_content</b> <sub>string</sub> <code>这是我对自己这条推文的回复。</code></td><td>x</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>x.SendDmToConversation</code></b><br><sub>我想在X私信里找到和@unknown的聊天框，发一句「Hello from benchmark.」</sub><br><code>social</code> <code>create</code></td><td><i>_target_conversation</i> <sub>?</sub><br><i>conversation_id</i> <sub>string</sub><br><b>participant_handle</b> <sub>string</sub> <code>@unknown</code><br><i>last_message_preview</i> <sub>string</sub> <code>示例消息</code><br><b>content</b> <sub>string</sub> <code>Hello from benchmark.</code></td><td>x</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🔵 **L2** Medium (4)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>x.FollowUserAndLikeTheirPost</code></b><br><sub>我想在X上关注（某位用户），再给TA发的随便一条推文点个赞</sub><br><code>social</code> <code>search</code></td><td><i>_target_user</i> <sub>?</sub><br><b>user_handle</b> <sub>string</sub><br><b>user_name</b> <sub>string</sub> <code>某位用户</code></td><td>x</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>x.ReplyAndRetweetSamePost</code></b><br><sub>我想找到@unknown发的有「示例内容」的推文，先评论「Great post!」，再把这条推文转发出去</sub><br><code>social</code> <code>create</code></td><td><i>_target_post</i> <sub>?</sub><br><i>post_id</i> <sub>string</sub><br><b>author_handle</b> <sub>string</sub> <code>@unknown</code><br><b>post_preview</b> <sub>string</sub> <code>示例内容</code><br><b>reply_content</b> <sub>string</sub> <code>Great post!</code></td><td>x</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>x.SearchAndBookmark</code></b><br><sub>我想在X搜「Tesla」，从结果里找一条相关推文收藏</sub><br><code>search</code> <code>social</code></td><td><b>keyword</b> <sub>enum</sub> <code>Tesla</code></td><td>x</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">4</td><td><b><code>x.SetCallPermissionsBundle</code></b><br><sub>我想在X设置里打开音视频通话，只让我关注的人和认证用户能打给我，不让通讯录里的人打过来</sub><br><code>nav</code> <code>settings</code></td><td>—</td><td>x</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🟡 **L3** Hard (3)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>x.ComplexSettingsChain</code></b><br><sub>帮我统一调一下X的几个设置：帖子互动显示互动量，关闭探索页里“显示你当前所在位置的内容”，过滤器打开只留重要通知，只启用聊天推送，再把推送通知里的“推荐”关掉</sub><br><code>nav</code> <code>settings</code> <code>explore</code></td><td>—</td><td>x</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>x.SetAudiencePrivacyBundle</code></b><br><sub>我想改一下X的隐私设置：帖子私密开启，视频保护开启，照片圈人关闭</sub><br><code>nav</code> <code>settings</code></td><td><b>private_posts</b> <sub>bool</sub> <code>开启</code><br><b>protect_videos</b> <sub>bool</sub> <code>开启</code><br><b>photo_tagging</b> <sub>bool</sub> <code>关闭</code></td><td>x</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">3</td><td><b><code>x.SetPushNotificationMix</code></b><br><sub>我想改改X的推送，把推荐推送关掉，保留紧急警报和专业版相关的通知</sub><br><code>nav</code> <code>settings</code></td><td>—</td><td>x</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

### 🔴 **L4** Expert (2)

<table>
<tr><th align="right">#</th><th>Task ID</th><th>Params</th><th>App</th><th align="center">Scope</th><th align="center">Objective</th><th align="center">Composition</th></tr>
<tr><td align="right">1</td><td><b><code>x.QuotePostAndTweet</code></b><br><sub>我想找到@unknown发的那条带「示例内容」的推文，引用它再发一条新推文，内容是「Quoting this post for testing.」</sub><br><code>search</code> <code>social</code> <code>create</code></td><td><i>_target_post</i> <sub>?</sub><br><i>post_id</i> <sub>string</sub><br><b>author_handle</b> <sub>string</sub> <code>@unknown</code><br><b>post_preview</b> <sub>string</sub> <code>示例内容</code><br><b>content</b> <sub>string</sub> <code>Quoting this post for t…</code></td><td>x</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
<tr><td align="right">2</td><td><b><code>x.SearchMultipleKeywordsAndInteract</code></b><br><sub>我想先在X搜「Tesla」，给一条相关推文点赞，再搜「Linux」，把一条相关推文收藏起来</sub><br><code>search</code> <code>social</code></td><td><b>keyword1</b> <sub>enum</sub> <code>Tesla</code><br><b>keyword2</b> <sub>enum</sub> <code>Linux</code></td><td>x</td><td align="center"><code>S1</code></td><td align="center"><code>operate</code></td><td align="center"><code>sequential</code></td></tr>
</table>

---

*共 **440** 个任务，其中 **355** 个带参数（模板参数 353，仅内部 2） · 由 `bench_env/task_listing.py` 自动生成*
