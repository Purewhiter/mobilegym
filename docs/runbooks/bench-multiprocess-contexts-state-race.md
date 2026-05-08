# multi-process + contexts iso 下 `_post_sample` state 注入 race(已知未修)

## 一句话问题

`bench_env` 在 **多进程 runner(`--processes N`)+ contexts iso** 组合下,准确率比 pages iso baseline 低 4-5%(实测 16-19% vs 21-23%)。13 个 task 一致 regress,17 个 task 偶发 regress。所有 regressed task 共同特征:`_post_sample` 通过 `env.set_state({...}, reload=False)` 注入种子状态。**单进程 contexts iso 不踩 / pages iso 不踩 / browsers iso 不踩,只这一个组合**。

## 实测数据

| 配置 | 成功率 | 状态 |
|---|---|---|
| pages iso 多进程(8/proc 共享 chromium + storage) | 21-23% | ✓ |
| browsers iso 单进程(1 env / chromium) | 17-21% | ✓ |
| contexts iso 单进程 16×16(同 chromium 16 contexts,启动错峰长) | 21.1% | ✓ |
| **contexts iso 多进程 32×8(每进程 1 chromium × 8 contexts)** | **16-19%** | **✗** |

## 症状细节(以 `wechat.DisableWechatSportsLeaderboard` 为例)

`CriteriaTask._invert_criteria` 在 `_post_sample` 注入"取反 seed"(让 agent 必须有动作才能达到 criteria):

```python
criteria = {
    "settings.accessibility.wechatSports.enabled": True,
    "settings.accessibility.wechatSports.joinLeaderboard": False,
}
# _invert_criteria → 注入:
#   wechatSports.enabled=False, wechatSports.joinLeaderboard=True
# agent 应开 enabled、关 joinLeaderboard
```

实测多进程 ctx 模式:
- agent_message: **"微信运动功能入口未在当前版本可访问"** → ABORT
- 终态字段:**`enabled=False, joinLeaderboard=True`**(就是注入的 seed 值)
- agent 完全没碰这两个字段,因为 UI 上看不到"微信运动"菜单

判定:agent 看到的 **UI 渲染基于默认 state,不是 `_post_sample` 写入的 seed**。要么 setState 没写进去,要么写进去后被覆盖。

## 持续 regress 的 13 个 task(全都用 `_post_sample` 注入 state)

```
alipay.SetFontSizeLevel
calendar.DateCalcThenCreate
crossapp_life.RestaurantRatingInviteCalendar
notes.ReadTodoText
railway12306.QueryFastestTrainDetails
reddit.Reddit_DisableCommunityThemes
spotify.ListLibraryArtists
spotify.QueueAndLikeSong
weather.SwitchUnitAndReport
wechat.DisableWechatSportsLeaderboard
wechat_reading.FindLowestProgressAndRead
wechat_reading.SetProfileVisibility
wechat_reading.TogglePrivateReading
```

另 17 个**只在 A 或 B 之一失败**(也都有 _post_sample),提示 race 是 stochastic 的。

## 推测的机制(未验证)

可能是这三个之一:

1. **setState ↔ hydrate race**:`set_state(reload=False)` 写 in-memory Zustand,但 `__SIM__.waitForData` 异步 fetch 仍未完成,fetch 回来后用 IDB 默认数据 hydrate 覆盖 setState
2. **store 未 mount**:`warm_apps` 返回时部分 React lazy chunk 还没加载完,setState 写到一个不存在的 store 上(silent no-op)
3. **多进程时 chromium storage 子系统压力**:1 chromium 进程同时给 8 contexts 跑 IDB seed import,导致前后顺序 unstable

## 单进程 contexts iso 为什么不踩

256 envs 在 `batch_size=8 + sleep=0.3s` 下启动,32 batches × 0.3s ≈ 10s ramp。前面 batch 的 envs 已经完成 setup 时,后面 batch 才进入 `wait_ready`。任意时刻同 chromium 内 hydrate 队列都不深 → race 窗口太小不触发。

多进程下每进程 8 envs 通过 `asyncio.gather` 几乎同时进入 reset/setup,**0 错峰**,8 个 context 同时打 chromium storage worker,race 必然触发。

## 当前生产 workaround

**用 `--isolation pages` 跑生产 bench**,准确率 21-23%。pages iso 因为 8 page 共享 IDB origin,IDB 已暖,`waitForData` 几乎瞬完,setState 之后无 hydrate 覆盖。

不要用 `--isolation contexts --processes N` 组合。

## 修法选项(未实施)

### A. `_wait_ready` 加 settle barrier(架构正确)

在 `_wait_ready` 的 `waitForData` 子阶段后加一步,确保所有 store 真正 hydrated 才返回:

```python
# bench_env/env/mobile_gym.py _wait_ready 末尾
with sw.phase("settle"):
    await self.page.evaluate("""async () => {
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const stores = window.__SIM__?.getRegisteredStores?.() || [];
        await Promise.all(stores.map(s => s.persist?.rehydrate?.()).filter(Boolean));
    }""")
```

依赖 `__SIM__` 暴露 `getRegisteredStores`(目前不知道是否有,需要确认 / 加)。

### B. `_post_sample` 之前 sleep(band-aid)

```python
# bench_env/task/base.py setup() 里
with sw.phase("post_sample"):
    if not skip_state_dependent:
        await asyncio.sleep(1.0)  # 等 warm/wait_ready 后 race 窗口结束
        await self._post_sample(env)
```

每 task 多 1s,256 并发 wallclock 多 ≈ 1s。**简单可立即试**,但 1s 不一定够 worst case。

### C. `__SIM__.setState` 改成 retry-until-stable(simulator 里改)

setState 写完后读回验证,被覆盖就重写。改 `os/` 下 `__SIM__` 实现,影响范围大。

> **不要选这个** — `_post_sample` 后 reset/reload 会把 in-memory state 全擦掉(volatile store 不可恢复,persisted store 还要重新 hydrate 又回到 race 窗口),等于白注入。

## 验证步骤(假设要先 instrument 定位机制)

在 [bench_env/task/base.py](../../bench_env/task/base.py) `_post_sample` 调用前后采样 store:

```python
with sw.phase("post_sample"):
    if not skip_state_dependent:
        path = "apps.wechat.settings.accessibility.wechatSports"
        before = await env.page.evaluate(
            f"() => JSON.stringify(window.__SIM__?.getState()?.{path} || null)"
        )
        await self._post_sample(env)
        after_0 = await env.page.evaluate(
            f"() => JSON.stringify(window.__SIM__?.getState()?.{path} || null)"
        )
        await asyncio.sleep(2)
        after_2 = await env.page.evaluate(
            f"() => JSON.stringify(window.__SIM__?.getState()?.{path} || null)"
        )
        logger.info(f"[POST_SAMPLE_PROBE] before={before} after_0={after_0} after_2s={after_2}")
```

跑一次 multi-process contexts iso 单 task,grep `[POST_SAMPLE_PROBE]`:
- `before=null, after_0=<seed>, after_2s=null` → race 1(setState 写过但被覆盖)→ 修法 A
- `before=null, after_0=null, after_2s=null` → race 2(setState 没写进去,store 不存在)→ 修法 A 或重排 setup 顺序
- `before=null, after_0=<seed>, after_2s=<seed>` → setState 是稳的,问题在 React UI re-render → 别的方向

## 已知不会修的方向

- ❌ `_post_sample` 后 `env.reset()`:reset 擦内存 + 重新 hydrate,既丢 volatile state 又回到 race 窗口
- ❌ 关闭 multi-process / 砍 contexts iso:bench 速度从 9 min 退回 16+ min,代价过大
- ❌ 把 set_state 默认改 `reload=True`:很多 task 内部依赖 reload=False 的 in-memory 写入语义(如 `_prepare`)
