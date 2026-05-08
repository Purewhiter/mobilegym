"""
Clock app task definitions.
"""
# -- Task Index (auto-generated, do not edit) --
# 18 tasks | L1×2  L2×9  L3×4  L4×3
#
# [L1] ToggleAlarm                {toggle}{time}的闹钟
# [L2] CountAlarms                时钟里一共有几个闹钟
# [L2] AddAlarm                   帮我设一个{time}的闹钟
# [L2] DeleteAlarm                帮我把{time}的闹钟删掉
# [L2] SetAlarmRepeat             把{time}的闹钟改成{repeat}
# [L2] AddWorldCity               在世界时钟里添加{city}
# [L2] RemoveWorldCity            把{city}从世界时钟里删掉
# [L2] CheckAlarmNote             时钟里{time}的闹钟备注写的什么
# [L4] AddAlarmWithSettings       设一个{time}的闹钟，重复模式{repeat}，备注写“{note}”
# [L4] EnableAllAlarms            帮我把时钟里所有闹钟都打开
# [L3] CheckCityTime              帮我看看世界时钟里{city}现在几点
# [L2] CompareCityTimeDiff        {city1}和{city2}现在差几个小时
# [L3] CityLocalTimeDiff          世界时钟里{city}比咱们这儿快还是慢，差多久
# [L3] LatestTimezoneCity         世界时钟里的城市，哪个现在时间最晚
# [L2] AddCityAndCheckTime        在世界时钟里加上{city}，然后告诉我那边现在几点
# [L1] AddCityAndCompareTimeDiff  把{new_city}加到世界时钟，然后告诉我{new_city}和{existing_city}差几个小时
# [L4] ReorganizeWorldClock       把世界时钟里的{remove_city}删掉，换成{add_city}
# [L3] SetupMorningAlarms         帮我设两个起床闹钟：{time1}的设成{repeat1}，{time2}的设成{repeat2}
# -- End Task Index --

from __future__ import annotations

from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import AnswerTask, CriteriaTask, build_answer_checks
from bench_env.task.judge import JudgeInput
from bench_env.task.clock.app import CLOCK_NOTE_VALUES, CLOCK_REPEAT_VALUES, Clock
class ToggleAlarm(CriteriaTask):
    templates = ["{toggle}{time}的闹钟"]
    apps = ["clock"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["edit"]
    parameters = {
        "alarm_id": {"type": "string", "default": "a1", "description": "闹钟 id"},
        "time": {"type": "string", "default": "04:30", "description": "闹钟时间"},
        "toggle": {
            "type": "bool",
            "values": {"打开": True, "关闭": False},
            "default": False,
        },
        "_alarm": {
            "sampler": Clock.sample_existing_alarm,
            "fields": {"alarm_id": "alarm_id", "time": "time"},
        },
    }
    expected_changes = ["alarms[id={alarm_id}]"]
    criteria = {"alarms[id={alarm_id}].enabled": "{toggle}"}

    async def _post_sample(self, env):
        await env.set_state({"apps": {"clock": {
            f"alarms[id={self.p.alarm_id}]": {"enabled": not bool(self.p.toggle)},
        }}}, deep=True, reload=False)


class CountAlarms(AnswerTask):
    templates = ["时钟里一共有几个闹钟"]
    apps = ["clock"]
    scope = "S1"
    objective = "query"
    composition = "atomic"
    difficulty = "L2"
    capabilities = ["query"]
    answer = (".alarms", len)
    answer_fields = [{"type": "number", "label": "闹钟数量"}]


class AddAlarm(BaseTask):
    templates = [
        "帮我设一个{time}的闹钟",
        "Set an alarm for {time}",
    ]
    apps = ["clock"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["create"]
    parameters = {
        "time": {"type": "string", "default": "07:10", "description": "闹钟时间"},
        "hour": {"type": "int", "default": 7, "description": "小时"},
        "minute": {"type": "int", "default": 10, "description": "分钟"},
        "_time": {
            "sampler": Clock.sample_new_alarm_time,
            "fields": {"time": "time", "hour": "hour", "minute": "minute"},
        },
    }
    expected_changes = ["alarms[+1]"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        clock = Clock(input.apps["clock"], init=input.apps_init["clock"])
        return [clock.check_created_alarm(self.p.hour, self.p.minute)]


class DeleteAlarm(BaseTask):
    templates = ["帮我把{time}的闹钟删掉"]
    apps = ["clock"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["edit"]
    parameters = {
        "alarm_id": {"type": "string", "default": "a1", "description": "闹钟 id"},
        "time": {"type": "string", "default": "04:30", "description": "闹钟时间"},
        "_alarm": {
            "sampler": Clock.sample_existing_alarm,
            "fields": {"alarm_id": "alarm_id", "time": "time"},
        },
    }
    expected_changes = ["alarms[id={alarm_id}]"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        clock = Clock(input.apps["clock"], init=input.apps_init["clock"])
        return [clock.check_deleted_alarm(self.p.alarm_id)]


class SetAlarmRepeat(CriteriaTask):
    templates = ["把{time}的闹钟改成{repeat}"]
    apps = ["clock"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["edit"]
    parameters = {
        "alarm_id": {"type": "string", "default": "a1", "description": "闹钟 id"},
        "time": {"type": "string", "default": "04:30", "description": "闹钟时间"},
        "repeat": {
            "type": "enum",
            "values": CLOCK_REPEAT_VALUES,
            "default": "daily",
        },
        "_alarm": {
            "sampler": Clock.sample_existing_alarm,
            "fields": {"alarm_id": "alarm_id", "time": "time"},
        },
    }
    expected_changes = ["alarms[id={alarm_id}]"]
    criteria = {"alarms[id={alarm_id}].repeat": "{repeat}"}

    async def _post_sample(self, env):
        replacement = next(value for value in CLOCK_REPEAT_VALUES.values() if value != self.p.repeat)
        await env.set_state({"apps": {"clock": {
            f"alarms[id={self.p.alarm_id}]": {"repeat": replacement},
        }}}, deep=True, reload=False)


class AddWorldCity(BaseTask):
    templates = [
        "在世界时钟里添加{city}",
        "Add {city} to the world clock",
    ]
    apps = ["clock"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["nav", "search"]
    parameters = {
        "city": {"type": "string", "default": "北京", "description": "城市名称"},
        "_city": {
            "sampler": Clock.sample_addable_city,
            "fields": {"city": "city"},
        },
    }
    expected_changes = ["selectedCityIds", "selectedCities[name={city}]"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        clock = Clock(input.apps["clock"], init=input.apps_init["clock"])
        return [{
            "field": "selectedCityIds",
            "expected": f"contains {self.p.city}",
            "actual": [str(city["name"]) for city in clock.selected_cities],
            "passed": clock.selected_city_matches(self.p.city) and not clock.init.selected_city_matches(self.p.city),
        }]


class RemoveWorldCity(BaseTask):
    templates = [
        "把{city}从世界时钟里删掉",
        "Remove {city} from the world clock",
    ]
    apps = ["clock"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["edit"]
    parameters = {
        "city": {"type": "string", "default": "伦敦", "description": "城市名称"},
        "_city": {
            "sampler": Clock.sample_selected_city,
            "fields": {"city": "city"},
        },
    }
    expected_changes = ["selectedCityIds", "selectedCities[name={city}]"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        clock = Clock(input.apps["clock"], init=input.apps_init["clock"])
        return [{
            "field": "selectedCityIds",
            "expected": f"not contains {self.p.city}",
            "actual": [str(city["name"]) for city in clock.selected_cities],
            "passed": not clock.selected_city_matches(self.p.city) and clock.init.selected_city_matches(self.p.city),
        }]


class CheckAlarmNote(AnswerTask):
    templates = ["时钟里{time}的闹钟备注写的什么"]
    apps = ["clock"]
    scope = "S1"
    objective = "query"
    composition = "atomic"
    difficulty = "L2"
    capabilities = ["query"]
    answer_fields = [{"type": "text", "label": "闹钟备注"}]
    parameters = {
        "alarm_id": {"type": "string", "default": "a1", "description": "闹钟 id"},
        "time": {"type": "string", "default": "04:30", "description": "闹钟时间"},
        "_alarm": {
            "sampler": Clock.sample_noted_alarm,
            "fields": {"alarm_id": "alarm_id", "time": "time"},
        },
    }

    def get_answer(self, input: JudgeInput) -> Any:
        return Clock(input.apps_init["clock"]).find_alarm_by_id(self.p.alarm_id)["note"]


class AddAlarmWithSettings(BaseTask):
    templates = ["设一个{time}的闹钟，重复模式{repeat}，备注写“{note}”"]
    apps = ["clock"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["create"]
    parameters = {
        "time": {"type": "string", "default": "07:10", "description": "闹钟时间"},
        "hour": {"type": "int", "default": 7, "description": "小时"},
        "minute": {"type": "int", "default": 10, "description": "分钟"},
        "repeat": {
            "type": "enum",
            "values": CLOCK_REPEAT_VALUES,
            "default": "daily",
        },
        "note": {
            "type": "enum",
            "values": CLOCK_NOTE_VALUES,
            "default": "晨练",
        },
        "_time": {
            "sampler": Clock.sample_new_alarm_time,
            "fields": {"time": "time", "hour": "hour", "minute": "minute"},
        },
    }
    expected_changes = ["alarms[+1]"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        clock = Clock(input.apps["clock"], init=input.apps_init["clock"])
        return [clock.check_created_alarm(
            self.p.hour, self.p.minute, repeat=self.p.repeat, note=self.p.note,
        )]
class EnableAllAlarms(BaseTask):
    templates = [
        "帮我把时钟里所有闹钟都打开",
        "Turn on all alarms in Clock",
    ]
    apps = ["clock"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["edit"]
    expected_changes = ["alarms"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        clock = Clock(input.apps["clock"])
        return [{
            "field": "alarms",
            "expected": "全部 enabled=True",
            "actual": [bool(alarm.get("enabled")) for alarm in clock.alarms],
            "passed": bool(clock.alarms) and all(bool(alarm.get("enabled")) for alarm in clock.alarms),
        }]


class CheckCityTime(AnswerTask):
    templates = ["帮我看看世界时钟里{city}现在几点", "世界时钟里{city}现在是几点钟"]
    apps = ["clock"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["query"]
    answer_fields = [{"type": "text", "label": "{city}现在几点", "hint": "如：14:30", "matcher": "time"}]
    parameters = {
        "city": {"type": "string", "default": "巴黎", "description": "城市名称"},
        "_city": {
            "sampler": Clock.sample_selected_city,
            "fields": {"city": "city"},
        },
    }

    def get_answer(self, input: JudgeInput) -> Any:
        return Clock(input.apps_init["clock"]).city_time(self.p.city, input.os_init)

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        clock = Clock(input.apps_init["clock"])
        return [clock.check_city_time_answer(self.p.city, input.os_init, input.answer)]


class CompareCityTimeDiff(AnswerTask):
    templates = ["{city1}和{city2}现在差几个小时", "世界时钟里{city1}跟{city2}差多少个小时"]
    apps = ["clock"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L2"
    capabilities = ["query", "reasoning"]
    answer_fields = [{"type": "number", "label": "时差（小时）"}]
    parameters = {
        "city1": {"type": "string", "default": "巴黎", "description": "城市 1"},
        "city2": {"type": "string", "default": "纽约", "description": "城市 2"},
        "_cities": {
            "sampler": Clock.sample_selected_city_pair,
            "fields": {"city1": "city1", "city2": "city2"},
        },
    }

    def get_answer(self, input: JudgeInput) -> Any:
        return Clock(input.apps_init["clock"]).time_diff_hours(self.p.city1, self.p.city2)


class CityLocalTimeDiff(AnswerTask):
    templates = ["世界时钟里{city}比咱们这儿快还是慢，差多久"]
    apps = ["clock"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["query", "reasoning"]
    answer_fields = [{"type": "text", "label": "{city}与本地时差", "hint": "如：快3小时"}]
    parameters = {
        "city": {"type": "string", "default": "巴黎", "description": "城市名称"},
        "_city": {
            "sampler": Clock.sample_city_not_local_offset,
            "fields": {"city": "city"},
        },
    }

    def get_answer(self, input: JudgeInput) -> Any:
        return Clock(input.apps_init["clock"]).city_local_diff_text(self.p.city, input.os_init)

    def get_expected_response(self, input: JudgeInput) -> list:
        clock = Clock(input.apps_init["clock"])
        diff_minutes = int(clock.find_city(self.p.city)["gmtOffsetMinutes"]) - Clock._local_offset_minutes(input.os_init)
        if diff_minutes == 0:
            return ["一样"]
        sign = "快" if diff_minutes > 0 else "慢"
        abs_minutes = abs(diff_minutes)
        hours = abs_minutes // 60
        minutes = abs_minutes % 60
        parts = []
        if hours > 0:
            parts.append(f"{hours}小时")
        if minutes > 0:
            parts.append(f"{minutes}分钟")
        return [f"{sign}{''.join(parts)}"]


class LatestTimezoneCity(AnswerTask):
    templates = ["世界时钟里的城市，哪个现在时间最晚", "帮我看看世界时钟里哪个城市现在最晚"]
    apps = ["clock"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["query", "reasoning"]
    answer_fields = [{"type": "text", "label": "时间最晚的城市", "hint": "如：纽约"}]

    def get_answer(self, input: JudgeInput) -> Any:
        return Clock(input.apps_init["clock"]).latest_city_name()

    def get_expected_response(self, input: JudgeInput) -> list:
        result = Clock(input.apps_init["clock"]).latest_city_name()
        if isinstance(result, str):
            return [result]
        # regex（多城市并列）→ 返回第一个城市名
        cities = Clock(input.apps_init["clock"]).selected_cities
        max_off = max(int(c["gmtOffsetMinutes"]) for c in cities)
        winners = [str(c["name"]) for c in cities if int(c["gmtOffsetMinutes"]) == max_off]
        return [winners[0]]


class AddCityAndCheckTime(BaseTask):
    templates = ["在世界时钟里加上{city}，然后告诉我那边现在几点"]
    apps = ["clock"]
    scope = "S1"
    objective = "hybrid"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["nav", "search", "query"]
    parameters = {
        "city": {"type": "string", "default": "北京", "description": "城市名称"},
        "_city": {
            "sampler": Clock.sample_addable_city,
            "fields": {"city": "city"},
        },
    }
    expected_changes = ["selectedCityIds", "selectedCities[name={city}]"]
    answer_fields = [{"type": "text", "label": "{city}现在几点", "hint": "如：14:30", "matcher": "time"}]

    def get_expected_response(self, input: JudgeInput) -> list:
        return [Clock(input.apps["clock"]).city_time(self.p.city, input.os_init)]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        clock = Clock(input.apps["clock"], init=input.apps_init["clock"])
        return [
            {
                "field": "selectedCityIds",
                "expected": f"contains {self.p.city}",
                "actual": [str(city["name"]) for city in clock.selected_cities],
                "passed": clock.selected_city_matches(self.p.city) and not clock.init.selected_city_matches(self.p.city),
            },
            clock.check_city_time_answer(self.p.city, input.os_init, input.answer),
        ]


class AddCityAndCompareTimeDiff(BaseTask):
    templates = ["把{new_city}加到世界时钟，然后告诉我{new_city}和{existing_city}差几个小时"]
    apps = ["clock"]
    scope = "S1"
    objective = "hybrid"
    composition = "deep_dive"
    difficulty = "L1"
    capabilities = ["nav", "search", "query", "reasoning"]
    parameters = {
        "new_city": {"type": "string", "default": "北京", "description": "新城市"},
        "existing_city": {"type": "string", "default": "巴黎", "description": "已有城市"},
        "_cities": {
            "sampler": Clock.sample_compare_city_pair_with_new,
            "fields": {"new_city": "new_city", "existing_city": "existing_city"},
        },
    }
    expected_changes = ["selectedCityIds", "selectedCities[name={new_city}]"]
    answer_fields = [{"type": "number", "label": "时差（小时）"}]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        clock = Clock(input.apps["clock"], init=input.apps_init["clock"])
        checks = [{
            "field": "selectedCityIds",
            "expected": f"contains {self.p.new_city}",
            "actual": [str(city["name"]) for city in clock.selected_cities],
            "passed": clock.selected_city_matches(self.p.new_city) and not clock.init.selected_city_matches(self.p.new_city),
        }]
        checks.extend(build_answer_checks(clock.time_diff_hours(self.p.new_city, self.p.existing_city), input.answer))
        return checks


class ReorganizeWorldClock(BaseTask):
    templates = [
        "把世界时钟里的{remove_city}删掉，换成{add_city}",
        "Remove {remove_city} from the world clock and replace it with {add_city}",
    ]
    apps = ["clock"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["edit", "search"]
    parameters = {
        "remove_city": {"type": "string", "default": "伦敦", "description": "待删除城市"},
        "add_city": {"type": "string", "default": "北京", "description": "待添加城市"},
        "_cities": {
            "sampler": Clock.sample_remove_add_city,
            "fields": {"remove_city": "remove_city", "add_city": "add_city"},
        },
    }
    expected_changes = ["selectedCityIds", "selectedCities[name={remove_city}]", "selectedCities[name={add_city}]"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        clock = Clock(input.apps["clock"], init=input.apps_init["clock"])
        return [
            {
                "field": "remove_city",
                "expected": f"not contains {self.p.remove_city}",
                "actual": [str(city["name"]) for city in clock.selected_cities],
                "passed": not clock.selected_city_matches(self.p.remove_city),
            },
            {
                "field": "add_city",
                "expected": f"contains {self.p.add_city}",
                "actual": [str(city["name"]) for city in clock.selected_cities],
                "passed": clock.selected_city_matches(self.p.add_city) and not clock.init.selected_city_matches(self.p.add_city),
            },
        ]
class SetupMorningAlarms(BaseTask):
    templates = ["帮我设两个起床闹钟：{time1}的设成{repeat1}，{time2}的设成{repeat2}"]
    apps = ["clock"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["create"]
    parameters = {
        "time1": {"type": "string", "default": "07:10", "description": "第一个闹钟时间"},
        "h1": {"type": "int", "default": 7, "description": "第一个闹钟小时"},
        "m1": {"type": "int", "default": 10, "description": "第一个闹钟分钟"},
        "time2": {"type": "string", "default": "07:20", "description": "第二个闹钟时间"},
        "h2": {"type": "int", "default": 7, "description": "第二个闹钟小时"},
        "m2": {"type": "int", "default": 20, "description": "第二个闹钟分钟"},
        "repeat1": {
            "type": "enum",
            "values": CLOCK_REPEAT_VALUES,
            "default": "daily",
        },
        "repeat2": {
            "type": "enum",
            "values": CLOCK_REPEAT_VALUES,
            "default": "weekday",
        },
        "_times": {
            "sampler": Clock.sample_two_new_alarm_times,
            "fields": {
                "time1": "time1",
                "h1": "h1",
                "m1": "m1",
                "time2": "time2",
                "h2": "h2",
                "m2": "m2",
            },
        },
    }
    expected_changes = ["alarms[+2]"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        clock = Clock(input.apps["clock"], init=input.apps_init["clock"])
        return [
            clock.check_created_alarm(self.p.h1, self.p.m1, field="alarm1", repeat=self.p.repeat1),
            clock.check_created_alarm(self.p.h2, self.p.m2, field="alarm2", repeat=self.p.repeat2),
        ]
