"""
SMS app task definitions.
"""
# -- Task Index (auto-generated, do not edit) --
# 16 tasks | L1×2  L2×4  L3×6  L4×4
#
# [L1] OpenSmsSettingsPage              打开短信设置页
# [L1] ReadLatestSender                 看看当前排在最上面的短信是谁发来的
# [L2] ToggleMainSetting                把短信的{setting_key}设为{enabled}
# [L2] OpenConversationBySender         打开来自{conversation_id}的短信会话
# [L2] ReadUnreadConversationCount      数一下短信里现在有几个未读会话
# [L2] ReadLatestIncomingMessage        看看来自{sender}的最新一条短信写了什么
# [L3] ReplyToConversation              给{sender}回复一条短信，内容是"{content}"
# [L3] MarkAllConversationsRead         把短信里的所有会话都标成已读
# [L3] ToggleFreeNetworkSetting         把短信里{setting_key}设为{enabled}
# [L3] ToggleFiveGSetting               把短信 5G 消息里的{setting_key}设为{enabled}
# [L3] ComposeNewMessage                给{recipient}发一条新短信，内容是"{content}"
# [L4] CompareConversationMessageCount  {sender1}和{sender2}这两个短信会话里，哪个消息更多
# [L4] ConfigureFreeNetworkSmsSettings  把短信的网络短信设置成：自动转为短信{auto_convert_sms}，自动转为彩信{auto_convert_mms}，屏蔽陌生人{block_strangers}
# [L4] DeleteConversation               帮我把{sender}的短信会话删掉
# [L4] ReplyToLatestUnread              看看最新的未读短信是哪个发来的，帮我回复他「{content}」
# [L3] FindAndReplySendersByKeyword     把之前给我发过提到{keyword}短信的人都找出来，统一回一句{reply}
# -- End Task Index --

from __future__ import annotations

from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import AnswerTask, CriteriaTask
from bench_env.task.judge import JudgeInput
from bench_env.task.sms.app import (
    SMS_EXISTING_SENDERS,
    SMS_NEW_RECIPIENTS,
    Sms,
    sms_from_input,
    sms_init_from_input,
)


class OpenSmsSettingsPage(CriteriaTask):
    templates = [
        "打开短信设置页",
        "Open the SMS settings page",
    ]
    apps = ["sms"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["nav"]
    criteria = {"route": "/settings"}
    optimal_paths = [["settings.open"]]


class ReadLatestSender(AnswerTask):
    templates = ["看看当前排在最上面的短信是谁发来的"]
    apps = ["sms"]
    scope = "S1"
    objective = "query"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["query"]
    answer_fields = [{"type": "text", "label": "发送者", "hint": "如：中国移动"}]

    def get_answer(self, input: JudgeInput) -> Any:
        return sms_init_from_input(input).conversations[0]["sender"]


class ToggleMainSetting(CriteriaTask):
    templates = ["把短信的{setting_key}设为{enabled}"]
    apps = ["sms"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["settings"]
    parameters = {
        "setting_key": {
            "type": "enum",
            "values": {
                "免费网络短信(SIM卡1)": "free_sms_sim1",
                "免费网络短信(SIM卡2)": "free_sms_sim2",
                "5G消息": "5g_message",
                "列表中显示头像": "show_avatar",
                "文字头像": "text_avatar",
            },
            "default": "show_avatar",
        },
        "enabled": {
            "type": "bool",
            "values": {"开启": True, "关闭": False},
            "default": False,
        },
    }
    criteria = {"settings.{setting_key}": "{enabled}"}

    async def _post_sample(self, env) -> None:
        await self._invert_criteria(env)


class OpenConversationBySender(CriteriaTask):
    templates = ["打开来自{conversation_id}的短信会话"]
    apps = ["sms"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["nav"]
    expected_changes = ["os.providers.sms.conversations"]
    parameters = {
        "conversation_id": {
            "type": "enum",
            "values": {
                "华为云": "huawei-cloud",
                "抖音月付": "douyin-pay",
                "10690955998": "abc-bank",
                "建设银行": "ccb-bank",
                "中国电信": "china-telecom",
                "中国联通": "china-unicom",
            },
            "default": "china-telecom",
        },
    }
    criteria = {"route": "/conversation/{conversation_id}"}


class ReadUnreadConversationCount(AnswerTask):
    templates = ["数一下短信里现在有几个未读会话"]
    apps = ["sms"]
    scope = "S1"
    objective = "query"
    composition = "atomic"
    difficulty = "L2"
    capabilities = ["query"]
    answer_fields = [{"type": "number", "label": "未读会话数"}]

    def get_answer(self, input: JudgeInput) -> Any:
        return sms_init_from_input(input).unread_conversation_count


class ReadLatestIncomingMessage(AnswerTask):
    templates = [
        "看看来自{sender}的最新一条短信写了什么",
        "帮我看看{sender}最近发来的那条短信内容是什么",
    ]
    apps = ["sms"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["query"]
    parameters = {
        "sender": {
            "type": "enum",
            "values": SMS_EXISTING_SENDERS,
            "default": "华为云",
        },
    }
    expected_changes = ["os.providers.sms.conversations"]
    answer_fields = [{"type": "text", "label": "短信内容", "hint": "请填写完整的短信原文"}]

    def get_answer(self, input: JudgeInput) -> Any:
        return sms_init_from_input(input).latest_incoming_content_from(self.p.sender)


class ReplyToConversation(BaseTask):
    templates = [
        '给{sender}回复一条短信，内容是"{content}"',
        'Reply to {sender} with a message saying "{content}"',
    ]
    apps = ["sms"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["create"]
    parameters = {
        "sender": {
            "type": "enum",
            "values": SMS_EXISTING_SENDERS,
            "default": "中国联通",
        },
        "content": {
            "type": "string",
            "default": "我知道了",
        },
    }
    expected_changes = ["os.providers.sms.conversations", "os.providers.sms.messagesByConversationId"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        sms = sms_from_input(input)
        return [
            sms.check_new_sent_to(self.p.sender, self.p.content, field="reply_message"),
        ]


class MarkAllConversationsRead(BaseTask):
    templates = [
        "把短信里的所有会话都标成已读",
        "Mark all SMS conversations as read",
    ]
    apps = ["sms"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L3"
    capabilities = ["edit"]
    expected_changes = ["os.providers.sms.conversations"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        sms = sms_from_input(input)
        return [sms.check_all_read()]


class ToggleFreeNetworkSetting(CriteriaTask):
    templates = ["把短信里{setting_key}设为{enabled}"]
    apps = ["sms"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L1"
    capabilities = ["settings"]
    parameters = {
        "setting_key": {
            "type": "enum",
            "values": {
                "自动转为短信": "auto_convert_sms",
                "自动转为彩信": "auto_convert_mms",
                "屏蔽陌生人的网络短信": "block_strangers",
            },
            "default": "block_strangers",
        },
        "enabled": {
            "type": "bool",
            "values": {"开启": True, "关闭": False},
            "default": False,
        },
    }
    criteria = {"settings.{setting_key}": "{enabled}"}

    async def _post_sample(self, env) -> None:
        await self._invert_criteria(env)


class ToggleFiveGSetting(CriteriaTask):
    templates = ["把短信 5G 消息里的{setting_key}设为{enabled}"]
    apps = ["sms"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["settings"]
    parameters = {
        "setting_key": {
            "type": "enum",
            "values": {
                "自动转为短信": "5g_auto_sms",
                "自动转为彩信": "5g_auto_mms",
                "回执报告": "5g_read_report",
            },
            "default": "5g_read_report",
        },
        "enabled": {
            "type": "bool",
            "values": {"开启": True, "关闭": False},
            "default": True,
        },
    }
    criteria = {"settings.{setting_key}": "{enabled}"}

    async def _post_sample(self, env) -> None:
        await self._invert_criteria(env)


class ComposeNewMessage(BaseTask):
    templates = [
        '给{recipient}发一条新短信，内容是"{content}"',
        'Send a new SMS to {recipient} saying "{content}"',
    ]
    apps = ["sms"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["create"]
    parameters = {
        "recipient": {
            "type": "enum",
            "values": SMS_NEW_RECIPIENTS,
            "default": "张三",
        },
        "content": {
            "type": "string",
            "default": "今天下午三点开会",
        },
    }
    expected_changes = ["os.providers.sms.conversations", "os.providers.sms.messagesByConversationId"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        sms = sms_from_input(input)
        return [
            sms.check_new_sent_to(
                self.p.recipient,
                self.p.content,
                field="compose_message",
            ),
        ]


class CompareConversationMessageCount(AnswerTask):
    templates = [
        "{sender1}和{sender2}这两个短信会话里，哪个消息更多",
        "帮我看看{sender1}和{sender2}的短信会话，谁那边的消息条数更多",
    ]
    apps = ["sms"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L2"
    capabilities = ["query", "reasoning"]
    expected_changes = ["os.providers.sms.conversations"]
    answer_fields = [{"type": "choice", "label": "消息更多的会话", "options": ["{sender1}", "{sender2}"]}]
    parameters = {
        "sender1": {
            "type": "string",
            "default": "中国电信",
        },
        "sender2": {
            "type": "string",
            "default": "中国联通",
        },
        "_pair": {
            "sampler": Sms.sample_compare_pair,
            "fields": {"sender1": "sender1", "sender2": "sender2"},
        },
    }

    def get_answer(self, input: JudgeInput) -> Any:
        sms = sms_init_from_input(input)
        return sms.sender_with_more_messages(self.p.sender1, self.p.sender2)


class ConfigureFreeNetworkSmsSettings(CriteriaTask):
    templates = [
        "把短信的网络短信设置成：自动转为短信{auto_convert_sms}，自动转为彩信{auto_convert_mms}，屏蔽陌生人{block_strangers}",
    ]
    apps = ["sms"]
    scope = "S1"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["settings"]
    parameters = {
        "auto_convert_sms": {
            "type": "bool",
            "values": {"开启": True, "关闭": False},
            "default": False,
        },
        "auto_convert_mms": {
            "type": "bool",
            "values": {"开启": True, "关闭": False},
            "default": True,
        },
        "block_strangers": {
            "type": "bool",
            "values": {"开启": True, "关闭": False},
            "default": False,
        },
    }
    criteria = {
        "settings.auto_convert_sms": "{auto_convert_sms}",
        "settings.auto_convert_mms": "{auto_convert_mms}",
        "settings.block_strangers": "{block_strangers}",
    }

    async def _post_sample(self, env) -> None:
        await self._invert_criteria(env)


class DeleteConversation(BaseTask):
    templates = [
        "帮我把{sender}的短信会话删掉",
        "删除{sender}的短信会话",
        "Delete the SMS conversation with {sender}",
        "Remove the SMS conversation from {sender}",
    ]
    apps = ["sms"]
    scope = "S1"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["edit"]
    parameters = {
        "sender": {
            "type": "enum",
            "values": SMS_EXISTING_SENDERS,
            "default": "建设银行",
        },
    }
    expected_changes = ["os.providers.sms.conversations", "os.providers.sms.messagesByConversationId"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        sms = sms_from_input(input)
        return [sms.check_conversation_deleted(self.p.sender)]


class ReplyToLatestUnread(BaseTask):
    templates = [
        "看看最新的未读短信是哪个发来的，帮我回复他「{content}」",
        "帮我打开最新的未读短信会话，回复“{content}”",
        'Find the latest unread SMS and reply with "{content}"',
        'Open the most recent unread SMS conversation and reply "{content}"',
    ]
    apps = ["sms"]
    scope = "S1"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["query", "create"]
    parameters = {
        "content": {
            "type": "string",
            "default": "好的收到",
        },
    }
    expected_changes = ["os.providers.sms.conversations", "os.providers.sms.messagesByConversationId"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        sms = sms_from_input(input)
        target_sender = sms_init_from_input(input).latest_unread_sender()
        return [sms.check_new_sent_to(target_sender, self.p.content, field="reply_to_unread")]


class FindAndReplySendersByKeyword(BaseTask):
    """验证 Agent 是否找出所有含关键词短信的发送方并统一回复。

    判定：使用 Sms.senders_with_keyword 获取目标发送方列表，
    再用 Sms.check_replied_to_all 验证每个目标都收到了包含 reply 的新消息。
    """

    templates = [
        "把之前给我发过提到{keyword}短信的人都找出来，统一回一句{reply}",
        "帮我找出短信里提到过{keyword}的发送方，给每个人回复{reply}",
        "Find all senders who previously sent me SMS messages mentioning {keyword}, and reply to each of them with {reply}",
        "Look through SMS for messages containing {keyword}, and send {reply} to each of those senders",
    ]
    apps = ["sms"]
    scope = "S1"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["query", "create"]
    parameters = {
        "keyword": {"type": "string", "default": "套餐"},
        "reply": {"type": "string", "default": "拒收"},
    }
    expected_changes = ["os.providers.sms.messagesByConversationId", "os.providers.sms.conversations"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        sms = sms_from_input(input)
        senders = sms.senders_with_keyword(self.p.keyword)
        return [sms.check_replied_to_all(senders, self.p.reply)]