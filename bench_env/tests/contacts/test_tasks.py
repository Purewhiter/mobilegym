"""
Contacts accessor tests.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

from bench_env.task.contacts.app import Contacts


def _load_provider() -> dict:
    path = Path(__file__).resolve().parents[3] / "os" / "providers" / "defaults" / "contacts.json"
    return json.loads(path.read_text(encoding="utf-8"))


BASE_STATE = _load_provider()


class TestContactsAccessor:
    @pytest.fixture
    def contacts(self) -> Contacts:
        return Contacts(copy.deepcopy(BASE_STATE))

    def test_phone_and_normalized_phone(self, contacts: Contacts):
        assert contacts.phone("张三") == "+86 13800138000"
        assert contacts.normalized_phone("张三") == "13800138000"

    def test_check_contact_phone_accepts_formatted_number(self, contacts: Contacts):
        check = contacts.check_contact_phone("张三", "138-0013-8000")
        assert check["passed"] is True
        assert check["actual"]["phone"] == "+86 13800138000"

    def test_check_contact_phone_negative(self, contacts: Contacts):
        check = contacts.check_contact_phone("张三", "13900000000")
        assert check["passed"] is False

    def test_missing_contact_raises(self, contacts: Contacts):
        with pytest.raises(ValueError):
            contacts.phone("不存在")

    def test_contact_without_phone_raises(self):
        state = copy.deepcopy(BASE_STATE)
        state["contacts"].append(
            {
                "id": "c_no_phone",
                "displayName": "无号码联系人",
                "phones": [],
            }
        )
        contacts = Contacts(state)
        with pytest.raises(ValueError):
            contacts.phone("无号码联系人")
