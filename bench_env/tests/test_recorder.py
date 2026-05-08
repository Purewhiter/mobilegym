from __future__ import annotations

from datetime import datetime

from bench_env.env.recorder import RunRecorder


class _FixedDateTime(datetime):
    @classmethod
    def now(cls, tz=None):
        return cls(2026, 3, 27, 1, 10, 0, tzinfo=tz)


def test_start_run_uses_unique_directory_when_timestamp_collides(tmp_path, monkeypatch):
    import bench_env.env.recorder as recorder_module

    monkeypatch.setattr(recorder_module, "datetime", _FixedDateTime)

    rec1 = RunRecorder(tmp_path, save_trajectory=False)
    run_dir_1 = rec1.start_run(agent="a", model_name="m")
    rec1.finish_run()

    rec2 = RunRecorder(tmp_path, save_trajectory=False)
    run_dir_2 = rec2.start_run(agent="a", model_name="m")
    rec2.finish_run()

    assert run_dir_1 != run_dir_2
    assert run_dir_1.name == "20260327_011000"
    assert run_dir_2.name.startswith("20260327_011000")
