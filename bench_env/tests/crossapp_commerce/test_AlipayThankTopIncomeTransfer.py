from __future__ import annotations

from bench_env.tests.task_defs._defs_runner import (
    run_definition_contract,
    run_derived_specific_regressions,
    run_hard_offline_cases,
    run_hard_specific_regressions,
)


SUITE = "crossapp_commerce"
TASK_NAME = "AlipayThankTopIncomeTransfer"


def test_definition_contract() -> None:
    run_definition_contract(SUITE, TASK_NAME)


def test_hard_offline_cases() -> None:
    run_hard_offline_cases(TASK_NAME)


def test_hard_specific_regressions() -> None:
    run_hard_specific_regressions(TASK_NAME)


def test_derived_specific_regressions() -> None:
    run_derived_specific_regressions(TASK_NAME)
