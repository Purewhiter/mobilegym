from __future__ import annotations

from bench_env.task.sampler import TaskSampler


def test_multi_field_none_uses_default_and_warns() -> None:
    sampler = TaskSampler(
        schema={
            "_target": {
                "sampler": lambda env_state, rng: {"keyword1": None},
                "fields": {"keyword1": "keyword1"},
            },
            "keyword1": {
                "type": "string",
                "default": "AI",
            },
        },
        seed=0,
    )

    result = sampler.sample({})

    assert result.params["keyword1"] == "AI"
    assert result.warnings == [
        "'keyword1': multi-field expansion produced None, using default",
    ]
