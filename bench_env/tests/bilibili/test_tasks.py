"""
Bilibili task correctness tests.
"""

from __future__ import annotations

import copy
import inspect
import json
import re
from pathlib import Path
from typing import Any

import pytest

from bench_env.task.base import BaseTask
from bench_env.task.bilibili import tasks as _tasks_module
from bench_env.task.bilibili.app import Bilibili, norm_ip_location
from bench_env.task.common_tasks import AnswerTask, CriteriaTask
from bench_env.tests.conftest import make_judge_input
from bench_env.tests.fixtures.bilibili import BASE_STATE, _sanlian_video

ALL_TASK_CLASSES: list[type[BaseTask]] = [
    obj
    for _, obj in inspect.getmembers(_tasks_module, inspect.isclass)
    if issubclass(obj, BaseTask) and obj is not BaseTask and obj.__module__ == _tasks_module.__name__
]
ALL_TASK_IDS = [cls.__name__ for cls in ALL_TASK_CLASSES]
ANSWER_TASK_CLASSES = [cls for cls in ALL_TASK_CLASSES if issubclass(cls, AnswerTask)]

TEST_OS_STATE = {"time": {"timestamp": 1742025600000}}
DEFAULT_ROUTE = {"app": "bilibili", "path": "/"}


def _make_task_input(
    init_state: dict[str, Any],
    curr_state: dict[str, Any],
    *,
    route: dict[str, Any] | None = None,
    answer: str | None = None,
):
    return make_judge_input(
        {"apps": {"bilibili": init_state}, "os": TEST_OS_STATE},
        {"apps": {"bilibili": curr_state}, "os": TEST_OS_STATE},
        route=route or DEFAULT_ROUTE,
        answer=answer,
    )


def _set_by_path(state: dict[str, Any], path: str, value: Any) -> None:
    current = state
    parts = path.split(".")
    for part in parts[:-1]:
        current = current[part]
    current[parts[-1]] = value


def _resolve_criteria_value(value: Any, params: dict[str, Any]) -> Any:
    if isinstance(value, str):
        match = re.fullmatch(r"\{(\w+)\}", value)
        if match:
            return params[match.group(1)]
    return value


def _realistic_answer(expected: Any) -> str:
    if isinstance(expected, (int, float)):
        return f"现在是{expected:g}" if isinstance(expected, float) else f"现在是{expected}"
    if isinstance(expected, str):
        if expected.isdigit():
            return f"UID是{expected}"
        if "万" in expected or "亿" in expected:
            return f"现在有{expected}粉丝"
        return f"答案是{expected}"
    return str(expected)


def _wrong_answer(expected: Any) -> str:
    if isinstance(expected, (int, float)):
        wrong = expected + 1
        return f"现在是{wrong:g}" if isinstance(wrong, float) else f"现在是{wrong}"
    if isinstance(expected, str):
        if expected.isdigit():
            return "UID是123456"
        if "万" in expected or "亿" in expected:
            return "现在有0粉丝"
        return "答案是错误值"
    return "错误答案"


def _add_search_history(state: dict[str, Any], keyword: str) -> None:
    history = state["user"].setdefault("searchHistory", [])
    state["user"]["searchHistory"] = [keyword, *[item for item in history if item != keyword]]


def _follow_user(state: dict[str, Any], name: str) -> None:
    mid = Bilibili.mid_from_name(name)
    following_list = state["user"]["followingList"]
    if not any(str(item["mid"]) == mid for item in following_list):
        following_list.append({"mid": mid, "name": name, "face": ""})
    state["user"]["following"] = len(following_list)


def _unfollow_user(state: dict[str, Any], name: str) -> None:
    mid = Bilibili.mid_from_name(name)
    following_list = state["user"]["followingList"]
    state["user"]["followingList"] = [
        item for item in following_list if str(item["mid"]) != mid and str(item["name"]) != name
    ]
    state["user"]["following"] = len(state["user"]["followingList"])


def _coin_video(state: dict[str, Any], title: str) -> None:
    video_id = Bilibili.bvid_from_title(title)
    state["activeVideoId"] = video_id
    coined_coins = state["user"].setdefault("coinedVideoCoins", {})
    existing = coined_coins.get(video_id, 0)
    if existing < 2:
        coined_coins[video_id] = existing + 1
        state["user"]["coins"] -= 1


def _favorite_video(state: dict[str, Any], title: str) -> None:
    video_id = Bilibili.bvid_from_title(title)
    state["activeVideoId"] = video_id
    for folder in state["user"]["favoritesFolders"]:
        if folder["id"] == "fav_default" and video_id not in folder["videoIds"]:
            folder["videoIds"].append(video_id)


def _fav_target_title(task: BaseTask) -> str:
    entry = Bilibili.ranking_entry(task.p.partition, int(task.p.rank))
    return str(entry["title"])


def _find_unfavorited_rank_entry() -> tuple[str, int, str]:
    app = Bilibili(BASE_STATE)
    favored = set(app.folder_by_title("默认收藏夹")["videoIds"])
    for partition in ("全站", "知识", "音乐", "科技数码", "影视"):
        for rank in range(1, 16):
            entry = Bilibili.ranking_entry(partition, rank)
            video_id = Bilibili.bvid_from_title(str(entry["title"]))
            if video_id not in favored:
                return partition, rank, str(entry["title"])
    raise AssertionError("No unfavorited ranking entry available in current Bilibili defaults")


def _with_open_video(title: str) -> dict[str, Any]:
    curr = copy.deepcopy(BASE_STATE)
    curr["activeVideoId"] = Bilibili.bvid_from_title(title)
    return curr


def _positive_answer_case(task: AnswerTask, *, curr_state: dict[str, Any] | None = None):
    curr = copy.deepcopy(curr_state) if curr_state is not None else copy.deepcopy(BASE_STATE)
    probe = _make_task_input(copy.deepcopy(BASE_STATE), curr)
    expected = task.get_answer(probe)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, answer=_realistic_answer(expected))


def _negative_answer_case(task: AnswerTask, *, curr_state: dict[str, Any] | None = None):
    curr = copy.deepcopy(curr_state) if curr_state is not None else copy.deepcopy(BASE_STATE)
    probe = _make_task_input(copy.deepcopy(BASE_STATE), curr)
    expected = task.get_answer(probe)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, answer=_wrong_answer(expected))


def _positive_criteria_case(task: CriteriaTask):
    curr = copy.deepcopy(BASE_STATE)
    route = DEFAULT_ROUTE
    for path, raw_value in task.criteria.items():
        value = _resolve_criteria_value(raw_value, task.params)
        if path == "route":
            route = {"app": "bilibili", "path": str(value)}
            continue
        _set_by_path(curr, path, value)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, route=route)


def _negative_criteria_case(task: CriteriaTask):
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


class TestTaskDefinitions:
    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_instantiation(self, cls):
        task = cls()
        assert task.name == cls.__name__
        assert task.templates
        assert "bilibili" in task.apps

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_description_renders(self, cls):
        task = cls()
        task._env_state = {"os": TEST_OS_STATE}
        desc = task.description
        assert desc
        assert "{" not in desc

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_required_class_attrs(self, cls):
        assert cls.scope in ("S1", "S2", "S3")
        assert cls.objective in ("operate", "query", "hybrid")
        assert cls.composition in ("atomic", "sequential", "transfer", "deep_dive")
        assert cls.difficulty in ("L1", "L2", "L3", "L4")

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_parameter_defaults_present(self, cls):
        for key, schema in cls.parameters.items():
            if key.startswith("_"):
                continue
            assert "default" in schema, f"{cls.__name__}.parameters['{key}'] missing default"

    @pytest.mark.parametrize("cls", ANSWER_TASK_CLASSES, ids=[cls.__name__ for cls in ANSWER_TASK_CLASSES])
    def test_answer_task_has_answer_or_get_answer(self, cls):
        has_answer_attr = cls.answer is not None
        has_get_answer_override = cls.get_answer is not AnswerTask.get_answer
        assert has_answer_attr or has_get_answer_override


class TestBilibiliAccessor:
    @pytest.fixture
    def bilibili(self) -> Bilibili:
        return Bilibili(copy.deepcopy(BASE_STATE))

    def test_get_video_interaction_status(self, bilibili: Bilibili):
        status = bilibili.get_video_interaction_status("BVmg00006148")
        assert status["liked"] is True
        assert status["coined"] is False

    def test_is_following_by_name(self, bilibili: Bilibili):
        assert bilibili.is_following_by_name("铁壁观察") is True
        assert bilibili.is_following_by_name("流光视界") is False

    def test_recommended_mid_helpers(self, bilibili: Bilibili):
        assert bilibili.recommended_mid_by_name("流光视界") == "800000001054"
        assert set(bilibili.recommended_mids()) == {"800000001054", "800000064982"}

    def test_profile_stat_uses_lists(self, bilibili: Bilibili):
        assert bilibili.profile_stat("following") == 2
        assert bilibili.profile_stat("followers") == 1

    def test_folder_video_count(self, bilibili: Bilibili):
        assert bilibili.folder_video_count("默认收藏夹") == 6

    def test_author_by_name(self):
        author = Bilibili.author_by_name("流光视界")
        assert author["name"] == "流光视界"

    def test_author_follower_display(self):
        display = Bilibili.author_follower_display("流光视界")
        assert isinstance(display, str)
        assert display

    def test_ranking_entry(self):
        entry = Bilibili.ranking_entry("全站", 1)
        assert entry["id"] == "BVmg00006148"

    def test_bvid_from_title(self):
        assert Bilibili.bvid_from_title("把老式音乐盒改造成 AI 作曲机：从硬件到算法全流程") == "BVmg00006148"

    def test_bvid_from_title_normalizes_ranking_title_whitespace(self):
        assert Bilibili.bvid_from_title("精灵旅社4：变身大冒险") == "BVmg00000164"

    def test_comment_by_contains(self):
        comment = Bilibili.comment_by_contains("BVmg00006148", "朴素点不行")
        assert "朴素点不行" in comment["message"]

    def test_missing_folder_raises(self, bilibili: Bilibili):
        with pytest.raises(ValueError):
            bilibili.folder_by_title("不存在的收藏夹")

    def test_norm_ip_location(self):
        assert norm_ip_location("IP属地：北京") == "北京"


def _open_ranking_positive():
    return _positive_criteria_case(_tasks_module.OpenRankingTask())


def _open_ranking_negative():
    return _negative_criteria_case(_tasks_module.OpenRankingTask())
def _view_profile_stat_positive():
    return _positive_answer_case(_tasks_module.ViewProfileStatTask())


def _view_profile_stat_negative():
    return _negative_answer_case(_tasks_module.ViewProfileStatTask())


def _subscribe_positive():
    task = _tasks_module.SubscribeTask()
    curr = copy.deepcopy(BASE_STATE)
    _follow_user(curr, task.p.up_name)
    _add_search_history(curr, task.p.up_name)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _subscribe_negative():
    return _tasks_module.SubscribeTask(), _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _update_sign_positive():
    return _positive_criteria_case(_tasks_module.UpdateSignTask())


def _update_sign_negative():
    return _negative_criteria_case(_tasks_module.UpdateSignTask())


def _coin_video_positive():
    task = _tasks_module.CoinVideoTask()
    curr = copy.deepcopy(BASE_STATE)
    _coin_video(curr, task.p.title)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _coin_video_negative():
    return _tasks_module.CoinVideoTask(), _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _view_my_uid_positive():
    return _positive_answer_case(_tasks_module.ViewMyUidTask())


def _view_my_uid_negative():
    return _negative_answer_case(_tasks_module.ViewMyUidTask())


def _update_nickname_positive():
    return _positive_criteria_case(_tasks_module.UpdateNicknameTask())


def _update_nickname_negative():
    return _negative_criteria_case(_tasks_module.UpdateNicknameTask())
def _video_online_positive():
    task = _tasks_module.VideoAnswerOnlineTask()
    curr = _with_open_video(task.p.title)
    return _positive_answer_case(task, curr_state=curr)


def _video_online_negative():
    task = _tasks_module.VideoAnswerOnlineTask()
    curr = _with_open_video(task.p.title)
    return _negative_answer_case(task, curr_state=curr)


def _video_tags_positive():
    task = _tasks_module.VideoAnswerTagsTask()
    tags = Bilibili.video_detail(Bilibili.bvid_from_title(task.p.title))["tags"][:3]
    curr = _with_open_video(task.p.title)
    answer = "、".join(tags)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, answer=answer)


def _video_tags_negative():
    task = _tasks_module.VideoAnswerTagsTask()
    curr = _with_open_video(task.p.title)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, answer="错误标签一、错误标签二、错误标签三")


def _toggle_anime_positive():
    task = _tasks_module.ToggleAnimeSubscriptionTask()
    curr = copy.deepcopy(BASE_STATE)
    # Task expects anime to be subscribed (expected=True), so add it
    if not any(item["title"] == task.p.anime_title for item in curr["user"]["subscribedAnime"]):
        curr["user"]["subscribedAnime"].append({"title": task.p.anime_title})
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _toggle_anime_negative():
    return _tasks_module.ToggleAnimeSubscriptionTask(), _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _set_sex_positive():
    return _positive_criteria_case(_tasks_module.SetSexTask())


def _set_sex_negative():
    return _negative_criteria_case(_tasks_module.SetSexTask())


def _view_favorites_count_positive():
    return _positive_answer_case(_tasks_module.ViewFavoritesFolderCountTask())


def _view_favorites_count_negative():
    return _negative_answer_case(_tasks_module.ViewFavoritesFolderCountTask())


def _search_user_follower_positive():
    task = _tasks_module.SearchUserFollowerCountTask()
    curr = copy.deepcopy(BASE_STATE)
    _add_search_history(curr, task.p.up_name)
    return _positive_answer_case(task, curr_state=curr)


def _search_user_follower_negative():
    task = _tasks_module.SearchUserFollowerCountTask()
    curr = copy.deepcopy(BASE_STATE)
    _add_search_history(curr, task.p.up_name)
    return _negative_answer_case(task, curr_state=curr)


def _sanlian_positive():
    task = _tasks_module.SanlianTask()
    curr = copy.deepcopy(BASE_STATE)
    _sanlian_video(curr, task.p.title)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _sanlian_negative():
    return _tasks_module.SanlianTask(), _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _follow_recommendation_positive():
    task = _tasks_module.FollowRecommendationTask()
    curr = copy.deepcopy(BASE_STATE)
    _follow_user(curr, task.p.target_up_name)
    _follow_user(curr, "_拾光记录者_")
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _follow_recommendation_negative():
    return _tasks_module.FollowRecommendationTask(), _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _unfollow_and_clear_history_positive():
    task = _tasks_module.UnfollowAndClearHistoryTask()
    curr = copy.deepcopy(BASE_STATE)
    _unfollow_user(curr, task.p.up_name)
    curr["user"]["searchHistory"] = []
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _unfollow_and_clear_history_negative():
    return _tasks_module.UnfollowAndClearHistoryTask(), _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


def _set_birthday_positive():
    task = _tasks_module.SetBirthdayTask()
    curr = copy.deepcopy(BASE_STATE)
    curr["user"]["birthday"] = f"1980-{int(task.p.month):02d}-{int(task.p.day):02d}"
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _set_birthday_negative():
    task = _tasks_module.SetBirthdayTask()
    curr = copy.deepcopy(BASE_STATE)
    curr["user"]["birthday"] = "1980-01-01"
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _fav_video_and_count_positive():
    partition, rank, title = _find_unfavorited_rank_entry()
    task = _tasks_module.FavVideoAndCountTask(partition=partition, rank=rank)
    curr = copy.deepcopy(BASE_STATE)
    _favorite_video(curr, title)
    default_folder = next(folder for folder in curr["user"]["favoritesFolders"] if folder["id"] == "fav_default")
    answer = f"默认收藏夹现在有{len(default_folder['videoIds'])}个内容"
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, answer=answer)


def _fav_video_and_count_negative_wrong_state():
    partition, rank, _ = _find_unfavorited_rank_entry()
    task = _tasks_module.FavVideoAndCountTask(partition=partition, rank=rank)
    expected_count = len(next(folder for folder in BASE_STATE["user"]["favoritesFolders"] if folder["id"] == "fav_default")["videoIds"]) + 1
    answer = f"默认收藏夹现在有{expected_count}个内容"
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE), answer=answer)


def _fav_video_and_count_negative_wrong_answer():
    partition, rank, title = _find_unfavorited_rank_entry()
    task = _tasks_module.FavVideoAndCountTask(partition=partition, rank=rank)
    curr = copy.deepcopy(BASE_STATE)
    _favorite_video(curr, title)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, answer="默认收藏夹现在有999个内容")


def _comment_uid_positive():
    task = _tasks_module.VideoCommentContainsAnswerUidTask()
    curr = _with_open_video(task.p.title)
    return _positive_answer_case(task, curr_state=curr)


def _comment_uid_negative():
    task = _tasks_module.VideoCommentContainsAnswerUidTask()
    curr = _with_open_video(task.p.title)
    return _negative_answer_case(task, curr_state=curr)


def _comment_location_positive():
    task = _tasks_module.VideoCommentContainsAnswerLocationTask()
    curr = _with_open_video(task.p.title)
    return _positive_answer_case(task, curr_state=curr)


def _comment_location_negative():
    task = _tasks_module.VideoCommentContainsAnswerLocationTask()
    curr = _with_open_video(task.p.title)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, answer="IP属地在火星")


OFFLINE_JUDGE_POSITIVE_CASES = [
    ("OpenRankingTask", _open_ranking_positive),
    ("ViewProfileStatTask", _view_profile_stat_positive),
    ("SubscribeTask", _subscribe_positive),
    ("UpdateSignTask", _update_sign_positive),
    ("CoinVideoTask", _coin_video_positive),
    ("ViewMyUidTask", _view_my_uid_positive),
    ("UpdateNicknameTask", _update_nickname_positive),
    ("VideoAnswerOnlineTask", _video_online_positive),
    ("VideoAnswerTagsTask", _video_tags_positive),
    ("ToggleAnimeSubscriptionTask", _toggle_anime_positive),
    ("SetSexTask", _set_sex_positive),
    ("ViewFavoritesFolderCountTask", _view_favorites_count_positive),
    ("SearchUserFollowerCountTask", _search_user_follower_positive),
    ("SanlianTask", _sanlian_positive),
    ("FollowRecommendationTask", _follow_recommendation_positive),
    ("UnfollowAndClearHistoryTask", _unfollow_and_clear_history_positive),
    ("SetBirthdayTask", _set_birthday_positive),
    ("FavVideoAndCountTask", _fav_video_and_count_positive),
    ("VideoCommentContainsAnswerUidTask", _comment_uid_positive),
    ("VideoCommentContainsAnswerLocationTask", _comment_location_positive),
]

OFFLINE_JUDGE_NEGATIVE_CASES = [
    ("OpenRankingTask", _open_ranking_negative),
    ("ViewProfileStatTask", _view_profile_stat_negative),
    ("SubscribeTask", _subscribe_negative),
    ("UpdateSignTask", _update_sign_negative),
    ("CoinVideoTask", _coin_video_negative),
    ("ViewMyUidTask", _view_my_uid_negative),
    ("UpdateNicknameTask", _update_nickname_negative),
    ("VideoAnswerOnlineTask", _video_online_negative),
    ("VideoAnswerTagsTask", _video_tags_negative),
    ("ToggleAnimeSubscriptionTask", _toggle_anime_negative),
    ("SetSexTask", _set_sex_negative),
    ("ViewFavoritesFolderCountTask", _view_favorites_count_negative),
    ("SearchUserFollowerCountTask", _search_user_follower_negative),
    ("SanlianTask", _sanlian_negative),
    ("FollowRecommendationTask", _follow_recommendation_negative),
    ("UnfollowAndClearHistoryTask", _unfollow_and_clear_history_negative),
    ("SetBirthdayTask", _set_birthday_negative),
    ("FavVideoAndCountTask", _fav_video_and_count_negative_wrong_state),
    ("FavVideoAndCountTask", _fav_video_and_count_negative_wrong_answer),
    ("VideoCommentContainsAnswerUidTask", _comment_uid_negative),
    ("VideoCommentContainsAnswerLocationTask", _comment_location_negative),
]

OFFLINE_JUDGE_TASK_NAMES = {cls.__name__ for cls in ALL_TASK_CLASSES}


class TestTaskJudgeMatrixOffline:
    def test_offline_judge_matrix_complete(self):
        positive = {name for name, _ in OFFLINE_JUDGE_POSITIVE_CASES}
        negative = {name for name, _ in OFFLINE_JUDGE_NEGATIVE_CASES}
        assert positive == OFFLINE_JUDGE_TASK_NAMES
        assert negative == OFFLINE_JUDGE_TASK_NAMES
        hybrid_negatives = [name for name, _ in OFFLINE_JUDGE_NEGATIVE_CASES if name == "FavVideoAndCountTask"]
        assert len(hybrid_negatives) >= 2

    @pytest.mark.parametrize(
        "task_name,builder",
        OFFLINE_JUDGE_POSITIVE_CASES,
        ids=[name for name, _ in OFFLINE_JUDGE_POSITIVE_CASES],
    )
    def test_positive_case(self, task_name, builder):
        task, inp = builder()
        result = task.evaluate(inp)
        assert result.success, f"{task_name} positive failed: issues={result.issues}, warnings={result.warnings}"

    @pytest.mark.parametrize(
        "task_name,builder",
        OFFLINE_JUDGE_NEGATIVE_CASES,
        ids=[name for name, _ in OFFLINE_JUDGE_NEGATIVE_CASES],
    )
    def test_negative_case(self, task_name, builder):
        task, inp = builder()
        result = task.evaluate(inp)
        assert not result.success, f"{task_name} negative unexpectedly passed"

    def test_fav_video_and_count_uses_ranking_entry_id_for_duplicate_titles(self):
        task = _tasks_module.FavVideoAndCountTask(partition="电影", rank=7)
        entry = Bilibili.ranking_entry("电影", 7)
        assert entry["title"] == "罗小黑战记"
        assert entry["id"] == "BVmg00000081"

        curr = copy.deepcopy(BASE_STATE)
        _favorite_video(curr, str(entry["title"]))
        curr["activeVideoId"] = str(entry["id"])
        default_folder = next(folder for folder in curr["user"]["favoritesFolders"] if folder["id"] == "fav_default")
        wrong_bvid = Bilibili.bvid_from_title(str(entry["title"]))
        default_folder["videoIds"] = [vid for vid in default_folder["videoIds"] if vid != wrong_bvid]
        if str(entry["id"]) not in default_folder["videoIds"]:
            default_folder["videoIds"].append(str(entry["id"]))

        answer = f"默认收藏夹现在有{len(default_folder['videoIds'])}个内容"
        result = task.evaluate(_make_task_input(copy.deepcopy(BASE_STATE), curr, answer=answer))
        assert result.success, result.issues

    def test_folder_created_check_accepts_duplicate_title_bvids(self):
        curr = copy.deepcopy(BASE_STATE)
        curr["user"]["favoritesFolders"].append(
            {
                "id": "fav_duplicate_title",
                "title": "同名视频",
                "isPublic": False,
                "videoIds": ["BVmg00000081"],
            }
        )
        app = Bilibili(curr, init=copy.deepcopy(BASE_STATE))

        result = app.check_folder_created_with_bvids(
            "同名视频",
            ["BVmg00000081"],
            video_titles=["罗小黑战记"],
        )

        assert result["passed"] is True
