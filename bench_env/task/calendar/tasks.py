"""
Calendar app task definitions.
"""
# -- Task Index (auto-generated, do not edit) --
# 20 tasks | L1×3  L2×8  L3×7  L4×2
#
# [L1] ToggleShowWeekNumber     {toggle}日历的显示周数
# [L1] ChangeDefaultReminder    把日历默认提前提醒改成{reminder}
# [L2] CreateEvent              帮我在{date}创建一个名为{title}的日程
# [L2] DeleteEvent              帮我把{title}那个日程删了
# [L2] SearchEventTitle         日历里关于{keyword}的日程，最早的是哪个
# [L2] CreateBirthdayEvent      帮我在日历里记一下{title}，设置个生日日程，日期是{date}
# [L3] CreateTimedEvent         {date}{start}到{end}有个安排，帮我创建一个名为{title}的日程
# [L3] CreateEventWithReminder  {date}有个安排，帮我创建一个名为{title}的日程，提前{reminder}提醒
# [L2] DateCalcForward          从{date}往后数{days}天是几月几号
# [L2] CalculateDateInterval    {date1}到{date2}隔了多少天
# [L3] QueryHolidayLength       今年{holiday}一共放几天假
# [L2] QueryMakeupWorkday       今年{holiday}放假结束后第一个补班日是哪天
# [L1] ConfigAllReminders       把日历默认提前提醒改成{r1}，全天提醒改成{r2}，稍后提醒改成{r3}
# [L3] EditEventTime            把{title}那个日程改到{new_time}
# [L3] QueryFirstEventOnDate    {date}最早的安排是什么，几点开始
# [L3] DateCalcThenCreate       从{date}往后数{days}天是几号，顺手帮我在那天创建一个名为{title}的日程，最后告诉我具体是哪天
# [L2] MakeupDayReminder        看看今年{holiday}放假结束后有没有补班，有就在那天创建一个名为{title}的日程，没有就直接告诉我不用
# [L3] SearchDeleteAll          帮我把日历里所有和{keyword}有关的日程都删掉，删完告诉我一共删了几个
# [L4] CompareScheduleDensity   {date1}和{date2}哪天安排更多
# [L4] EditAndReportNewTime     把{title}改到{new_date} {new_time}，改完告诉我新的结束时间
# -- End Task Index --

from __future__ import annotations

import datetime
import re
from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import AnswerTask, CriteriaTask, build_answer_checks
from bench_env.task.judge import JudgeInput
from bench_env.task.utils import default_tomorrow, sim_today
from bench_env.task.calendar.app import (
    CALENDAR_ALLDAY_REMINDER_VALUES,
    CALENDAR_DEFAULT_REMINDER_VALUES,
    CALENDAR_DELETE_TITLES,
    CALENDAR_EDIT_TITLES,
    CALENDAR_EVENT_REMINDER_VALUES,
    CALENDAR_HOLIDAY_VALUES,
    CALENDAR_HOLIDAY_WITH_MAKEUP_VALUES,
    CALENDAR_LATER_REMINDER_VALUES,
    CALENDAR_SEARCH_KEYWORDS,
    CALENDAR_WEEK_START_VALUES,
    HOLIDAY_FIRST_REST,
    HOLIDAY_MAKEUP_DAYS,
    HOLIDAY_REST_DAYS,
    Calendar,
)



# =============================================================================
# L1 — Atomic settings
# =============================================================================
class ToggleShowWeekNumber(CriteriaTask):
    templates = [
        "{toggle}日历的显示周数",
        "帮我把日历里的周数显示{toggle}",
    ]
    apps = ["calendar"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["settings"]
    parameters = {
        "toggle": {
            "type": "bool",
            "values": {"打开": True, "关闭": False},
            "default": True,
        },
    }
    criteria = {"settings.showWeekNumber": "{toggle}"}

    async def _post_sample(self, env):
        await self._invert_criteria(env)


class ChangeDefaultReminder(CriteriaTask):
    templates = [
        "把日历默认提前提醒改成{reminder}",
        "帮我把日历默认提醒时间调成{reminder}",
    ]
    apps = ["calendar"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["settings"]
    parameters = {
        "reminder": {
            "type": "enum",
            "values": CALENDAR_DEFAULT_REMINDER_VALUES,
            "default": "15_minutes_before",
        },
    }
    criteria = {"settings.defaultReminder": "{reminder}"}

    async def _post_sample(self, env):
        await self._invert_criteria(env)


# =============================================================================
# L2 — Basic create / delete / search / date tools
# =============================================================================


class CreateEvent(BaseTask):
    templates = [
        "帮我在{date}创建一个名为{title}的日程",
        "{date}我要安排一个日程，名称是{title}，帮我放进日历里",
    ]
    apps = ["calendar"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["create"]
    parameters = {
        "date": {
            "type": "string",
            "sampler": Calendar.sample_future_date,
            "default": default_tomorrow,
            "display": "date_hao",
        },
        "title": {"type": "string", "default": "牙医复诊"},
    }
    expected_changes = ["events", "selectedDateTs"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        calendar = Calendar(input.apps["calendar"], init=input.apps_init["calendar"])
        return [
            calendar.check_event_created(self.p.title),
            calendar.check_event_on_date(self.p.title, self.p.date),
        ]


class DeleteEvent(BaseTask):
    templates = [
        "帮我把{title}那个日程删了",
        "把日历里的{title}删除掉",
    ]
    apps = ["calendar"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["edit"]
    parameters = {
        "title": {
            "type": "enum",
            "values": CALENDAR_DELETE_TITLES,
            "default": "团队周会",
        },
    }
    expected_changes = ["events"]

    async def _prepare(self, env):
        state = await env.get_state()
        today = sim_today(state.get("os", {}))
        patch = Calendar.prepare_state_with_seed_events(today)
        await env.set_state({"apps": {"calendar": patch}}, deep=True, reload=False)

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        calendar = Calendar(input.apps["calendar"], init=input.apps_init["calendar"])
        return [calendar.check_event_deleted(self.p.title)]
class SearchEventTitle(AnswerTask):
    templates = [
        "日历里关于{keyword}的日程，最早的是哪个",
    ]
    apps = ["calendar"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["search", "extract"]
    parameters = {
        "keyword": {
            "type": "enum",
            "values": CALENDAR_SEARCH_KEYWORDS,
            "default": "项目",
        },
    }
    answer_fields = [{"type": "text", "label": "最早日程的标题"}]

    async def _prepare(self, env):
        state = await env.get_state()
        today = sim_today(state.get("os", {}))
        patch = Calendar.prepare_state_with_seed_events(today)
        await env.set_state({"apps": {"calendar": patch}}, deep=True, reload=False)

    def get_answer(self, input: JudgeInput) -> Any:
        calendar = Calendar(input.apps_init["calendar"])
        matches = calendar.find_events_by_keyword(self.p.keyword)
        if not matches:
            raise RuntimeError(f"任务设计错误：关键词 {self.p.keyword} 没有命中任何种子日程。")
        return matches[-1]["title"]


class CreateBirthdayEvent(BaseTask):
    templates = [
        "帮我在日历里记一下{title}，设置个生日日程，日期是{date}",
        "{date}是{title}，帮我在日历里设置一个生日日程",
    ]
    apps = ["calendar"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["create"]
    parameters = {
        "title": {"type": "string", "default": "爸爸生日"},
        "date": {
            "type": "string",
            "sampler": Calendar.sample_future_date,
            "default": default_tomorrow,
            "display": "date_hao",
        },
    }
    expected_changes = ["events", "selectedDateTs"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        calendar = Calendar(input.apps["calendar"], init=input.apps_init["calendar"])
        return [
            calendar.check_event_created(self.p.title, fuzzy=True),
            calendar.check_event_type(self.p.title, "birthday", fuzzy=True),
            calendar.check_event_on_date(self.p.title, self.p.date, fuzzy=True),
        ]
# =============================================================================
# L3 — Deeper forms / holiday reasoning / multi-setting
# =============================================================================


class CreateTimedEvent(BaseTask):
    templates = [
        "{date}{start}到{end}有个安排，帮我创建一个名为{title}的日程",
        "帮我在{date}创建一个名为{title}的日程，时间是{start}-{end}",
    ]
    apps = ["calendar"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["create"]
    parameters = {
        "date": {
            "type": "string",
            "sampler": Calendar.sample_future_date,
            "default": default_tomorrow,
            "display": "date_hao",
        },
        "title": {"type": "string", "default": "面试"},
        "start": {"type": "string", "default": "09:00"},
        "end": {"type": "string", "default": "10:30"},
        "_time_range": {
            "sampler": Calendar.sample_time_range,
            "fields": {"start": "start", "end": "end"},
        },
    }
    expected_changes = ["events", "selectedDateTs"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        calendar = Calendar(input.apps["calendar"], init=input.apps_init["calendar"])
        start_ts = Calendar.timestamp(self.p.date, self.p.start)
        end_ts = Calendar.timestamp(self.p.date, self.p.end)
        return [
            calendar.check_event_created(self.p.title),
            calendar.check_event_time(self.p.title, start_ts, end_ts),
        ]


class CreateEventWithReminder(BaseTask):
    templates = [
        "{date}有个安排，帮我创建一个名为{title}的日程，提前{reminder}提醒",
        "帮我在{date}创建一个名为{title}的日程，并提前{reminder}提醒我",
    ]
    apps = ["calendar"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["create", "settings"]
    parameters = {
        "date": {
            "type": "string",
            "sampler": Calendar.sample_future_date,
            "default": default_tomorrow,
            "display": "date_hao",
        },
        "title": {"type": "string", "default": "出差提醒"},
        "reminder": {
            "type": "enum",
            "values": CALENDAR_EVENT_REMINDER_VALUES,
            "default": 30,
        },
    }
    expected_changes = ["events", "selectedDateTs"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        calendar = Calendar(input.apps["calendar"], init=input.apps_init["calendar"])
        return [
            calendar.check_event_created(self.p.title),
            calendar.check_event_on_date(self.p.title, self.p.date),
            calendar.check_event_reminder(self.p.title, self.p.reminder),
        ]
class DateCalcForward(AnswerTask):
    templates = [
        "从{date}往后数{days}天是几月几号",
        "帮我算一下{date}之后{days}天是哪天",
    ]
    apps = ["calendar"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["extract", "reasoning"]
    expected_changes = ["selectedDateTs"]
    answer_fields = [{"type": "text", "label": "计算结果日期", "hint": "如：5月10号", "matcher": "date"}]
    parameters = {
        # date 和 days 的实际值由 _calc sampler 覆盖，此处仅提供 default 和 display
        "date": {"type": "string", "default": default_tomorrow, "display": "date_hao"},
        "days": {"type": "int", "default": 35},
        "_calc": {
            "sampler": Calendar.sample_calc_forward,
            "fields": {"date": "date", "days": "days"},
        },
    }

    def get_answer(self, input: JudgeInput) -> Any:
        target = Calendar.parse_ymd(self.p.date) + datetime.timedelta(days=int(self.p.days))
        return Calendar.date_answer_pattern(target.isoformat(), input.os_init)

    def get_expected_response(self, input: JudgeInput) -> list:
        target = Calendar.parse_ymd(self.p.date) + datetime.timedelta(days=int(self.p.days))
        return [target.isoformat()]


class CalculateDateInterval(AnswerTask):
    templates = [
        "{date1}到{date2}隔了多少天",
        "帮我算算{date1}和{date2}之间差几天",
    ]
    apps = ["calendar"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["extract", "reasoning"]
    expected_changes = ["selectedDateTs"]
    answer_fields = [{"type": "number", "label": "间隔天数"}]
    parameters = {
        # date1 和 date2 的实际值由 _interval sampler 覆盖，此处仅提供 default 和 display
        "date1": {
            "type": "string",
            "default": default_tomorrow,
            "display": "date_hao",
        },
        "date2": {
            "type": "string",
            "default": lambda: (datetime.date.today() + datetime.timedelta(days=45)).isoformat(),
            "display": "date_hao",
        },
        "_interval": {
            "sampler": Calendar.sample_interval_pair,
            "fields": {"date1": "date1", "date2": "date2"},
        },
    }

    def get_answer(self, input: JudgeInput) -> Any:
        date1 = Calendar.parse_ymd(self.p.date1)
        date2 = Calendar.parse_ymd(self.p.date2)
        return abs((date2 - date1).days)


class QueryHolidayLength(AnswerTask):
    templates = [
        "今年{holiday}一共放几天假",
        "帮我看看今年{holiday}总共休几天",
    ]
    apps = ["calendar"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["extract", "reasoning", "explore"]
    answer_fields = [{"type": "number", "label": "放假天数"}]
    parameters = {
        "holiday": {
            "type": "enum",
            "values": CALENDAR_HOLIDAY_VALUES,
            "default": "春节",
        },
    }
    expected_changes = ["selectedDateTs"]

    def get_answer(self, input: JudgeInput) -> Any:
        return HOLIDAY_REST_DAYS[self.p.holiday]


class QueryMakeupWorkday(AnswerTask):
    """查询假期结束后第一个补班日期。

    日历上的"班"标注不区分归属，直接问"X 假期的补班"会有歧义（部分假期前后都有补班），
    因此固定询问"假期结束后的第一个补班日"，对应 HOLIDAY_MAKEUP_DAYS 中记录的日期。
    判定用 regex search，Agent 回答包含该日期即通过。
    """

    templates = [
        "今年{holiday}放假结束后第一个补班日是哪天",
        "帮我看看{holiday}假期之后最近一次补班是几号",
    ]
    apps = ["calendar"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L2"
    capabilities = ["extract", "reasoning", "explore"]
    answer_fields = [{"type": "text", "label": "补班日期", "hint": "如：2月8号", "matcher": "date"}]
    parameters = {
        "holiday": {
            "type": "enum",
            "values": CALENDAR_HOLIDAY_WITH_MAKEUP_VALUES,
            "default": "春节",
        },
    }
    expected_changes = ["selectedDateTs"]

    def get_answer(self, input: JudgeInput) -> Any:
        return Calendar.date_answer_pattern(HOLIDAY_MAKEUP_DAYS[self.p.holiday], input.os_init)

    def get_expected_response(self, input: JudgeInput) -> list:
        return [HOLIDAY_MAKEUP_DAYS[self.p.holiday]]


class ConfigAllReminders(CriteriaTask):
    templates = [
        "把日历默认提前提醒改成{r1}，全天提醒改成{r2}，稍后提醒改成{r3}",
        "帮我把日历的三种默认提醒分别调成{r1}、{r2}和{r3}",
    ]
    apps = ["calendar"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L1"
    capabilities = ["settings"]
    parameters = {
        "r1": {
            "type": "enum",
            "values": CALENDAR_DEFAULT_REMINDER_VALUES,
            "default": "30_minutes_before",
        },
        "r2": {
            "type": "enum",
            "values": CALENDAR_ALLDAY_REMINDER_VALUES,
            "default": "start_of_day",
        },
        "r3": {
            "type": "enum",
            "values": CALENDAR_LATER_REMINDER_VALUES,
            "default": "30_minutes",
        },
    }
    criteria = {
        "settings.defaultReminder": "{r1}",
        "settings.defaultAllDayReminder": "{r2}",
        "settings.defaultReminderLaterTime": "{r3}",
    }

    async def _post_sample(self, env):
        await self._invert_criteria(env)


class EditEventTime(BaseTask):
    templates = [
        "把{title}那个日程改到{new_time}",
        "帮我把{title}的时间改成{new_time}",
    ]
    apps = ["calendar"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["edit"]
    parameters = {
        "title": {
            "type": "enum",
            "values": CALENDAR_EDIT_TITLES,
            "default": "项目汇报",
        },
        "new_time": {
            "type": "enum",
            "values": ["11:00", "15:30", "19:00"],
            "default": "11:00",
        },
    }
    expected_changes = ["events", "selectedDateTs"]

    async def _prepare(self, env):
        state = await env.get_state()
        today = sim_today(state.get("os", {}))
        patch = Calendar.prepare_state_with_seed_events(today)
        await env.set_state({"apps": {"calendar": patch}}, deep=True, reload=False)

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        calendar = Calendar(input.apps["calendar"], init=input.apps_init["calendar"])
        original = calendar.init.find_event_by_title(self.p.title)
        if original is None:
            raise RuntimeError(f"任务设计错误：种子日程 {self.p.title} 不存在。")
        original_start = int(original["startTs"])
        original_end = int(original["endTs"])
        original_date = datetime.datetime.fromtimestamp(original_start / 1000.0).date().isoformat()
        original_duration = original_end - original_start
        expected_start = Calendar.timestamp(original_date, self.p.new_time)
        expected_end = expected_start + original_duration
        return [calendar.check_event_time(self.p.title, expected_start, expected_end)]


class QueryFirstEventOnDate(AnswerTask):
    templates = [
        "{date}最早的安排是什么，几点开始",
        "帮我看看{date}第一个日程叫什么，什么时候开始",
    ]
    apps = ["calendar"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["extract", "reasoning"]
    answer_fields = [
        {"type": "text", "label": "最早日程的标题"},
        {"type": "text", "label": "开始时间", "hint": "如：09:00", "matcher": "time"},
    ]
    parameters = {
        "date": {
            "type": "string",
            "sampler": Calendar.sample_seed_date,
            "default": default_tomorrow,
            "display": "date_hao",
        },
    }
    expected_changes = ["selectedDateTs"]

    async def _prepare(self, env):
        state = await env.get_state()
        today = sim_today(state.get("os", {}))
        patch = Calendar.prepare_state_with_seed_events(today)
        await env.set_state({"apps": {"calendar": patch}}, deep=True, reload=False)

    def get_answer(self, input: JudgeInput) -> Any:
        calendar = Calendar(input.apps_init["calendar"])
        event = calendar.first_event_on_date(Calendar.parse_ymd(self.p.date))
        start_ts = Calendar.coerce_ts(event["startTs"])
        if start_ts is None:
            raise RuntimeError(f"任务设计错误：日程 {event['title']} 缺少开始时间。")
        return {"title": event["title"], "time": Calendar.hhmm(start_ts)}


# =============================================================================
# L4 — Deep multi-step & conditional tasks
# =============================================================================


class DateCalcThenCreate(BaseTask):
    templates = [
        "从{date}往后数{days}天是几号，顺手帮我在那天创建一个名为{title}的日程，最后告诉我具体是哪天",
        "先帮我算一下{date}之后{days}天是几月几号，再在那天创建一个名为{title}的日程，并把日期告诉我",
    ]
    apps = ["calendar"]
    scope = "S1"
    objective = "hybrid"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["create", "reasoning"]
    parameters = {
        # date 和 days 的实际值由 _calc sampler 覆盖，此处仅提供 default 和 display
        "date": {"type": "string", "default": default_tomorrow, "display": "date_hao"},
        "days": {"type": "int", "default": 35},
        "title": {"type": "string", "default": "出发提醒"},
        "_calc": {
            "sampler": Calendar.sample_calc_forward,
            "fields": {"date": "date", "days": "days"},
        },
    }
    expected_changes = ["events", "selectedDateTs"]
    answer_fields = [{"type": "text", "label": "计算结果日期", "hint": "如：5月10号", "matcher": "date"}]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        calendar = Calendar(input.apps["calendar"], init=input.apps_init["calendar"])
        target = Calendar.parse_ymd(self.p.date) + datetime.timedelta(days=int(self.p.days))
        target_iso = target.isoformat()
        checks = [
            calendar.check_event_created(self.p.title),
            calendar.check_event_on_date(self.p.title, target_iso),
        ]
        checks.extend(build_answer_checks(Calendar.date_answer_pattern(target_iso, input.os_init), input.answer))
        return checks


class MakeupDayReminder(BaseTask):
    """查询假期结束后是否有补班，有则创建日程，无则答复不用补班。

    与 QueryMakeupWorkday 共用"假期结束后第一个补班日"语义，避免日历上"班"标注
    归属不明的问题。采样覆盖全部 7 个假期，其中清明、端午、中秋 2026 假期后无补班，
    会走 else 分支（Agent 应答"不用补班"且不得创建同名日程）。
    """

    templates = [
        "看看今年{holiday}放假结束后有没有补班，有就在那天创建一个名为{title}的日程，没有就直接告诉我不用",
        "帮我查一下今年{holiday}放完假后有没有补班。要补就在那天建个叫{title}的日程，不用就告诉我不用补班",
    ]
    apps = ["calendar"]
    scope = "S1"
    objective = "hybrid"
    composition = "deep_dive"
    difficulty = "L2"
    capabilities = ["create", "reasoning", "explore"]
    parameters = {
        "holiday": {
            "type": "enum",
            "values": CALENDAR_HOLIDAY_VALUES,
            "default": "春节",
        },
        "title": {"type": "string", "default": "补班提醒"},
    }
    expected_changes = ["events", "selectedDateTs"]
    answer_fields = {
        "question": "今年{holiday}放假结束后需要补班吗？",
        "fields": [
            {"type": "choice", "label": "是否需要补班",
             "options": ["需要补班", "不用补班"]},
        ],
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        calendar = Calendar(input.apps["calendar"], init=input.apps_init["calendar"])
        no_makeup_re = re.compile(r"没有补班|不用补班|不需要补班|无补班|不用")
        answer_text = re.sub(r"\s+", "", str(input.answer or ""))

        if self.p.holiday in HOLIDAY_MAKEUP_DAYS:
            makeup_date = HOLIDAY_MAKEUP_DAYS[self.p.holiday]
            # 有补班时 Agent 不能声称"不用补班"（即使日程创建正确），否则行为自相矛盾。
            return [
                calendar.check_event_created(self.p.title),
                calendar.check_event_on_date(self.p.title, makeup_date),
                {
                    "field": "answer",
                    "expected": "不应声称'不用补班'",
                    "actual": input.answer,
                    "passed": no_makeup_re.search(answer_text) is None,
                },
            ]

        init_count = calendar.init.count_events_with_title(self.p.title)
        curr_count = calendar.count_events_with_title(self.p.title)
        return [
            {
                "field": "event_created",
                "expected": "不新增提醒",
                "actual": {"initCount": init_count, "currCount": curr_count},
                "passed": curr_count == init_count,
            },
            {
                "field": "answer",
                "expected": "明确说明不用补班",
                "actual": input.answer,
                "passed": no_makeup_re.search(answer_text) is not None,
            },
        ]


class SearchDeleteAll(BaseTask):
    templates = [
        "帮我把日历里所有和{keyword}有关的日程都删掉，删完告诉我一共删了几个",
        "日历里凡是和{keyword}相关的安排都删掉，最后告诉我删了多少个",
    ]
    apps = ["calendar"]
    scope = "S1"
    objective = "hybrid"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["search", "delete", "reasoning", "extract"]
    parameters = {
        "keyword": {
            "type": "enum",
            "values": CALENDAR_SEARCH_KEYWORDS,
            "default": "项目",
        },
    }
    expected_changes = ["events"]
    answer_fields = [{"type": "number", "label": "删除的日程数量"}]

    async def _prepare(self, env):
        state = await env.get_state()
        today = sim_today(state.get("os", {}))
        patch = Calendar.prepare_state_with_seed_events(today)
        await env.set_state({"apps": {"calendar": patch}}, deep=True, reload=False)

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        calendar = Calendar(input.apps["calendar"], init=input.apps_init["calendar"])
        init_matches = calendar.init.find_events_by_keyword(self.p.keyword)
        if not init_matches:
            raise RuntimeError(f"任务设计错误：关键词 {self.p.keyword} 没有命中任何种子日程。")
        curr_matches = calendar.find_events_by_keyword(self.p.keyword)
        deleted_count = len(init_matches) - len(curr_matches)
        checks = [
            {
                "field": "deleted_events",
                "expected": [],
                "actual": [event["title"] for event in curr_matches],
                "passed": len(curr_matches) == 0,
            }
        ]
        checks.extend(build_answer_checks(deleted_count, input.answer))
        return checks
class CompareScheduleDensity(AnswerTask):
    templates = [
        "{date1}和{date2}哪天安排更多",
        "帮我比一下{date1}跟{date2}，哪天日程更满",
    ]
    apps = ["calendar"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["extract", "reasoning"]
    parameters = {
        "date1": {"type": "string", "default": default_tomorrow, "display": "date_hao"},
        "date2": {"type": "string", "default": lambda: (datetime.date.today() + datetime.timedelta(days=12)).isoformat(), "display": "date_hao"},
        "_dates": {
            "sampler": Calendar.sample_seed_date_pair,
            "fields": {"date1": "date1", "date2": "date2"},
        },
    }
    expected_changes = ["selectedDateTs"]
    answer_fields = [
        {"type": "choice", "label": "安排更多的一天",
         "options": ["{date1}", "{date2}", "一样多"], "matcher": "date"}
    ]

    async def _prepare(self, env):
        state = await env.get_state()
        today = sim_today(state.get("os", {}))
        patch = Calendar.prepare_state_with_seed_events(today)
        await env.set_state({"apps": {"calendar": patch}}, deep=True, reload=False)

    def get_answer(self, input: JudgeInput) -> Any:
        calendar = Calendar(input.apps_init["calendar"])
        count1 = calendar.count_events_on_date(Calendar.parse_ymd(self.p.date1))
        count2 = calendar.count_events_on_date(Calendar.parse_ymd(self.p.date2))
        if count1 > count2:
            return Calendar.date_answer_pattern(self.p.date1, input.os_init)
        if count2 > count1:
            return Calendar.date_answer_pattern(self.p.date2, input.os_init)
        return re.compile(r"一样|相同|差不多")

    def get_expected_response(self, input):
        calendar = Calendar(input.apps_init["calendar"])
        count1 = calendar.count_events_on_date(Calendar.parse_ymd(self.p.date1))
        count2 = calendar.count_events_on_date(Calendar.parse_ymd(self.p.date2))
        if count1 > count2:
            return [self.p.date1]
        if count2 > count1:
            return [self.p.date2]
        return ["一样多"]


class EditAndReportNewTime(BaseTask):
    templates = [
        "把{title}改到{new_date} {new_time}，改完告诉我新的结束时间",
        "帮我把{title}挪到{new_date}{new_time}，然后把新的结束时间告诉我",
    ]
    apps = ["calendar"]
    scope = "S1"
    objective = "hybrid"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["edit", "reasoning"]
    parameters = {
        "title": {
            "type": "enum",
            "values": CALENDAR_EDIT_TITLES,
            "default": "团队周会",
        },
        "new_date": {
            "type": "string",
            "sampler": Calendar.sample_future_date,
            "default": default_tomorrow,
            "display": "date_hao",
        },
        "new_time": {
            "type": "enum",
            "values": ["10:30", "15:00", "19:30"],
            "default": "10:30",
        },
    }
    expected_changes = ["events", "selectedDateTs"]
    answer_fields = [
        {"type": "text", "label": "新的结束时间", "hint": "如：11:30", "matcher": "time"},
    ]

    async def _prepare(self, env):
        state = await env.get_state()
        today = sim_today(state.get("os", {}))
        patch = Calendar.prepare_state_with_seed_events(today)
        await env.set_state({"apps": {"calendar": patch}}, deep=True, reload=False)

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        calendar = Calendar(input.apps["calendar"], init=input.apps_init["calendar"])
        original = calendar.init.find_event_by_title(self.p.title)
        if original is None:
            raise RuntimeError(f"任务设计错误：种子日程 {self.p.title} 不存在。")
        duration = int(original["endTs"]) - int(original["startTs"])
        expected_start = Calendar.timestamp(self.p.new_date, self.p.new_time)
        expected_end = expected_start + duration
        checks = [calendar.check_event_time(self.p.title, expected_start, expected_end)]
        end_dt = datetime.datetime.fromtimestamp(expected_end / 1000.0)
        end_date_str = end_dt.date().isoformat()
        end_time_str = Calendar.hhmm(expected_end)
        checks.extend(
            build_answer_checks(
                {
                    "date": Calendar.date_answer_pattern(end_date_str, input.os_init),
                    "time": end_time_str,
                },
                input.answer,
            )
        )
        return checks
