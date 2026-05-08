"""
SMS task correctness tests.
"""

from __future__ import annotations

import copy
import inspect
import json
import random
import re
from pathlib import Path
from typing import Any

import pytest

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import AnswerTask, CriteriaTask
from bench_env.task.sms import tasks as _tasks_module
from bench_env.task.sms.app import Sms
from bench_env.tests.conftest import make_judge_input

ALL_TASK_CLASSES: list[type[BaseTask]] = [
    obj
    for _, obj in inspect.getmembers(_tasks_module, inspect.isclass)
    if issubclass(obj, BaseTask) and obj is not BaseTask and obj.__module__ == _tasks_module.__name__
]
ALL_TASK_IDS = [cls.__name__ for cls in ALL_TASK_CLASSES]
ANSWER_TASK_CLASSES = [cls for cls in ALL_TASK_CLASSES if issubclass(cls, AnswerTask)]

TEST_OS_STATE = {"time": {"timestamp": 1773619200000}}
DEFAULT_ROUTE = {"app": "sms", "path": "/"}

_PATH_TOKEN_RE = re.compile(r"([^\.\[\]]+)|\[(\d+)\]")


def _load_sms_data() -> tuple[dict[str, Any], dict[str, Any]]:
    """Return (app_state, provider_state) for SMS."""
    root = Path(__file__).resolve().parents[2]
    app_defaults = json.loads(
        (root / "system" / "Sms" / "data" / "defaults.json").read_text(encoding="utf-8")
    )
    provider_defaults = json.loads(
        (root / "os" / "providers" / "defaults" / "sms.json").read_text(encoding="utf-8")
    )
    app_state = {"settings": app_defaults["settings"]}
    provider_state = {
        "conversations": provider_defaults["conversations"],
        "messagesByConversationId": provider_defaults["messagesByConversationId"],
    }
    return app_state, provider_state


BASE_APP_STATE, BASE_PROVIDER_STATE = _load_sms_data()
# Legacy alias — tests that manipulate conversations/messages operate on provider state
BASE_STATE = BASE_PROVIDER_STATE


def _make_task_input(
    init_state: dict[str, Any],
    curr_state: dict[str, Any],
    *,
    curr_app_state: dict[str, Any] | None = None,
    route: dict[str, Any] | None = None,
    answer: str | None = None,
):
    app_curr = curr_app_state if curr_app_state is not None else BASE_APP_STATE
    return make_judge_input(
        {
            "apps": {"sms": copy.deepcopy(BASE_APP_STATE)},
            "os": {**TEST_OS_STATE, "providers": {"sms": init_state}},
        },
        {
            "apps": {"sms": copy.deepcopy(app_curr)},
            "os": {**TEST_OS_STATE, "providers": {"sms": curr_state}},
        },
        route=route or DEFAULT_ROUTE,
        answer=answer,
    )


def _format_answer(expected: Any) -> str:
    if isinstance(expected, int):
        return f"答案是{expected}"
    if isinstance(expected, float):
        return f"答案是{expected:g}"
    return f"答案是{expected}"


def _parse_path(path: str) -> list[str | int]:
    tokens: list[str | int] = []
    for name, index in _PATH_TOKEN_RE.findall(path):
        tokens.append(name if name else int(index))
    return tokens


def _set_by_path(state: dict[str, Any], path: str, value: Any) -> None:
    tokens = _parse_path(path)
    current: Any = state
    for token in tokens[:-1]:
        current = current[token]
    current[tokens[-1]] = value


def _resolve_template(value: Any, params: dict[str, Any]) -> Any:
    if isinstance(value, str) and "{" in value:
        matched = re.fullmatch(r"\{(\w+)\}", value.strip())
        if matched:
            return params[matched.group(1)]
        return value.format(**params)
    return value


def _move_conversation_to_top(state: dict[str, Any], conversation_id: str, preview: str) -> None:
    idx = next(i for i, item in enumerate(state["conversations"]) if item["id"] == conversation_id)
    conversation = copy.deepcopy(state["conversations"][idx])
    conversation["preview"] = preview
    conversation["messageCount"] = len(state["messagesByConversationId"][conversation_id])
    state["conversations"].pop(idx)
    state["conversations"].insert(0, conversation)


def _append_outgoing_message(
    state: dict[str, Any],
    sender: str,
    content: str,
    *,
    message_id: str = "msg_test",
) -> None:
    conversation = next((item for item in state["conversations"] if item["sender"] == sender), None)
    if conversation is None:
        conversation_id = f"conv_{sender}"
        state["conversations"].insert(
            0,
            {
                "id": conversation_id,
                "sender": sender,
                "preview": content,
                "timestamp": "18:00",
                "avatarColor": "#3482FF",
                "avatarText": sender[0],
                "isUnread": False,
                "simSlot": 1,
                "messageCount": 1,
            },
        )
        state["messagesByConversationId"][conversation_id] = []
    else:
        conversation_id = conversation["id"]

    state["messagesByConversationId"][conversation_id].append(
        {
            "id": message_id,
            "content": content,
            "timestamp": "18:00",
            "isOutgoing": True,
            "status": "sent",
        }
    )
    _move_conversation_to_top(state, conversation_id, content)


def _mark_all_read(state: dict[str, Any]) -> None:
    for conversation in state["conversations"]:
        conversation["isUnread"] = False


def _positive_answer_case(task: BaseTask, *, curr_state: dict[str, Any] | None = None):
    curr = copy.deepcopy(curr_state) if curr_state is not None else copy.deepcopy(BASE_STATE)
    probe = _make_task_input(copy.deepcopy(BASE_STATE), curr)
    expected = task.get_answer(probe)  # type: ignore[attr-defined]
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, answer=_format_answer(expected))


def _positive_criteria_case(task: CriteriaTask):
    curr_provider = copy.deepcopy(BASE_STATE)
    curr_app = copy.deepcopy(BASE_APP_STATE)
    route = DEFAULT_ROUTE
    for raw_path, raw_value in task.criteria.items():
        path = _resolve_template(raw_path, task.params)
        value = _resolve_template(raw_value, task.params)
        if path == "route":
            route = {"app": "sms", "path": str(value)}
            continue
        if path.startswith("settings."):
            _set_by_path(curr_app, path, value)
        else:
            _set_by_path(curr_provider, path, value)
    return task, _make_task_input(
        copy.deepcopy(BASE_STATE), curr_provider,
        curr_app_state=curr_app, route=route,
    )


class TestTaskDefinitions:
    @pytest.mark.parametrize("task_cls", ALL_TASK_CLASSES, ids=lambda cls: cls.__name__)
    def test_instantiation(self, task_cls: type[BaseTask]):
        task = task_cls()
        assert task.templates
        assert task.apps == ["sms"]

    @pytest.mark.parametrize("task_cls", ALL_TASK_CLASSES, ids=lambda cls: cls.__name__)
    def test_description_renders(self, task_cls: type[BaseTask]):
        task = task_cls()
        assert "{" not in task.description

    @pytest.mark.parametrize("task_cls", ALL_TASK_CLASSES, ids=lambda cls: cls.__name__)
    def test_required_class_attrs(self, task_cls: type[BaseTask]):
        assert task_cls.scope in {"S1", "S2", "S3"}
        assert task_cls.objective in {"operate", "query", "hybrid", "vague", "safety"}
        assert task_cls.composition in {"atomic", "sequential", "transfer", "deep_dive"}
        assert task_cls.difficulty in {"L1", "L2", "L3", "L4"}
        assert 1 <= len(task_cls.capabilities) <= 4

    @pytest.mark.parametrize("task_cls", ALL_TASK_CLASSES, ids=lambda cls: cls.__name__)
    def test_parameter_defaults_present(self, task_cls: type[BaseTask]):
        for key, spec in task_cls.parameters.items():
            if key.startswith("_"):
                continue
            assert "default" in spec

    @pytest.mark.parametrize("task_cls", ANSWER_TASK_CLASSES, ids=lambda cls: cls.__name__)
    def test_answer_task_has_answer_or_get_answer(self, task_cls: type[AnswerTask]):
        assert task_cls.answer is not None or task_cls.get_answer is not AnswerTask.get_answer


class TestSmsAccessor:
    @pytest.fixture
    def sms(self) -> Sms:
        return Sms(copy.deepcopy(BASE_STATE))

    def test_basic_properties(self, sms: Sms):
        assert len(sms.conversations) == 6
        assert sms.messages_by_conversation_id["china-telecom"][-1]["content"].startswith("分将按")
        assert sms.unread_conversation_count == 5
        assert sms.all_conversations_read is False

    def test_conversation_and_message_lookup(self, sms: Sms):
        conversation = sms.conversation_by_sender("中国电信")
        assert conversation["id"] == "china-telecom"
        assert len(sms.messages_for_sender("中国联通")) == 2
        assert sms.message_count_for("中国电信") == 4
        assert sms.find_conversation_ids("建设银行") == ["ccb-bank"]

    def test_latest_message_methods(self, sms: Sms):
        assert sms.latest_message_from("华为云")["content"] == "【华为云】回复“1”获取体验资格；回复“TD”退订。"
        assert sms.latest_incoming_message_from("抖音月付")["id"] == "douyin-3"
        assert sms.latest_incoming_content_from("建设银行") == "【建设银行】已为您办理退订，之后将不再收到该类通知。"
        assert sms.latest_message_to("中国联通")["id"] == "cu-2"

    def test_sender_comparisons(self, sms: Sms):
        assert sms.sender_with_most_messages() == "中国电信"
        assert sms.sender_with_more_messages("中国电信", "中国联通") == "中国电信"
        sampled = Sms.sample_compare_pair({}, random.Random(0))
        assert sampled["sender1"] != sampled["sender2"]

    def test_new_outgoing_checks(self):
        init_state = copy.deepcopy(BASE_STATE)
        curr_state = copy.deepcopy(BASE_STATE)
        _append_outgoing_message(curr_state, "中国联通", "稍后联系你", message_id="cu_new")
        sms = Sms(curr_state, init=init_state)
        assert sms.new_outgoing_messages_to("中国联通")[0]["id"] == "cu_new"
        assert sms.new_outgoing_message("中国联通", "稍后联系你")["id"] == "cu_new"
        assert sms.check_new_sent_to("中国联通", "稍后联系你")["passed"] is True

    def test_check_new_sent_contains_phone(self):
        init_state = copy.deepcopy(BASE_STATE)
        curr_state = copy.deepcopy(BASE_STATE)
        _append_outgoing_message(
            curr_state,
            "中国联通",
            "联系电话是 010-6511 6400",
            message_id="cu_phone",
        )
        sms = Sms(curr_state, init=init_state)
        check = sms.check_new_sent_contains_phone("中国联通", "(010)65116400")
        assert check["passed"] is True

    def test_check_new_sent_to_accepts_phone_param_for_contact_thread(self):
        init_state = copy.deepcopy(BASE_STATE)
        curr_state = copy.deepcopy(BASE_STATE)
        _append_outgoing_message(
            curr_state,
            "张三",
            "测试短信",
            message_id="zs_phone_alias",
        )
        contacts = [
            {
                "displayName": "张三",
                "phones": [{"number": "+86 13800138000"}],
            }
        ]
        sms = Sms(curr_state, init=init_state, contacts=contacts)
        check = sms.check_new_sent_to("+86 13800138000", "测试短信")
        assert check["passed"] is True

    def test_check_new_sent_to_rejects_truncated_phone_alias(self):
        init_state = copy.deepcopy(BASE_STATE)
        curr_state = copy.deepcopy(BASE_STATE)
        _append_outgoing_message(
            curr_state,
            "张三",
            "测试短信",
            message_id="zs_phone_alias_short",
        )
        contacts = [
            {
                "displayName": "张三",
                "phones": [{"number": "+86 13800138000"}],
            }
        ]
        sms = Sms(curr_state, init=init_state, contacts=contacts)
        check = sms.check_new_sent_to("1380013800", "测试短信")
        assert check["passed"] is False

    def test_check_new_sent_any_of(self):
        init_state = copy.deepcopy(BASE_STATE)
        curr_state = copy.deepcopy(BASE_STATE)
        _append_outgoing_message(
            curr_state,
            "中国联通",
            "我要两颗西柚发了三篇笔记",
            message_id="cu_count",
        )
        sms = Sms(curr_state, init=init_state)
        check = sms.check_new_sent_any_of("中国联通", ["3", "三"], "篇笔记")
        assert check["passed"] is True

    def test_check_new_sent_contains_number(self):
        init_state = copy.deepcopy(BASE_STATE)
        curr_state = copy.deepcopy(BASE_STATE)
        _append_outgoing_message(
            curr_state,
            "中国联通",
            "我要两颗西柚发了三十三篇笔记",
            message_id="cu_num_cn",
        )
        sms = Sms(curr_state, init=init_state)
        check = sms.check_new_sent_contains_number("中国联通", 33, "篇笔记")
        assert check["passed"] is True

    def test_check_all_read(self):
        curr_state = copy.deepcopy(BASE_STATE)
        _mark_all_read(curr_state)
        sms = Sms(curr_state, init=copy.deepcopy(BASE_STATE))
        assert sms.check_all_read()["passed"] is True


def _open_settings_positive():
    return _positive_criteria_case(_tasks_module.OpenSmsSettingsPage())


def _open_settings_negative():
    task = _tasks_module.OpenSmsSettingsPage()
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _read_latest_sender_positive():
    return _positive_answer_case(_tasks_module.ReadLatestSender())


def _read_latest_sender_negative():
    task = _tasks_module.ReadLatestSender()
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE), answer="建设银行")


def _toggle_main_setting_positive():
    return _positive_criteria_case(_tasks_module.ToggleMainSetting(setting_key="show_avatar", enabled=False))


def _toggle_main_setting_negative():
    task = _tasks_module.ToggleMainSetting(setting_key="show_avatar", enabled=False)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _open_conversation_positive():
    return _positive_criteria_case(_tasks_module.OpenConversationBySender(conversation_id="china-telecom"))


def _open_conversation_negative():
    task = _tasks_module.OpenConversationBySender(conversation_id="china-telecom")
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE), route=DEFAULT_ROUTE)


def _read_unread_count_positive():
    return _positive_answer_case(_tasks_module.ReadUnreadConversationCount())


def _read_unread_count_negative():
    task = _tasks_module.ReadUnreadConversationCount()
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE), answer="还有4个未读")


def _read_latest_message_positive():
    return _positive_answer_case(_tasks_module.ReadLatestIncomingMessage(sender="中国联通"))


def _read_latest_message_negative():
    task = _tasks_module.ReadLatestIncomingMessage(sender="中国联通")
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE), answer="【中国联通】活动结束")


def _reply_positive():
    task = _tasks_module.ReplyToConversation(sender="中国联通", content="稍后联系")
    curr = copy.deepcopy(BASE_STATE)
    _append_outgoing_message(curr, "中国联通", "稍后联系", message_id="reply_ok")
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _reply_negative():
    task = _tasks_module.ReplyToConversation(sender="中国联通", content="稍后联系")
    curr = copy.deepcopy(BASE_STATE)
    _append_outgoing_message(curr, "中国联通", "别的内容", message_id="reply_bad")
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _mark_all_read_positive():
    task = _tasks_module.MarkAllConversationsRead()
    curr = copy.deepcopy(BASE_STATE)
    _mark_all_read(curr)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _mark_all_read_negative():
    task = _tasks_module.MarkAllConversationsRead()
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _toggle_free_network_positive():
    return _positive_criteria_case(
        _tasks_module.ToggleFreeNetworkSetting(setting_key="block_strangers", enabled=False)
    )


def _toggle_free_network_negative():
    task = _tasks_module.ToggleFreeNetworkSetting(setting_key="block_strangers", enabled=False)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _toggle_fiveg_positive():
    return _positive_criteria_case(
        _tasks_module.ToggleFiveGSetting(setting_key="5g_read_report", enabled=True)
    )


def _toggle_fiveg_negative():
    task = _tasks_module.ToggleFiveGSetting(setting_key="5g_read_report", enabled=True)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _compose_new_positive():
    task = _tasks_module.ComposeNewMessage(recipient="张三", content="今天下午三点开会")
    curr = copy.deepcopy(BASE_STATE)
    _append_outgoing_message(curr, "张三", "今天下午三点开会", message_id="compose_ok")
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _compose_new_negative():
    task = _tasks_module.ComposeNewMessage(recipient="张三", content="今天下午三点开会")
    curr = copy.deepcopy(BASE_STATE)
    _append_outgoing_message(curr, "张三", "明天再说", message_id="compose_bad")
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _compare_count_positive():
    return _positive_answer_case(
        _tasks_module.CompareConversationMessageCount(sender1="中国电信", sender2="中国联通")
    )


def _compare_count_negative():
    task = _tasks_module.CompareConversationMessageCount(sender1="中国电信", sender2="中国联通")
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE), answer="中国联通")


def _configure_free_sms_positive():
    return _positive_criteria_case(
        _tasks_module.ConfigureFreeNetworkSmsSettings(
            auto_convert_sms=False,
            auto_convert_mms=True,
            block_strangers=False,
        )
    )


def _configure_free_sms_negative():
    task = _tasks_module.ConfigureFreeNetworkSmsSettings(
        auto_convert_sms=False,
        auto_convert_mms=True,
        block_strangers=False,
    )
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _delete_conversation_positive():
    task = _tasks_module.DeleteConversation(sender="建设银行")
    curr = copy.deepcopy(BASE_STATE)
    # Remove the 建设银行 conversation
    curr["conversations"] = [c for c in curr["conversations"] if c["sender"] != "建设银行"]
    del curr["messagesByConversationId"]["ccb-bank"]
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _delete_conversation_negative():
    task = _tasks_module.DeleteConversation(sender="建设银行")
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _reply_to_latest_unread_positive():
    task = _tasks_module.ReplyToLatestUnread(content="好的收到")
    curr = copy.deepcopy(BASE_STATE)
    # 最新未读 = 华为云（conversations[0], isUnread=True）
    _append_outgoing_message(curr, "华为云", "好的收到", message_id="unread_reply_ok")
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _reply_to_latest_unread_negative():
    task = _tasks_module.ReplyToLatestUnread(content="好的收到")
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _find_and_reply_keyword_positive():
    task = _tasks_module.FindAndReplySendersByKeyword(keyword="套餐", reply="拒收")
    curr = copy.deepcopy(BASE_STATE)
    _append_outgoing_message(curr, "中国电信", "拒收", message_id="keyword_reply_ok")
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _find_and_reply_keyword_negative():
    task = _tasks_module.FindAndReplySendersByKeyword(keyword="套餐", reply="拒收")
    curr = copy.deepcopy(BASE_STATE)
    _append_outgoing_message(curr, "中国电信", "先不用了", message_id="keyword_reply_bad")
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


OFFLINE_JUDGE_POSITIVE_CASES = [
    ("OpenSmsSettingsPage", _open_settings_positive),
    ("ReadLatestSender", _read_latest_sender_positive),
    ("ToggleMainSetting", _toggle_main_setting_positive),
    ("OpenConversationBySender", _open_conversation_positive),
    ("ReadUnreadConversationCount", _read_unread_count_positive),
    ("ReadLatestIncomingMessage", _read_latest_message_positive),
    ("ReplyToConversation", _reply_positive),
    ("MarkAllConversationsRead", _mark_all_read_positive),
    ("ToggleFreeNetworkSetting", _toggle_free_network_positive),
    ("ToggleFiveGSetting", _toggle_fiveg_positive),
    ("ComposeNewMessage", _compose_new_positive),
    ("CompareConversationMessageCount", _compare_count_positive),
    ("ConfigureFreeNetworkSmsSettings", _configure_free_sms_positive),
    ("DeleteConversation", _delete_conversation_positive),
    ("ReplyToLatestUnread", _reply_to_latest_unread_positive),
    ("FindAndReplySendersByKeyword", _find_and_reply_keyword_positive),
]

OFFLINE_JUDGE_NEGATIVE_CASES = [
    ("OpenSmsSettingsPage", _open_settings_negative),
    ("ReadLatestSender", _read_latest_sender_negative),
    ("ToggleMainSetting", _toggle_main_setting_negative),
    ("OpenConversationBySender", _open_conversation_negative),
    ("ReadUnreadConversationCount", _read_unread_count_negative),
    ("ReadLatestIncomingMessage", _read_latest_message_negative),
    ("ReplyToConversation", _reply_negative),
    ("MarkAllConversationsRead", _mark_all_read_negative),
    ("ToggleFreeNetworkSetting", _toggle_free_network_negative),
    ("ToggleFiveGSetting", _toggle_fiveg_negative),
    ("ComposeNewMessage", _compose_new_negative),
    ("CompareConversationMessageCount", _compare_count_negative),
    ("ConfigureFreeNetworkSmsSettings", _configure_free_sms_negative),
    ("DeleteConversation", _delete_conversation_negative),
    ("ReplyToLatestUnread", _reply_to_latest_unread_negative),
    ("FindAndReplySendersByKeyword", _find_and_reply_keyword_negative),
]


class TestTaskJudgeMatrixOffline:
    @pytest.mark.parametrize("case_name,factory", OFFLINE_JUDGE_POSITIVE_CASES, ids=lambda item: item)
    def test_positive_cases(self, case_name: str, factory):
        task, judge_input = factory()
        result = task.evaluate(judge_input)
        assert result.success, case_name

    @pytest.mark.parametrize("case_name,factory", OFFLINE_JUDGE_NEGATIVE_CASES, ids=lambda item: item)
    def test_negative_cases(self, case_name: str, factory):
        task, judge_input = factory()
        result = task.evaluate(judge_input)
        assert not result.success, case_name

    def test_offline_judge_matrix_complete(self):
        positive = {name for name, _ in OFFLINE_JUDGE_POSITIVE_CASES}
        negative = {name.split("_")[0] for name, _ in OFFLINE_JUDGE_NEGATIVE_CASES}
        assert positive == set(ALL_TASK_IDS)
        assert negative == set(ALL_TASK_IDS)
