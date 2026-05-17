from __future__ import annotations

import datetime
from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.judge import JudgeInput
from bench_env.task.railway12306.app import RAIL_QUERY_CHANGES, Railway12306
from bench_env.task.utils import sim_today
from bench_env.task.wechat.app import WECHAT_SEND_CHANGES, Wechat


# 联系人里默认没有"母亲"，需要在 _prepare 注入一条，昵称写 "母亲"。
_INJECTED_CONTACT_NAME = "母亲"


class RailwayTomorrowMomBookingToWechat(BaseTask):
    """判定：查询了明天从 from_city 到 to_city + 微信给"母亲"发了最早高铁车次号。"""

    templates = [
        "我妈妈明天要从{from_city} 来 {to_city}，在12306 查一下车票，把最早一趟高铁的车次号发给她",
    ]
    apps = ["railway12306", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L3"
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
            "sampler": Railway12306.sample_route_pair,
            "fields": {"from_city": "from_station", "to_city": "to_station"},
        },
    }
    expected_changes = RAIL_QUERY_CHANGES + WECHAT_SEND_CHANGES

    async def _prepare(self, env: Any) -> None:
        state = await env.get_state()
        wechat_state = Wechat(state["apps"]["wechat"]).prepare_state_with_contact(
            name=_INJECTED_CONTACT_NAME,
        )
        await env.set_state(
            {"apps": {"wechat": wechat_state}},
            deep=True,
            reload=False,
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        rail = Railway12306(input.apps["railway12306"], init=input.apps_init["railway12306"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        tomorrow = (sim_today(input.os_init) + datetime.timedelta(days=1)).isoformat()
        searched = rail.check_searched(
            from_station=self.p.from_city,
            to_station=self.p.to_city,
            date=tomorrow,
            field="query.searched",
        )
        if not searched["passed"]:
            return [
                searched,
                {
                    "field": "mom_train_share",
                    "expected": "最早高铁车次号",
                    "actual": wechat.joined_new_texts_to(_INJECTED_CONTACT_NAME) or "(none)",
                    "passed": False,
                },
            ]
        train = rail.earliest_high_speed_train(
            self.p.from_city, self.p.to_city, require_sellable=True,
        )
        if train is None:
            raise ValueError(
                f"No sellable G-prefix train for {self.p.from_city}->{self.p.to_city} "
                f"on {tomorrow}"
            )
        return [
            searched,
            wechat.check_new_sent_contains(
                _INJECTED_CONTACT_NAME,
                str(train["trainNo"]),
                field="mom_train_share",
            ),
        ]
