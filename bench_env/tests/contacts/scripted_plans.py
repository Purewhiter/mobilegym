"""Scripted validation plans for Contacts tasks.

The contacts package currently provides only the provider accessor; it does not
declare concrete ``BaseTask`` subclasses under ``bench_env/task/contacts``.
"""

from __future__ import annotations

from bench_env.agent.scripted import Step

PLANS: dict[str, list[Step]] = {}
