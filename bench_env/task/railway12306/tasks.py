"""
Railway12306 task definitions.
"""
# -- Task Index (auto-generated, do not edit) --
# 16 tasks | L1×2  L2×4  L3×6  L4×4
#
# [L3] OpenAllApps                     找到12306的全部应用页面
# [L2] OpenServicePhone                在12306中查一下{region}的客服电话区号是多少
# [L2] OpenInvoice                     在12306里添加一个发票抬头{name}，{make_default}默认，并把发票邮箱设置为{email}
# [L2] CheckPassengerCount             看看12306里一共添加了几个乘车人
# [L1] CheckDefaultPassengerName       看看12306里默认乘车人叫什么名字
# [L3] CheckStudentVerify              看看我的学生票优惠区间是哪里
# [L3] CheckRecentTripCities           看看我最近的车票，我都{direction}
# [L3] CheckIdVerificationStatus       进入人证核验页面，看看我的12306是否人证核验成功
# [L3] BuyReturnTicketFromLatestOrder  看看我最新的一张车票，给我买一张明天任意时间的返程票，提交订单即可
# [L1] FindTrainByDate                 看看我{date}坐了哪趟车
# [L2] CheckTicketPriceByDate          看看我{date}坐的那趟车花了多少钱
# [L4] QueryAndCheckRoute              帮我看看明天{from_station}到{to_station}的所有车次，其中发车最晚的是哪一趟
# [L4] BuyTicketForPassenger           帮我给{name}买一张{date}从{from_station}到{to_station}的高铁票，要有票的{schedule_pref}的班次，{seat_type}，提交订单即可
# [L4] BuyTicketsForTwoPassengers      帮我给{name}和{name2}各买一张{date}从{from_station}到{to_station}的高铁票，要有票的{schedule_pref}的班次，{seat_type}，提交订单即可
# [L3] BuyTicketForNewPassenger        帮我给{name}买一张{date}从{from_station}到{to_station}的高铁票，要{schedule_pref}的有票的班次，{seat_type}，他的身份证号是{id_no}，手机号是{phone},提交订单即可
# [L4] QueryFastestTrainDetails        帮我看看{date}从{from_station}到{to_station}的车票，最快的车是哪一趟，要多久，始发站是哪里，几点到地方
# -- End Task Index --


from __future__ import annotations

import re
from typing import Any, ClassVar

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import AnswerTask, CriteriaTask, build_best_match_answer_checks, match_value, match_duration, match_time
from bench_env.task.judge import JudgeInput
from bench_env.task.railway12306.app import (
    Railway12306,
    SCHEDULE_PREF_PARAM,
    SEAT_TYPE_PARAM,
)
from bench_env.task.utils import default_tomorrow, format_date_natural, normalize_price, sample_future_date, tomorrow_ymd

#
# expected_changes is matched against diff paths like:
#   apps.railway12306.searchForm.to
# so we must reference the real state structure, not template parameter names.
QUERY_EXPECTED_CHANGES = [
    # Query form fields live under searchForm (from/to/date/stationSelectTarget, etc.)
    "searchForm",
    # Search/query side effects
    "searchHistory",
    "lastQuerySummary",
    "queryState",
    "stationSelectTarget",
    "directTrains",
    "from",
    "to",
    "date",
]

BOOKING_EXPECTED_CHANGES = QUERY_EXPECTED_CHANGES + [
    "selectedTrain", "lastPickedTrain", "orders",
]

BOOKING_WITH_PASSENGER_CHANGES = BOOKING_EXPECTED_CHANGES + ["passengers"]

# ═════════════════════════════════════════════════════════════════════
# Simple tasks
# ═════════════════════════════════════════════════════════════════════
class OpenAllApps(CriteriaTask):
    """打开全部应用页"""

    apps = ["railway12306"]
    templates = [
        "找到12306的全部应用页面",
        "去12306的全部应用页",
        "Go to the All Apps page in 12306",
        "Open the All Apps page of 12306",
    ]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L3"
    capabilities = ["nav"]
    optimal_paths = [["home.allApps"]]
    criteria = {"route": "/all-apps"}


class OpenServicePhone(CriteriaTask):
    """查询客服电话区号"""

    apps = ["railway12306"]
    templates = [
        "在12306中查一下{region}的客服电话区号是多少",
        "帮我看看{region}的12306客服电话区号",
    ]
    scope = "S1"
    objective = "hybrid"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["nav", "extract"]
    parameters = {
        "region": {
            "type": "enum",
            "values": {
                "北京": "北京铁路客户服务中心",
                "上海": "上海铁路客户服务中心",
                "广州": "广州铁路客户服务中心",
                "武汉": "武汉铁路客户服务中心",
                "成都": "成都铁路客户服务中心",
            },
            "default": "上海铁路客户服务中心",
            "description": "客服中心地区",
        }
    }
    optimal_paths = [["service.servicePhone"]]
    criteria = {}
    answer = ".servicePhones[region={region}].areaCode"
    answer_fields = [{"type": "text", "label": "区号", "hint": "如：010"}]


class OpenInvoice(CriteriaTask):
    """添加发票抬头并设置邮箱"""

    apps = ["railway12306"]
    templates = [
        "在12306里添加一个发票抬头{name}，{make_default}默认，并把发票邮箱设置为{email}",
    ]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["nav", "create"]
    parameters = {
        "name": {
            "type": "enum",
            "values": ["赵宇轩", "王明", "张伟", "大刘"],
            "default": "赵宇轩",
            "description": "发票抬头名称",
        },
        "make_default": {
            "type": "bool",
            "values": {"设为": True, "不要设为": False},
            "default": True,
            "description": "是否设为默认抬头",
        },
        "email": {
            "type": "enum",
            "values": [
                "ticket_demo01@example.com",
                "ticket_demo02@example.com",
                "ticket_demo03@example.com",
            ],
            "default": "ticket_demo01@example.com",
            "description": "发票邮箱",
        },
    }
    optimal_paths = [["tab.orders", "orders.invoice"]]
    criteria = {
        "invoiceHeaders[name={name}].name": "{name}",
        "invoiceHeaders[name={name}].isDefault": "{make_default}",
        "invoiceEmail": "{email}",
    }
class CheckPassengerCount(AnswerTask):
    """查看乘车人数量"""

    apps = ["railway12306"]
    templates = ["看看12306里一共添加了几个乘车人", "12306里现在有几位乘车人"]
    scope = "S1"
    objective = "query"
    composition = "atomic"
    difficulty = "L3"
    capabilities = ["extract"]
    answer = (".passengers", len)
    answer_fields = [{"type": "number", "label": "乘车人数量"}]


class CheckDefaultPassengerName(AnswerTask):
    """查看默认乘车人姓名"""

    apps = ["railway12306"]
    templates = ["看看12306里默认乘车人叫什么名字", "帮我看一下默认乘车人是谁"]
    scope = "S1"
    objective = "query"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["extract"]

    answer = ".passengers[isDefault=True].name"
    answer_fields = [{"type": "text", "label": "默认乘车人姓名", "hint": "如：李明"}]


class CheckStudentVerify(CriteriaTask):
    """查看学生票优惠区间"""

    apps = ["railway12306"]
    templates = ["看看我的学生票优惠区间是哪里", "帮我看一下学生票优惠区间"]
    scope = "S1"
    objective = "hybrid"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["nav", "extract"]
    optimal_paths = [["tab.my", "my.account", "account.studentVerify"]]
    criteria = {}
    answer = {"from": ".studentVerify.from", "to": ".studentVerify.to"}
    answer_fields = [
        {"type": "text", "label": "出发站", "hint": "如：杭州"},
        {"type": "text", "label": "到达站", "hint": "如：广州"},
    ]


class CheckRecentTripCities(AnswerTask):
    """查看最近车票涉及的出发/到达城市"""

    apps = ["railway12306"]
    templates = ["看看我最近的车票，我都{direction}", "帮我看看最近的车票里，我都{direction}"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["extract"]
    parameters = {
        "direction": {
            "type": "enum",
            "values": {"从哪些城市出发过": "from", "目的地是哪些城市": "to"},
            "default": "from",
            "description": "统计出发还是到达城市",
        }
    }
    answer_fields = [{"type": "text", "label": "城市", "hint": "如：北京", "repeatable": True, "compare": "set"}]

    def get_answer(self, input: JudgeInput) -> dict[str, str]:
        rail = Railway12306(input.apps_init["railway12306"])
        cities = rail.unique_trip_cities(self.p.direction)
        return {f"city_{idx + 1}": city for idx, city in enumerate(cities)}

    def get_expected_response(self, input: JudgeInput) -> list:
        rail = Railway12306(input.apps_init["railway12306"])
        cities = rail.unique_trip_cities(self.p.direction)
        return [list(cities)]


class CheckIdVerificationStatus(BaseTask):
    """查看人证核验结果"""

    apps = ["railway12306"]
    templates = ["进入人证核验页面，看看我的12306是否人证核验成功", "进入人证核验页面，帮我确认一下12306里的人证核验有没有成功"]
    scope = "S1"
    objective = "hybrid"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["nav", "extract"]
    optimal_paths = [["tab.my", "my.settings", "settings.idVerify"]]
    answer_fields = [{"type": "choice", "label": "核验结果", "options": ["核验成功", "未通过核验"]}]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        expected = input.apps_init["railway12306"]["user"]["realNameVerified"]
        answer = re.sub(r"\s+", "", str(input.answer or ""))
        negative = re.search(
            r"未通过(?:核验)?|没有通过|没通过"
            r"|没有?人证核验成功|未人证核验成功"
            r"|未核验成功|没有核验成功"
            r"|未成功|没有成功|没成功|不成功|失败|否",
            answer,
        )
        positive = re.search(r"核验成功|已通过|已核验|成功|通过|是", answer)
        judged = False if negative else True if positive else None
        return [{
            "field": "answer",
            "expected": "肯定" if expected else "否定",
            "actual": input.answer,
            "passed": judged is not None and judged == expected,
        }]


class BuyReturnTicketFromLatestOrder(BaseTask):
    """基于最新车票购买返程票"""

    apps = ["railway12306"]
    templates = [
        "看看我最新的一张车票，给我买一张明天任意时间的返程票，提交订单即可",
        "帮我参考最新的一张车票，买一张明天回程的票，时间不限，提交订单就行",
        "Check my most recent train ticket and buy a return ticket for tomorrow at any time; just submit the order",
        "Based on my latest train ticket, buy a return trip for tomorrow, any time is fine, just submit the order",
    ]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["search", "create", "reasoning"]
    expected_changes: ClassVar[list[str]] = BOOKING_EXPECTED_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        init_rail = Railway12306(input.apps_init["railway12306"])
        my_ticket = init_rail.my_latest_ticket
        from_city = Railway12306._station_to_city(my_ticket["toStation"])
        to_city = Railway12306._station_to_city(my_ticket["fromStation"])
        user_name = init_rail.user_name
        travel_date = tomorrow_ymd(input.os_init)
        rail = Railway12306(
            input.apps["railway12306"],
            init=input.apps_init["railway12306"],
        )
        return [
            rail.check_booking_order(
                from_station=from_city,
                to_station=to_city,
                date=travel_date,
                passenger_names=[user_name],
                field="newReturnOrder",
            )
        ]


# ═════════════════════════════════════════════════════════════════════
# Tasks with sampling
# ═════════════════════════════════════════════════════════════════════


class FindTrainByDate(AnswerTask):
    """按日期查看车次"""

    apps = ["railway12306"]
    templates = ["看看我{date}坐了哪趟车", "帮我查一下我{date}坐的是哪趟车"]
    scope = "S1"
    objective = "query"
    composition = "atomic"
    difficulty = "L2"
    capabilities = ["extract"]
    parameters = {
        "date": {
            "type": "string",
            "sampler": Railway12306.sample_my_ticket_date,
            "default": "2026-02-09",
            "display": "date_hao",
            "description": "订单日期",
        },
    }
    answer_fields = [{"type": "text", "label": "车次", "hint": "如：G5678"}]

    def get_answer(self, input: JudgeInput) -> str:
        rail = Railway12306(input.apps_init["railway12306"])
        tickets = rail.my_tickets_on_date(str(self.p.date))
        return tickets[0]["trainNo"]


class CheckTicketPriceByDate(AnswerTask):
    """按日期查看票价"""

    apps = ["railway12306"]
    templates = ["看看我{date}坐的那趟车花了多少钱", "帮我看一下我{date}那趟车票价多少"]
    scope = "S1"
    objective = "query"
    composition = "atomic"
    difficulty = "L2"
    capabilities = ["extract"]
    parameters = {
        "date": {
            "type": "string",
            "sampler": Railway12306.sample_my_ticket_date,
            "default": "2026-02-09",
            "display": "date_hao",
            "description": "订单日期",
        },
    }
    answer_fields = [{"type": "number", "label": "票价（元）"}]

    def get_answer(self, input: JudgeInput) -> int | float:
        rail = Railway12306(input.apps_init["railway12306"])
        tickets = rail.my_tickets_on_date(str(self.p.date))
        return normalize_price(sum(float(t["price"]) for t in tickets))


class QueryAndCheckRoute(AnswerTask):
    """查询明天最晚的车次"""

    apps = ["railway12306"]
    templates = [
        "帮我看看明天{from_station}到{to_station}的所有车次，其中发车最晚的是哪一趟",
        "查一下明天{from_station}到{to_station}的所有车次，看看发车最晚的车次是哪趟"
    ]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["search", "extract"]
    parameters = {
        "from_station": {"type": "string", "default": "上海", "description": "出发站"},
        "to_station": {"type": "string", "default": "南京", "description": "到达站"},
        "_route": {
            "sampler": Railway12306.sample_route_pair,
            "fields": {"from_station": "from_station", "to_station": "to_station"},
        },
    }
    expected_changes: ClassVar[list[str]] = QUERY_EXPECTED_CHANGES
    answer_fields = [{"type": "text", "label": "车次", "hint": "如：G5678"}]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rail = Railway12306(
            input.apps["railway12306"],
            init=input.apps_init["railway12306"],
        )

        date = tomorrow_ymd(input.os_init)
        searched = rail.check_searched(
            from_station=str(self.p.from_station),
            to_station=str(self.p.to_station),
            date=date,
        )
        if not searched["passed"]:
            return [searched]

        return build_best_match_answer_checks(
            rail.pick_trains("latest"),
            [("车次", "trainNo", match_value)],
            str(input.answer or ""),
        )


class BuyTicketForPassenger(BaseTask):
    """给单个已有乘车人购票"""

    apps = ["railway12306"]
    templates = [
        "帮我给{name}买一张{date}从{from_station}到{to_station}的高铁票，要有票的{schedule_pref}的班次，{seat_type}，提交订单即可",
        "请帮我给{name}订一张{date}从{from_station}到{to_station}的高铁票，{seat_type}，班次要有票的且{schedule_pref}的，只提交订单就行",
    ]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["search", "create"]
    parameters = {
        "name": {
            "type": "string",
            "source": "apps.railway12306.passengers[name]",
            "default": "赵宇轩",
            "description": "乘车人姓名",
        },
        "from_station": {"type": "string", "default": "上海", "description": "出发站"},
        "to_station": {"type": "string", "default": "南京", "description": "到达站"},
        "date": {
            "type": "string",
            "default": default_tomorrow,
            "display": format_date_natural,
            "description": "出发日期",
        },
        "schedule_pref": SCHEDULE_PREF_PARAM,
        "seat_type": SEAT_TYPE_PARAM,
        "_bookable_trip": {
            "sampler": Railway12306.sample_bookable_trip,
            "fields": {
                "from_station": "from_station",
                "to_station": "to_station",
                "date": "date",
                "schedule_pref": "schedule_pref",
                "seat_type": "seat_type",
            },
        },
    }
    expected_changes: ClassVar[list[str]] = BOOKING_EXPECTED_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rail = Railway12306(
            input.apps["railway12306"],
            init=input.apps_init["railway12306"],
        )
        _, target_train = rail.inspect_booking_target(
            from_station=str(self.p.from_station),
            to_station=str(self.p.to_station),
            date=str(self.p.date),
            schedule_pref=self.p.schedule_pref,
            seat_type=str(self.p.seat_type),
        )
        seat_type = str(self.p.seat_type)

        expected_train_no = target_train["trainNo"] if target_train else None
        return [
            rail.check_booking_order(
                from_station=str(self.p.from_station),
                to_station=str(self.p.to_station),
                date=str(self.p.date),
                passenger_names=[str(self.p.name)],
                expected_train_no=expected_train_no,
                seat_type=seat_type,
            )
        ]


class BuyTicketsForTwoPassengers(BaseTask):
    """给两个已有乘车人购票"""

    apps = ["railway12306"]
    templates = [
        "帮我给{name}和{name2}各买一张{date}从{from_station}到{to_station}的高铁票，要有票的{schedule_pref}的班次，{seat_type}，提交订单即可",
        "请帮我给{name}和{name2}各订一张{date}从{from_station}到{to_station}的高铁票，要有票的且{schedule_pref}的班次，席别要{seat_type}，提交订单就行",
    ]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["search", "create"]
    parameters = {
        "name": {"type": "string", "default": "赵宇轩", "description": "乘车人 1"},
        "name2": {"type": "string", "default": "王思雨", "description": "乘车人 2"},
        "_passengers": {
            "sampler": Railway12306.sample_passenger_pair,
            "fields": {"name": "name", "name2": "name2"},
        },
        "from_station": {"type": "string", "default": "上海", "description": "出发站"},
        "to_station": {"type": "string", "default": "南京", "description": "到达站"},
        "date": {
            "type": "string",
            "default": default_tomorrow,
            "display": format_date_natural,
            "description": "出发日期",
        },
        "schedule_pref": SCHEDULE_PREF_PARAM,
        "seat_type": SEAT_TYPE_PARAM,
        "_bookable_trip": {
            "sampler": Railway12306.sample_bookable_trip,
            "fields": {
                "from_station": "from_station",
                "to_station": "to_station",
                "date": "date",
                "schedule_pref": "schedule_pref",
                "seat_type": "seat_type",
            },
        },
    }
    expected_changes: ClassVar[list[str]] = BOOKING_EXPECTED_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rail = Railway12306(
            input.apps["railway12306"],
            init=input.apps_init["railway12306"],
        )
        _, target_train = rail.inspect_booking_target(
            from_station=str(self.p.from_station),
            to_station=str(self.p.to_station),
            date=str(self.p.date),
            schedule_pref=self.p.schedule_pref,
            seat_type=str(self.p.seat_type),
        )
        seat_type = str(self.p.seat_type)
        names = [str(self.p.name), str(self.p.name2)]

        expected_train_no = target_train["trainNo"] if target_train else None
        return [
            rail.check_booking_order(
                from_station=str(self.p.from_station),
                to_station=str(self.p.to_station),
                date=str(self.p.date),
                passenger_names=names,
                expected_train_no=expected_train_no,
                seat_type=seat_type,
            )
        ]


class BuyTicketForNewPassenger(BaseTask):
    """新增乘车人并购票"""

    apps = ["railway12306"]
    templates = [
        "帮我给{name}买一张{date}从{from_station}到{to_station}的高铁票，要{schedule_pref}的有票的班次，{seat_type}，他的身份证号是{id_no}，手机号是{phone},提交订单即可",
        "请先新增乘车人{name}，身份证号{id_no}，手机号{phone}，再给他买一张{date}从{from_station}到{to_station}的高铁票，选{schedule_pref}有票的班次和{seat_type},提交订单即可",
    ]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["search", "create"]
    parameters = {
        "name": {"type": "string", "default": "周若涵", "description": "新增乘车人姓名"},
        "id_no": {"type": "string", "default": "320106199612183428", "description": "身份证号"},
        "phone": {"type": "string", "default": "13912345678", "description": "手机号"},
        "_identity": {
            "sampler": Railway12306.sample_new_passenger_profile,
            "fields": {"name": "name", "id_no": "id_no", "phone": "phone"},
        },
        "from_station": {"type": "string", "default": "上海", "description": "出发站"},
        "to_station": {"type": "string", "default": "南京", "description": "到达站"},
        "date": {
            "type": "string",
            "default": default_tomorrow,
            "display": format_date_natural,
            "description": "出发日期",
        },
        "schedule_pref": SCHEDULE_PREF_PARAM,
        "seat_type": SEAT_TYPE_PARAM,
        "_bookable_trip": {
            "sampler": Railway12306.sample_bookable_trip,
            "fields": {
                "from_station": "from_station",
                "to_station": "to_station",
                "date": "date",
                "schedule_pref": "schedule_pref",
                "seat_type": "seat_type",
            },
        },
    }
    expected_changes: ClassVar[list[str]] = BOOKING_WITH_PASSENGER_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rail = Railway12306(
            input.apps["railway12306"],
            init=input.apps_init["railway12306"],
        )
        _, target_train = rail.inspect_booking_target(
            from_station=str(self.p.from_station),
            to_station=str(self.p.to_station),
            date=str(self.p.date),
            schedule_pref=self.p.schedule_pref,
            seat_type=str(self.p.seat_type),
        )
        seat_type = str(self.p.seat_type)

        expected_train_no = target_train["trainNo"] if target_train else None
        passenger_check = rail.check_new_passenger(
            name=str(self.p.name),
            id_no=str(self.p.id_no),
            phone=str(self.p.phone),
        )
        return [
            passenger_check,
            rail.check_booking_order(
                from_station=str(self.p.from_station),
                to_station=str(self.p.to_station),
                date=str(self.p.date),
                passenger_names=[str(self.p.name)],
                expected_train_no=expected_train_no,
                seat_type=seat_type,
            ),
        ]


class QueryFastestTrainDetails(AnswerTask):
    """查询最快车次的详细信息"""

    apps = ["railway12306"]
    templates = [
        "帮我看看{date}从{from_station}到{to_station}的车票，最快的车是哪一趟，要多久，始发站是哪里，几点到地方",
        "查一下{date}{from_station}到{to_station}的车次里哪趟最快，并告诉我车次、历时、始发站和到达时间",
    ]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["search", "extract"]
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
    expected_changes: ClassVar[list[str]] = QUERY_EXPECTED_CHANGES
    answer_fields = [
        {"type": "text", "label": "车次", "hint": "如：G5678"},
        {"type": "text", "label": "历时", "hint": "如：3小时15分"},
        {"type": "text", "label": "始发站", "hint": "如：杭州东"},
        {"type": "text", "label": "到达时间", "hint": "如：10:25"},
    ]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rail = Railway12306(
            input.apps["railway12306"],
            init=input.apps_init["railway12306"],
        )

        searched = rail.check_searched(
            from_station=str(self.p.from_station),
            to_station=str(self.p.to_station),
            date=str(self.p.date),
        )
        if not searched["passed"]:
            return [searched]

        return build_best_match_answer_checks(
            rail.pick_trains("fastest"),
            [("车次", "trainNo", match_value),
             ("历时", "duration", match_duration),
             ("始发站", "fromStation", match_value),
             ("到达时间", "arriveTime", match_time)],
            str(input.answer or ""),
        )
