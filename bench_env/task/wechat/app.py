"""
WeChat state accessor.

Provides convenient access to WeChat app state with comparison utilities.
"""

from __future__ import annotations

import copy
import re
from typing import Any

from bench_env.task.base import BaseApp
from bench_env.task.common_tasks import match_duration, match_time
from bench_env.task.tencent_meeting.app import TencentMeeting
from bench_env.task.utils import city_aliases, extract_numbers, norm

WECHAT_CONTACT_PARAM = {
    "type": "string",
    "default": "陈静",
    "source": "apps.wechat.contacts[name]",
    "description": "目标联系人",
}

WECHAT_SEND_CHANGES = ["wechat.chats"]
WECHAT_MOMENT_CHANGES = ["wechat.moments"]


class Wechat(BaseApp):
    """
    WeChat state accessor.
    
    Usage:
        wechat = Wechat(input.apps["wechat"])
        wechat.user_name
        wechat.contacts
        
        # With init state for comparison
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        wechat.init.user_name
    """
    
    # =========================================================================
    # User properties
    # =========================================================================
    
    @property
    def user(self) -> dict[str, Any]:
        """Current user object."""
        return self.get("user")
    
    @property
    def user_id(self) -> str:
        return str(self.user["wxid"])
    
    @property
    def user_name(self) -> str:
        return str(self.user["name"])
    
    @property
    def user_avatar(self) -> str:
        return str(self.user["avatar"])
    
    # =========================================================================
    # Settings shortcuts
    # =========================================================================
    
    @property
    def settings(self) -> dict[str, Any]:
        """User settings."""
        return self.get("settings")

    @property
    def subscriptions(self) -> list[dict[str, Any]]:
        return self.get_list("subscriptions")

    @property
    def authorized_apps(self) -> list[dict[str, Any]]:
        return self.get_list("authorizedApps")

    @property
    def auth(self) -> dict[str, Any]:
        return self.get("auth")

    @property
    def session(self) -> dict[str, Any]:
        return self.auth["session"]

    @property
    def accounts(self) -> list[dict[str, Any]]:
        return self.auth["accounts"]

    @property
    def login_attempts(self) -> list[dict[str, Any]]:
        return self.auth["loginAttempts"]

    @property
    def verification_attempts(self) -> list[dict[str, Any]]:
        return self.auth["verificationAttempts"]

    @property
    def verification_codes(self) -> list[dict[str, Any]]:
        return self.auth["verificationCodes"]
    
    @property
    def privacy_settings(self) -> dict[str, Any]:
        return self.settings["privacy"]
    
    @property
    def general_settings(self) -> dict[str, Any]:
        return self.settings["general"]
    
    # =========================================================================
    # Data lists
    # =========================================================================
    
    @property
    def contacts(self) -> list[dict]:
        """Contact list."""
        return self.get_list("contacts")
    
    @property
    def moments(self) -> list[dict]:
        """Moments list."""
        return self.get_list("moments")
    
    @property
    def chats(self) -> list[dict]:
        """Chat list."""
        return self.get_list("chats")
    
    # =========================================================================
    # Helper methods
    # =========================================================================
    
    @staticmethod
    def _norm_name(s: str) -> str:
        """
        Normalize display names / aliases for fuzzy matching.
        Example: "blank." -> "blank"
        """
        s = (s or "").strip().lower()
        return re.sub(r"[\s\.\-_\u3002]+", "", s)

    def find_contact(self, name: str) -> dict | None:
        """Find contact by name."""
        for contact in self.contacts:
            if contact.get("name") == name:
                return contact
        return None

    def find_contact_wxid(self, name_or_alias: str) -> str:
        """
        Find contact wxid by fuzzy name/alias match.

        Returns empty string if not found.
        """
        target = self._norm_name(name_or_alias)
        if not target:
            return ""
        for c in self.contacts:
            if not isinstance(c, dict):
                continue
            name = self._norm_name(str(c.get("name") or ""))
            alias = self._norm_name(str(c.get("alias") or ""))
            if name == target or alias == target or name.startswith(target) or alias.startswith(target):
                return str(c.get("wxid") or "")
        return ""

    def require_contact_wxid(self, name_or_alias: str) -> str:
        """按名称或别名查找联系人 wxid，找不到则抛错。"""
        wxid = self.find_contact_wxid(name_or_alias)
        if not wxid:
            raise ValueError(f"任务设计错误：联系人 '{name_or_alias}' 不存在。")
        return wxid

    def contact_by_wxid(self, wxid: str) -> dict[str, Any]:
        """按 wxid 获取联系人。"""
        for contact in self.contacts:
            if str(contact["wxid"]) == str(wxid):
                return contact
        raise ValueError(f"任务设计错误：联系人 wxid '{wxid}' 不存在。")

    def contact_by_name(self, name_or_alias: str) -> dict[str, Any]:
        """按名称或别名获取联系人。"""
        return self.contact_by_wxid(self.require_contact_wxid(name_or_alias))
    
    def find_chat(self, name: str) -> dict | None:
        """Find chat by contact name."""
        for chat in self.chats:
            if chat.get("name") == name or chat.get("contactName") == name:
                return chat
        return None

    def find_subscription_by_keywords(self, *keywords: str) -> dict[str, Any] | None:
        for item in self.subscriptions:
            text = str(item["membershipType"])
            if all(keyword in text for keyword in keywords):
                return item
        return None

    def new_subscription_by_membership_type(self, membership_type: str) -> dict[str, Any] | None:
        target = str(membership_type).strip()
        init_ids: set[str] = set()
        if self.has_init:
            init_ids = {
                str(item.get("id") or "")
                for item in self.init.subscriptions
                if str(item.get("id") or "")
            }
        for item in self.subscriptions:
            if str(item.get("membershipType") or "").strip() != target:
                continue
            if str(item.get("id") or "") in init_ids:
                continue
            return item
        return None

    def find_authorized_app_by_name(self, name: str) -> dict[str, Any] | None:
        target = str(name).strip()
        for item in self.authorized_apps:
            if str(item["name"]).strip() == target:
                return item
        return None

    def account_by_phone(self, phone: str) -> dict[str, Any] | None:
        target = str(phone)
        for account in self.accounts:
            if str(account["phone"]) == target:
                return account
        return None

    def verification_codes_for_phone(self, phone: str) -> list[dict[str, Any]]:
        target = str(phone)
        return [item for item in self.verification_codes if str(item["phone"]) == target]

    def verification_attempts_for_phone(self, phone: str) -> list[dict[str, Any]]:
        target = str(phone)
        return [item for item in self.verification_attempts if str(item["phone"]) == target]

    def trusted_devices(self, phone: str) -> list[dict[str, Any]]:
        return self.auth["trustedDevicesByPhone"][str(phone)]

    def last_sent_text_to(self, target_wxid: str) -> str:
        """
        Get the last text message content sent by current user to target.

        Returns empty string if not found.
        """
        if not target_wxid:
            return ""
        me = str((self.user or {}).get("wxid") or "")
        for chat in self.chats:
            if not isinstance(chat, dict):
                continue
            if str(chat.get("id") or "") != target_wxid:
                continue
            messages = chat.get("messages") or []
            for m in reversed(messages):
                if not isinstance(m, dict):
                    continue
                if m.get("type") != "text":
                    continue
                if str(m.get("senderId") or "") != me:
                    continue
                return str(m.get("content") or "").strip()
        return ""

    def has_sent_text_to(self, target_wxid: str, expected: str, *, allow_contains: bool = True) -> bool:
        """
        Check whether current user has sent a text message to target.

        By default, allows substring match to be tolerant to templates like "城市：北京".
        """
        expected = str(expected or "").strip()
        if not target_wxid or not expected:
            return False
        last = self.last_sent_text_to(target_wxid)
        return last == expected or (allow_contains and expected in last)
    
    def latest_moment(self) -> dict | None:
        """Get the latest (first) moment."""
        return self.moments[0] if self.moments else None
    
    def moment_has_content(self, content: str) -> bool:
        """Check if any moment has the given content."""
        return any(m.get("content") == content for m in self.moments)

    # =========================================================================
    # Unified lookup
    # =========================================================================

    def get_chat_with(self, contact_name: str) -> dict | None:
        """通过联系人名查找聊天（含多级 fallback）。"""
        wxid = self.find_contact_wxid(contact_name)
        if wxid:
            for c in self.chats:
                if c.get("id") == wxid:
                    return c
        chat = self.find_chat(contact_name)
        if chat:
            return chat
        for c in self.chats:
            if c.get("user", {}).get("name") == contact_name:
                return c
        return None

    def find_chat_wxid_by_chat_name(self, chat_name: str) -> str:
        target = str(chat_name or "").strip()
        if not target:
            return ""
        for chat in self.get_list("chats"):
            user = chat.get("user") or {}
            if str(user.get("name") or "").strip() == target:
                return str(user.get("wxid") or "")
        for chat in self.get_list("chats"):
            user = chat.get("user") or {}
            if target in str(user.get("name") or ""):
                return str(user.get("wxid") or "")
        return ""

    def last_sent_text_by_name(self, contact_name: str) -> str:
        wxid = self.find_contact_wxid(contact_name)
        return self.last_sent_text_to(wxid) if wxid else ""

    def has_sent_text_contains(self, contact_name: str, expected_substring: str) -> bool:
        wxid = self.find_contact_wxid(contact_name)
        return self.has_sent_text_to(wxid, expected_substring, allow_contains=True) if wxid else False

    def last_sent_text_by_chat_name(self, chat_name: str) -> str:
        wxid = self.find_chat_wxid_by_chat_name(chat_name)
        return self.last_sent_text_to(wxid) if wxid else ""

    def has_sent_text_contains_by_chat_name(
        self, chat_name: str, expected_substring: str
    ) -> bool:
        wxid = self.find_chat_wxid_by_chat_name(chat_name)
        return self.has_sent_text_to(wxid, expected_substring, allow_contains=True) if wxid else False

    def chat_by_wxid(self, wxid: str) -> dict | None:
        if not wxid:
            return None
        for chat in self.chats:
            if str((chat or {}).get("id") or "") == str(wxid):
                return chat
        return None

    def prepare_state_with_contact(
        self,
        *,
        name: str,
        alias: str | None = None,
        wxid: str | None = None,
        avatar: str = "",
    ) -> dict[str, Any]:
        """返回注入一条新联系人后的 app state。同名联系人已存在时原样返回。

        场景：任务需要给某个不在默认联系人列表里的人（如"林若溪"、"母亲"）发消息时，
        在 `_prepare()` 中调用以保证 `find_contact_wxid(name)` 可命中。
        """
        existing = self.find_contact_wxid(name)
        if existing:
            return copy.deepcopy(self.raw)
        next_state = copy.deepcopy(self.raw)
        contact_wxid = str(wxid or f"wxid_{self._norm_name(name) or 'contact'}").strip()
        # 避免和现有 wxid 冲突
        used = {str(c.get("wxid") or "") for c in next_state.get("contacts") or []}
        base_wxid = contact_wxid
        suffix = 1
        while contact_wxid in used:
            contact_wxid = f"{base_wxid}_{suffix}"
            suffix += 1
        new_contact: dict[str, Any] = {
            "wxid": contact_wxid,
            "name": str(name),
            "alias": str(alias) if alias else "",
            "avatar": str(avatar),
            "isStarred": False,
            "isBlacklisted": False,
            "isMuted": False,
        }
        contacts = list(next_state.get("contacts") or [])
        contacts.append(new_contact)
        next_state["contacts"] = contacts
        return next_state

    def ensure_chat_with_contact(self, contact_name: str) -> dict[str, Any]:
        wxid = self.require_contact_wxid(contact_name)
        chat = self.chat_by_wxid(wxid)
        if chat is not None:
            return chat
        contact = self.contact_by_wxid(wxid)
        chat = {
            "id": wxid,
            "user": {
                "wxid": wxid,
                "name": str(contact["name"]),
                "avatar": str(contact.get("avatar") or ""),
            },
            "isMuted": False,
            "isSticky": False,
            "isAlert": False,
            "messages": [],
        }
        self.chats.insert(0, chat)
        return chat

    def prepare_state_with_incoming_text(
        self,
        contact_name: str,
        content: str,
        *,
        message_id: str,
        timestamp: int,
    ) -> dict[str, Any]:
        next_state = copy.deepcopy(self.raw)
        next_wechat = Wechat(next_state)
        chat = next_wechat.ensure_chat_with_contact(contact_name)
        sender_id = str((chat.get("user") or {}).get("wxid") or chat.get("id") or "")
        chat["messages"] = list(chat.get("messages") or [])
        chat["messages"].append(
            {
                "id": message_id,
                "type": "text",
                "content": content,
                "senderId": sender_id,
                "timestamp": int(timestamp),
            }
        )
        return next_state

    def received_texts_from(self, contact_name: str) -> list[str]:
        """获取联系人发来的所有文本消息。"""
        wxid = self.require_contact_wxid(contact_name)
        chat = self.chat_by_wxid(wxid)
        if chat is None:
            raise ValueError(f"任务设计错误：联系人 '{contact_name}' 没有聊天记录。")
        texts: list[str] = []
        for message in chat["messages"]:
            if str(message["senderId"]) != wxid:
                continue
            if str(message["type"]) != "text":
                continue
            texts.append(str(message["content"]).strip())
        if not texts:
            raise ValueError(f"任务设计错误：联系人 '{contact_name}' 没有文本消息。")
        return texts

    def last_received_text_from(self, contact_name: str) -> str:
        """获取联系人最近发来的一条文本消息。"""
        return self.received_texts_from(contact_name)[-1]

    def last_received_text_with_amount_from(self, contact_name: str) -> str:
        """从新到旧查找对方发来、且能解析出至少一个金额的最后一则文本（用于转账请求后对方又发感谢语等）。"""
        for text in reversed(self.received_texts_from(contact_name)):
            if extract_numbers(text):
                return text
        raise ValueError(
            f"联系人 {contact_name!r} 的来信中没有可解析的金额（请确认对方发过含数字金额的消息）。"
        )

    def contact_steps(self, contact_name: str) -> int:
        """获取联系人的微信运动步数。"""
        contact = self.contact_by_name(contact_name)
        return int(contact["steps"])

    def top_stepper(self) -> tuple[str, int]:
        """返回联系人里步数最高的人名和步数。"""
        top_contact = max(self.contacts, key=lambda contact: int(contact["steps"]))
        return str(top_contact["name"]), int(top_contact["steps"])

    @staticmethod
    def _friend_names(env_state: dict[str, Any]) -> list[str]:
        """返回所有非自己的联系人名称列表。"""
        wechat = env_state.get("apps", {}).get("wechat", {})
        user_wxid = (wechat.get("user") or {}).get("wxid", "")
        return [
            c["name"] for c in wechat.get("contacts", [])
            if isinstance(c, dict) and c.get("wxid") != user_wxid and c.get("name")
        ]

    @staticmethod
    def sample_friend_name(env_state: dict[str, Any], rng: Any) -> str | None:
        """从联系人列表随机采样一个非自己的联系人名称。"""
        names = Wechat._friend_names(env_state)
        return rng.choice(names) if names else None

    @staticmethod
    def sample_two_friend_names(env_state: dict[str, Any], rng: Any) -> dict[str, str] | None:
        """采样两个不同的非自己联系人名称。"""
        names = Wechat._friend_names(env_state)
        if len(names) < 2:
            return None
        picked = rng.sample(names, 2)
        return {"target": picked[0], "notify_to": picked[1]}

    @staticmethod
    def sample_diff_steps_pair(env_state: dict[str, Any], rng: Any) -> dict[str, str] | None:
        """采样两个步数不同的非自己联系人。"""
        wechat_state = env_state.get("apps", {}).get("wechat", {})
        user_wxid = (wechat_state.get("user") or {}).get("wxid", "")
        contacts = [
            c for c in wechat_state.get("contacts", [])
            if isinstance(c, dict) and c.get("wxid") != user_wxid
            and c.get("name") and "steps" in c
        ]
        rng.shuffle(contacts)
        for i, c1 in enumerate(contacts):
            for c2 in contacts[i + 1:]:
                if int(c1["steps"]) != int(c2["steps"]):
                    return {"contact1": c1["name"], "contact2": c2["name"]}
        return None

    def authorized_app_id(self, app_name: str) -> str:
        """根据授权应用名称获取 app id。"""
        for app in self.get_list("authorizedApps"):
            if str(app["name"]) == app_name:
                return str(app["id"])
        raise ValueError(f"任务设计错误：授权应用 '{app_name}' 不存在。")

    def new_sent_texts_to(self, contact_name: str) -> list[str]:
        """获取本次任务中新发给联系人的所有文本消息。"""
        wxid = self.require_contact_wxid(contact_name)
        me = str(self.user["wxid"])
        current_chat = self.chat_by_wxid(wxid)
        if current_chat is None:
            return []
        initial_ids: set[str] = set()
        if self.has_init:
            initial_chat = self.init.chat_by_wxid(wxid)
            if initial_chat is not None:
                for message in initial_chat["messages"]:
                    message_id = str(message["id"])
                    if message_id:
                        initial_ids.add(message_id)
        texts: list[str] = []
        for message in current_chat["messages"]:
            message_id = str(message["id"])
            if message_id and message_id in initial_ids:
                continue
            if str(message["senderId"]) != me:
                continue
            if str(message["type"]) != "text":
                continue
            texts.append(str(message["content"]).strip())
        return texts

    def new_sent_image_paths_to(self, contact_name: str) -> list[str]:
        """获取本次任务中新发给联系人的所有图片路径。"""
        wxid = self.require_contact_wxid(contact_name)
        me = str(self.user["wxid"])
        current_chat = self.chat_by_wxid(wxid)
        if current_chat is None:
            return []
        initial_ids: set[str] = set()
        if self.has_init:
            initial_chat = self.init.chat_by_wxid(wxid)
            if initial_chat is not None:
                for message in initial_chat["messages"]:
                    message_id = str(message["id"])
                    if message_id:
                        initial_ids.add(message_id)
        paths: list[str] = []
        for message in current_chat["messages"]:
            message_id = str(message["id"])
            if message_id and message_id in initial_ids:
                continue
            if str(message["senderId"]) != me:
                continue
            if str(message["type"]) != "image":
                continue
            paths.append(str(message["content"]).strip())
        return paths

    def new_moments_by_me(self) -> list[dict[str, Any]]:
        """获取本次任务中新发的自己的朋友圈。"""
        my_wxid = str(self.user["wxid"])
        initial_ids: set[str] = set()
        if self.has_init:
            for moment in self.init.moments:
                if str(moment["wxid"]) == my_wxid:
                    initial_ids.add(str(moment["id"]))
        moments: list[dict[str, Any]] = []
        for moment in self.moments:
            if str(moment["wxid"]) != my_wxid:
                continue
            if str(moment["id"]) in initial_ids:
                continue
            moments.append(moment)
        return moments

    def _latest_new_moment_content(self) -> str:
        moments = self.new_moments_by_me()
        return str(moments[0]["content"]).strip() if moments else ""

    def has_new_sent_text_contains(
        self, contact_name: str, expected_substring: str
    ) -> tuple[bool, str]:
        wxid = self.find_contact_wxid(contact_name)
        if not wxid:
            raise ValueError(f"任务设计错误：联系人 '{contact_name}' 不存在。")
        me = str((self.user or {}).get("wxid") or "")
        current_chat = self.chat_by_wxid(wxid) or {}
        current_messages = (
            current_chat.get("messages") or [] if isinstance(current_chat, dict) else []
        )
        initial_ids: set[str] = set()
        if self.has_init:
            initial_chat = self.init.chat_by_wxid(wxid) or {}
            initial_messages = (
                initial_chat.get("messages") or []
                if isinstance(initial_chat, dict)
                else []
            )
            for message in initial_messages:
                if isinstance(message, dict):
                    message_id = str(message.get("id") or "")
                    if message_id:
                        initial_ids.add(message_id)
        for message in reversed(current_messages):
            if not isinstance(message, dict):
                continue
            message_id = str(message.get("id") or "")
            if message_id and message_id in initial_ids:
                continue
            if str(message.get("senderId") or "") != me:
                continue
            if str(message.get("type") or "") != "text":
                continue
            content = str(message.get("content") or "").strip()
            if expected_substring and expected_substring in content:
                return True, content
        return False, self.last_sent_text_to(wxid)

    def last_new_sent_text_contains(
        self, contact_name: str, expected_substring: str
    ) -> tuple[bool, str]:
        wxid = self.find_contact_wxid(contact_name)
        if not wxid:
            raise ValueError(f"任务设计错误：联系人 '{contact_name}' 不存在。")
        me = str((self.user or {}).get("wxid") or "")
        current_chat = self.chat_by_wxid(wxid) or {}
        current_messages = (
            current_chat.get("messages") or [] if isinstance(current_chat, dict) else []
        )
        initial_ids: set[str] = set()
        if self.has_init:
            initial_chat = self.init.chat_by_wxid(wxid) or {}
            initial_messages = (
                initial_chat.get("messages") or []
                if isinstance(initial_chat, dict)
                else []
            )
            for message in initial_messages:
                if isinstance(message, dict):
                    message_id = str(message.get("id") or "")
                    if message_id:
                        initial_ids.add(message_id)
        last_message = None
        for message in reversed(current_messages):
            if not isinstance(message, dict):
                continue
            if str(message.get("senderId") or "") != me:
                continue
            if str(message.get("type") or "") != "text":
                continue
            last_message = message
            break
        if not isinstance(last_message, dict):
            return False, self.last_sent_text_to(wxid)
        message_id = str(last_message.get("id") or "")
        content = str(last_message.get("content") or "").strip()
        if message_id and message_id in initial_ids:
            return False, content
        return (expected_substring != "" and expected_substring in content), content

    def last_n_new_sent_texts(self, contact_name: str, n: int) -> list[str]:
        wxid = self.find_contact_wxid(contact_name)
        if not wxid:
            raise ValueError(f"任务设计错误：联系人 '{contact_name}' 不存在。")
        me = str((self.user or {}).get("wxid") or "")
        if int(n) <= 0:
            return []
        current_chat = self.chat_by_wxid(wxid) or {}
        current_messages = (
            current_chat.get("messages") or [] if isinstance(current_chat, dict) else []
        )
        initial_ids: set[str] = set()
        if self.has_init:
            initial_chat = self.init.chat_by_wxid(wxid) or {}
            initial_messages = (
                initial_chat.get("messages") or []
                if isinstance(initial_chat, dict)
                else []
            )
            for message in initial_messages:
                if isinstance(message, dict):
                    message_id = str(message.get("id") or "")
                    if message_id:
                        initial_ids.add(message_id)
        picked: list[str] = []
        for message in reversed(current_messages):
            if not isinstance(message, dict):
                continue
            message_id = str(message.get("id") or "")
            if message_id and message_id in initial_ids:
                continue
            if str(message.get("senderId") or "") != me:
                continue
            if str(message.get("type") or "") != "text":
                continue
            picked.append(str(message.get("content") or "").strip())
            if len(picked) >= int(n):
                break
        picked.reverse()
        return picked

    # =========================================================================
    # Check methods — return standard list[dict] for check_goals
    # =========================================================================

    def check_message_to(
        self, contact_name: str, predicate, *, field: str = "message"
    ) -> list[dict]:
        """检查是否给联系人发了满足条件的消息。

        Args:
            contact_name: 联系人名称
            predicate: ``(message_content: str) -> bool``
            field: check result 中的 field 名
        """
        chat = self.get_chat_with(contact_name)
        if not chat:
            return [{"field": field, "expected": f"chat with '{contact_name}'",
                     "actual": "not found", "passed": False}]
        my_wxid = self.user.get("wxid")
        for m in reversed(chat.get("messages", [])):
            if m.get("senderId") == my_wxid:
                content = m.get("content", "")
                if predicate(content):
                    return [{"field": field, "expected": "message matching predicate",
                             "actual": content[:80], "passed": True}]
        return [{"field": field, "expected": "message matching predicate",
                 "actual": "no matching message", "passed": False}]

    def check_moment_posted(
        self, predicate, *, field: str = "moment"
    ) -> list[dict]:
        """检查是否发了满足条件的朋友圈。

        Args:
            predicate: ``(content: str) -> bool``
            field: check result 中的 field 名
        """
        my_wxid = self.user.get("wxid")
        for m in self.moments:
            if m.get("wxid") == my_wxid and predicate(m.get("content", "")):
                return [{"field": field, "expected": "moment matching predicate",
                         "actual": m.get("content", "")[:80], "passed": True}]
        return [{"field": field, "expected": "moment matching predicate",
                 "actual": "no matching moment", "passed": False}]

    def new_received_texts_from(self, contact_name: str) -> list[str]:
        """获取本次任务中联系人新发来的文本消息（对比 init 差集）。"""
        wxid = self.require_contact_wxid(contact_name)
        current_chat = self.chat_by_wxid(wxid)
        if current_chat is None:
            return []
        initial_ids: set[str] = set()
        if self.has_init:
            initial_chat = self.init.chat_by_wxid(wxid)
            if initial_chat is not None:
                for message in initial_chat["messages"]:
                    message_id = str(message["id"])
                    if message_id:
                        initial_ids.add(message_id)
        texts: list[str] = []
        for message in current_chat["messages"]:
            message_id = str(message["id"])
            if message_id and message_id in initial_ids:
                continue
            if str(message["senderId"]) == wxid and str(message["type"]) == "text":
                texts.append(str(message["content"]).strip())
        return texts

    def check_new_sent_to(
        self, contact_name: str, *keywords: str, field: str | None = None
    ) -> dict[str, Any]:
        """验证是否新给联系人发了包含所有关键词的消息。"""
        if field is None:
            field = f"sent_to_{contact_name}"
        texts = self.new_sent_texts_to(contact_name)
        actual = texts[-1] if texts else "(none)"
        passed = bool(texts) and all(keyword in actual for keyword in keywords)
        return {
            "field": field,
            "expected": f"new msg to '{contact_name}' with {list(keywords)}",
            "actual": actual,
            "passed": passed,
        }

    def joined_new_texts_to(self, contact_name: str) -> str:
        """拼接本次任务中新发给联系人的所有文本消息（换行分隔）。

        Agent 可能分多条消息发信息，此方法合并后用于子串匹配。
        """
        texts = self.new_sent_texts_to(contact_name)
        return "\n".join(texts) if texts else ""

    def check_new_sent_contains(
        self, contact_name: str, *keywords: str, field: str | None = None
    ) -> dict[str, Any]:
        """验证新消息（跨消息合并）是否包含所有关键词。"""
        if field is None:
            field = f"sent_to_{contact_name}"
        joined = self.joined_new_texts_to(contact_name)
        passed = bool(joined) and all(kw in joined for kw in keywords)
        return {
            "field": field,
            "expected": f"new msgs to '{contact_name}' with {list(keywords)}",
            "actual": joined[:200] or "(none)",
            "passed": passed,
        }

    def check_new_sent_norm_contains(
        self,
        contact_name: str,
        *keywords: str,
        field: str | None = None,
        last_only: bool = False,
    ) -> dict[str, Any]:
        """验证新消息归一化后包含所有关键词。"""
        if field is None:
            field = f"sent_to_{contact_name}"
        texts = self.new_sent_texts_to(contact_name)
        actual = texts[-1] if last_only and texts else self.joined_new_texts_to(contact_name)
        actual_norm = norm(actual)
        passed = bool(actual) and all(norm(keyword) in actual_norm for keyword in keywords)
        scope = "msg" if last_only else "msgs"
        return {
            "field": field,
            "expected": f"new {scope} to '{contact_name}' with normalized {list(keywords)}",
            "actual": actual[:200] or "(none)",
            "passed": passed,
        }

    def check_new_sent_norm_excludes(
        self,
        contact_name: str,
        *forbidden_keywords: str,
        field: str | None = None,
    ) -> dict[str, Any]:
        """验证新消息归一化后不包含指定干扰关键词。"""
        if field is None:
            field = f"sent_to_{contact_name}_excludes"
        joined = self.joined_new_texts_to(contact_name)
        joined_norm = norm(joined)
        forbidden_hits = [
            keyword
            for keyword in forbidden_keywords
            if norm(keyword) and norm(keyword) in joined_norm
        ]
        return {
            "field": field,
            "expected": f"new msgs to '{contact_name}' without normalized {list(forbidden_keywords)}",
            "actual": {
                "text": joined[:200] or "(none)",
                "forbidden_hits": forbidden_hits,
            },
            "passed": bool(joined) and not forbidden_hits,
        }

    def check_new_sent_contains_number(
        self,
        contact_name: str,
        expected: float,
        *,
        tolerance: float = 0.01,
        field: str | None = None,
    ) -> dict[str, Any]:
        if field is None:
            field = f"sent_to_{contact_name}_number"
        joined = self.joined_new_texts_to(contact_name)
        numbers = extract_numbers(joined)
        passed = bool(joined) and any(abs(num - float(expected)) <= tolerance for num in numbers)
        return {
            "field": field,
            "expected": {"number": expected, "tolerance": tolerance},
            "actual": {"text": joined[:200] or "(none)", "numbers": numbers[:20]},
            "passed": passed,
        }

    def check_new_sent_number_near_any_keyword(
        self,
        contact_name: str,
        expected: float,
        keywords: list[str],
        *,
        window: int = 12,
        tolerance: float = 0.01,
        field: str | None = None,
    ) -> dict[str, Any]:
        """验证新消息中某个数字出现在任一上下文关键词附近。"""
        if field is None:
            field = f"sent_to_{contact_name}_number_near_keyword"
        joined = self.joined_new_texts_to(contact_name)
        search_text = re.sub(
            r"\b[A-Za-z]+(?:-[A-Za-z0-9]+)+\b",
            lambda match: " " * len(match.group(0)),
            joined or "",
        )
        hits: list[dict[str, Any]] = []
        for match in re.finditer(
            r"(?<![0-9A-Za-z_.])(-?(?:\d{1,3}(?:[，,]\d{3})+|\d+)(?:\.\d+)?)(?![0-9A-Za-z_.])",
            search_text,
        ):
            try:
                number = float(match.group(1).replace(",", "").replace("，", ""))
            except Exception:
                continue
            left = max(0, match.start() - int(window))
            right = min(len(joined), match.end() + int(window))
            context = joined[left:right]
            near_keywords = [keyword for keyword in keywords if keyword and keyword in context]
            if abs(number - float(expected)) <= tolerance and near_keywords:
                hits.append({"number": number, "context": context})
        return {
            "field": field,
            "expected": {
                "number": expected,
                "near_any_keyword": keywords,
                "window": int(window),
            },
            "actual": {"text": joined[:200] or "(none)", "hits": hits[:5]},
            "passed": bool(joined) and bool(hits),
        }

    def check_new_sent_images_exact(
        self,
        contact_name: str,
        expected_paths: list[str],
        *,
        field: str | None = None,
    ) -> dict[str, Any]:
        """验证本次新发给联系人的图片路径集合与期望完全一致。"""
        if field is None:
            field = f"sent_images_to_{contact_name}"
        actual_paths = self.new_sent_image_paths_to(contact_name)
        return {
            "field": field,
            "expected": sorted(expected_paths),
            "actual": sorted(actual_paths),
            "passed": sorted(actual_paths) == sorted(expected_paths),
        }

    def check_new_sent_any_of(
        self,
        contact_name: str,
        labels: list[str],
        *extra_keywords: str,
        field: str | None = None,
    ) -> dict[str, Any]:
        """验证新消息包含 labels 中任意一个 + 所有 extra_keywords（跨消息合并）。"""
        if field is None:
            field = f"sent_to_{contact_name}"
        joined = self.joined_new_texts_to(contact_name)
        label_ok = any(label in joined for label in labels) if labels else True
        keywords_ok = all(kw in joined for kw in extra_keywords)
        passed = bool(joined) and label_ok and keywords_ok
        return {
            "field": field,
            "expected": f"any of {labels[:3]}{'…' if len(labels) > 3 else ''}"
            + (f" + {list(extra_keywords)}" if extra_keywords else ""),
            "actual": joined[:200] or "(none)",
            "passed": passed,
        }

    def check_new_subscription_created(
        self, membership_type: str, *, field: str = "wechat.subscription.created"
    ) -> dict[str, Any]:
        subscription = self.new_subscription_by_membership_type(membership_type)
        return {
            "field": field,
            "expected": str(membership_type),
            "actual": subscription.get("membershipType") if subscription else None,
            "passed": subscription is not None,
        }

    def check_new_subscription_auto_renew(
        self,
        membership_type: str,
        *,
        expected: bool,
        field: str = "wechat.subscription.auto_renew",
    ) -> dict[str, Any]:
        subscription = self.new_subscription_by_membership_type(membership_type)
        actual = None if subscription is None else bool(subscription.get("autoRenew"))
        return {
            "field": field,
            "expected": bool(expected),
            "actual": actual,
            "passed": subscription is not None and actual == bool(expected),
        }

    def check_new_transfer_notification(
        self,
        contact_name: str,
        amount: float,
        *,
        tolerance: float = 0.02,
        field: str = "wechat.notify.sent",
    ) -> dict[str, Any]:
        joined = self.joined_new_texts_to(contact_name)
        numbers = extract_numbers(joined)
        mentions_amount = any(abs(num - float(amount)) <= tolerance for num in numbers)
        transfer_keywords = (
            "已转",
            "转了",
            "转账",
            "转给",
            "打款",
            "汇款",
            "汇过去",
            "转款",
            "支付宝转",
            "给你转",
        )
        mentions_transfer = any(keyword in joined for keyword in transfer_keywords) or bool(
            re.search(r"转\s*[\d０-９,.，]", joined)
        )
        return {
            "field": field,
            "expected": {"contact": contact_name, "amount": float(amount)},
            "actual": joined[:200] or "(none)",
            "passed": bool(joined) and mentions_transfer and mentions_amount,
        }

    def check_blacklisted(self, name: str) -> dict[str, Any]:
        """验证联系人是否已被拉黑。"""
        contact = self.contact_by_name(name)
        actual = contact.get("isBlacklisted") is True
        return {
            "field": "blacklisted",
            "expected": True,
            "actual": actual,
            "passed": actual,
        }

    def check_new_moment_with(
        self, *keywords: str, field: str = "moment"
    ) -> dict[str, Any]:
        """验证是否新发了包含所有关键词的朋友圈。"""
        moments = self.new_moments_by_me()
        actual = str(moments[0]["content"]).strip() if moments else "(none)"
        passed = bool(moments) and all(keyword in actual for keyword in keywords)
        return {
            "field": field,
            "expected": f"new moment with {list(keywords)}",
            "actual": actual,
            "passed": passed,
        }

    def check_new_moment_contains(
        self,
        *keywords: str,
        field: str = "moment",
    ) -> dict[str, Any]:
        """验证最新新朋友圈归一化后包含所有关键词。"""
        actual = self._latest_new_moment_content()
        actual_norm = norm(actual)
        passed = bool(actual) and all(norm(keyword) in actual_norm for keyword in keywords)
        return {
            "field": field,
            "expected": f"new moment with normalized {list(keywords)}",
            "actual": actual or "(none)",
            "passed": passed,
        }

    def check_new_moment_contains_number(
        self,
        expected: float,
        *,
        tolerance: float = 0.01,
        field: str = "moment_number",
    ) -> dict[str, Any]:
        """验证最新新朋友圈包含指定数值。"""
        actual = self._latest_new_moment_content()
        numbers = extract_numbers(actual)
        passed = bool(actual) and any(abs(num - float(expected)) <= tolerance for num in numbers)
        return {
            "field": field,
            "expected": {"number": expected, "tolerance": tolerance},
            "actual": {"text": actual[:200] or "(none)", "numbers": numbers[:20]},
            "passed": passed,
        }

    def check_new_moment_contains_labels_and_number(
        self,
        labels: list[str],
        amount: float,
        *,
        tolerance: float = 0.01,
        field: str = "moment",
    ) -> dict[str, Any]:
        """验证最新新朋友圈包含任一标签和指定金额。"""
        actual = self._latest_new_moment_content()
        actual_norm = norm(actual)
        numbers = extract_numbers(actual)
        label_ok = any(norm(label) in actual_norm for label in labels) if labels else True
        amount_ok = any(
            abs(num - float(amount)) <= tolerance or abs(abs(num) - float(amount)) <= tolerance
            for num in numbers
        )
        return {
            "field": field,
            "expected": {"labels": labels[:3], "amount": float(amount)},
            "actual": {"text": actual[:200] or "(none)", "numbers": numbers[:20]},
            "passed": bool(actual) and label_ok and amount_ok,
        }

    def check_new_moment_no_images(self) -> dict[str, Any]:
        """验证新发的朋友圈没有附带图片（纯文字）。"""
        moments = self.new_moments_by_me()
        has_images = bool(moments[0].get("images")) if moments else False
        return {
            "field": "moment_no_images",
            "expected": "no images",
            "actual": "has images" if has_images else "text only",
            "passed": bool(moments) and not has_images,
        }

    def check_new_sent_match_time(
        self,
        contact_name: str,
        time_hhmm: str,
        *,
        field: str | None = None,
    ) -> dict[str, Any]:
        """新消息（多消息合并）中含指定 HH:MM（match_time 语义）。"""
        if field is None:
            field = "wechat_upcoming_time"
        joined = self.joined_new_texts_to(contact_name)
        passed = bool(joined) and match_time(time_hhmm, joined)
        return {
            "field": field,
            "expected": f"新消息含时间 {time_hhmm}",
            "actual": joined[:300] or "(none)",
            "passed": passed,
        }

    def check_new_sent_match_duration(
        self,
        contact_name: str,
        expected_duration_zh: str,
        *,
        field: str | None = None,
    ) -> dict[str, Any]:
        """新消息（多消息合并）与期望时长表述 match_duration 匹配。"""
        if field is None:
            field = "wechat_total_duration"
        joined = self.joined_new_texts_to(contact_name)
        passed = bool(joined) and match_duration(expected_duration_zh, joined)
        return {
            "field": field,
            "expected": expected_duration_zh,
            "actual": joined[:400] or "(none)",
            "passed": passed,
        }

    def check_no_new_sent_to(
        self,
        contact_name: str,
        *,
        field: str | None = None,
        summary: str = "无未读时不应新发给联系人转发短信",
    ) -> dict[str, Any]:
        """验证未给联系人发送新文本（与 init 差集为空）。"""
        if field is None:
            field = "wechat_no_forward"
        texts = self.new_sent_texts_to(contact_name)
        return {
            "field": field,
            "expected": summary,
            "actual": texts,
            "passed": len(texts) == 0,
        }

    def check_new_sent_meeting_id(
        self,
        contact_name: str,
        meeting_id: str,
        *,
        field: str | None = None,
    ) -> dict[str, Any]:
        """新消息中含会议号（忽略空格，允许数字间有空格）。"""
        if field is None:
            field = f"wechat_meeting_{contact_name}"
        mid = re.sub(r"\s+", "", str(meeting_id))
        joined = self.joined_new_texts_to(contact_name)
        if not mid:
            return {
                "field": field,
                "expected": "含会议号",
                "actual": joined[:300] or "(none)",
                "passed": False,
            }
        pat = TencentMeeting.meeting_id_pattern(mid)
        passed = bool(joined) and bool(pat.search(joined))
        return {
            "field": field,
            "expected": "含会议号",
            "actual": joined[:300] or "(none)",
            "passed": passed,
        }

    def check_new_sent_meeting_id_and_password(
        self,
        contact_name: str,
        meeting_id: str,
        password: str,
        *,
        field: str | None = None,
    ) -> dict[str, Any]:
        """新消息同时含会议号（pattern）与密码串。"""
        if field is None:
            field = "wechat_share"
        mid = re.sub(r"\s+", "", str(meeting_id))
        joined = self.joined_new_texts_to(contact_name)
        if not mid:
            return {
                "field": field,
                "expected": f"会议号+密码 {password}",
                "actual": joined[:400] or "(none)",
                "passed": False,
            }
        pat = TencentMeeting.meeting_id_pattern(mid)
        passed = bool(joined) and bool(pat.search(joined)) and str(password) in joined
        return {
            "field": field,
            "expected": f"会议号+密码 {password}",
            "actual": joined[:400] or "(none)",
            "passed": passed,
        }

    def check_new_sent_route_duration_and_meeting_time(
        self,
        contact_name: str,
        route_duration_text: str,
        meeting_time_hhmm: str,
        *,
        field: str | None = None,
    ) -> dict[str, Any]:
        """新消息同时含驾车历时（match_duration）与会议时间（match_time）。"""
        if field is None:
            field = "wechat_eta_and_meeting"
        joined = self.joined_new_texts_to(contact_name)
        passed = (
            bool(joined)
            and match_duration(route_duration_text, joined)
            and match_time(meeting_time_hhmm, joined)
        )
        return {
            "field": field,
            "expected": f"历时≈{route_duration_text}，会议时间≈{meeting_time_hhmm}",
            "actual": joined[:500] or "(none)",
            "passed": passed,
        }

    def check_new_sent_compare_city_temp(
        self,
        contact_name: str,
        *,
        city1: str,
        temp1: str | int | float,
        city2: str,
        temp2: str | int | float,
        winner: str,
        field: str = "compare_city_temp_share",
    ) -> dict[str, Any]:
        """验证新消息包含正确的温度比较结果。

        只验证核心事实：
        - 赢家城市名出现在消息中
        - 赢家温度值出现在消息中
        不绑定特定比较句式（如"比…更暖和"），Agent 可以用任何
        合理方式表达比较结论。
        """
        actual = self.joined_new_texts_to(contact_name)
        temp1_str = str(temp1)
        temp2_str = str(temp2)

        if winner == "一样":
            # 平局：消息中包含至少一个城市名和温度值即可
            passed = bool(actual) and (
                temp1_str in actual or temp2_str in actual
            ) and (city1 in actual or city2 in actual)
        else:
            winner_temp = temp1_str if winner == city1 else temp2_str
            winner_aliases = city_aliases(winner)
            # 核心事实：赢家城市名 + 赢家温度值
            has_winner = any(alias in (actual or "") for alias in winner_aliases)
            has_temp = winner_temp in (actual or "")
            passed = bool(actual) and has_winner and has_temp

        return {
            "field": field,
            "expected": {
                "city1": city1,
                "temp1": temp1_str,
                "city2": city2,
                "temp2": temp2_str,
                "winner": winner,
            },
            "actual": actual or "(none)",
            "passed": passed,
        }
