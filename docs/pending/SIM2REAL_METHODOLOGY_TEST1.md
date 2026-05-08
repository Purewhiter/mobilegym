# Sim2Real Real-Device Evaluation — test.txt Methodology

> 本文档只记录 [bench_env/splits/test.txt](../../bench_env/splits/test.txt)（256 任务）的最终 sim2real 口径。paper 写作时引用本文档，不混入其他评测集数字。

配套文件：

- [bench_env/splits/train.txt](../../bench_env/splits/train.txt) — 164 任务的实际训练集；与 `train.raw.txt` 内容一致
- [bench_env/splits/train.raw.txt](../../bench_env/splits/train.raw.txt) — 训练集 provenance，来自 qwen3-vl-4b base 8 次 rollout 中通过次数在 1-7 之间的任务
- [bench_env/splits/test.txt](../../bench_env/splits/test.txt) — 256 任务的最终评测集
- [bench_env/splits/train.legacy_199.txt](../../bench_env/splits/train.legacy_199.txt) — 旧 199 任务训练 split 备份，不作为 paper 训练口径
- [sim2real_instructions.json](../../bench_env/splits/sim2real_instructions.json) — test selection 中 59 个真机可执行任务的烘焙指令（53 个已有真机 + 6 个补跑）

待补 artifact：

- `SIM2REAL_SELECTION_TEST.txt` / `SIM2REAL_TEST_BUCKETS.csv` — 固化 test 的桶、sim pass count、真机覆盖状态
- `SIM2REAL_PARAM_AUDIT_TEST.txt` — test selection 67 的参数/模板审计
- `sim2real_instructions_test.json` — 可选：从当前 `bench_env/splits/sim2real_instructions.json` 拆出的 test-only `--task-instructions`

---

## 1. test 评测口径

本文档使用 **test.txt（256 任务）** 作为唯一评测池：

| 设计点 | 说明 |
|---|---|
| 单一测试集 | paper 主结果只报告 test，不并列报告其他评测池 |
| outcome-stratified selection | 按 qwen3-vl-4b base 与 qwen3-vl-4b-10s trained 的 sim 结果划分 uplift / stable_pass / mid / stable_fail |
| 真机子集 | 真机只跑 uplift / stable_pass / mid 三个有信息量的桶；stable_fail 不进入真机主表 |
| 人工复核 | 真机结果以人工复核为准，VLM judge 只作为辅助记录 |

---

## 2. test.txt 桶分布

用 qwen3-vl-4b base 4-seed + qwen3-vl-4b-10s trained 4-seed 完整 sim 数据：

> 注意：当前 `runs/` 目录中的 raw shard 不完全等价于本文使用的汇总表（例如 trained 有补跑 shard 文件名为 `result.jsonl`，且部分 shard 只覆盖 52 条任务）。为保证 paper 可复现，需要把下表固化为 `SIM2REAL_TEST_BUCKETS.csv`。

| 桶 | 规则 | 规模 | 选 | 作用 |
|---|---|---:|---:|---|
| uplift | base ≤1/4 ∧ trained ≥3/4 | **26** | **26**（全选）| 主结论（训练带来的提升）|
| stable_pass | 双方 ≥3/4 | **21** | **21**（全选）| 基线能力迁移 sanity |
| mid | partial 提升 | **20** | **20**（全选）| 边际信号 / failure analysis |
| regression | base ≥3/4 ∧ trained ≤1/4 | **0** | – | 当前 test 统计中未观察到 |
| stable_fail | 双方 ≤1/4 | **189** | 0 | 无区分信号，真机大概率也 fail |
| 合计 | – | **256** | **67** | – |

---

## 3. Selection: 全选 67

**全选的辩护理由**：

1. **有信息量桶全覆盖**：uplift/stable_pass/mid 共 67 个任务全部进入 selection
2. **Selection 桶内抽样噪声为 0**：三个桶不再抽样，因此 sim 侧 selection 能无损代表这三个桶
3. **stable_fail 不进入主真机集**：stable_fail 双模型几乎都失败，真机主表不把它作为核心证据

---

## 4. Sim 侧重加权估计

把 selection 67 重加权回 test 全集（256），用 stratified estimator：

```
estimated_test_pass_rate = Σ_b (sample_pass_rate_b × N_b / 256)
```

**验证结果**：

| 估计方法 | base 估计 | base 实际 | 偏差 | trained 估计 | trained 实际 | 偏差 |
|---|---:|---:|---:|---:|---:|---:|
| 桶内全用真实平均 | 9.38% | 9.38% | **+0.00pt** | 22.27% | 22.27% | **+0.00pt** |
| Sample-based（stable_fail 假设 0）| 8.98% | 9.38% | -0.39pt | 20.41% | 22.27% | -1.86pt |

第一行 **0.00pt** 偏差——因为 selection 桶（uplift/stable_pass/mid）100% 采样、stable_fail 桶用 sim 真实 pass rate（base 4/756、trained 19/756）参与重加权，**sim 侧 estimator 完全 lossless**。

第二行 ~0.5-1.6pt 偏差来自 "stable_fail 假设 0%" 简化。真机重加权到 256 也需要额外假设 stable_fail real pass≈0；目前只有 2 条真机旁证，因此只能作为附表/limitation 口径，不能写成已充分验证。

---

## 5. 真机数据复用与补跑完成状态

selection 67 中：

| 类别 | 数量 |
|---|---|
| **已完成真机数据** | **53** |
| **补跑真机数据**（人工复核）| **6** |
| **§7.1 不可配置排除**（账号变更 / 硬件 / 不可复制设备状态）| **8** |
| 合计 | **67** |

6 个补跑任务完成后，selection 中除 8 个不可配置任务外，59 个真机可执行任务已经全覆盖。

---

## 6. §7.1 不可配置排除（8 个）

这些任务在真机上要么不可逆，要么需要预置真机无法等价复现的状态：

### uplift 桶 (5)

| 任务 | 原因 |
|---|---|
| `account.Railway12306ForgotPasswordReset` | 12306 找回密码流程，操作账号不可逆 |
| `account.WechatAccountCancellation` | 微信注销不可逆 |
| `bilibili.CoinVideoTask` | 投币消耗真实硬币 |
| `crossapp_work.MeetingLongestInfoToWechat` | 需预置一组假会议历史，真机无法等价配置 |
| `tencent_meeting.CheckContactCount` | 需预置假联系人 |

### stable_pass 桶 (3)

| 任务 | 原因 |
|---|---|
| `account.Railway12306ChangePassword` | 12306 改密码不可逆 |
| `reddit.Reddit_DeleteSeededChatMessage` | 需预置聊天再删除 |
| `x.SendDmToConversation` | 需预置 X DM 会话 |

`x.SetChatPrivacyBundle` 的模拟器流程参考 iOS 版 X App，而 Android 真机没有等价设置路径，因此不纳入 test；当前 test 使用 `crossapp_commerce.AlipayShareBillDetail`。

---

## 7. 补跑的 6 个真机评测结果

每个任务跑 **base + trained 两个模型 × 单轮 pass@1 = 2 条轨迹**，6 个共 **12 条轨迹**。下表采用人工复核结果；VLM judge 的错判单独记录在 §8。

| 任务 | 桶 | base sim | trained sim | base real | trained real | 备注 |
|---|---|---:|---:|---|---|---|
| `alipay.SetFontSizeLevel` | mid | 1/4 | 2/4 | F | F | trained 做错但 VLM 假阳性 |
| `calendar.MakeupDayReminder` | uplift | 0/4 | 3/4 | F | F | base + trained 做错，且均出现 VLM 假阳性 |
| `reddit.Reddit_CreatePostToCommunity` | stable_pass | 4/4 | 4/4 | F | P | trained 因 Reddit 必选标签导致首次发布无反应，但模型意识到需选择标签并推进到最后一步；软件异常未发出帖子，人工计为通过 |
| `wechat.ConditionalReplyToBoss` | stable_pass | 3/4 | 3/4 | P | P | – |
| `x.FollowUserAndLikeTheirPost` | mid | 1/4 | 2/4 | P | P | – |
| `x.PostWithImageAndReply` | uplift | 0/4 | 4/4 | F | P | – |

补跑子集汇总：

| 模型 | 人工真机通过率 |
|---|---:|
| base qwen3-vl-4b | **2/6** |
| trained qwen3-vl-4b-10s | **4/6** |

合入已完成的 53 个真机任务后，test selection 的真机可执行子集（59 个）结果为。下表采用**人工复核口径**：所有已知 VLM 错判均按人工观察结果修正。

| 桶 | 可执行任务数 | base real | trained real |
|---|---:|---:|---:|
| uplift | 23 | 4 | 17 |
| stable_pass | 18 | 11 | 17 |
| mid | 18 | 4 | 9 |
| **合计** | **59** | **19/59** | **43/59** |

对应通过率：

| 口径 | base | trained | Δ | retention |
|---|---:|---:|---:|---:|
| sim（同 59 任务，4-seed）| 80/236 = 33.9% | 181/236 = 76.7% | +42.8pt | – |
| real（人工复核，pass@1）| 19/59 = 32.2% | 43/59 = 72.9% | +40.7pt | 95.1% |

这里的 retention 指 **提升量保留率**：`(72.9 - 32.2) / (76.7 - 33.9) = 95.1%`。若报告 trained 绝对通过率相对 sim 的保留，则是 `72.9 / 76.7 = 95.0%`。

---

## 8. VLM 错判任务保留为证据

当前 test 人工复核中包含以下 VLM 判定错误：

| 任务 | 桶（test）| VLM 错判 |
|---|---|---|
| `calendar.ChangeDefaultReminder` | stable_pass | trained 假阴性 |
| `crossapp_life.RestaurantRatingInviteCalendar` | mid | trained 假阴性 |
| `railway12306.QueryFastestTrainDetails` | uplift | base + trained 假阳性 |
| `reddit.Reddit_UpdateProfileBio` | stable_pass | base 假阳性 |

另有 3 个 VLM 错判证据任务：

| 任务 | 桶 | VLM 错判 |
|---|---|---|
| `crossapp_content.NotesContentToRedbookAndX` | uplift | trained 假阴性 |
| `crossapp_content.WechatReadingBestBookToWechat` | uplift | base + trained 假阳性 |
| `crossapp_life.MapPlaceToWechat` | mid | trained 假阳性 |

**这 9 个错误实例覆盖的 7 个唯一任务，是 paper 中 "VLM judge 不可靠"主张的具体证据来源**，必须保留在 test + selection 中。

补跑 6 个任务后新增 3 个 VLM 假阳性实例：

| 任务 | 桶 | 模型 | 人工复核 | VLM 判定 | 说明 |
|---|---|---|---|---|---|
| `alipay.SetFontSizeLevel` | mid | trained | F | P | 字体设置未达目标，但 VLM 判为完成 |
| `calendar.MakeupDayReminder` | uplift | base | F | P | 补班提醒未正确完成，但 VLM 判为完成 |
| `calendar.MakeupDayReminder` | uplift | trained | F | P | 补班提醒未正确完成，但 VLM 判为完成 |

因此当前 test 证据集中至少有 **12 个 VLM 错判实例，覆盖 9 个唯一任务**。这进一步支持 paper 中“真机状态判定不能依赖 VLM judge 单独完成”的论点。

---

## 9. test ∩ 真机数据的完整盘点

当前 [sim2real_instructions.json](../../bench_env/splits/sim2real_instructions.json) 包含 **59 个任务**，正好等于 selection 67 扣除 8 个不可配置任务后的真机可执行主表集合；没有额外 stable_fail 任务混入，也没有不可配置任务残留。

注意：`crossapp_life.CalendarFreeWeatherInvite` 和 `wechat.ToggleDiscoverEntry` 在当前 sim 统计中是 **mid**（base 0/4，trained 2/4），因此它们属于 selection 和 59 个真机主表任务，不是 selection 外的 stable_fail sanity check。

完整覆盖：

```
test (256)
├── selection 67 (uplift/stable_pass/mid)
│   ├── 已有真机数据  53
│   ├── 补跑真机数据   6
│   └── §7.1 不可配置  8
└── stable_fail 189
    └── 不进入真机主表
```

---

## 10. Paper 主数字清单

| 项 | test 数字 | 备注 |
|---|---:|---|
| 总任务数 | 256 | test.txt |
| 桶分布 | 26 uplift / 21 stable_pass / 20 mid / 189 stable_fail | regression = 0 |
| selection | 67 | uplift/stable_pass/mid 全选 |
| 真机可执行 | 59 | selection 67 - 不可配置 8 |
| sim base / trained（同 59 任务） | 33.9% / 76.7% | 4-seed 平均 |
| real base / trained（同 59 任务） | 32.2% / 72.9% | 人工复核 pass@1 |
| sim Δ / real Δ | +42.8pt / +40.7pt | 提升在真机上基本保留 |
| Δ retention | 95.1% | `(real trained - real base) / (sim trained - sim base)` |
| VLM 错判 | 至少 12 个实例，覆盖 9 个唯一任务 | 真机 judge 必须人工复核 |

---

## 11. 论文叙事要点

### 11.1 双目标达成情况

| 目标 | 结论 | test 证据 |
|---|---|---|
| **sim2real 有效**：训练带来的提升能迁移到真机 | 达成 | sim Δ = +42.8pt，real Δ = +40.7pt，提升量保留率 95.1% |
| **sim bench 可预测 real bench**：模拟器指标能预测真机表现 | 达成 | 同 59 任务上，base 33.9%→32.2%，trained 76.7%→72.9%，绝对偏差分别为 1.7pt 和 3.8pt |
| **state-based judge 有价值**：sim 判定比真机 VLM judge 更稳定 | 达成 | 真机人工复核发现至少 12 个 VLM 错判实例；sim 中这些任务由状态判定或答题卡判定规避该噪声 |

推荐主文说法：

> On the 59 real-executable test tasks, simulator performance closely predicts real-device performance: the base model obtains 33.9% in simulation and 32.2% on the device, while the trained model obtains 76.7% in simulation and 72.9% on the device. The improvement is almost fully retained on the device (+40.7pt real vs. +42.8pt simulated; 95.1% retention). Manual auditing further reveals at least 12 VLM-judge misclassifications, highlighting the advantage of simulator-side state-based evaluation.

### 11.2 答题卡任务怎么写

答题卡不应该作为主 sim2real 结论的第三条硬证据，而应作为 **evaluation design** 的机制说明或 appendix side observation。

可采用的论点：

1. **答题卡不会泄露答案**：agent 仍然必须在 App 中找到答案；答题卡只是要求它把答案提交到独立界面。
2. **答题卡更严格**：通过答题卡要求同时满足“找到正确答案”和“按结构化格式提交”。因此，答题卡 pass 的轨迹在宽松自由文本 judge 下通常也应通过；答题卡 pass rate 是自由文本成功率的保守下界。
3. **不要把答题卡和 real free-text 直接做强统计比较**：两者有不同 trial 数、不同参数、不同 UI、不同 judge。没有同 rollout 的 ablation 时，只能说现有结果与“答题卡是额外过滤门槛”一致，不能说严格证明。

test 中的答题卡任务统计如下。real 列采用人工复核口径，已修正已知 VLM 错判；其中 `calendar.MakeupDayReminder` 和 `railway12306.QueryFastestTrainDetails` 的 VLM 假阳性不会计入成功。

| 子集 | base sim | base real | trained sim | trained real |
|---|---:|---:|---:|---:|
| answer_fields 全部 19 个 | 7/76 = 9.2% | 5/19 = 26.3% | 54/76 = 71.1% | 14/19 = 73.7% |
| uplift ∩ answer_fields 12 个 | 1/48 = 2.1% | 3/12 = 25.0% | 38/48 = 79.2% | 10/12 = 83.3% |

这组数据的正确解释是：

- 对 trained，答题卡任务的 sim 与 real 基本一致，且 real 没有低于 sim：全部答题卡任务为 71.1% vs 73.7%，uplift 答题卡任务为 79.2% vs 83.3%。这说明答题卡没有制造 simulator-only 的虚高。
- 对 base，real 明显高于 sim，尤其在 uplift 答题卡任务上是 2.1% vs 25.0%。这反而说明答题卡对弱模型构成了额外障碍：弱模型可能已经能在真机自由文本设置下完成少数查询/回答任务，但在 sim 中还需要额外完成结构化提交步骤，因此被过滤掉。
- 因此答题卡应被表述为 **conservative gate**：它降低或持平通过率，而不是抬高通过率。这个观察支持评测设计的保守性，但不是严格 ablation。

推荐写法：

> The answer-sheet protocol is stricter by construction: an agent must both discover the answer in the app and submit it through a separate structured interface. The sheet does not reveal the answer or reduce the task to multiple choice; it only adds a format and submission gate. On test, the trained model shows similar performance on answer-field tasks in simulation and on real devices (54/76 = 71.1% vs. 14/19 = 73.7%; uplift subset: 38/48 = 79.2% vs. 10/12 = 83.3%), while the weaker base model performs better under real-device free-text evaluation than under the simulator answer-sheet gate. This pattern is consistent with the answer sheet acting as a conservative filter rather than an inflationary shortcut. A controlled ablation that toggles the answer sheet on the same simulator rollouts would be needed to isolate this effect quantitatively.

### 11.3 真机 UI divergence

真机 pass@1 会受到设备特定 UI 差异影响：桌面图标位置、厂商设置页布局、账号/登录态、输入法、App 版本、发布/分享链路等都会改变单条轨迹成败。这些差异是 real-device evaluation 的额外方差，不等价于 simulator 预测失败。

论文中建议按聚合 pass rate 和桶级趋势报告主结论，不对单任务失败做过度归因。需要解释失败时，优先写成 device/app-state variance，而不是把每个失败都解释成模型能力缺陷。

---

## 12. Limitations

1. 8 个任务因账号、硬件或预置状态不可等价复现而排除
2. stable_fail 桶未进入真机主表；若要报告真机重加权到完整 256，需要明确 stable_fail real pass≈0 是假设，或额外补采 stable_fail
3. 真机评测 pass@1 单轮采样，方差较大；关键任务可跑 pass@3 加固
4. Reddit 真机存在软件侧限制：不选帖子标签无法发布。`reddit.Reddit_CreatePostToCommunity` 的 trained 轨迹已识别该限制并推进到最后一步，但因软件异常未实际发出帖子，人工计为通过；paper 中若展示该任务，应明确这是人工复核口径。
5. test 版参数审计文件需要另行生成

---

## 13. 操作清单

### 13.1 真机补跑已完成

已在真机上补跑 **qwen3-vl-4b base** 和 **qwen3-vl-4b-10s trained** 两个模型，每个 6 条任务，单轮 pass@1：

```bash
TASKS=(
  alipay.SetFontSizeLevel
  calendar.MakeupDayReminder
  reddit.Reddit_CreatePostToCommunity
  wechat.ConditionalReplyToBoss
  x.FollowUserAndLikeTheirPost
  x.PostWithImageAndReply
)
```

参数从真机已有联系人/历史里采样，不复用 sim 默认值。

### 13.2 输出汇总

跑完后整合：

| 来源 | 任务数 | 数据状态 |
|---|---|---|
| 已完成真机数据 | 53 | 已人工复核 |
| 补跑真机数据 | 6 | 已人工复核 |
| 不可配置（§7.1）| 8 | 永久排除 |
| **合计** | **67** | – |

### 13.3 真机数据汇总

已按人工复核口径汇总 §7.3 主表：真机可执行子集 59 个任务中，base 通过 19 个，trained 通过 43 个。
