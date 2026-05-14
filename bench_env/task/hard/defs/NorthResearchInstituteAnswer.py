from __future__ import annotations

import re
from typing import Any

from bench_env.task.common_tasks import AnswerTask, build_answer_checks
from bench_env.task.judge import JudgeInput
from bench_env.task.map.app import MAP_SEARCH_CHANGES


class NorthResearchInstituteAnswer(AnswerTask):
    templates = ["我所在位置正北边的研究所是什么"]
    apps = ["map"]
    scope = "S2"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["search", "extract", "reasoning"]
    expected_changes = MAP_SEARCH_CHANGES

    answer_fields = [
        {
            "type": "text",
            "label": "研究所名称",
            "hint": "填写研究所名称",
        }
    ]
    answer = re.compile(r"中国科学院物理研究所|中科院物理所|物理所")

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        checks = build_answer_checks(self.get_answer(input), input.answer)
        answer = str(input.answer or "")
        negated = bool(re.search(r"(?:不是|并不是|并非|非).{0,8}(?:物理所|物理研究所)", answer))
        if negated:
            checks[0]["passed"] = False
            checks[0]["reason"] = "answer contains a negated allowed institute name"
        return checks
