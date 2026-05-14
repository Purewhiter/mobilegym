from __future__ import annotations

from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.judge import JudgeInput
from bench_env.task.railway12306.app import RAIL_QUERY_CHANGES, Railway12306
from bench_env.task.utils import default_tomorrow, format_date_natural, sample_future_date
from bench_env.task.wechat.app import WECHAT_CONTACT_PARAM, WECHAT_SEND_CHANGES, Wechat


class RailwayEarliestGTrainToWechat(BaseTask):
    """判定：查询了目标路线/日期 + 微信消息含最早 G 字头车次号 + 二等座票价。

    任务要求只算 G 字头（不含 C/D）——使用 `earliest_high_speed_train` 时只看 G 字头车次。
    """

    templates = [
        "在 12306 查询 {date} 从 {from_city} 到 {to_city} 的车票，把最早一趟高铁的车次号和二等座票价发给微信联系人“{contact}”。",
    ]
    apps = ["railway12306", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["search", "extract", "reasoning", "handoff"]
    parameters = {
        "from_city": {
            "type": "string",
            "default": "上海",
            "description": "出发城市",
        },
        "to_city": {
            "type": "string",
            "default": "南京",
            "description": "到达城市",
        },
        "_route": {
            "sampler": Railway12306.sample_g_prefix_distractor_route,
            "fields": {"from_city": "from_city", "to_city": "to_city"},
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
            from_station=self.p.from_city,
            to_station=self.p.to_city,
            date=self.p.date,
            field="query.searched",
        )
        if not searched["passed"]:
            return [
                searched,
                {
                    "field": "earliest_g_share",
                    "expected": "最早 G 字头车次号 + 二等座票价",
                    "actual": wechat.joined_new_texts_to(self.p.contact) or "(none)",
                    "passed": False,
                },
            ]
        train = rail.earliest_high_speed_train(
            self.p.from_city, self.p.to_city, require_sellable=True,
        )
        if train is None:
            raise ValueError(
                f"No sellable G-prefix train for {self.p.from_city}->{self.p.to_city} "
                f"on {self.p.date}"
            )
        second_class_price = Railway12306.train_seat_price(train, "二等")
        price_label = f"{round(second_class_price, 2):g}"
        return [
            searched,
            wechat.check_new_sent_contains(
                self.p.contact,
                str(train["trainNo"]),
                price_label,
                field="earliest_g_share",
            ),
        ]
