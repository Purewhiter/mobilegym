import argparse
import json
import re
from collections import deque
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple


def _normalize(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\u4e00-\u9fff]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _tokenize(text: str) -> List[str]:
    return [t for t in _normalize(text).split(" ") if t]


def _score(query: str, candidate: str) -> float:
    if not query or not candidate:
        return 0.0
    q = _normalize(query)
    c = _normalize(candidate)
    if not q or not c:
        return 0.0
    if q == c:
        return 1.0
    if q in c:
        return 0.9
    q_tokens = _tokenize(q)
    c_tokens = set(_tokenize(c))
    if not q_tokens:
        return 0.0
    overlap = len([t for t in q_tokens if t in c_tokens]) / len(q_tokens)
    ratio = SequenceMatcher(None, q, c).ratio()
    return max(overlap * 0.75 + ratio * 0.25, ratio * 0.6)


def _gesture_to_verb(gesture: Optional[str]) -> str:
    if not gesture:
        return "点击"
    mapping = {
        "tap": "点击",
        "click": "点击",
        "doubleTap": "双击",
        "doubleClick": "双击",
        "longPress": "长按",
        "press": "按下",
        "swipe": "滑动",
        "drag": "拖拽",
    }
    if gesture in mapping:
        return mapping[gesture]
    g = str(gesture)
    if g in mapping:
        return mapping[g]
    return g


def _short_label(label: str) -> str:
    label = (label or "").strip()
    if not label:
        return ""
    # Node labels are usually: "<description> <component> <route> ...".
    # Using the first token keeps output readable.
    return label.split(" ")[0]


def _strip_id_prefix(label: str, entity_id: str) -> str:
    label = (label or "").strip()
    entity_id = (entity_id or "").strip()
    if not label or not entity_id:
        return label
    if label == entity_id:
        return ""
    prefix = entity_id + " "
    if label.startswith(prefix):
        return label[len(prefix) :].strip()
    return label


def _fmt_kv_pairs(obj: Any) -> str:
    if not isinstance(obj, dict) or not obj:
        return ""
    parts: List[str] = []
    for k, v in obj.items():
        if isinstance(v, (dict, list)):
            v_str = json.dumps(v, ensure_ascii=False)
        else:
            v_str = str(v)
        parts.append(f"{k}={v_str}")
    return ", ".join(parts)


def _edge_params_hint(edge: Dict[str, Any]) -> str:
    # Prefer showing concrete search values (e.g. tab=total), then route params schema (e.g. bookId=string).
    hints: List[str] = []
    search = edge.get("search")
    if isinstance(search, dict) and search:
        kv = _fmt_kv_pairs(search)
        if kv:
            hints.append(kv)
    params = edge.get("params")
    if isinstance(params, dict) and params:
        kv = _fmt_kv_pairs(params)
        if kv:
            hints.append(f"参数:{kv}")
    if not hints:
        return ""
    return f"（{'；'.join(hints)}）"


def _fmt_node_step(step: Dict[str, Any]) -> str:
    node_id = str(step.get("id") or "")
    label = str(step.get("label") or "")
    name = _short_label(label) or node_id
    return f"{name}({node_id})" if node_id else name


def _fmt_action_step(step: Dict[str, Any]) -> str:
    action_id = str(step.get("id") or "")
    label = str(step.get("label") or action_id)
    human = _strip_id_prefix(label, action_id) or label or action_id
    return f"{human}({action_id})" if action_id else human


def _fmt_state_step(step: Dict[str, Any]) -> str:
    state_id = str(step.get("id") or "")
    label = str(step.get("label") or state_id)
    human = _strip_id_prefix(label, state_id) or label or state_id
    return f"{human}({state_id})" if state_id else human


def _fmt_transition_step(step: Dict[str, Any]) -> str:
    trans_id = str(step.get("id") or "")
    label = str(step.get("label") or trans_id)
    human = _strip_id_prefix(label, trans_id) or label or trans_id
    return f"{human}({trans_id})" if trans_id else human


def _steps_to_narrative(steps: List[Dict[str, Any]]) -> str:
    if not steps:
        return ""

    nodes = [s for s in steps if s.get("type") == "node"]
    start_node = nodes[0] if nodes else None
    end_node = nodes[-1] if nodes else None
    end_node_id = str(end_node.get("id") or "") if end_node else ""
    last_node_index = -1
    for i in range(len(steps) - 1, -1, -1):
        if steps[i].get("type") == "node":
            last_node_index = i
            break

    segments: List[str] = []
    if start_node:
        segments.append(f"在初始状态 {_fmt_node_step(start_node)}")
    else:
        segments.append("在初始状态")

    # Walk through steps and generate a readable narrative.
    for idx, step in enumerate(steps):
        stype = step.get("type")

        if stype == "transition":
            edge = step.get("edge") if isinstance(step.get("edge"), dict) else {}
            edge_type = edge.get("type") or step.get("edge", {}).get("type")
            ui_meta = edge.get("uiMeta") if isinstance(edge.get("uiMeta"), dict) else {}
            verb = _gesture_to_verb(ui_meta.get("gesture"))

            # Find the next node to describe arrival.
            next_node = None
            next_node_index = -1
            for j in range(idx + 1, len(steps)):
                if steps[j].get("type") == "node":
                    next_node = steps[j]
                    next_node_index = j
                    break
            is_to_final_node = (
                bool(end_node_id)
                and next_node is not None
                and str(next_node.get("id") or "") == end_node_id
                and next_node_index == last_node_index
            )

            note_parts: List[str] = []
            if edge.get("availability") is not None:
                note_parts.append("受可用性限制")
            if bool(edge.get("needsPrompt")) or edge.get("uiCondition") is not None or edge.get("conditionStatus") is not None:
                note_parts.append("可能需要确认条件")
            note = f"（{'，'.join(note_parts)}）" if note_parts else ""

            if edge_type == "back" or step.get("id") == "back":
                if next_node:
                    # Avoid redundant "回到/到达 <final>" — the final node will be stated once at the end.
                    if is_to_final_node:
                        segments.append(f"{verb}返回{note}")
                    else:
                        segments.append(f"{verb}返回，回到 {_fmt_node_step(next_node)}{note}")
                else:
                    segments.append(f"{verb}返回{note}")
                continue

            trans_text = _fmt_transition_step(step)
            trans_text = f"{trans_text}{_edge_params_hint(edge)}"
            # Avoid duplicated gesture words, e.g. "长按长按打开..." when label already contains "长按".
            verb_prefix = "" if trans_text.startswith(verb) else verb
            if next_node:
                if is_to_final_node:
                    segments.append(f"{verb_prefix}{trans_text}{note}")
                else:
                    segments.append(
                        f"{verb_prefix}{trans_text}，到达 {_fmt_node_step(next_node)}{note}"
                    )
            else:
                segments.append(f"{verb_prefix}{trans_text}{note}")
            continue

        if stype == "action":
            # Prefer attaching the action to the nearest node (usually the previous node).
            loc_node = None
            for j in range(idx - 1, -1, -1):
                if steps[j].get("type") == "node":
                    loc_node = steps[j]
                    break
            action_text = _fmt_action_step(step)
            if loc_node:
                segments.append(f"在 {_fmt_node_step(loc_node)} 执行 {action_text}")
            else:
                segments.append(f"执行 {action_text}")
            continue

        if stype == "state":
            loc_node = None
            for j in range(idx - 1, -1, -1):
                if steps[j].get("type") == "node":
                    loc_node = steps[j]
                    break
            state_text = _fmt_state_step(step)
            if loc_node:
                segments.append(f"在 {_fmt_node_step(loc_node)} 切换到状态 {state_text}")
            else:
                segments.append(f"切换到状态 {state_text}")
            continue

    if end_node:
        segments.append(f"最终到达 {_fmt_node_step(end_node)}")
    else:
        last = steps[-1]
        if last.get("type") == "action":
            segments.append(f"最终执行 {_fmt_action_step(last)}")
        elif last.get("type") == "state":
            segments.append(f"最终处于状态 {_fmt_state_step(last)}")
        elif last.get("type") == "transition":
            segments.append(f"最终触发 {_fmt_transition_step(last)}")

    return "，".join([s for s in segments if s]).strip("，") + "。"


@dataclass(frozen=True)
class Entity:
    id: str
    type: str
    label: str
    parent_node: Optional[str] = None
    edge: Optional[Dict[str, Any]] = None


@dataclass(frozen=True)
class Match:
    entity: Entity
    score: float


class NavGraphPathFinder:
    def __init__(
        self,
        graph: Dict[str, Any],
        include_back_edges: bool = True,
        assume_push_when_mode_missing: bool = False,
        history_depth: int = 0,
        max_history_seeds: int = 50,
    ) -> None:
        self.graph = graph
        self.nodes = {node["id"]: node for node in graph.get("nodes", [])}
        self.edges = graph.get("edges", [])
        self.adj: Dict[str, List[Tuple[str, Dict[str, Any]]]] = {}
        self.push_incoming: Dict[str, List[Tuple[str, Dict[str, Any]]]] = {}
        self.entities: List[Entity] = []
        self.include_back_edges = include_back_edges
        self.assume_push_when_mode_missing = assume_push_when_mode_missing
        self.history_depth = history_depth
        self.max_history_seeds = max_history_seeds
        self._build_graph()
        self._build_entities()

    def _edge_endpoints(self, edge: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
        source = edge.get("sourceNodeId") or edge.get("source")
        target = edge.get("targetNodeId") or edge.get("target")
        return source, target

    def _is_push_edge(self, edge: Dict[str, Any]) -> bool:
        # Treat any edge with `mode: push` as contributing to back-stack history.
        #
        # In our nav graph schema, both "navigation" and "state" edges can be "push"
        # (e.g. opening a query-param UI state like `/?menu=plus`). If we ignore
        # non-navigation push edges, implicit "back" traversal becomes impossible for
        # these states and shortest paths will be missing.
        mode = edge.get("mode")
        if mode == "replace":
            return False
        if mode is None:
            return bool(self.assume_push_when_mode_missing)
        return True

    def _has_availability(self, edge: Dict[str, Any]) -> bool:
        # If present, this edge is not always available.
        return "availability" in edge and edge.get("availability") is not None

    def _has_ui_condition(self, edge: Dict[str, Any]) -> bool:
        # transition.ui.condition propagated into nav graph edge
        return edge.get("uiCondition") is not None

    def _has_condition_status(self, edge: Dict[str, Any]) -> bool:
        # data-mode condition evaluation status propagated into nav graph edge
        return edge.get("conditionStatus") is not None

    def _needs_prompt(self, edge: Dict[str, Any]) -> bool:
        # "Need prompt" edges: UI condition exists, or condition status indicates uncertainty.
        # In schema graphs, uiCondition exists but conditionStatus is usually absent.
        return self._has_ui_condition(edge) or self._has_condition_status(edge)

    def _node_needs_prompt(self, node: Dict[str, Any]) -> bool:
        # "Need prompt" nodes: existence depends on stateCondition, or data-mode has conditionStatus.
        return node.get("stateCondition") is not None or node.get("conditionStatus") is not None

    def _node_step(self, node_id: str) -> Dict[str, Any]:
        node = self.nodes.get(node_id, {"id": node_id})
        return {
            "type": "node",
            "id": node_id,
            "label": self._node_label(node),
            "node": {
                "stateCondition": node.get("stateCondition"),
                "conditionStatus": node.get("conditionStatus"),
                "needsPrompt": self._node_needs_prompt(node),
            },
        }

    def _build_graph(self) -> None:
        for edge in self.edges:
            source, target = self._edge_endpoints(edge)
            if not source or not target:
                continue
            self.adj.setdefault(source, []).append((target, edge))
            if self._is_push_edge(edge):
                self.push_incoming.setdefault(target, []).append((source, edge))

    def _node_label(self, node: Dict[str, Any]) -> str:
        parts = [
            node.get("description", ""),
            node.get("component", ""),
            node.get("routePath", ""),
            node.get("uiStateId", ""),
            node.get("id", ""),
        ]
        return " ".join([p for p in parts if p])

    def _build_entities(self) -> None:
        for node_id, node in self.nodes.items():
            self.entities.append(
                Entity(
                    id=node_id,
                    type="node",
                    label=self._node_label(node),
                    parent_node=node_id,
                )
            )
            for state in node.get("states", []):
                self.entities.append(
                    Entity(
                        id=state,
                        type="state",
                        label=f"{state} {node.get('description', '')}",
                        parent_node=node_id,
                    )
                )
            for action in node.get("actions", []):
                action_id = action.get("id", "")
                action_label = action.get("label", "")
                if not action_id and not action_label:
                    continue
                self.entities.append(
                    Entity(
                        id=action_id or action_label,
                        type="action",
                        label=f"{action_id} {action_label}".strip(),
                        parent_node=node_id,
                    )
                )
        for edge in self.edges:
            edge_id = edge.get("id") or edge.get("label")
            edge_label = edge.get("label") or edge.get("id") or ""
            if not edge_id and not edge_label:
                continue
            source, target = self._edge_endpoints(edge)
            if not source or not target:
                continue
            self.entities.append(
                Entity(
                    id=edge_id,
                    type="transition",
                    label=f"{edge_id} {edge_label}".strip(),
                    parent_node=None,
                    edge=edge,
                )
            )

    def search_entities(
        self,
        query: str,
        types: Optional[Iterable[str]] = None,
        limit: int = 5,
        min_score: float = 0.55,
    ) -> List[Match]:
        q_raw = (query or "").strip()
        # If the user provides a concrete route-like string (e.g. "/my-reading?tab=total"),
        # we should match nodes/states primarily by id, otherwise fuzzy label matching can
        # produce confusing "same-node" matches (0-length paths) due to high token overlap.
        path_like = q_raw.startswith("/")
        path_like_with_query = path_like and ("?" in q_raw)
        type_set = set(types) if types else None
        matches: List[Match] = []
        for entity in self.entities:
            if type_set and entity.type not in type_set:
                continue
            if path_like and entity.type in ("node", "state"):
                if path_like_with_query:
                    # For paths with query string, require exact id match.
                    score = 1.0 if q_raw == entity.id else 0.0
                else:
                    score = _score(query, entity.id)
            else:
                score = max(_score(query, entity.label), _score(query, entity.id))
            if score >= min_score:
                matches.append(Match(entity=entity, score=score))
        type_priority = {"node": 0, "state": 1, "action": 2, "transition": 3}
        matches.sort(
            key=lambda m: (-m.score, type_priority.get(m.entity.type, 99), m.entity.id)
        )
        return matches[:limit]

    def _build_history_seeds(
        self,
        start: str,
        edge_allowed: Optional[Callable[[Dict[str, Any]], bool]] = None,
        node_allowed: Optional[Callable[[str], bool]] = None,
    ) -> List[Tuple[str, ...]]:
        if self.history_depth <= 0:
            return [()]
        seeds: List[Tuple[str, ...]] = [()]
        stack: List[Tuple[str, Tuple[str, ...], int]] = [(start, (), 0)]
        visited = set()
        while stack:
            node, history, depth = stack.pop()
            if depth >= self.history_depth:
                continue
            key = (node, history)
            if key in visited:
                continue
            visited.add(key)
            for prev_node, inc_edge in self.push_incoming.get(node, []):
                if edge_allowed and not edge_allowed(inc_edge):
                    continue
                if node_allowed and not node_allowed(prev_node):
                    continue
                new_history = (prev_node,) + history
                seeds.append(new_history)
                if len(seeds) >= self.max_history_seeds:
                    return seeds
                stack.append((prev_node, new_history, depth + 1))
        return seeds

    def _shortest_path_with_history(
        self,
        start: str,
        target: str,
        edge_allowed: Optional[Callable[[Dict[str, Any]], bool]] = None,
        node_allowed: Optional[Callable[[str], bool]] = None,
    ) -> Optional[Tuple[List[Tuple[str, Optional[Dict[str, Any]]]], Tuple[str, ...]]]:
        if node_allowed and (not node_allowed(start) or not node_allowed(target)):
            return None
        if start == target:
            return [(start, None)], ()
        start_histories = self._build_history_seeds(
            start,
            edge_allowed=edge_allowed,
            node_allowed=node_allowed,
        )
        start_states = [(start, history) for history in start_histories]
        queue = deque(start_states)
        prev: Dict[Tuple[str, Tuple[str, ...]], Tuple[Tuple[str, Tuple[str, ...]], Dict[str, Any]]] = {}
        visited = set(start_states)
        while queue:
            node, history = queue.popleft()
            if node == target:
                end_state = (node, history)
                break
            for neighbor, edge in self.adj.get(node, []):
                if edge_allowed and not edge_allowed(edge):
                    continue
                if node_allowed and not node_allowed(neighbor):
                    continue
                next_history = history
                # IMPORTANT: bound history length, otherwise state space can explode (infinite in cycles).
                # We treat `history_depth` as the max stack depth we model for implicit back traversal.
                if self.history_depth > 0 and self._is_push_edge(edge):
                    next_history = (history + (node,))[-self.history_depth :]
                next_state = (neighbor, next_history)
                if next_state in visited:
                    continue
                visited.add(next_state)
                prev[next_state] = ((node, history), edge)
                queue.append(next_state)
            if self.include_back_edges and history:
                back_target = history[-1]
                if node_allowed and not node_allowed(back_target):
                    continue
                back_edge = {
                    "id": "back",
                    "label": "返回",
                    "type": "back",
                    "source": node,
                    "target": back_target,
                    "sourceNodeId": node,
                    "targetNodeId": back_target,
                }
                next_state = (back_target, history[:-1])
                if next_state not in visited:
                    visited.add(next_state)
                    prev[next_state] = ((node, history), back_edge)
                    queue.append(next_state)
        else:
            return None
        path: List[Tuple[str, Optional[Dict[str, Any]]]] = [(end_state[0], None)]
        cur_state = end_state
        while cur_state in prev:
            prev_state, edge = prev[cur_state]
            path.append((prev_state[0], edge))
            cur_state = prev_state
        path.reverse()
        assumed_history = cur_state[1]
        return path, assumed_history

    def _render_path(
        self, path: List[Tuple[str, Optional[Dict[str, Any]]]]
    ) -> List[Dict[str, Any]]:
        steps: List[Dict[str, Any]] = []
        for idx, (node_id, edge) in enumerate(path):
            steps.append(self._node_step(node_id))
            if edge and idx < len(path) - 1:
                steps.append(
                    {
                        "type": "transition",
                        "id": edge.get("id") or edge.get("label"),
                        "label": edge.get("label") or edge.get("id"),
                        "edge": {
                            "source": edge.get("sourceNodeId") or edge.get("source"),
                            "target": edge.get("targetNodeId") or edge.get("target"),
                            "type": edge.get("type"),
                            "mode": edge.get("mode"),
                            # Key parameters for locating UI triggers (e.g. tab switch).
                            "search": edge.get("search"),
                            "searchParams": edge.get("searchParams"),
                            "params": edge.get("params"),
                            "availability": edge.get("availability"),
                            "availabilityNote": edge.get("availabilityNote"),
                            "notes": edge.get("notes"),
                            "when": edge.get("when"),
                            "uiCondition": edge.get("uiCondition"),
                            "conditionStatus": edge.get("conditionStatus"),
                            "needsPrompt": self._needs_prompt(edge),
                            "uiMeta": edge.get("uiMeta"),
                        },
                    }
                )
        return steps

    def _resolve_from(self, match: Match) -> Tuple[str, List[Dict[str, Any]]]:
        entity = match.entity
        if entity.type == "transition" and entity.edge:
            target = self._edge_endpoints(entity.edge)[1]
            prefix = [
                {
                    "type": "transition",
                    "id": entity.id,
                    "label": entity.label,
                    "edge": {
                        "source": self._edge_endpoints(entity.edge)[0],
                        "target": target,
                        "type": entity.edge.get("type"),
                        "mode": entity.edge.get("mode"),
                        "search": entity.edge.get("search"),
                        "searchParams": entity.edge.get("searchParams"),
                        "params": entity.edge.get("params"),
                        "availability": entity.edge.get("availability"),
                        "availabilityNote": entity.edge.get("availabilityNote"),
                        "notes": entity.edge.get("notes"),
                        "when": entity.edge.get("when"),
                        "uiCondition": entity.edge.get("uiCondition"),
                        "conditionStatus": entity.edge.get("conditionStatus"),
                        "needsPrompt": self._needs_prompt(entity.edge),
                        "uiMeta": entity.edge.get("uiMeta"),
                    },
                }
            ]
            return target or "", prefix
        if entity.type == "action":
            return entity.parent_node or "", [
                {"type": "action", "id": entity.id, "label": entity.label}
            ]
        if entity.type == "state":
            return entity.parent_node or "", [
                {"type": "state", "id": entity.id, "label": entity.label}
            ]
        return entity.id, []

    def _resolve_to(self, match: Match) -> Tuple[str, List[Dict[str, Any]]]:
        entity = match.entity
        if entity.type == "transition" and entity.edge:
            source, target = self._edge_endpoints(entity.edge)
            suffix = [
                {
                    "type": "transition",
                    "id": entity.id,
                    "label": entity.label,
                    "edge": {
                        "source": source,
                        "target": target,
                        "type": entity.edge.get("type"),
                        "mode": entity.edge.get("mode"),
                        "search": entity.edge.get("search"),
                        "searchParams": entity.edge.get("searchParams"),
                        "params": entity.edge.get("params"),
                        "availability": entity.edge.get("availability"),
                        "availabilityNote": entity.edge.get("availabilityNote"),
                        "notes": entity.edge.get("notes"),
                        "when": entity.edge.get("when"),
                        "uiCondition": entity.edge.get("uiCondition"),
                        "conditionStatus": entity.edge.get("conditionStatus"),
                        "needsPrompt": self._needs_prompt(entity.edge),
                        "uiMeta": entity.edge.get("uiMeta"),
                    },
                }
            ]
            if target:
                suffix.append(self._node_step(target))
            return source or "", suffix
        if entity.type == "action":
            return entity.parent_node or "", [
                {"type": "action", "id": entity.id, "label": entity.label}
            ]
        if entity.type == "state":
            return entity.parent_node or "", [
                {"type": "state", "id": entity.id, "label": entity.label}
            ]
        return entity.id, []

    def find_paths(
        self,
        query_from: str,
        query_to: str,
        max_candidates: int = 5,
        max_paths: int = 5,
        types_from: Optional[Iterable[str]] = None,
        types_to: Optional[Iterable[str]] = None,
    ) -> Dict[str, Any]:
        if types_from is None:
            types_from = ["node"]
        from_matches = self.search_entities(
            query_from, types=types_from, limit=max_candidates
        )
        to_matches = self.search_entities(
            query_to, types=types_to, limit=max_candidates
        )
        # Keyed by (start_node_id, end_node_id). For each distinct endpoint pair,
        # keep only the shortest valid path. This matches agent usage better:
        # "all keyword-matching endpoints, each with its shortest path".
        best_by_endpoints: Dict[Tuple[str, str], Dict[str, Any]] = {}
        for from_match in from_matches:
            start_node, prefix = self._resolve_from(from_match)
            if not start_node:
                continue
            for to_match in to_matches:
                target_node, suffix = self._resolve_to(to_match)
                if not target_node:
                    continue
                path_result = self._shortest_path_with_history(start_node, target_node)
                if not path_result:
                    continue
                path, assumed_history = path_result
                steps = prefix + self._render_path(path) + suffix
                start_step = next((s for s in steps if s.get("type") == "node"), None)
                end_step = next((s for s in reversed(steps) if s.get("type") == "node"), None)
                endpoints = (
                    (start_step.get("id") if start_step else "") or start_node,
                    (end_step.get("id") if end_step else "") or target_node,
                )
                conditional_edges = [
                    s
                    for s in steps
                    if s.get("type") == "transition"
                    and isinstance(s.get("edge"), dict)
                    and s["edge"].get("availability") is not None
                ]
                prompt_edges = [
                    s
                    for s in steps
                    if s.get("type") == "transition"
                    and isinstance(s.get("edge"), dict)
                    and (s["edge"].get("uiCondition") is not None or s["edge"].get("conditionStatus") is not None)
                ]
                prompt_nodes = [
                    s
                    for s in steps
                    if s.get("type") == "node"
                    and isinstance(s.get("node"), dict)
                    and (
                        s["node"].get("stateCondition") is not None
                        or s["node"].get("conditionStatus") is not None
                        or bool(s["node"].get("needsPrompt"))
                    )
                ]
                item = {
                    "from": {
                        "query": query_from,
                        "match": {
                            "id": from_match.entity.id,
                            "type": from_match.entity.type,
                            "label": from_match.entity.label,
                            "score": from_match.score,
                        },
                    },
                    "to": {
                        "query": query_to,
                        "match": {
                            "id": to_match.entity.id,
                            "type": to_match.entity.type,
                            "label": to_match.entity.label,
                            "score": to_match.score,
                        },
                    },
                    "startNodeId": endpoints[0],
                    "endNodeId": endpoints[1],
                    "steps": steps,
                    "length": len([s for s in steps if s["type"] == "transition"]),
                    "assumedHistory": list(assumed_history),
                    # Naming alignment:
                    # - availability edges are NOT "condition" edges; they mean "not always available"
                    "hasAvailabilityEdges": len(conditional_edges) > 0,
                    "availabilityEdges": [
                        {
                            "id": ce.get("id"),
                            "label": ce.get("label"),
                            "edge": ce.get("edge"),
                        }
                        for ce in conditional_edges
                    ],
                    # Need-prompt edges: uiCondition / conditionStatus
                    "hasPromptEdges": len(prompt_edges) > 0,
                    "promptEdges": [
                        {
                            "id": pe.get("id"),
                            "label": pe.get("label"),
                            "edge": pe.get("edge"),
                        }
                        for pe in prompt_edges
                    ],
                    # Need-prompt nodes: stateCondition / conditionStatus
                    "hasPromptNodes": len(prompt_nodes) > 0,
                    "promptNodes": [
                        {"id": pn.get("id"), "label": pn.get("label"), "node": pn.get("node")}
                        for pn in prompt_nodes
                    ],
                    "fallback": None,
                }
                existing = best_by_endpoints.get(endpoints)
                if existing is None:
                    best_by_endpoints[endpoints] = item
                    continue
                # Prefer shorter path; then higher match scores; then fewer steps.
                if item["length"] < existing["length"]:
                    best_by_endpoints[endpoints] = item
                    continue
                if item["length"] > existing["length"]:
                    continue
                new_score = item["from"]["match"]["score"] + item["to"]["match"]["score"]
                old_score = existing["from"]["match"]["score"] + existing["to"]["match"]["score"]
                if new_score > old_score:
                    best_by_endpoints[endpoints] = item
                    continue
                if new_score < old_score:
                    continue
                if len(item["steps"]) < len(existing["steps"]):
                    best_by_endpoints[endpoints] = item

        results = list(best_by_endpoints.values())
        # For any path that uses availability edges, compute an additional shortest path
        # that avoids all edges with `availability`.
        def always_available(edge: Dict[str, Any]) -> bool:
            return not self._has_availability(edge)

        for item in results:
            if not item.get("hasAvailabilityEdges"):
                continue
            start_id = item.get("startNodeId") or ""
            end_id = item.get("endNodeId") or ""
            if not start_id or not end_id:
                continue
            fallback_result = self._shortest_path_with_history(
                start_id, end_id, edge_allowed=always_available
            )
            if not fallback_result:
                item["fallback"] = None
                continue
            fb_path, fb_history = fallback_result
            fb_steps = self._render_path(fb_path)

            # If the original target was action/state, keep that terminal info in fallback.
            to_match_type = item.get("to", {}).get("match", {}).get("type")
            if to_match_type == "action":
                last_action = next(
                    (s for s in reversed(item["steps"]) if s.get("type") == "action"),
                    None,
                )
                if last_action:
                    fb_steps = fb_steps + [last_action]
            elif to_match_type == "state":
                last_state = next(
                    (s for s in reversed(item["steps"]) if s.get("type") == "state"),
                    None,
                )
                if last_state:
                    fb_steps = fb_steps + [last_state]

            # Avoid duplicate output when the fallback equals the main path.
            sig_main = " -> ".join(f"{s['type']}:{s.get('id','')}" for s in item["steps"])
            sig_fb = " -> ".join(f"{s['type']}:{s.get('id','')}" for s in fb_steps)
            if sig_fb == sig_main:
                item["fallback"] = None
                continue

            item["fallback"] = {
                "steps": fb_steps,
                "length": len([s for s in fb_steps if s["type"] == "transition"]),
                "assumedHistory": list(fb_history),
            }

        # For any path that uses prompt edges/nodes, compute an additional shortest path
        # that avoids ALL prompt edges (uiCondition/conditionStatus) and prompt nodes (stateCondition/conditionStatus).
        def prompt_free_edge(edge: Dict[str, Any]) -> bool:
            return not self._needs_prompt(edge)

        def prompt_free_node(node_id: str) -> bool:
            node = self.nodes.get(node_id, {"id": node_id})
            return not self._node_needs_prompt(node)

        for item in results:
            if not (item.get("hasPromptEdges") or item.get("hasPromptNodes")):
                item["fallbackNoPrompt"] = None
                continue
            start_id = item.get("startNodeId") or ""
            end_id = item.get("endNodeId") or ""
            if not start_id or not end_id:
                item["fallbackNoPrompt"] = None
                continue

            fallback_result = self._shortest_path_with_history(
                start_id,
                end_id,
                edge_allowed=prompt_free_edge,
                node_allowed=prompt_free_node,
            )
            if fallback_result:
                fb_path, fb_history = fallback_result
                fb_steps = self._render_path(fb_path)

                # If the original target was action/state, keep that terminal info in fallback.
                to_match_type = item.get("to", {}).get("match", {}).get("type")
                if to_match_type == "action":
                    last_action = next(
                        (s for s in reversed(item["steps"]) if s.get("type") == "action"),
                        None,
                    )
                    if last_action:
                        fb_steps = fb_steps + [last_action]
                elif to_match_type == "state":
                    last_state = next(
                        (s for s in reversed(item["steps"]) if s.get("type") == "state"),
                        None,
                    )
                    if last_state:
                        fb_steps = fb_steps + [last_state]

                # Avoid duplicate output when the fallback equals the main path.
                sig_main = " -> ".join(f"{s['type']}:{s.get('id','')}" for s in item["steps"])
                sig_fb = " -> ".join(f"{s['type']}:{s.get('id','')}" for s in fb_steps)
                if sig_fb == sig_main:
                    item["fallbackNoPrompt"] = None
                else:
                    item["fallbackNoPrompt"] = {
                        "steps": fb_steps,
                        "length": len([s for s in fb_steps if s["type"] == "transition"]),
                        "assumedHistory": list(fb_history),
                    }
            else:
                item["fallbackNoPrompt"] = None

        # Add a readable natural-language narrative for each path/fallback.
        for item in results:
            item["narrative"] = _steps_to_narrative(item.get("steps", []))
            fallback = item.get("fallback")
            if isinstance(fallback, dict):
                fallback["narrative"] = _steps_to_narrative(fallback.get("steps", []))
            fallback_np = item.get("fallbackNoPrompt")
            if isinstance(fallback_np, dict):
                fallback_np["narrative"] = _steps_to_narrative(fallback_np.get("steps", []))
        results.sort(
            key=lambda r: (
                r["length"],
                -r["from"]["match"]["score"],
                -r["to"]["match"]["score"],
                len(r["steps"]),
            )
        )
        return {
            "summary": {
                "fromQuery": query_from,
                "toQuery": query_to,
                "pathsCount": min(len(results), max_paths),
                "fromCandidatesCount": len(from_matches),
                "toCandidatesCount": len(to_matches),
            },
            "fromCandidates": [
                {
                    "id": m.entity.id,
                    "type": m.entity.type,
                    "label": m.entity.label,
                    "score": m.score,
                }
                for m in from_matches
            ],
            "toCandidates": [
                {
                    "id": m.entity.id,
                    "type": m.entity.type,
                    "label": m.entity.label,
                    "score": m.score,
                }
                for m in to_matches
            ],
            "paths": results[:max_paths],
        }


def _parse_types(value: Optional[str]) -> Optional[List[str]]:
    if not value:
        return None
    return [t.strip() for t in value.split(",") if t.strip()]


def main() -> None:
    parser = argparse.ArgumentParser(description="Find shortest paths in nav graph")
    parser.add_argument("--graph", required=True, help="Path to nav graph json")
    parser.add_argument("--from", dest="from_query", required=True, help="Start query")
    parser.add_argument("--to", dest="to_query", required=True, help="Target query")
    parser.add_argument("--max-candidates", type=int, default=20)
    parser.add_argument("--max-paths", type=int, default=20)
    parser.add_argument("--json", action="store_true", help="Output JSON format")
    parser.add_argument("--no-back", action="store_true", help="Disable implicit back edges")
    parser.add_argument(
        "--assume-push",
        action="store_true",
        help="When edge mode missing, assume push and add back edges",
    )
    parser.add_argument(
        "--history-depth",
        type=int,
        default=10,
        help="Max implicit history depth for back traversal (default: 4)",
    )
    parser.add_argument(
        "--max-history-seeds",
        type=int,
        default=50,
        help="Limit initial history seed count (default: 50)",
    )
    parser.add_argument(
        "--from-types",
        default=None,
        help="Comma types: node,state,action,transition (default: node)",
    )
    parser.add_argument("--to-types", default=None, help="Comma types: node,state,action,transition")
    args = parser.parse_args()

    with open(args.graph, "r", encoding="utf-8") as f:
        graph = json.load(f)

    finder = NavGraphPathFinder(
        graph,
        include_back_edges=not args.no_back,
        assume_push_when_mode_missing=args.assume_push,
        history_depth=args.history_depth,
        max_history_seeds=args.max_history_seeds,
    )
    result = finder.find_paths(
        query_from=args.from_query,
        query_to=args.to_query,
        max_candidates=args.max_candidates,
        max_paths=args.max_paths,
        types_from=_parse_types(args.from_types),
        types_to=_parse_types(args.to_types),
    )
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    paths = result.get("paths", [])
    print(f"paths: {len(paths)}")
    for idx, path in enumerate(paths, start=1):
        steps = path.get("steps", [])
        start_node = next((s for s in steps if s.get("type") == "node"), None)
        end_node = next((s for s in reversed(steps) if s.get("type") == "node"), None)
        start_label = start_node.get("label") if start_node else ""
        end_label = end_node.get("label") if end_node else ""
        print(f"\n[{idx}] {start_label} -> {end_label}")
        for step in steps:
            if step.get("type") == "node":
                node_meta = step.get("node") if isinstance(step.get("node"), dict) else {}
                needs_prompt = bool(node_meta.get("needsPrompt")) or node_meta.get("stateCondition") is not None or node_meta.get("conditionStatus") is not None
                prefix = "  node(!prompt): " if needs_prompt else "  node: "
                print(prefix + f"{step.get('id')} | {step.get('label')}")
                if needs_prompt:
                    if node_meta.get("stateCondition") is not None:
                        print(f"    stateCondition: {node_meta.get('stateCondition')}")
                    if node_meta.get("conditionStatus") is not None:
                        print(f"    conditionStatus: {node_meta.get('conditionStatus')}")
            elif step.get("type") == "transition":
                edge = step.get("edge", {})
                availability = edge.get("availability")
                needs_prompt = bool(edge.get("needsPrompt")) or edge.get("uiCondition") is not None or edge.get("conditionStatus") is not None
                if availability is not None and needs_prompt:
                    prefix = "  transition(!availability,!prompt): "
                elif availability is not None:
                    prefix = "  transition(!availability): "
                elif needs_prompt:
                    prefix = "  transition(!prompt): "
                else:
                    prefix = "  transition: "
                print(
                    prefix
                    + f"{step.get('id')} | {step.get('label')} | "
                    + f"{edge.get('source')} -> {edge.get('target')} | "
                    + f"{edge.get('type')}"
                )
                # Important: expose key params for locating UI elements (e.g. tab=total).
                if isinstance(edge.get("search"), dict) and edge.get("search"):
                    print(f"    search: {json.dumps(edge.get('search'), ensure_ascii=False)}")
                if isinstance(edge.get("params"), dict) and edge.get("params"):
                    print(f"    params: {json.dumps(edge.get('params'), ensure_ascii=False)}")
                if availability is not None:
                    print(f"    availability: {availability}")
                    if edge.get("availabilityNote"):
                        print(f"    availabilityNote: {edge.get('availabilityNote')}")
                    if edge.get("notes"):
                        print(f"    notes: {edge.get('notes')}")
                if needs_prompt:
                    if edge.get("uiCondition") is not None:
                        print(f"    uiCondition: {edge.get('uiCondition')}")
                    if edge.get("conditionStatus") is not None:
                        print(f"    conditionStatus: {edge.get('conditionStatus')}")
            elif step.get("type") == "action":
                print(f"  action: {step.get('id')} | {step.get('label')}")
            elif step.get("type") == "state":
                print(f"  state: {step.get('id')} | {step.get('label')}")

        narrative = path.get("narrative")
        if narrative:
            print(f"\n  自然语言: {narrative}")

        if path.get("hasAvailabilityEdges"):
            fallback = path.get("fallback")
            if fallback is None:
                print("\n  fallback(no availability edges): <not found>")
            else:
                fb_steps = fallback.get("steps", [])
                fb_start = next((s for s in fb_steps if s.get("type") == "node"), None)
                fb_end = next((s for s in reversed(fb_steps) if s.get("type") == "node"), None)
                fb_start_label = fb_start.get("label") if fb_start else ""
                fb_end_label = fb_end.get("label") if fb_end else ""
                print(f"\n  fallback(no availability edges): {fb_start_label} -> {fb_end_label}")
                for step in fb_steps:
                    if step.get("type") == "node":
                        node_meta = step.get("node") if isinstance(step.get("node"), dict) else {}
                        needs_prompt = bool(node_meta.get("needsPrompt")) or node_meta.get("stateCondition") is not None or node_meta.get("conditionStatus") is not None
                        prefix = "    node(!prompt): " if needs_prompt else "    node: "
                        print(prefix + f"{step.get('id')} | {step.get('label')}")
                        if needs_prompt:
                            if node_meta.get("stateCondition") is not None:
                                print(f"      stateCondition: {node_meta.get('stateCondition')}")
                            if node_meta.get("conditionStatus") is not None:
                                print(f"      conditionStatus: {node_meta.get('conditionStatus')}")
                    elif step.get("type") == "transition":
                        edge = step.get("edge", {})
                        print(
                            "    transition: "
                            f"{step.get('id')} | {step.get('label')} | "
                            f"{edge.get('source')} -> {edge.get('target')} | "
                            f"{edge.get('type')}"
                        )
                    elif step.get("type") == "action":
                        print(f"    action: {step.get('id')} | {step.get('label')}")
                    elif step.get("type") == "state":
                        print(f"    state: {step.get('id')} | {step.get('label')}")

                fb_narrative = fallback.get("narrative")
                if fb_narrative:
                    print(f"\n    自然语言: {fb_narrative}")

        if path.get("hasPromptEdges") or path.get("hasPromptNodes"):
            fallback = path.get("fallbackNoPrompt")
            if fallback is None:
                print("\n  fallback(no prompt edges/nodes): <not found>")
            else:
                fb_steps = fallback.get("steps", [])
                fb_start = next((s for s in fb_steps if s.get("type") == "node"), None)
                fb_end = next((s for s in reversed(fb_steps) if s.get("type") == "node"), None)
                fb_start_label = fb_start.get("label") if fb_start else ""
                fb_end_label = fb_end.get("label") if fb_end else ""
                print(f"\n  fallback(no prompt edges/nodes): {fb_start_label} -> {fb_end_label}")
                for step in fb_steps:
                    if step.get("type") == "node":
                        node_meta = step.get("node") if isinstance(step.get("node"), dict) else {}
                        needs_prompt = bool(node_meta.get("needsPrompt")) or node_meta.get("stateCondition") is not None or node_meta.get("conditionStatus") is not None
                        prefix = "    node(!prompt): " if needs_prompt else "    node: "
                        print(prefix + f"{step.get('id')} | {step.get('label')}")
                    elif step.get("type") == "transition":
                        edge = step.get("edge", {})
                        needs_prompt = bool(edge.get("needsPrompt")) or edge.get("uiCondition") is not None or edge.get("conditionStatus") is not None
                        prefix = "    transition(!prompt): " if needs_prompt else "    transition: "
                        print(
                            prefix
                            + f"{step.get('id')} | {step.get('label')} | "
                            + f"{edge.get('source')} -> {edge.get('target')} | "
                            + f"{edge.get('type')}"
                        )
                    elif step.get("type") == "action":
                        print(f"    action: {step.get('id')} | {step.get('label')}")
                    elif step.get("type") == "state":
                        print(f"    state: {step.get('id')} | {step.get('label')}")

                fb_narrative = fallback.get("narrative")
                if fb_narrative:
                    print(f"\n    自然语言: {fb_narrative}")


if __name__ == "__main__":
    main()
