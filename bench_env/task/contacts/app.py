"""
Contacts provider accessor.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from bench_env.task.base import BaseApp
from bench_env.task.utils import norm

if TYPE_CHECKING:
    from bench_env.task.judge import JudgeInput


def contacts_from_input(input: "JudgeInput") -> "Contacts":
    provider = (input.os.get("providers") or {}).get("contacts") or {}
    return Contacts(provider)


class Contacts(BaseApp):
    """Accessor for os.providers.contacts."""

    @property
    def contacts(self) -> list[dict[str, Any]]:
        return self.get_list("contacts")

    @staticmethod
    def normalize_phone(raw: str) -> str:
        digits = "".join(c for c in str(raw or "") if c.isdigit())
        if digits.startswith("86") and len(digits) == 13:
            digits = digits[2:]
        return digits

    def contact_by_name(self, name: str) -> dict[str, Any]:
        target = norm(name)
        for contact in self.contacts:
            if norm(str(contact.get("displayName") or "")) == target:
                return contact
        raise ValueError(f"Contact {name!r} not found in contacts provider")

    def phone(self, name: str) -> str:
        contact = self.contact_by_name(name)
        for phone_item in contact.get("phones") or []:
            raw = str(phone_item.get("number") or "")
            if raw.strip():
                return raw
        raise ValueError(f"Contact {name!r} has no phone number in provider")

    def normalized_phone(self, name: str) -> str:
        return self.normalize_phone(self.phone(name))

    def check_contact_phone(
        self,
        name: str,
        expected: str,
        *,
        field: str = "contact_phone",
    ) -> dict[str, Any]:
        actual = self.phone(name)
        return {
            "field": field,
            "expected": {"name": str(name), "phone": str(expected)},
            "actual": {"name": str(name), "phone": actual},
            "passed": self.normalize_phone(actual) == self.normalize_phone(expected),
        }
