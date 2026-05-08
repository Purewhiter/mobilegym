"""
SMS app state accessor.
"""

from __future__ import annotations

import copy
import re
from typing import Any

from bench_env.task.base import BaseApp
from bench_env.task.common_tasks import match_value
from bench_env.task.tencent_meeting.app import TencentMeeting
from bench_env.task.utils import norm

SMS_EXISTING_SENDERS = [
    "华为云",
    "抖音月付",
    "10690955998",
    "建设银行",
    "中国电信",
    "中国联通",
]

SMS_UNREAD_SENDERS = {
    "华为云": "华为云",
    "抖音月付": "抖音月付",
    "建设银行": "建设银行",
    "中国电信": "中国电信",
    "中国联通": "中国联通",
}

SMS_NEW_RECIPIENTS = ["张三", "李四", "王五"]

SMS_RECIPIENT_PARAM = {
    "type": "enum",
    "values": SMS_NEW_RECIPIENTS,
    "default": "张三",
    "description": "短信收件人（真人联系人，发送到新会话）",
}

SMS_COMPARE_MESSAGE_COUNT_PAIRS = [
    ("中国电信", "中国联通"),
    ("中国电信", "10690955998"),
    ("华为云", "中国联通"),
]

SMS_SEND_CHANGES = [
    "os.providers.sms.conversations",
    "os.providers.sms.messagesByConversationId",
]


def _provider(input: Any, *, init: bool = False) -> dict:
    """Get SMS provider state from os.providers.sms."""
    src = input.os_init if init else input.os
    return (src.get("providers") or {}).get("sms") or {}


def _contacts_list(input: Any) -> list[dict[str, Any]]:
    """Extract contacts list from os.providers.contacts."""
    try:
        return (input.os.get("providers") or {}).get("contacts", {}).get("contacts") or []
    except Exception:
        return []


def sms_from_input(input: Any) -> "Sms":
    """Create Sms accessor with current + init provider state."""
    return Sms(
        _provider(input),
        init=_provider(input, init=True),
        contacts=_contacts_list(input),
    )


def sms_init_from_input(input: Any) -> "Sms":
    """Create Sms accessor from init provider state only."""
    return Sms(_provider(input, init=True))


class Sms(BaseApp):
    """
    SMS state accessor.

    Usage:
        sms = Sms(input.apps["sms"])
        sms.conversations
        sms.messages_by_conversation_id
    """

    def __init__(
        self,
        state: dict[str, Any],
        init: dict[str, Any] | None = None,
        contacts: list[dict[str, Any]] | None = None,
    ):
        super().__init__(state, init=init)
        self._contacts = contacts or []

    def _phone_numbers_for_contact(self, name: str) -> list[str]:
        """Look up phone numbers for a contact by display name."""
        target = norm(name)
        numbers: list[str] = []
        for contact in self._contacts:
            if target != norm(str(contact.get("displayName") or "")):
                continue
            for phone in contact.get("phones") or []:
                num = re.sub(r"[^\d+]", "", str(phone.get("number") or ""))
                if num:
                    numbers.append(num)
        return numbers

    def _contact_names_for_phone(self, phone: str) -> list[str]:
        """通过号码反查联系人名，只接受规范化后的等价号码匹配。"""
        target_variants = set(self._phone_variants(phone))
        if not target_variants:
            return []

        names: list[str] = []
        for contact in self._contacts:
            display = str(contact.get("displayName") or "")
            if not display:
                continue
            for ph in contact.get("phones") or []:
                contact_variants = set(self._phone_variants(str(ph.get("number") or "")))
                if target_variants & contact_variants:
                    names.append(display)
                    break
        return names

    @property
    def conversations(self) -> list[dict[str, Any]]:
        return self.get_list("conversations")

    @property
    def messages_by_conversation_id(self) -> dict[str, list[dict[str, Any]]]:
        return self.get("messagesByConversationId", {})

    @property
    def unread_conversation_count(self) -> int:
        return sum(1 for conversation in self.conversations if conversation["isUnread"])

    @property
    def all_conversations_read(self) -> bool:
        return self.unread_conversation_count == 0

    def latest_unread_sender(self) -> str:
        for conversation in self.conversations:
            if conversation.get("isUnread"):
                return str(conversation["sender"])
        raise ValueError("No unread conversations found")

    def conversation_by_sender(self, sender_name: str) -> dict[str, Any]:
        target = norm(sender_name)
        for conversation in self.conversations:
            if target == norm(conversation["sender"]):
                return conversation
        raise ValueError(f"Conversation for sender '{sender_name}' not found")

    def messages_for_sender(self, sender_name: str) -> list[dict[str, Any]]:
        conversation = self.conversation_by_sender(sender_name)
        conversation_id = str(conversation["id"])
        messages = self.messages_by_conversation_id[conversation_id]
        if not messages:
            raise ValueError(f"No messages found for sender '{sender_name}'")
        return messages

    def message_count_for(self, sender_name: str) -> int:
        return len(self.messages_for_sender(sender_name))

    def latest_message_from(self, sender_name: str) -> dict[str, Any]:
        return self.messages_for_sender(sender_name)[-1]

    def latest_incoming_message_from(self, sender_name: str) -> dict[str, Any]:
        messages = self.messages_for_sender(sender_name)
        for message in reversed(messages):
            if not message["isOutgoing"]:
                return message
        raise ValueError(f"No incoming message found for sender '{sender_name}'")

    def latest_incoming_content_from(self, sender_name: str) -> str:
        return str(self.latest_incoming_message_from(sender_name)["content"])

    @staticmethod
    def _generated_conversation_id(sender_name: str) -> str:
        return f"conv_{str(sender_name).encode('utf-8').hex()[:24]}"

    def ensure_conversation_with_sender(self, sender_name: str) -> dict[str, Any]:
        for conversation in self.conversations:
            if norm(str(conversation.get("sender") or "")) == norm(sender_name):
                return conversation

        conversation = {
            "id": self._generated_conversation_id(sender_name),
            "sender": str(sender_name),
            "timestamp": "",
            "avatarColor": "#3482FF",
            "avatarText": str(sender_name)[:1] or "#",
            "isUnread": False,
            "simSlot": 1,
            "messageCount": 0,
        }
        self.conversations.insert(0, conversation)
        self.messages_by_conversation_id[conversation["id"]] = []
        return conversation

    def prepare_state_with_incoming_message(
        self,
        sender_name: str,
        content: str,
        *,
        message_id: str,
        timestamp: str,
        is_unread: bool = True,
    ) -> dict[str, Any]:
        next_state = copy.deepcopy(self.raw)
        next_state.setdefault("conversations", copy.deepcopy(self.get_list("conversations")))
        next_state.setdefault(
            "messagesByConversationId",
            copy.deepcopy(self.get("messagesByConversationId", {})),
        )
        next_sms = Sms(next_state)
        conversation = next_sms.ensure_conversation_with_sender(sender_name)
        conversation_id = str(conversation["id"])
        messages = list(next_sms.messages_by_conversation_id.get(conversation_id) or [])
        messages.append(
            {
                "id": message_id,
                "content": str(content),
                "timestamp": str(timestamp),
                "isOutgoing": False,
            }
        )
        next_sms.messages_by_conversation_id[conversation_id] = messages
        conversation["timestamp"] = str(timestamp)
        conversation["isUnread"] = bool(is_unread)
        conversation["messageCount"] = len(messages)
        next_sms.raw["conversations"] = [
            conversation,
            *[
                item
                for item in next_sms.conversations
                if str(item.get("id") or "") != conversation_id
            ],
        ]
        return next_state

    def sender_with_most_messages(self) -> str:
        pairs = [
            (conversation["sender"], self.message_count_for(conversation["sender"]))
            for conversation in self.conversations
        ]
        best_sender, best_count = max(pairs, key=lambda item: item[1])
        if sum(1 for _, count in pairs if count == best_count) > 1:
            raise ValueError("Multiple senders are tied for most messages")
        return str(best_sender)

    def sender_with_more_messages(self, sender1: str, sender2: str) -> str:
        count1 = self.message_count_for(sender1)
        count2 = self.message_count_for(sender2)
        if count1 == count2:
            raise ValueError(f"Message counts are tied for '{sender1}' and '{sender2}'")
        return sender1 if count1 > count2 else sender2

    @staticmethod
    def sample_compare_pair(_env_state: dict[str, Any], rng: Any) -> dict[str, str]:
        sender1, sender2 = rng.choice(SMS_COMPARE_MESSAGE_COUNT_PAIRS)
        return {"sender1": sender1, "sender2": sender2}

    def new_outgoing_messages_to(self, sender_name: str) -> list[dict[str, Any]]:
        if not self.has_init:
            raise ValueError("Init state is required to diff new outgoing messages")

        current_ids = self.find_conversation_ids(sender_name)
        if not current_ids:
            return []

        initial_map = self.init.messages_by_conversation_id
        messages: list[dict[str, Any]] = []
        for conversation_id in current_ids:
            current_messages = self.messages_by_conversation_id[conversation_id]
            initial_ids = {
                str(message["id"])
                for message in initial_map.get(conversation_id, [])
            }
            messages.extend(
                message
                for message in current_messages
                if message["isOutgoing"] and str(message["id"]) not in initial_ids
            )
        return messages

    def latest_message_to(self, sender_name: str) -> dict[str, Any] | None:
        target = norm(sender_name)
        best = None
        for conversation in self.conversations:
            if target and target not in norm(conversation.get("sender")):
                continue
            conversation_id = str(conversation.get("id") or "")
            messages = self.messages_by_conversation_id.get(conversation_id) or []
            if not messages:
                continue
            last = messages[-1]
            if best is None:
                best = last
                continue
            if (last.get("timestamp") or 0) >= (best.get("timestamp") or 0):
                best = last
        return best

    def find_conversation_ids(self, sender_name: str) -> list[str]:
        target = norm(sender_name)
        ids: list[str] = []
        for conversation in self.conversations:
            if target and target not in norm(conversation.get("sender")):
                continue
            conversation_id = str(conversation.get("id") or "")
            if conversation_id:
                ids.append(conversation_id)
        if ids:
            return ids

        # Fallback 1: match via conversation.phoneNumber field (set by contact selection flow)
        phones = self._phone_numbers_for_contact(sender_name)
        if phones:
            for conversation in self.conversations:
                conv_phone = re.sub(r"[^\d+]", "", str(conversation.get("phoneNumber") or ""))
                if not conv_phone:
                    continue
                for phone in phones:
                    if conv_phone == phone or conv_phone.endswith(phone) or phone.endswith(conv_phone):
                        conversation_id = str(conversation.get("id") or "")
                        if conversation_id:
                            ids.append(conversation_id)
                        break
            if ids:
                return ids

        # Fallback 2: resolve contact name to phone numbers and match against sender
        if not phones:
            phones = []
        for conversation in self.conversations:
            sender = re.sub(r"[^\d+]", "", str(conversation.get("sender") or ""))
            if not sender:
                continue
            for phone in phones:
                if sender == phone or sender.endswith(phone) or phone.endswith(sender):
                    conversation_id = str(conversation.get("id") or "")
                    if conversation_id:
                        ids.append(conversation_id)
                    break
        if ids:
            return ids

        # Fallback 3: 任务参数给的是手机号，但实际通过联系人选择后，会话 sender 是联系人名。
        for contact_name in self._contact_names_for_phone(sender_name):
            contact_target = norm(contact_name)
            for conversation in self.conversations:
                if contact_target and contact_target not in norm(conversation.get("sender")):
                    continue
                conversation_id = str(conversation.get("id") or "")
                if conversation_id and conversation_id not in ids:
                    ids.append(conversation_id)
        return ids

    def new_outgoing_message(
        self, sender_name: str, expected_message: str
    ) -> dict[str, Any] | None:
        expected = str(expected_message or "")

        def _sms_norm(value: str) -> str:
            return re.sub(r"[\s\.\,\!\?，。！？；;：:]", "", value or "")

        current_map = self.messages_by_conversation_id or {}
        try:
            initial_map = self.init.messages_by_conversation_id or {}
        except Exception:
            initial_map = {}

        for conversation_id in self.find_conversation_ids(sender_name):
            current_messages = current_map.get(conversation_id) or []
            initial_messages = initial_map.get(conversation_id) or []
            initial_ids = {
                str((message or {}).get("id") or "")
                for message in initial_messages
                if isinstance(message, dict)
            }
            for message in current_messages:
                if not isinstance(message, dict):
                    continue
                message_id = str(message.get("id") or "")
                if message_id and message_id in initial_ids:
                    continue
                if not bool(message.get("isOutgoing")):
                    continue
                content = str(message.get("content") or "")
                if expected in content or _sms_norm(expected) == _sms_norm(content):
                    return message
        return None

    def check_new_sent_to(
        self, sender_name: str, *keywords: str, field: str | None = None
    ) -> dict[str, Any]:
        if field is None:
            field = f"sent_to_{sender_name}"

        messages = self.new_outgoing_messages_to(sender_name)
        matched = next(
            (
                message
                for message in messages
                if all(keyword in str(message["content"]) for keyword in keywords)
            ),
            None,
        )
        actual = str(matched["content"]) if matched else None
        return {
            "field": field,
            "expected": f"new message to '{sender_name}' containing {list(keywords)}",
            "actual": actual,
            "passed": matched is not None,
        }

    def check_new_sent_any_of(
        self,
        sender_name: str,
        labels: list[str],
        *extra_keywords: str,
        field: str | None = None,
    ) -> dict[str, Any]:
        if field is None:
            field = f"sent_to_{sender_name}"

        messages = self.new_outgoing_messages_to(sender_name)
        matched = next(
            (
                message
                for message in messages
                if any(label and label in str(message.get("content") or "") for label in labels)
                and all(keyword in str(message.get("content") or "") for keyword in extra_keywords)
            ),
            None,
        )
        actual = str(matched.get("content") or "") if matched else None
        return {
            "field": field,
            "expected": {
                "recipient": sender_name,
                "any_of": labels,
                "keywords": list(extra_keywords),
            },
            "actual": actual,
            "passed": matched is not None,
        }

    def check_new_sent_contains_number(
        self,
        sender_name: str,
        expected: float,
        *extra_keywords: str,
        field: str | None = None,
    ) -> dict[str, Any]:
        if field is None:
            field = f"sent_to_{sender_name}_number"

        messages = self.new_outgoing_messages_to(sender_name)
        matched = next(
            (
                message
                for message in messages
                if match_value(expected, str(message.get("content") or ""))
                and all(keyword in str(message.get("content") or "") for keyword in extra_keywords)
            ),
            None,
        )
        actual = str(matched.get("content") or "") if matched else None
        return {
            "field": field,
            "expected": {
                "recipient": sender_name,
                "number": expected,
                "keywords": list(extra_keywords),
            },
            "actual": actual,
            "passed": matched is not None,
        }

    @staticmethod
    def _normalize_phone_for_match(value: str) -> str:
        return "".join(ch for ch in str(value or "") if ch.isdigit())

    @staticmethod
    def _phone_variants(phone: str) -> list[str]:
        """生成电话号码的国内/国际两种纯数字形式，用于宽松匹配。

        固话（国内带前导 0，国际不带）：
          国内 010 8854 4114    → 01088544114  (11 位，0 开头)
          国际 +86 10 8854 4114 → 861088544114 (12 位，86+10 位)
        手机（国内不带 0，国际加 86）：
          国内 138 0000 0000    → 13800000000  (11 位，1 开头)
          国际 +86 138 0000 0000 → 8613800000000 (13 位，86+11 位)

        过短的数字串（< 7 位）不产生任何变体，避免 substring 匹配误过。
        """
        digits = "".join(ch for ch in str(phone or "") if ch.isdigit())
        if len(digits) < 7:
            return []
        variants: set[str] = {digits}
        if digits.startswith("86"):
            rest = digits[2:]
            if len(rest) == 10:           # 国际固话 → 国内补 "0"
                variants.add("0" + rest)
            elif len(rest) == 11 and rest[0] == "1":  # 国际手机 → 国内直接去掉 86
                variants.add(rest)
        elif len(digits) == 11:
            if digits[0] == "0":          # 国内固话 → 国际去 "0" 加 "86"
                variants.add("86" + digits[1:])
            elif digits[0] == "1":        # 国内手机 → 国际加 "86"
                variants.add("86" + digits)
        return list(variants)

    def check_new_sent_contains_phone(
        self,
        sender_name: str,
        phone: str,
        *,
        field: str | None = None,
    ) -> dict[str, Any]:
        if field is None:
            field = f"sent_phone_to_{sender_name}"

        variants = self._phone_variants(phone)
        messages = self.new_outgoing_messages_to(sender_name)
        matched = next(
            (
                message
                for message in messages
                if variants
                and any(
                    v in self._normalize_phone_for_match(str(message.get("content") or ""))
                    for v in variants
                )
            ),
            None,
        )
        actual = str(matched.get("content") or "") if matched else None
        return {
            "field": field,
            "expected": f"new message to '{sender_name}' containing phone {phone}",
            "actual": actual,
            "passed": matched is not None,
        }

    def check_no_new_sent_to(
        self, sender_name: str, *, field: str | None = None
    ) -> dict[str, Any]:
        if field is None:
            field = f"no_new_sent_to_{sender_name}"
        messages = self.new_outgoing_messages_to(sender_name)
        return {
            "field": field,
            "expected": f"no new message to '{sender_name}'",
            "actual": [str(message.get("content") or "") for message in messages],
            "passed": len(messages) == 0,
        }

    def check_all_read(self, field: str = "all_read") -> dict[str, Any]:
        return {
            "field": field,
            "expected": True,
            "actual": self.all_conversations_read,
            "passed": self.all_conversations_read,
        }

    def senders_with_keyword(self, keyword: str) -> list[str]:
        """返回所有收到过含 keyword 消息的会话 sender 名称列表。"""
        init_map = self.init.messages_by_conversation_id if self.has_init else {}
        curr_map = self.messages_by_conversation_id
        senders: list[str] = []
        for conv in self.conversations:
            cid = str(conv["id"])
            all_msgs = list(init_map.get(cid) or []) + list(curr_map.get(cid) or [])
            has_kw = any(
                not m.get("isOutgoing") and keyword in str(m.get("content") or "")
                for m in all_msgs
                if isinstance(m, dict)
            )
            if has_kw:
                senders.append(str(conv["sender"]))
        return senders

    def check_replied_to_all(
        self,
        senders: list[str],
        reply: str,
        *,
        field: str = "replied_to_all",
    ) -> dict[str, Any]:
        """验证是否给所有指定 sender 都发了包含 reply 的新消息。"""
        sent_count = sum(
            1 for sender in senders
            if self.new_outgoing_messages_to(sender)
            and any(reply in str(m["content"]) for m in self.new_outgoing_messages_to(sender))
        )
        return {
            "field": field,
            "expected": f"reply '{reply}' to all {len(senders)} senders",
            "actual": f"{sent_count}/{len(senders)}",
            "passed": sent_count == len(senders) and len(senders) > 0,
        }

    def check_conversation_deleted(self, sender_name: str, field: str = "deleted") -> dict[str, Any]:
        target = norm(sender_name)
        still_exists = any(target == norm(c["sender"]) for c in self.conversations)
        return {
            "field": field,
            "expected": f"conversation '{sender_name}' deleted",
            "actual": f"conversation '{sender_name}' still exists" if still_exists else f"conversation '{sender_name}' deleted",
            "passed": not still_exists,
        }

    def check_new_outgoing_contains_meeting_id(
        self,
        recipient_display: str,
        meeting_id: str,
        *,
        field: str | None = None,
    ) -> dict[str, Any]:
        """最新一条新发往外短信正文中含规范化会议号（忽略空格，兼容 digit 间空白 pattern）。"""
        if field is None:
            field = f"sms_meeting_{recipient_display}"
        mid = re.sub(r"\s+", "", str(meeting_id))
        msgs = self.new_outgoing_messages_to(recipient_display)
        text = str(msgs[-1]["content"]) if msgs else ""
        if not mid:
            return {
                "field": field,
                "expected": f"短信含会议号",
                "actual": text[:200] or "(none)",
                "passed": False,
            }
        pat = TencentMeeting.meeting_id_pattern(mid)
        passed = bool(msgs) and bool(pat.search(text))
        return {
            "field": field,
            "expected": f"短信含会议号 {mid}",
            "actual": text[:200] or "(none)",
            "passed": passed,
        }

    def check_new_outgoing_contains_meeting_id_and_password(
        self,
        recipient_display: str,
        meeting_id: str,
        password: str,
        *,
        field: str | None = None,
    ) -> dict[str, Any]:
        """最新一条新发往外短信正文中含会议号（忽略空格）和密码。"""
        if field is None:
            field = f"sms_meeting_share_{recipient_display}"
        mid = re.sub(r"\s+", "", str(meeting_id))
        msgs = self.new_outgoing_messages_to(recipient_display)
        text = str(msgs[-1]["content"]) if msgs else ""
        if not mid:
            passed = False
        else:
            passed = (
                bool(msgs)
                and bool(TencentMeeting.meeting_id_pattern(mid).search(text))
                and str(password) in text
            )
        return {
            "field": field,
            "expected": f"短信含会议号 {mid} 和密码 {password}",
            "actual": text[:200] or "(none)",
            "passed": passed,
        }
