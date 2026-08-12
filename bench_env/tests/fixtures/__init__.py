"""
Shared base-state fixtures, one module per suite.

These modules hold the base states (``BASE_STATE`` / ``DEFAULTS`` /
``TEST_OS_STATE``) and state-mutation helpers that are needed by more than
one test suite (mainly the ``crossapp_*`` suites). They were extracted from
the corresponding ``bench_env/tests/<suite>/test_tasks.py`` files so that
test modules never import other suites' *test modules* — cross-suite
consumers and the owning suite both import from here instead.

Timestamps intentionally differ between suites (each suite froze its own
"now"), so the per-suite ``TEST_OS_STATE`` values are NOT interchangeable.
"""
