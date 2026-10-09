"""Shared SMS base-state fixtures (extracted from tests/sms/test_tasks.py)."""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any


def _load_sms_data() -> tuple[dict[str, Any], dict[str, Any]]:
    """Return (app_state, provider_state) for SMS."""
    root = Path(__file__).resolve().parents[3]
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
