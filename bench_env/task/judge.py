"""
Task evaluation/judging types.

This module defines the core data structures for task evaluation:
- JudgeInput: All information needed to evaluate a task (current state, initial state, model answer)
- JudgeResult: Structured evaluation result (success, clean, issues, warnings)
"""

from __future__ import annotations

from dataclasses import dataclass, field
import logging
import re
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from bench_env.env.base import Observation

logger = logging.getLogger(__name__)


@dataclass
class JudgeInput:
    """
    Input data for task evaluation.
    
    Contains initial observation, last observation, and model output.
    """
    init_obs: Observation
    last_obs: Observation
    answer: str | None = None
    
    @property
    def route(self) -> dict[str, Any]:
        """Current route (from last observation)."""
        return self.last_obs.route

    @property
    def apps(self) -> dict[str, Any]:
        """Current apps state."""
        return self.last_obs.state.get("apps", {})

    @property
    def os(self) -> dict[str, Any]:
        """Current OS state."""
        return self.last_obs.state.get("os", {})

    @property
    def apps_init(self) -> dict[str, Any]:
        """Initial apps state."""
        return self.init_obs.state.get("apps", {})

    @property
    def os_init(self) -> dict[str, Any]:
        """Initial OS state."""
        return self.init_obs.state.get("os", {})


@dataclass
class JudgeResult:
    """
    Evaluation result.
    
    Attributes:
        success: Whether the task goal was achieved
        clean: Whether there were no unexpected state changes
        progress: Fraction of check_goals checks that passed (0.0 – 1.0)
        issues: List of reasons why goal was not achieved (for debugging)
        warnings: List of unexpected state changes (for debugging)
        judge_error: If set, the judge itself errored (not agent's fault)
    """
    success: bool = False
    clean: bool = True
    progress: float = 0.0
    issues: list[dict[str, Any]] = field(default_factory=list)
    warnings: list[dict[str, Any]] = field(default_factory=list)
    judge_error: str | None = None
    
    @property
    def passed(self) -> bool:
        """Task passed = goal achieved + no unexpected changes."""
        return self.success and self.clean
    
    @classmethod
    def ok(cls) -> "JudgeResult":
        """Create a successful result."""
        return cls(success=True, clean=True, progress=1.0)
    
    @classmethod
    def fail(cls, reason: str) -> "JudgeResult":
        """Create a failed result with reason."""
        return cls(
            success=False,
            clean=True,
            issues=[{"reason": reason}],
        )
    
    @classmethod
    def error(cls, message: str) -> "JudgeResult":
        """Create an error result (judge itself errored, not agent's fault)."""
        return cls(
            success=False,
            clean=True,
            issues=[],
            judge_error=message,
        )
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dict."""
        d = {
            "success": self.success,
            "clean": self.clean,
            "progress": self.progress,
            "passed": self.passed,
            "issues": self.issues,
            "warnings": self.warnings,
        }
        if self.judge_error:
            d["judge_error"] = self.judge_error
        return d


class StateComparator:
    """
    Utility for comparing state dictionaries (JSON Diff).
    """
    
    # 常见的唯一标识符字段名，按优先级排列
    # id: 通用标识符（大多数应用）
    # wxid: 微信用户/联系人
    # mid: Bilibili 用户
    # uid: 通用用户ID
    # bookId: 微信读书书籍关联
    # chatId, contactId, messageId: 聊天相关
    # key: 通用键值
    ID_FIELDS = ["id", "wxid", "mid", "uid", "bookId", "chatId", "contactId", "messageId", "key"]
    
    @staticmethod
    def _find_id_field(items: list[Any]) -> str | None:
        """
        自动检测数组元素中的唯一标识符字段。
        
        Args:
            items: 数组元素列表
            
        Returns:
            找到的标识符字段名，如果没有找到则返回 None
        """
        if not items:
            return None
        
        # 取第一个 dict 元素来检测
        sample = None
        for item in items:
            if isinstance(item, dict):
                sample = item
                break
        
        if not sample:
            return None
        
        # 按优先级检查常见的 ID 字段
        for field in StateComparator.ID_FIELDS:
            if field in sample:
                return field
        
        return None
    
    @staticmethod
    def diff_states(
        init: dict[str, Any],
        curr: dict[str, Any],
        prefix: str = "",
    ) -> list[dict[str, Any]]:
        """
        Find all differences between two state dicts.
        
        Args:
            init: Initial state dict
            curr: Current state dict
            prefix: Path prefix for nested dicts
            
        Returns:
            List of {"path": "...", "init": ..., "curr": ...}
        """
        diffs: list[dict[str, Any]] = []

        all_keys = set(init.keys()) | set(curr.keys())

        for key in all_keys:
            path = f"{prefix}.{key}" if prefix else key
            init_val = init.get(key)
            curr_val = curr.get(key)

            if isinstance(init_val, dict) and isinstance(curr_val, dict):
                diffs.extend(StateComparator.diff_states(init_val, curr_val, path))
                continue

            if isinstance(init_val, list) and isinstance(curr_val, list):
                diffs.extend(StateComparator.diff_lists(init_val, curr_val, path))
                continue

            if init_val != curr_val:
                diffs.append({"path": path, "init": init_val, "curr": curr_val})

        return diffs

    @staticmethod
    def _is_flat_list(init: list[Any], curr: list[Any]) -> bool:
        """Check if both lists contain only primitive values (not dicts/lists)."""
        for item in (*init, *curr):
            if isinstance(item, (dict, list)):
                return False
        return True

    @staticmethod
    def _diff_lists_flat(
        init: list[Any], curr: list[Any], prefix: str
    ) -> list[dict[str, Any]]:
        """Set-based diff for flat (primitive) arrays.

        Produces ``prefix[-=value]`` for removals, ``prefix[+=value]``
        for additions, and ``prefix._order`` for reordering.
        Uses Counter to handle duplicates correctly.
        """
        from collections import Counter
        diffs: list[dict[str, Any]] = []
        init_counts = Counter(init)
        curr_counts = Counter(curr)
        for val, count in init_counts.items():
            removed = count - curr_counts.get(val, 0)
            for _ in range(removed):
                diffs.append({"path": f"{prefix}[-={val}]", "init": val, "curr": None})
        for val, count in curr_counts.items():
            added = count - init_counts.get(val, 0)
            for _ in range(added):
                diffs.append({"path": f"{prefix}[+={val}]", "init": None, "curr": val})
        # Detect reordering among common elements
        if init_counts == curr_counts and init != curr:
            diffs.append({
                "path": f"{prefix}._order",
                "init": init,
                "curr": curr,
            })
        return diffs

    @staticmethod
    def diff_lists(init: list[Any], curr: list[Any], prefix: str) -> list[dict[str, Any]]:
        """
        比较两个数组的差异。

        - dict 元素且有唯一标识符：按 ID 匹配比较
        - 原始值数组（str/int 等）：集合 diff（产出 ``[+=v]`` / ``[-=v]``）
        - 其他：按索引比较
        """
        diffs: list[dict[str, Any]] = []

        id_field = StateComparator._find_id_field(init) or StateComparator._find_id_field(curr)

        if id_field:
            diffs.extend(StateComparator._diff_lists_by_id(init, curr, prefix, id_field))
        elif StateComparator._is_flat_list(init, curr):
            diffs.extend(StateComparator._diff_lists_flat(init, curr, prefix))
        else:
            diffs.extend(StateComparator._diff_lists_by_index(init, curr, prefix))

        return diffs

    
    @staticmethod
    def _diff_lists_by_id(
        init: list[Any], 
        curr: list[Any], 
        prefix: str, 
        id_field: str
    ) -> list[dict[str, Any]]:
        """
        按唯一标识符比较数组差异（优化版本）。
        
        检测以下类型的变化：
        1. 新增的元素（在 curr 中有但 init 中没有）
        2. 删除的元素（在 init 中有但 curr 中没有）
        3. 已有元素的属性变化（ID 相同但其他字段变化）
        4. 已有元素的相对顺序变化（不检测因新增导致的绝对索引变化）
        
        核心原则：除去任务操作的数据，剩余数据应完全一致。
        
        时间复杂度: O(n + m)，其中 n = len(init), m = len(curr)
        空间复杂度: O(n + m)
        """
        diffs: list[dict[str, Any]] = []
        
        # 一次遍历构建映射：ID -> (index, item)
        # 同时保留原始顺序的 ID 列表用于检测相对顺序变化
        init_by_id: dict[Any, tuple[int, dict]] = {}
        init_id_order: list[Any] = []  # 保持原始顺序
        init_without_id: list[tuple[int, Any]] = []
        for i, item in enumerate(init):
            if isinstance(item, dict) and id_field in item:
                item_id = item[id_field]
                if item_id in init_by_id:
                    logger.warning(
                        f"Duplicate {id_field}={item_id!r} in init list at {prefix}, "
                        f"index {init_by_id[item_id][0]} will be overwritten by index {i}"
                    )
                init_by_id[item_id] = (i, item)
                init_id_order.append(item_id)
            else:
                init_without_id.append((i, item))
        
        curr_by_id: dict[Any, tuple[int, dict]] = {}
        curr_without_id: list[tuple[int, Any]] = []
        for i, item in enumerate(curr):
            if isinstance(item, dict) and id_field in item:
                item_id = item[id_field]
                if item_id in curr_by_id:
                    logger.warning(
                        f"Duplicate {id_field}={item_id!r} in curr list at {prefix}, "
                        f"index {curr_by_id[item_id][0]} will be overwritten by index {i}"
                    )
                curr_by_id[item_id] = (i, item)
            else:
                curr_without_id.append((i, item))
        
        # 使用 set 加速集合操作
        init_ids = set(init_by_id.keys())
        curr_ids = set(curr_by_id.keys())
        
        # 1. 删除的元素（在 init 中有但 curr 中没有）
        deleted_ids = init_ids - curr_ids
        for item_id in deleted_ids:
            init_idx, init_item = init_by_id[item_id]
            path = f"{prefix}[{id_field}={item_id}]"
            diffs.append({"path": path, "init": init_item, "curr": None})
        
        # 2. 新增的元素（在 curr 中有但 init 中没有）
        added_ids = curr_ids - init_ids
        for item_id in added_ids:
            curr_idx, curr_item = curr_by_id[item_id]
            path = f"{prefix}[{id_field}={item_id}]"
            diffs.append({"path": path, "init": None, "curr": curr_item})
        
        # 3. 共同元素：检查属性变化
        common_ids = init_ids & curr_ids
        for item_id in common_ids:
            init_idx, init_item = init_by_id[item_id]
            curr_idx, curr_item = curr_by_id[item_id]
            path = f"{prefix}[{id_field}={item_id}]"
            
            # 检查属性变化（递归比较）
            diffs.extend(StateComparator.diff_states(init_item, curr_item, path))
        
        # 4. 检查已有元素的相对顺序是否变化
        # 只检测共同元素（已有数据）的相对顺序，不关心新增元素
        # 原理：提取 init 中的 ID 顺序，在 curr 中找出这些 ID 的位置，检查是否保持递增
        if len(common_ids) > 1:
            # 按 init 原始顺序提取共同 ID
            common_id_order_in_init = [id for id in init_id_order if id in common_ids]
            # 获取这些 ID 在 curr 中的位置
            positions_in_curr = [curr_by_id[id][0] for id in common_id_order_in_init]
            
            # 检查位置是否严格递增（相对顺序保持不变）
            for i in range(1, len(positions_in_curr)):
                if positions_in_curr[i] < positions_in_curr[i - 1]:
                    # 相对顺序发生了变化
                    id_a = common_id_order_in_init[i - 1]
                    id_b = common_id_order_in_init[i]
                    diffs.append({
                        "path": f"{prefix}._relative_order",
                        "init": f"{id_field}={id_a} before {id_field}={id_b}",
                        "curr": f"{id_field}={id_b} before {id_field}={id_a}",
                    })
                    # 只报告第一处顺序异常，避免大量重复警告
                    break
        
        # 5. 处理没有 ID 字段的元素（回退到按索引比较）
        if init_without_id or curr_without_id:
            n = max(len(init_without_id), len(curr_without_id))
            for i in range(n):
                init_idx, init_val = init_without_id[i] if i < len(init_without_id) else (None, None)
                curr_idx, curr_val = curr_without_id[i] if i < len(curr_without_id) else (None, None)
                
                idx = curr_idx if curr_idx is not None else init_idx
                path = f"{prefix}[{idx}]"
                
                if isinstance(init_val, dict) and isinstance(curr_val, dict):
                    diffs.extend(StateComparator.diff_states(init_val, curr_val, path))
                elif isinstance(init_val, list) and isinstance(curr_val, list):
                    diffs.extend(StateComparator.diff_lists(init_val, curr_val, path))
                elif init_val != curr_val:
                    diffs.append({"path": path, "init": init_val, "curr": curr_val})
        
        return diffs
    
    @staticmethod
    def _diff_lists_by_index(init: list[Any], curr: list[Any], prefix: str) -> list[dict[str, Any]]:
        """按索引位置比较数组差异（原始行为）。"""
        diffs: list[dict[str, Any]] = []
        n = max(len(init), len(curr))
        for i in range(n):
            path = f"{prefix}[{i}]"
            init_val = init[i] if i < len(init) else None
            curr_val = curr[i] if i < len(curr) else None

            if isinstance(init_val, dict) and isinstance(curr_val, dict):
                diffs.extend(StateComparator.diff_states(init_val, curr_val, path))
                continue
            if isinstance(init_val, list) and isinstance(curr_val, list):
                diffs.extend(StateComparator.diff_lists(init_val, curr_val, path))
                continue
            if init_val != curr_val:
                diffs.append({"path": path, "init": init_val, "curr": curr_val})
        return diffs
    
    @staticmethod
    def filter_unexpected_changes(
        diffs: list[dict[str, Any]],
        expected: list[str],
    ) -> list[dict[str, Any]]:
        """
        Filter out expected changes from diff list.
        
        Args:
            diffs: List of changes from diff_states()
            expected: List of path prefixes that are expected to change
            
        Returns:
            List of unexpected changes
        """
        def _is_expected(path: str, exp: str, is_addition: bool = False) -> bool:
            # 处理通配符：* (任意路径段) 和 [] (任意数组下标)
            if "*" in exp or "[]" in exp:
                esc = re.escape(exp)
                esc = esc.replace(re.escape("[]"), r"\[\d+\]")
                esc = esc.replace(r"\*", r"[^.\[]+")
                if re.fullmatch(esc, path):
                    return True
                # path 是 exp 的子路径
                # 例如：exp="apps.*._temp", path="apps.wechat._temp.queryLoading"
                if re.match(esc + r"(\.|\[)", path):
                    return True
                # 反向匹配：仅对新增元素生效，且仅限 [] 通配符
                # [] 反向匹配有意义：期望 moments[].content 变化 → moments[0] 整条新增也是预期的
                # * 反向匹配无意义：期望 apps.*._temp 变化 ≠ apps.wechat 整棵子树新增是预期的
                if is_addition and "*" not in exp:
                    path_segs = re.findall(r'[^.\[]+|\[\d*\]', path)
                    exp_segs = re.findall(r'[^.\[]+|\[\d*\]', exp)
                    if len(path_segs) < len(exp_segs):
                        prefix_ok = True
                        for ps, es in zip(path_segs, exp_segs):
                            if es == '[]':
                                if not re.fullmatch(r'\[\d+\]', ps):
                                    prefix_ok = False
                                    break
                                continue
                            if ps != es:
                                prefix_ok = False
                                break
                        if prefix_ok:
                            return True
                return False
            
            # 精确匹配
            if path == exp:
                return True
            # path 是 exp 的子路径（path 更具体）
            # 例如：exp="moments[0]", path="moments[0].content"
            if path.startswith(exp + ".") or path.startswith(exp + "["):
                return True
            # 反向匹配：仅对新增元素生效
            # exp 是 path 的子路径（exp 更具体）
            # 例如：path="moments[0]"（新增整个对象）, exp="moments[0].content"
            if is_addition and (exp.startswith(path + ".") or exp.startswith(path + "[")):
                return True
            return False

        # 1. 分离计数型期望（[+N]）和普通期望
        counted: dict[str, int] = {}  # prefix -> max additions
        regular: list[str] = []
        for exp in expected:
            m = re.match(r'^(.+)\[\+(\d+)\]$', exp)
            if m:
                counted[m.group(1)] = int(m.group(2))
            else:
                regular.append(exp)

        # 2. 用普通期望过滤
        unexpected: list[dict[str, Any]] = []
        for diff in diffs:
            path = diff["path"]
            is_addition = diff.get("init") is None
            if not any(_is_expected(path, exp, is_addition) for exp in regular):
                unexpected.append(diff)

        # 3. 计数型期望：允许 N 个新增，超出部分保留为 unexpected
        if counted:
            still_unexpected: list[dict[str, Any]] = []
            addition_counts: dict[str, int] = {p: 0 for p in counted}
            for diff in unexpected:
                path = diff["path"]
                is_addition = diff.get("init") is None
                matched_prefix = None
                if is_addition:
                    for prefix in counted:
                        if _is_expected(path, prefix, True):
                            matched_prefix = prefix
                            break
                if matched_prefix is not None:
                    addition_counts[matched_prefix] += 1
                    if addition_counts[matched_prefix] > counted[matched_prefix]:
                        still_unexpected.append(diff)
                    # else: within quota, drop from unexpected
                else:
                    still_unexpected.append(diff)
            unexpected = still_unexpected

        return unexpected
