"""
Cross-app Life & Travel (crossapp_life) task definitions.

覆盖出行规划、天气关怀、路线导航、日程提醒、约饭聚餐等日常生活场景。
核心信息流：Weather / Map / Railway12306 / Calendar / Clock → WeChat / SMS / Notes。
含反向流：WeChat → Map（从聊天提取地点搜索）。
"""
# -- Task Index (auto-generated, do not edit) --
# 24 tasks | L2×2  L3×11  L4×11
#
# [L3] MapPlaceToWechat                       帮我在地图上搜一下{place}的地址，发给微信好友{contact}
# [L4] WeatherShareMetric                     查一下{city}的{metric}，把结果微信发给{contact}
# [L4] WeatherReportToNotes                   帮我查一下{city}现在的温度和天气，简单整理成一条记录保存到备忘录。
# [L2] WeatherFilterNonRainyDays              查{city}未来五天天气，把不下雨的日期记在笔记里，标题写'适合出行的日子'
# [L3] WeatherRainBranchNotify                {city}明天要是下雨，给{contact}发消息提醒带伞；不下雨就说'明天天气不错'
# [L3] RailwayTrainInfoToWechat               帮我查{date}从{from_station}到{to_station}最早的高铁，把车次和发车时间发给微信好友{contact}
# [L4] RailwayPriceVsBalance                  查{date}从{from_station}到{to_station}最便宜的高铁票多少钱，再看看支付宝余额够不够买
# [L3] RailwayDestWeatherQuery                我买了张去{city}的火车票，帮我查一下到达那天{city}的天气和温度
# [L4] MapNearbyBestToWechat                  在地图搜{radius}内评分最高的{category}，把名字、评分和地址微信发给{contact}，评分一样的话优先最近的
# [L3] CalendarEventToWechat                  看看日历明天有什么安排，把第一个事件的主题和时间发给微信好友{contact}
# [L4] WeatherFirstNonRainyDayBuyTicket       查{city}未来三天天气，找到第一个不下雨的天，帮我买那天从{from_station}到{city}的高铁票,提交订单即可。
# [L4] MapRatingConditionBuyTicket            帮我在地图看看{place}的评分，如果超过4分就买明天从{from_station}过去的最早高铁，提交订单即可。
# [L3] RailwayWeatherToWechat                 查{date}从{from_station}到{city}的最早高铁和{city}那天天气，把车次和天气一起发给{contact}
# [L4] WeatherFirstSunnyDayCalendarAlarm      查{city}未来两周的天气，找到第一个不下雨的天，在那天日历建个户外运动日程，设个早上8点的闹钟
# [L4] RailwayBalanceConditionalBuyNotify     查{date}从{from_station}到{city}最便宜的高铁票，看支付宝余额够不够，够就直接买票提交订单，微信告诉{contact}我要去{city}，不够就告诉TA没钱了
# [L3] CalendarFreeWeatherInvite              看看日历下周末哪天没安排，查那天{city}天气，有一天没有安排而且不下雨就给{contact}发消息约出去玩
# [L4] WechatFoodExtractMapSms                看看{contact}在微信里最近说想吃什么，搜附近最近的那家，把地址用短信发给{sms_contact}
# [L3] RestaurantRatingInviteCalendar         在地图搜{restaurant}看看评分，超过{rating}分就给{contact}发微信约今晚去吃，顺便在日历建个聚餐日程
# [L4] TripClosedLoopNotify                   查{date}从{from_station}到{to_station}最早的高铁，在日历建标题为出行的事件，设个出发前1小时的闹钟，最后把车次信息微信发给{contact}
# [L4] FullTripPlanWeatherDriven              我想去{city}出差，查未来两周里第一个不下雨且日历没有安排的日期，给我买从{from_station}出发的最早高铁提交订单即可，并设一个出发前一小时的闹钟
# [L2] WeekendTripFullPlan                    看看下周六{city}下不下雨，不下雨就查开车去{destination}要多久，在日历建个标题出游的日程，发微信约{contact}一起去
# [L3] TripMemoAndNotify                      {date}从{from_station}去{city}出差，查最快的高铁和当天天气，在笔记记个出行备忘，发微信通知{contact}接站
# [L3] TravelPlanToWechat                     帮我查一下{dest}的详细地址和那边城市的当前天气，一起微信发给{contact}。
# [L3] WeatherCalendar_CreateEventIfNotSunny  查询 {city} 的天气，如果不是晴天，则在日历中创建一个全天日程，标题为 {event_title}，并在备注中写入当前的温度和天气状况。
# -- End Task Index --



from __future__ import annotations

import datetime

from typing import Any

from bench_env.task.alipay.app import Alipay
from bench_env.task.base import BaseTask
from bench_env.task.calendar.app import CALENDAR_EVENT_CHANGES, Calendar
from bench_env.task.contacts.app import contacts_from_input
from bench_env.task.clock.app import CLOCK_ALARM_CHANGES, Clock
from bench_env.task.common_tasks import AnswerTask, match_value
from bench_env.task.judge import JudgeInput
from bench_env.task.map.app import CATEGORY_PARAM, MAP_SEARCH_CHANGES, PLACE_PARAM, RADIUS_PARAM, RESTAURANT_PARAM, Map
from bench_env.task.notes.app import NOTES_CREATE_CHANGES, Notes
from bench_env.task.railway12306.app import RAIL_BOOKING_CHANGES, RAIL_QUERY_CHANGES, Railway12306
from bench_env.task.sms.app import SMS_SEND_CHANGES, sms_from_input
from bench_env.task.utils import (
    city_aliases,
    date_match_labels,
    default_tomorrow,
    format_date_natural,
    has_close_number,
    sample_future_date,
    sim_datetime,
    sim_today,
    check_alternatives,
)
from bench_env.task.weather.app import WEATHER_QUERY_CHANGES, WEATHER_SAVED_CITIES, Weather
from bench_env.task.wechat.app import WECHAT_CONTACT_PARAM, WECHAT_MOMENT_CHANGES, WECHAT_SEND_CHANGES, Wechat



# ══════════════════════════════════════════════════════════════════════════
#  L2 — 基础信息搬运 (2-APP, transfer)
#
#  模式：A 查到数据 → 原样传递给 B，Agent 不需要中间推理。
# ══════════════════════════════════════════════════════════════════════════
class MapPlaceToWechat(BaseTask):
    """用户想把某地点的地址分享给微信好友。Agent 需在地图搜索地点、
    找到地址信息后切到微信发送。

    判定：微信新消息包含 {place} 的地址（与 places.json 匹配）。
    """

    templates = [
        "帮我在地图上搜一下{place}的地址，发给微信好友{contact}",
    ]
    apps = ["map", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["search", "handoff"]
    parameters = {"place": PLACE_PARAM, "contact": WECHAT_CONTACT_PARAM}
    expected_changes = MAP_SEARCH_CHANGES + WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        places = Map.resolve_places(str(self.p.place))
        return check_alternatives(
            [wechat.check_new_sent_to(self.p.contact, Map.extract_address(p), field="place_address_share") for p in places],
        )
# ══════════════════════════════════════════════════════════════════════════
#  L3 — 2-APP 单源推理/筛选后搬运
#
#  模式丰富：含条件分支、比较、筛选、计算推导等不同 composition。
# ══════════════════════════════════════════════════════════════════════════


# ---------- 天气相关 ----------
class WeatherShareMetric(BaseTask):
    """判定：把指定天气指标发给微信联系人。"""

    templates = ["查一下{city}的{metric}，把结果微信发给{contact}"]
    apps = ["weather", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["extract", "handoff"]
    parameters = {
        "city": {"type": "string", "default": "北京"},
        "metric": {
            "type": "enum",
            "values": {
                "温度和体感": "temp_feels",
                "湿度": "humidity",
                "明天高低温": "tomorrow",
            },
            "default": "temp_feels",
        },
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = WEATHER_QUERY_CHANGES + WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        weather = Weather(input.apps["weather"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])

        if self.p.metric == "temp_feels":
            keywords = [
                weather.current_temp_str(self.p.city),
                weather.current_feels_like_str(self.p.city),
            ]
        elif self.p.metric == "humidity":
            keywords = [weather.current_humidity_str(self.p.city)]
        else:
            high, low = weather.tomorrow_high_low_str(self.p.city)
            keywords = [high, low]

        return [
            wechat.check_new_sent_contains(
                self.p.contact,
                *keywords,
                field="sent_weather_metric",
            )
        ]


class WeatherReportToNotes(BaseTask):
    """判定：把当前天气整理成一条备忘录记录。"""

    templates = [
        "帮我查一下{city}现在的温度和天气，简单整理成一条记录保存到备忘录。",
        "Check the current temperature and weather in {city}, organize it into a short record and save it in Notes.",
    ]
    apps = ["weather", "notes"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["extract", "create", "handoff"]
    parameters = {"city": {"type": "string", "default": "北京"}}
    expected_changes = WEATHER_QUERY_CHANGES + NOTES_CREATE_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        notes = Notes(input.apps["notes"])
        weather = Weather(input.apps["weather"])
        target_temp = weather.current_temp(self.p.city)
        weather_type = weather.weather_type_chinese(self.p.city)
        weather_text = weather.current_weather_text(self.p.city)
        # 天气描述：接受中文归类（如"阴"）或原始文本（如"Cloudy"）任一
        weather_labels = list({weather_type, weather_text, weather_text.lower()})
        return [
            notes.check_latest_contains(self.p.city, field="weather_report_city"),
            notes.check_latest_contains_any_of(weather_labels, field="weather_report_condition"),
            notes.check_latest_contains_number(target_temp, tolerance=2.0, field="weather_report_temp"),
        ]
class WeatherFilterNonRainyDays(BaseTask):
    """用户出行前想筛选未来哪些天不下雨。Agent 需浏览多日预报、逐日判断晴雨、
    把符合条件的日期整理到笔记。模板指定了笔记标题"适合出行的日子"，
    给 judge 一个固定锚点来定位这条笔记。

    判定：笔记标题匹配，内容包含所有不下雨日期。
    """

    templates = [
        "查{city}未来五天天气，把不下雨的日期记在笔记里，标题写'适合出行的日子'",
    ]
    apps = ["weather", "notes"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L2"
    capabilities = ["extract", "create", "handoff"]
    parameters = {
        "city": {"type": "enum", "values": WEATHER_SAVED_CITIES, "default": "北京"}
    }
    expected_changes = WEATHER_QUERY_CHANGES + NOTES_CREATE_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        weather = Weather(input.apps["weather"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        note = notes.find_note_by_title("适合出行的日子")
        init_note = notes.init.find_note_by_title("适合出行的日子") if notes.has_init else None
        content = ""
        if note is not None:
            content = f"{note.get('title', '')}\n{note.get('content', '')}"
        init_content = ""
        if init_note is not None:
            init_content = f"{init_note.get('title', '')}\n{init_note.get('content', '')}"
        missing_dates: list[str] = []
        for fx_date in weather.non_rainy_dates(self.p.city, 1, 5):
            labels = Weather.date_labels(fx_date, input.os)
            if not any(label in content for label in labels):
                missing_dates.append(fx_date)
        return [
            {
                "field": "non_rainy_dates_note",
                "expected": {
                    "title": "适合出行的日子",
                    "dates": weather.non_rainy_dates(self.p.city, 1, 5),
                },
                "actual": {
                    "found": note is not None,
                    "changed": content != init_content,
                    "content": content[:240],
                    "missing_dates": missing_dates,
                },
                "passed": note is not None and content != init_content and not missing_dates,
            }
        ]
class WeatherRainBranchNotify(BaseTask):
    """用户让 Agent 看明天天气，下雨就提醒带伞，不下雨就说天气不错。
    两个分支的预期消息文本不同，Agent 必须先查天气再决定发哪种内容。
    模板把两个分支的措辞都写明了，judge 可以直接匹配关键词。

    判定：下雨分支消息含"带伞"，晴天分支含"天气不错"。
    """

    templates = [
        "{city}明天要是下雨，给{contact}发消息提醒带伞；不下雨就说'明天天气不错'",
    ]
    apps = ["weather", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["extract", "reasoning", "handoff"]
    parameters = {
        "city": {"type": "enum", "values": WEATHER_SAVED_CITIES, "default": "北京"},
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = WEATHER_QUERY_CHANGES + WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        weather = Weather(input.apps["weather"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        is_rain = weather.tomorrow_is_rainy(self.p.city)
        if is_rain:
            return [
                wechat.check_new_sent_contains(
                    self.p.contact,
                    "伞",
                    field="rain_branch_message",
                )
            ]
        return [
            wechat.check_new_sent_contains(
                self.p.contact,
                "天气不错",
                field="rain_branch_message",
            )
        ]


# ---------- 12306 相关 ----------


class RailwayTrainInfoToWechat(BaseTask):
    """用户要把最早高铁的车次和时间告诉朋友。Agent 需在 12306 查票结果中
    找到最早那趟（不是随便一趟），再把车次号和发车时间发微信。

    判定：微信消息包含最早 G 字头车次号和发车时间。
    """

    templates = [
        "帮我查{date}从{from_station}到{to_station}最早的高铁，把车次和发车时间发给微信好友{contact}",
    ]
    apps = ["railway12306", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["search", "extract", "handoff"]
    parameters = {
        "from_station": {"type": "string", "default": "上海", "description": "出发站"},
        "to_station": {"type": "string", "default": "南京", "description": "到达站"},
        "_route": {
            "sampler": Railway12306.sample_route_pair,
            "fields": {"from_station": "from_station", "to_station": "to_station"},
        },
        "date": {
            "type": "string",
            "sampler": sample_future_date,
            "default": default_tomorrow,
            "display": format_date_natural,
            "description": "出发日期",
        },
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = RAIL_QUERY_CHANGES + WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rail = Railway12306(input.apps["railway12306"], init=input.apps_init["railway12306"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        searched = rail.check_searched(
            from_station=self.p.from_station,
            to_station=self.p.to_station,
            date=self.p.date,
            field="query.searched",
        )
        if not searched["passed"]:
            return [
                searched,
                {
                    "field": "train_info_share",
                    "expected": "最早高铁车次和发车时间",
                    "actual": wechat.joined_new_texts_to(self.p.contact) or "(none)",
                    "passed": False,
                },
            ]
        train = rail.pick_train_for_route_strict(
            "earliest",
            from_station=self.p.from_station,
            to_station=self.p.to_station,
            only_high_speed=True,
        )
        if train is None:
            raise ValueError(
                f"No high-speed train found for route {self.p.from_station}->{self.p.to_station}"
            )
        return [
            searched,
            wechat.check_new_sent_contains(
                self.p.contact,
                str(train["trainNo"]),
                field="train_info_train_no",
            ),
            wechat.check_new_sent_match_time(
                self.p.contact,
                str(train["departTime"]),
                field="train_info_depart_time",
            ),
        ]


class RailwayPriceVsBalance(AnswerTask):
    """用户想知道支付宝余额够不够买最便宜的高铁票。Agent 需分别查 12306 票价
    和支付宝余额，做数值比较后回答。

    判定："够"或"不够"与实际比较结果一致。
    注入：随机设置支付宝余额在 100-1000 之间，两个分支都能被测到。
    """

    templates = [
        "查{date}从{from_station}到{to_station}最便宜的高铁票多少钱，再看看支付宝余额够不够买",
    ]
    apps = ["railway12306", "alipay"]
    scope = "S2"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["search", "extract", "reasoning"]
    parameters = {
        "from_station": {"type": "string", "default": "上海", "description": "出发站"},
        "to_station": {"type": "string", "default": "南京", "description": "到达站"},
        "_route": {
            "sampler": Railway12306.sample_route_pair,
            "fields": {"from_station": "from_station", "to_station": "to_station"},
        },
        "date": {
            "type": "string",
            "sampler": sample_future_date,
            "default": default_tomorrow,
            "display": format_date_natural,
            "description": "出发日期",
        },
    }
    expected_changes = RAIL_QUERY_CHANGES
    answer_fields = [
        {"type": "text", "label": "最便宜的票价", "hint": "如：233元"},
        {"type": "choice", "label": "余额是否足够", "options": ["够", "不够"]},
    ]

    async def _post_sample(self, env: Any) -> None:
        """注入随机支付宝余额，确保够/不够两个分支都能被测到。"""
        balance = round(self.sampler.rng.uniform(100, 1000), 2)
        await env.set_state(
            {"apps": {"alipay": {"balance": {"total": balance}}}},
            deep=True,
            reload=False,
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rail = Railway12306(input.apps["railway12306"], init=input.apps_init["railway12306"])
        alipay = Alipay(input.apps["alipay"])
        searched = rail.check_searched(
            from_station=self.p.from_station,
            to_station=self.p.to_station,
            date=self.p.date,
            field="query.searched",
        )
        answer_text = str(input.answer or "")
        if not searched["passed"]:
            return [
                searched,
                {
                    "field": "answer",
                    "expected": "回答票价和余额是否足够",
                    "actual": input.answer,
                    "passed": False,
                },
            ]
        cheapest = rail.cheapest_high_speed_seat_price(
            self.p.from_station,
            self.p.to_station,
            date=self.p.date,
        )
        if cheapest is None:
            raise ValueError(
                f"No priced high-speed seats found for route {self.p.from_station}->{self.p.to_station}"
            )
        return [
            searched,
            {
                "field": "answer.price",
                "expected": cheapest,
                "actual": input.answer,
                "passed": has_close_number(answer_text, cheapest, tol=1.0),
            },
            alipay.check_balance_afford_answer(
                cheapest, answer_text, field="answer.afford",
            ),
        ]


class RailwayDestWeatherQuery(AnswerTask):
    """用户已经买了火车票，想看目的地到达那天的天气。Agent 需先去 12306
    找到这张订单读出到达日期，再拿日期去天气 App 查对应那天的预报。
    "那天"的日期完全由订单决定，不是用户指定的，所以 Agent 必须先读订单。

    判定：Agent 回答包含到达日的天气状况和温度。
    注入：确保 12306 恰好有一张去 {city} 的车票，不会有多张导致歧义。
    """

    templates = [
        "我买了张去{city}的火车票，帮我查一下到达那天{city}的天气和温度",
    ]
    apps = ["railway12306", "weather"]
    scope = "S2"
    objective = "query"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["extract", "handoff"]
    parameters = {"city": {"type": "enum", "values": WEATHER_SAVED_CITIES, "default": "上海"}}
    expected_changes = WEATHER_QUERY_CHANGES
    answer_fields = [
        {"type": "text", "label": "天气状况", "hint": "如：晴"},
        {"type": "text", "label": "最高温度", "hint": "如：23°"},
        {"type": "text", "label": "最低温度", "hint": "如：15°"},
    ]

    async def _post_sample(self, env: Any) -> None:
        """注入一张未来 1-10 天内去目标城市的车票。"""
        state = await env.get_state()
        base_date = sim_today(state["os"])
        rng = self.sampler.rng
        offset = rng.choice(range(1, 11))
        ticket_date = (base_date + datetime.timedelta(days=offset)).isoformat()

        rail_state = state["apps"]["railway12306"]
        user_name = rail_state.get("user", {}).get("name", "赵宇轩")
        from_station = "北京" if self.p.city != "北京" else "广州"

        order = Railway12306.prepare_order(
            from_station=from_station,
            to_station=self.p.city,
            date=ticket_date,
            passenger_name=user_name,
            rng=rng,
            created_at_iso=sim_datetime(state["os"]).isoformat(),
        )

        rail = Railway12306(rail_state)
        next_state = rail.prepare_state_with_order(order=order)

        await env.set_state(
            {"apps": {"railway12306": next_state}},
            deep=True,
            reload=False,
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rail = Railway12306(input.apps["railway12306"])
        weather = Weather(input.apps["weather"])
        target_ticket = next(
            (
                ticket
                for ticket in rail.my_tickets()
                if self.p.city in str(ticket.get("toStation") or "")
                or any(
                    alias.lower() in str(ticket.get("toStation") or "").lower()
                    for alias in city_aliases(self.p.city)
                )
            ),
            None,
        )
        if target_ticket is None:
            raise ValueError(f"No owned railway ticket found for destination city {self.p.city!r}")
        day = weather.daily_by_date(self.p.city, str(target_ticket["date"]))
        high = int(round(float(day["tempMax"])))
        low = int(round(float(day["tempMin"])))
        actual = str(input.answer or "")
        return [
            {
                "field": "answer.weather",
                "expected": f"textDay={day.get('textDay')} / textNight={day.get('textNight')}",
                "actual": input.answer,
                "passed": Weather.forecast_text_matches(day, actual),
            },
            {
                "field": "answer.temp",
                "expected": {"high": high, "low": low},
                "actual": input.answer,
                "passed": match_value(high, actual) and match_value(low, actual),
            },
        ]


# ---------- 地图相关 ----------
class MapNearbyBestToWechat(BaseTask):
    """用户想把附近评分最高的某类店推荐给朋友。Agent 需搜索附近地点、
    在结果列表中找到评分最高的那家（不是随便一家），再把名字、评分、
    地址发给联系人。

    判定：微信消息包含评分最高 POI 的名字、评分和地址。
    """

    templates = [
    "在地图搜{radius}内评分最高的{category}，把名字、评分和地址微信发给{contact}，评分一样的话优先最近的",
    ]
    apps = ["map", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["search", "extract", "handoff"]
    parameters = {
        "radius": RADIUS_PARAM,
        "category": CATEGORY_PARAM,
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = MAP_SEARCH_CHANGES + WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        results = Map.geo_search(self.p.category, limit=0)
        best = Map.best_rated_from_results(results, max_distance_meters=float(self.p.radius))
        rating = str(best["rating"])
        address = Map.extract_address(best)
        return [
            wechat.check_new_sent_contains(
                self.p.contact,
                str(best["name"]),
                rating,
                address,
                field="best_poi_share",
            )
        ]
# ---------- 反向信息流 / 日历信息源 ----------
class CalendarEventToWechat(BaseTask):
    """用户想把明天的日程安排告诉朋友。Agent 需先打开日历查看明天的事件，
    找到第一个事件的主题和时间，再切到微信发给联系人。
    这是本套件中日历首次作为"信息源"（而非写入目标）出现的任务。

    判定：微信消息包含明天第一个日历事件的标题和开始时间。
    注入：确保日历明天至少有一个事件。
    """

    templates = [
        "看看日历明天有什么安排，把第一个事件的主题和时间发给微信好友{contact}",
    ]
    apps = ["calendar", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["extract", "handoff"]
    parameters = {"contact": WECHAT_CONTACT_PARAM}
    expected_changes = CALENDAR_EVENT_CHANGES + WECHAT_SEND_CHANGES

    async def _prepare(self, env: Any) -> None:
        state = await env.get_state()
        current_ts = int(state["os"]["time"]["timestamp"])
        tomorrow = sim_today(state["os"]) + datetime.timedelta(days=1)
        calendar_state = Calendar(state["apps"]["calendar"]).prepare_state_with_event(
            event_id="crossapp_life_tomorrow_event",
            title="项目评审",
            date_text=tomorrow.isoformat(),
            start_time="09:00",
            end_time="10:00",
            created_at=current_ts,
            reminder_minutes_before=30,
            event_type="schedule",
        )
        await env.set_state(
            {"apps": {"calendar": calendar_state}},
            deep=True,
            reload=False,
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        calendar = Calendar(input.apps["calendar"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        tomorrow = sim_today(input.os) + datetime.timedelta(days=1)
        event = calendar.first_event_on_date(tomorrow)
        title = str(event["title"])
        time_str = Calendar.hhmm(event["startTs"])
        return [
            wechat.check_new_sent_contains(
                self.p.contact,
                title,
                field="sent_event_title",
            ),
            wechat.check_new_sent_match_time(
                self.p.contact,
                time_str,
                field="sent_event_time",
            ),
        ]


# ---------- 通讯录 + 12306 ----------
# ══════════════════════════════════════════════════════════════════════════
#  L3 — 3-APP 信息汇聚
#
#  模式：从 2 个信息源提取 → 汇聚到第 3 个 App。
# ══════════════════════════════════════════════════════════════════════════
# ══════════════════════════════════════════════════════════════════════════
#  L4 — 2-APP 复杂推理
#
#  模式：信息依赖链较长或需要复合推理。
# ══════════════════════════════════════════════════════════════════════════


class WeatherFirstNonRainyDayBuyTicket(BaseTask):
    """用户想挑一个不下雨的天出发。Agent 需浏览多日天气预报、找到第一个不下雨的日期，
    然后去 12306 买那天的票。用"第一个不下雨的天"有唯一确定答案。

    判定：12306 pending order 出发日 == 预报中第一个不下雨日期，且为高铁。
    注入：天气数据前 1-2 天设为雨、之后有不下雨的天，Agent 不能盲选明天。
    """

    templates = [
        "查{city}未来三天天气，找到第一个不下雨的天，帮我买那天从{from_station}到{city}的高铁票,提交订单即可。",
    ]
    apps = ["weather", "railway12306"]
    scope = "S2"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["extract", "reasoning", "search"]
    parameters = {
        "city": {
            "type": "enum",
            "values": {"上海": "上海", "杭州": "杭州"},
            "default": "上海",
        },
        "from_station": {
            "type": "enum",
            "values": {"北京": "北京", "广州": "广州"},
            "default": "北京",
            "description": "出发站",
        },
    }
    expected_changes = WEATHER_QUERY_CHANGES + RAIL_BOOKING_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        weather = Weather(input.apps["weather"])
        rail = Railway12306(input.apps["railway12306"], init=input.apps_init["railway12306"])
        try:
            target_date = weather.first_non_rainy_date(self.p.city, 1, 3)
        except ValueError:
            # 未来三天都没有晴天，任务无法完成，直接通过
            return [
                {
                    "field": "no_sunny_day",
                    "expected": "至少一个晴天",
                    "actual": "未来三天都没有晴天",
                    "passed": True,
                }
            ]
        return [
            rail.check_booking_order(
                from_station=self.p.from_station,
                to_station=self.p.city,
                date=target_date,
                passenger_names=[rail.user_name],
                field="newPendingOrder",
            )
        ]


class MapRatingConditionBuyTicket(BaseTask):
    """用户想去某个景点玩，但只有评分够高才值得跑一趟。Agent 先查 {place} 评分，
    超过 4 分就去买高铁票；不到则不创建订单。模板只要求条件成立时买票，
    不要求额外回答。

    判定：评分 > 4.0 → 有 pending order；≤ 4.0 → 无新订单。
    """

    templates = [
        "帮我在地图看看{place}的评分，如果超过4分就买明天从{from_station}过去的最早高铁，提交订单即可。",
    ]
    apps = ["map", "railway12306"]
    scope = "S2"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["search", "reasoning", "extract"]
    parameters = {
        "place": PLACE_PARAM,
        "from_station": {"type": "string", "default": "上海", "description": "出发站"},
    }
    expected_changes = MAP_SEARCH_CHANGES + RAIL_BOOKING_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rail = Railway12306(input.apps["railway12306"], init=input.apps_init["railway12306"])
        # 从离线数据确定性获取评分和城市（不依赖 Agent 运行时状态）
        place = Map.resolve_places(str(self.p.place))[0]
        rating = float(place["rating"])
        if rating > 4.0:
            to_city = Map.city_from_address(str(place.get("address") or ""))
            tomorrow = (sim_today(input.os) + datetime.timedelta(days=1)).isoformat()
            searched = rail.check_searched(
                from_station=self.p.from_station,
                to_station=to_city,
                date=tomorrow,
                field="query.searched",
            )
            if not searched["passed"]:
                return [
                    searched,
                    {
                        "field": "newPendingOrder",
                        "expected": f"{self.p.from_station}→{to_city} {tomorrow} 最早高铁",
                        "actual": "未完成车次查询",
                        "passed": False,
                    },
                ]
            train = rail.pick_train_for_route_strict(
                "earliest",
                from_station=self.p.from_station,
                to_station=to_city,
                only_high_speed=True,
            )
            if train is None:
                raise ValueError(
                    f"No high-speed train found for route {self.p.from_station}->{to_city}"
                )
            return [
                searched,
                rail.check_booking_order(
                    from_station=self.p.from_station,
                    to_station=to_city,
                    date=tomorrow,
                    passenger_names=[rail.user_name],
                    expected_train_no=train["trainNo"],
                    field="newPendingOrder",
                ),
            ]
        new_orders = rail.new_pending_orders()
        return [
            {
                "field": "no_booking_when_low_rating",
                "expected": f"{self.p.place} rating={rating:.1f} <= 4.0 时不创建订单",
                "actual": rail.describe_order(new_orders[0]) if new_orders else "未创建新订单",
                "passed": len(new_orders) == 0,
            }
        ]
# ══════════════════════════════════════════════════════════════════════════
#  L4 — 3-APP transfer（多源 → 顺序传递）
# ══════════════════════════════════════════════════════════════════════════


class RailwayWeatherToWechat(BaseTask):
    """用户要出差，想一次性把车次和目的地天气都告诉朋友。
    Agent 需从 12306 和天气两个 App 分别取信息，合并成一条微信发出。

    判定：微信消息同时包含车次号和 {city} 天气。
    """

    templates = [
        "查{date}从{from_station}到{city}的最早高铁和{city}那天天气，把车次和天气一起发给{contact}",
    ]
    apps = ["railway12306", "weather", "wechat"]
    scope = "S3"
    objective = "operate"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["search", "extract", "handoff"]
    parameters = {
        "city": {
            "type": "enum",
            "values": {"上海": "上海", "深圳": "深圳"},
            "default": "上海",
        },
        "from_station": {"type": "enum", "values": {"北京": "北京", "广州": "广州"}, "default": "北京"},
        "date": {
            "type": "string",
            "sampler": sample_future_date,
            "default": default_tomorrow,
            "display": format_date_natural,
        },
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = RAIL_QUERY_CHANGES + WEATHER_QUERY_CHANGES + WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rail = Railway12306(input.apps["railway12306"], init=input.apps_init["railway12306"])
        weather = Weather(input.apps["weather"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        searched = rail.check_searched(
            from_station=self.p.from_station,
            to_station=self.p.city,
            date=self.p.date,
            field="query.searched",
        )
        if not searched["passed"]:
            return [
                searched,
                {
                    "field": "combined_share",
                    "expected": "车次 + 天气",
                    "actual": wechat.joined_new_texts_to(self.p.contact) or "(none)",
                    "passed": False,
                },
            ]
        train = rail.pick_train_for_route_strict(
            "earliest",
            from_station=self.p.from_station,
            to_station=self.p.city,
            only_high_speed=True,
        )
        if train is None:
            raise ValueError(
                f"No high-speed train found for route {self.p.from_station}->{self.p.city}"
            )
        day = weather.daily_by_date(self.p.city, self.p.date)
        # forecast_text_matches 做多文本模糊匹配（日/夜均可），无法用 check_new_sent_contains 替代
        actual = wechat.joined_new_texts_to(self.p.contact)
        return [
            searched,
            wechat.check_new_sent_contains(
                self.p.contact,
                str(train["trainNo"]),
                field="combined_share_train_no",
            ),
            {
                "field": "combined_share_weather",
                "expected": f"{day.get('textDay','')}/{day.get('textNight','')}",
                "actual": actual or "(none)",
                "passed": bool(actual) and Weather.forecast_text_matches(day, actual),
            },
        ]
# ══════════════════════════════════════════════════════════════════════════
#  L4 — 3-APP deep_dive（需推理/条件/比较后才能行动）
# ══════════════════════════════════════════════════════════════════════════


class WeatherFirstSunnyDayCalendarAlarm(BaseTask):
    """用户想找一个不下雨的天去户外运动，需要建日程并设早起闹钟。
    合并了"天气筛选→建日程"和"天气筛选→设闹钟"两个同构 L3 流程，
    用一个任务覆盖两者。

    判定：
    1) 在未来两周内找到第一个“不下雨”的天（白天或夜间任一为雨天都视为下雨）。
    2) 日历新增"户外运动"事件日期 == 第一个不下雨的天；闹钟设在早上 8 点。
    """

    templates = [
        "查{city}未来两周的天气，找到第一个不下雨的天，在那天日历建个户外运动日程，设个早上8点的闹钟",
        "Check the weather in {city} for the next two weeks, find the first non-rainy day, create an outdoor exercise event on the calendar for that day, and set an alarm for 8 AM",
    ]
    apps = ["weather", "calendar", "clock"]
    scope = "S3"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["extract", "reasoning", "create"]
    parameters = {
        "city": {"type": "enum", "values": WEATHER_SAVED_CITIES, "default": "北京"}
    }
    expected_changes = WEATHER_QUERY_CHANGES + CALENDAR_EVENT_CHANGES + CLOCK_ALARM_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        weather = Weather(input.apps["weather"])
        calendar = Calendar(input.apps["calendar"], init=input.apps_init["calendar"])
        clock = Clock(input.apps["clock"], init=input.apps_init["clock"])
        target_date = weather.first_non_rainy_date(self.p.city, 1, 14)

        return [
            calendar.check_event_created("户外运动", field="event_created", fuzzy=True),
            calendar.check_event_on_date("户外运动", target_date, field="event_date", fuzzy=True),
            clock.check_alarm_at(8, 0, field="alarm"),
        ]
class RailwayBalanceConditionalBuyNotify(BaseTask):
    """用户让 Agent 帮忙看余额够不够买票——够就直接买并通知朋友，
    不够就告诉用户还差多少。两个分支的行为完全不同（一个要买票+发微信，
    一个只需回答差额），judge 按实际余额 vs 票价决定预期分支。

    判定：够 → 有 pending order + 微信含"去{city}"；不够 → 无订单 + 回答含差额。
    注入：随机设置支付宝余额在票价的 80%-120% 区间。
    """

    templates = [
        "查{date}从{from_station}到{city}最便宜的高铁票，看支付宝余额够不够，够就直接买票提交订单，微信告诉{contact}我要去{city}，不够就告诉TA没钱了",
    ]
    apps = ["railway12306", "alipay", "wechat"]
    scope = "S3"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["search", "reasoning", "extract", "handoff"]
    parameters = {
        "city": {
            "type": "enum",
            "values": {"上海": "上海", "深圳": "深圳"},
            "default": "上海",
        },
        "from_station": {"type": "enum", "values": {"北京": "北京", "广州": "广州"}, "default": "北京"},
        "date": {
            "type": "string",
            "sampler": sample_future_date,
            "default": default_tomorrow,
            "display": format_date_natural,
        },
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = RAIL_BOOKING_CHANGES + WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rail = Railway12306(input.apps["railway12306"], init=input.apps_init["railway12306"])
        # 余额可能在采样后被注入修改，分支判断必须读取当前状态。
        alipay = Alipay(input.apps["alipay"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        searched = rail.check_searched(
            from_station=self.p.from_station,
            to_station=self.p.city,
            date=self.p.date,
            field="query.searched",
        )
        if not searched["passed"]:
            return [
                searched,
                {
                    "field": "balance_branch",
                    "expected": "完成查票并执行对应分支",
                    "actual": {
                        "answer": input.answer,
                        "message": wechat.joined_new_texts_to(self.p.contact),
                    },
                    "passed": False,
                },
            ]
        cheapest = rail.cheapest_high_speed_seat_price(
            self.p.from_station,
            self.p.city,
            date=self.p.date,
        )
        if cheapest is None:
            raise ValueError("No priced high-speed seat found in current queryState")
        balance = float(alipay.total_balance)
        actual = wechat.joined_new_texts_to(self.p.contact)
        if balance >= cheapest:
            return [
                searched,
                rail.check_booking_order(
                    from_station=self.p.from_station,
                    to_station=self.p.city,
                    date=self.p.date,
                    passenger_names=[rail.user_name],
                    field="newPendingOrder",
                ),
                wechat.check_new_sent_contains(
                    self.p.contact,
                    self.p.city,
                    "去",
                    field="notify_contact",
                ),
            ]
        diff = round(cheapest - balance, 2)
        return [
            searched,
            {
                "field": "no_order_when_balance_insufficient",
                "expected": "余额不足时不创建订单",
                "actual": rail.describe_order(rail.new_pending_orders()[0])
                if rail.new_pending_orders()
                else "未创建新订单",
                "passed": len(rail.new_pending_orders()) == 0,
            },
            {
                "field": "notify_contact_insufficient_balance",
                "expected": f"告知没钱了 / 差额≈{diff:.2f}",
                "actual": actual or "(none)",
                "passed": bool(actual)
                and ("没钱" in actual or "不够" in actual or "买不起" in actual)
                and (has_close_number(actual, diff, tol=1.0) or "没钱" in actual),
            },
        ]


class CalendarFreeWeatherInvite(BaseTask):
    """用户想下周末约人出去，但要满足两个条件：日历有空 + 天气不下雨。

    用"下周末"而非"这周末"，避免当前日期恰好是周末时的歧义。
    周末两天可能都空闲，Agent 选哪天都行；下雨判定同时看白天和夜间天气。
    判定：存在空闲且不下雨的日子 → 微信发了约人消息（含日期 + 出去玩）；
    所有空闲日均下雨 → 未发消息。
    """

    templates = [
        "看看日历下周末哪天没安排，查那天{city}天气，有一天没有安排而且不下雨就给{contact}发消息约出去玩",
    ]
    apps = ["calendar", "weather", "wechat"]
    scope = "S3"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["extract", "reasoning", "handoff"]
    parameters = {
        "city": {"type": "enum", "values": WEATHER_SAVED_CITIES, "default": "北京"},
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = WEATHER_QUERY_CHANGES + WECHAT_SEND_CHANGES + CALENDAR_EVENT_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        calendar = Calendar(input.apps_init["calendar"])
        weather = Weather(input.apps_init["weather"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        today = sim_today(input.os_init)
        # "下周末"：先到下周一，再 +5 到周六
        days_to_next_monday = (7 - today.weekday()) % 7 or 7
        saturday = today + datetime.timedelta(days=days_to_next_monday + 5)
        sunday = saturday + datetime.timedelta(days=1)

        # ---- 找空闲日 ----
        free_days: list[datetime.date] = []
        if calendar.count_events_on_date(saturday) == 0:
            free_days.append(saturday)
        if calendar.count_events_on_date(sunday) == 0:
            free_days.append(sunday)

        # ---- 空闲日中筛选不下雨的（白天+夜间都看）----
        valid_days = [
            d for d in free_days
            if not weather.is_rainy_on_date(self.p.city, d, today)
        ]
        actual = wechat.joined_new_texts_to(self.p.contact)

        # ---- 无可约日子（日历都有安排 或 空闲日均下雨）→ 不应发消息 ----
        if not valid_days:
            if not free_days:
                reason = "周末日历均有安排，不发邀请"
            else:
                reason = "空闲日均有雨，不发邀请"
            return [
                {
                    "field": "no_invite",
                    "expected": reason,
                    "actual": actual or "(none)",
                    "passed": not actual,
                }
            ]

        # ---- 存在可约的日子 → 检查邀请消息 ----
        # 用 date_match_labels 生成日期多标签（§4.6）
        all_date_labels: list[str] = []
        for d in valid_days:
            all_date_labels.extend(date_match_labels(d.isoformat(), input.os_init))
        # 两天都可约时，"周末"也是合理表达
        if len(valid_days) == 2:
            all_date_labels += ["下周末"]

        return [
            wechat.check_new_sent_any_of(
                self.p.contact, all_date_labels, field="invite_date",
            ),
            wechat.check_new_sent_any_of(
                self.p.contact, ["玩", "一起", "约", "出去"], field="invite_activity",
            ),
        ]


class WechatFoodExtractMapSms(BaseTask):
    """用户让 Agent 看朋友微信里想吃什么，然后搜附近对应的餐厅。
    "想吃什么"如果是"火锅""川菜"这种泛类别，地图搜索结果不可控；
    所以通过注入确保聊天消息里出现的是明确的连锁品牌名（麦当劳/肯德基/必胜客），
    Agent 只需识别品牌名并在地图搜索即可，搜索结果确定唯一。

    判定：短信包含正确品牌最近门店的地址。
    注入：向 {contact} 聊天记录注入"好想吃{brand}"，{brand} 从
      [麦当劳, 肯德基, 必胜客] 中采样；地图 places.json 有对应 POI。
    """

    templates = [
        "看看{contact}在微信里最近说想吃什么，搜附近最近的那家，把地址用短信发给{sms_contact}",
    ]
    apps = ["wechat", "map", "sms"]
    scope = "S3"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["extract", "reasoning", "search", "handoff"]
    parameters = {
        "contact": WECHAT_CONTACT_PARAM,
        "brand": {
            "type": "enum",
            "values": {"麦当劳": "麦当劳", "肯德基": "肯德基", "必胜客": "必胜客"},
            "default": "麦当劳",
        },
        "sms_contact": {
            "type": "string",
            "source": "os.providers.contacts.contacts[displayName]",
            "default": "张三",
            "description": "短信联系人",
        },
    }
    expected_changes = WECHAT_SEND_CHANGES + MAP_SEARCH_CHANGES + SMS_SEND_CHANGES

    async def _post_sample(self, env: Any) -> None:
        state = await env.get_state()
        wechat_state = Wechat(state["apps"]["wechat"]).prepare_state_with_incoming_text(
            self.p.contact,
            f"好想吃{self.p.brand}",
            message_id=f"crossapp_life_food_{self.p.brand}",
            timestamp=state["os"]["time"]["timestamp"],
        )
        await env.set_state(
            {"apps": {"wechat": wechat_state}},
            deep=True,
            reload=False,
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        sms = sms_from_input(input)
        best = Map.nearest_from_results(Map.geo_search(self.p.brand, limit=0))
        formatted_address = Map.extract_address(best)
        return [
            sms.check_new_sent_to(
                self.p.sms_contact,
                formatted_address,
                field="food_address_sms",
            )
        ]


class RestaurantRatingInviteCalendar(BaseTask):
    """用户想约朋友去吃饭，但只在评分够高时才值得去。Agent 先在地图搜
    {restaurant} 查评分，超过 {rating} 分就给朋友发微信邀请并建日程；
    不够就不行动。与 MapRatingConditionBuyTicket（评分→买票）条件分支模式类似，
    但输出端是"微信邀请 + 建聚餐日程"，覆盖日常"约饭"场景。

    判定：评分 > {rating} → 微信含邀请 + 日历有聚餐日程；≤ {rating} → 都没有。
    注入：注入比较困难，选几个地点作为参数就行了，注意这个restaurant需要是明确的地点，而不是泛化的餐厅类型
    """

    templates = [
        "在地图搜{restaurant}看看评分，超过{rating}分就给{contact}发微信约今晚去吃，顺便在日历建个聚餐日程",
    ]
    apps = ["map", "wechat", "calendar"]
    scope = "S3"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["search", "reasoning", "handoff", "create"]
    parameters = {
        "restaurant": RESTAURANT_PARAM,
        "rating": {
            "type": "enum",
            "values": {"4.0": 4.0, "4.5": 4.5},
            "default": 4.0,
        },
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = MAP_SEARCH_CHANGES + WECHAT_SEND_CHANGES + CALENDAR_EVENT_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        calendar = Calendar(input.apps["calendar"], init=input.apps_init["calendar"])
        # 从离线数据确定性获取评分（不依赖 Agent 运行时状态）
        place = Map.resolve_places(str(self.p.restaurant))[0]
        rating = float(place["rating"])
        if rating > float(self.p.rating):
            return [
                wechat.check_new_sent_contains(
                    self.p.contact,
                    self.p.restaurant,
                    field="invite_message",
                ),
                calendar.check_event_created("聚餐", field="dinner_calendar_event", fuzzy=True),
            ]
        return [
            wechat.check_no_new_sent_to(
                self.p.contact,
                field="no_invite_when_low_rating",
                summary=f"rating={rating:.1f} <= {float(self.p.rating):.1f} 时不发邀请",
            ),
            calendar.check_no_new_events(field="no_dinner_event"),
        ]



# ══════════════════════════════════════════════════════════════════════════
#  L4 — 4+-APP 完整链路
#
#  跨 4 个以上 App 的长步骤链，体现 Agent 全流程规划与多步执行能力。
# ══════════════════════════════════════════════════════════════════════════


class TripClosedLoopNotify(BaseTask):
    """出行闭环四件套：查票 → 建日程 → 设闹钟 → 通知朋友。四步顺序执行，
    后续步骤依赖前序结果（日程日期来自车次、闹钟时间由发车时间推算）。
    合并了"车次→日历""车次→闹钟"两个 L3 同构任务并追加通知环节。

    判定：① 日历有出行事件 ② 闹钟 = 发车时间-1h ③ 微信含车次和发车时间。
    """

    templates = [
        "查{date}从{from_station}到{to_station}最早的高铁，在日历建标题为出行的事件，设个出发前1小时的闹钟，最后把车次信息微信发给{contact}",
    ]
    apps = ["railway12306", "calendar", "clock", "wechat"]
    scope = "S3"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["search", "create", "handoff"]
    parameters = {
        "from_station": {"type": "string", "default": "上海", "description": "出发站"},
        "to_station": {"type": "string", "default": "南京", "description": "到达站"},
        "_route": {
            "sampler": Railway12306.sample_route_pair,
            "fields": {"from_station": "from_station", "to_station": "to_station"},
        },
        "date": {
            "type": "string",
            "sampler": sample_future_date,
            "default": default_tomorrow,
            "display": format_date_natural,
        },
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = RAIL_BOOKING_CHANGES + CALENDAR_EVENT_CHANGES + CLOCK_ALARM_CHANGES + WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rail = Railway12306(input.apps["railway12306"], init=input.apps_init["railway12306"])
        calendar = Calendar(input.apps["calendar"], init=input.apps_init["calendar"])
        clock = Clock(input.apps["clock"], init=input.apps_init["clock"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        searched = rail.check_searched(
            from_station=self.p.from_station,
            to_station=self.p.to_station,
            date=self.p.date,
            field="query.searched",
        )
        if not searched["passed"]:
            return [
                searched,
                {
                    "field": "calendar_trip_event",
                    "expected": self.p.date,
                    "actual": "未完成车次查询",
                    "passed": False,
                },
                {
                    "field": "alarm",
                    "expected": "出发前1小时",
                    "actual": "未完成车次查询",
                    "passed": False,
                },
                {
                    "field": "wechat_share",
                    "expected": "车次和发车时间",
                    "actual": wechat.joined_new_texts_to(self.p.contact) or "(none)",
                    "passed": False,
                },
            ]
        train = rail.pick_train_for_route_strict(
            "earliest",
            from_station=self.p.from_station,
            to_station=self.p.to_station,
            only_high_speed=True,
        )
        if train is None:
            raise ValueError(
                f"No high-speed train found for route {self.p.from_station}->{self.p.to_station}"
            )
        depart_hour, depart_minute = map(int, str(train["departTime"]).split(":"))
        alarm_dt = datetime.datetime(2000, 1, 1, depart_hour, depart_minute) - datetime.timedelta(hours=1)
        return [
            searched,
            calendar.check_event_created("出行", field="calendar_trip_event", fuzzy=True),
            calendar.check_event_on_date("出行", self.p.date, field="calendar_trip_date", fuzzy=True),
            clock.check_alarm_at(alarm_dt.hour, alarm_dt.minute, field="alarm"),
            wechat.check_new_sent_contains(
                self.p.contact,
                str(train["trainNo"]),
                field="wechat_share_train_no",
            ),
            wechat.check_new_sent_match_time(
                self.p.contact,
                str(train["departTime"]),
                field="wechat_share_depart_time",
            ),
        ]


class FullTripPlanWeatherDriven(BaseTask):
    """完整出行规划：先按天气选日子，再检查日历有没有冲突，没有就买票设闹钟。
    四步决策链，每一步的输出驱动下一步的输入。
    是本套件中信息依赖链最长的决策型任务。

    判定：
    1) pending order 日期 = 第一个不下雨的天（白天或夜间任一为雨天都视为下雨）且日历无冲突；
    2) 闹钟 = 发车时间-1h。
    """

    templates = [
        "我想去{city}出差，查未来两周里第一个不下雨且日历没有安排的日期，给我买从{from_station}出发的最早高铁提交订单即可，并设一个出发前一小时的闹钟",
        "I'm going on a business trip to {city}. Find the first non-rainy day with no calendar events in the next two weeks, buy the earliest high-speed train from {from_station} and just submit the order, and set an alarm 1 hour before departure",
    ]
    apps = ["weather", "railway12306", "calendar", "clock"]
    scope = "S3"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["extract", "reasoning", "search", "create"]
    parameters = {
        "city": {
            "type": "enum",
            "values": {"上海": "上海", "深圳": "深圳"},
            "default": "上海",
        },
        "from_station": {"type": "enum", "values": {"北京": "北京", "广州": "广州"}, "default": "北京"},
    }
    expected_changes = WEATHER_QUERY_CHANGES + CALENDAR_EVENT_CHANGES + RAIL_BOOKING_CHANGES + CLOCK_ALARM_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        weather = Weather(input.apps_init["weather"])
        calendar = Calendar(input.apps_init["calendar"])
        rail = Railway12306(input.apps["railway12306"], init=input.apps_init["railway12306"])
        clock = Clock(input.apps["clock"], init=input.apps_init["clock"])
        target_date = next(
            (
                fx_date
                for fx_date in weather.non_rainy_dates(self.p.city, 1, 14)
                if calendar.count_events_on_date(datetime.date.fromisoformat(fx_date))
                == 0
            ),
            None,
        )
        
        searched = rail.check_searched(
            from_station=self.p.from_station,
            to_station=self.p.city,
            date=target_date,
            field="query.searched",
        )
        if not searched["passed"]:
            return [
                searched,
                {
                    "field": "newPendingOrder",
                    "expected": f"{self.p.from_station}→{self.p.city} {target_date} 最早高铁",
                    "actual": "未完成车次查询",
                    "passed": False,
                },
                {
                    "field": "alarm",
                    "expected": "出发前1小时",
                    "actual": "未完成车次查询",
                    "passed": False,
                },
            ]
        train = rail.pick_train_for_route_strict(
            "earliest",
            from_station=self.p.from_station,
            to_station=self.p.city,
            only_high_speed=True,
        )
        if train is None:
            raise ValueError(
                f"No high-speed train found for route {self.p.from_station}->{self.p.city}"
            )
        depart_hour, depart_minute = map(int, str(train["departTime"]).split(":"))
        alarm_dt = datetime.datetime(2000, 1, 1, depart_hour, depart_minute) - datetime.timedelta(hours=1)
        return [
            searched,
            rail.check_booking_order(
                from_station=self.p.from_station,
                to_station=self.p.city,
                date=target_date,
                passenger_names=[rail.user_name],
                expected_train_no=train["trainNo"],
                field="newPendingOrder",
            ),
            clock.check_alarm_at(alarm_dt.hour, alarm_dt.minute, field="alarm"),
        ]


class WeekendTripFullPlan(BaseTask):
    """周末自驾出游全流程。先看下周六天气，不下雨才继续——查从当前位置
    开车去北京某个具体景点的时间、建日程、约朋友。下雨就整个流程中止。
    用"下周六"而非"这周六"，避免当前日期恰好是周末时的歧义。

    判定：不下雨 → 地图查了{destination}，在日历有出游日程 + 微信约人消息；下雨 → 都没有。
    """

    templates = [
        "看看下周六{city}下不下雨，不下雨就查开车去{destination}要多久，在日历建个标题出游的日程，发微信约{contact}一起去",
    ]
    apps = ["weather", "map", "calendar", "wechat"]
    scope = "S3"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["extract", "search", "create", "handoff"]
    parameters = {
        # 城市固定为北京，用于天气查询。
        "city": {"type": "enum", "values": {"北京": "北京"}, "default": "北京"},
        # 出游目的地限定为北京的若干具体景点，避免泛化地点导致 routes 不稳定。
        "destination": {
            "type": "enum",
            "values": {
                "天安门广场": "天安门广场",
                "故宫博物院": "故宫博物院",
                "颐和园": "颐和园",
                "中国国家博物馆": "中国国家博物馆",
            },
            "default": "颐和园",
        },
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = WEATHER_QUERY_CHANGES + MAP_SEARCH_CHANGES + CALENDAR_EVENT_CHANGES + WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        weather = Weather(input.apps["weather"])
        map_app = Map(input.apps["map"], init=input.apps_init["map"])
        calendar = Calendar(input.apps["calendar"], init=input.apps_init["calendar"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        today = sim_today(input.os)
        # "下周六"：先到下周一，再 +5 到周六
        days_to_next_monday = (7 - today.weekday()) % 7 or 7
        saturday = today + datetime.timedelta(days=days_to_next_monday + 5)
        if weather.is_rainy_on_date(self.p.city, saturday, today):
            return [
                calendar.check_no_new_events(field="no_weekend_trip_event"),
                wechat.check_no_new_sent_to(
                    self.p.contact,
                    field="no_weekend_invite",
                    summary=f"{saturday.isoformat()} 下雨时不发邀请",
                ),
            ]
        # 晴天分支：应完成地图路线查询 + 新增日历事件 + 发微信约人消息。
        return [
            map_app.check_searched_for_place(self.p.destination),
            calendar.check_event_created("出游", field="weekend_trip_event", fuzzy=True),
            calendar.check_event_on_date("出游", saturday.isoformat(), field="weekend_trip_date", fuzzy=True),
            wechat.check_new_sent_any_of(
                self.p.contact,
                ["一起", "去", "出游"],
                field="weekend_invite",
            ),
        ]


class TripMemoAndNotify(BaseTask):
    """用户出差前让 Agent 把行程信息整理到两个地方：笔记留给自己备忘、
    微信发给接站的朋友。Agent 需查车次和天气后分别写入笔记和微信，
    是"同一份信息、两个输出目标"的模式。

    判定：笔记包含车次+天气；微信包含车次+到达时间。
    """

    templates = [
        "{date}从{from_station}去{city}出差，查最快的高铁和当天天气，在笔记记个出行备忘，发微信通知{contact}接站",
    ]
    apps = ["railway12306", "weather", "notes", "wechat"]
    scope = "S3"
    objective = "operate"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["search", "extract", "create", "handoff"]
    parameters = {
        "city": {
            "type": "enum",
            "values": {"上海": "上海", "深圳": "深圳"},
            "default": "上海",
        },
        "from_station": {"type": "enum", "values": {"北京": "北京", "广州": "广州"}, "default": "北京"},
        "date": {
            "type": "string",
            "sampler": sample_future_date,
            "default": default_tomorrow,
            "display": format_date_natural,
        },
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = RAIL_QUERY_CHANGES + WEATHER_QUERY_CHANGES + NOTES_CREATE_CHANGES + WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rail = Railway12306(input.apps["railway12306"], init=input.apps_init["railway12306"])
        weather = Weather(input.apps["weather"])
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        searched = rail.check_searched(
            from_station=self.p.from_station,
            to_station=self.p.city,
            date=self.p.date,
            field="query.searched",
        )
        if not searched["passed"]:
            return [
                searched,
                {
                    "field": "memo",
                    "expected": "笔记包含车次和天气",
                    "actual": notes.latest_note.get("title") if notes.latest_note else "无笔记",
                    "passed": False,
                },
                {
                    "field": "notify",
                    "expected": "微信通知接站",
                    "actual": wechat.joined_new_texts_to(self.p.contact) or "(none)",
                    "passed": False,
                },
            ]
        train = rail.pick_train_for_route_strict(
            "fastest",
            from_station=self.p.from_station,
            to_station=self.p.city,
            only_high_speed=True,
        )
        if train is None:
            raise ValueError(
                f"No high-speed train found for route {self.p.from_station}->{self.p.city}"
            )
        weather_day = weather.daily_by_date(self.p.city, self.p.date)
        actual = wechat.joined_new_texts_to(self.p.contact)
        # 笔记：车次 + 天气（textDay 或 textNight 任一）
        memo_check = notes.check_latest_contains(
            str(train["trainNo"]),
            field="memo",
        )
        note = notes.latest_note
        note_text = f"{note.get('title','')}\n{note.get('content','')}" if note else ""
        weather_ok = Weather.forecast_text_matches(weather_day, note_text)
        if not weather_ok:
            memo_check["passed"] = False
            td = weather_day.get("textDay", "")
            tn = weather_day.get("textNight", "")
            memo_check["expected"] = f"contains [{train['trainNo']!r}, weather({td}/{tn})]"
        return [
            searched,
            memo_check,
            wechat.check_new_sent_contains(
                self.p.contact,
                str(train["trainNo"]),
                field="notify_train_no",
            ),
            wechat.check_new_sent_match_time(
                self.p.contact,
                str(train["arriveTime"]),
                field="notify_arrive_time",
            ),
        ]


class TravelPlanToWechat(BaseTask):
    """判定：给联系人发送目的地地址和当地天气。"""

    templates = ["帮我查一下{dest}的详细地址和那边城市的当前天气，一起微信发给{contact}。"]
    apps = ["map", "weather", "wechat"]
    scope = "S3"
    objective = "operate"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["search", "extract", "handoff"]
    parameters = {
        "dest": {"type": "string", "default": "中国国家博物馆"},
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = MAP_SEARCH_CHANGES + WEATHER_QUERY_CHANGES + WECHAT_SEND_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        weather = Weather(input.apps["weather"])
        places = Map.resolve_places(str(self.p.dest))
        return check_alternatives(
            [wechat.check_new_sent_contains(self.p.contact, Map.extract_address(p), field="travel_plan_address") for p in places],
            [wechat.check_new_sent_contains(self.p.contact, weather.current_weather_text(Map.extract_address(p)), field="travel_plan_weather") for p in places],
            [wechat.check_new_sent_contains_number(self.p.contact, weather.current_temp(Map.extract_address(p)), tolerance=0.1, field="travel_plan_temp") for p in places],
        )


class WeatherCalendar_CreateEventIfNotSunny(BaseTask):
    """判定：非晴天时创建当天全天日程并写入天气备注。"""

    templates = ["查询 {city} 的天气，如果不是晴天，则在日历中创建一个全天日程，标题为 {event_title}，并在备注中写入当前的温度和天气状况。"]
    apps = ["weather", "calendar"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["extract", "create", "handoff"]
    parameters = {
        "city": {"type": "string", "default": "北京"},
        "event_title": {"type": "string", "default": "带伞"},
    }

    def get_expected_changes(self, input: JudgeInput) -> list[str]:
        return WEATHER_QUERY_CHANGES + CALENDAR_EVENT_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        calendar = Calendar(input.apps["calendar"], init=input.apps_init["calendar"])
        weather = Weather(input.apps["weather"])
        app_temp = weather.current_temp(str(self.p.city))
        app_desc = weather.current_weather_text(str(self.p.city))
        is_sunny = weather.is_sunny_text(app_desc)
        weather_type = weather.weather_type_chinese(str(self.p.city))

        title_target = str(self.p.event_title).strip()

        if is_sunny:
            return [
                calendar.check_no_event_created(title_target, field="calendar_event"),
            ]

        # 天气描述：接受中文归类（如"阴"）或原始文本（如"Cloudy"）任一
        weather_labels = list({weather_type, app_desc, app_desc.lower()})
        return [
            calendar.check_event_created(title_target, field="calendar_event_created"),
            calendar.check_event_all_day(title_target, field="calendar_event_all_day"),
            calendar.check_event_on_date(title_target, sim_today(input.os).isoformat(), field="calendar_event_date"),
            *check_alternatives(
                [calendar.check_event_description_contains(title_target, label, field="calendar_event_weather") for label in weather_labels],
            ),
            calendar.check_event_description_contains_number(title_target, float(app_temp), tolerance=2.0, field="calendar_event_temp"),
        ]
