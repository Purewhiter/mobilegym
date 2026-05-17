from __future__ import annotations

import ast
import tokenize
from io import BytesIO
from pathlib import Path


TASK_ROOT = Path(__file__).resolve().parents[2] / "task"
IGNORED_TOKEN_TYPES = {
    tokenize.NL,
    tokenize.NEWLINE,
    tokenize.COMMENT,
    tokenize.INDENT,
    tokenize.DEDENT,
}


def _task_definition_paths() -> list[Path]:
    paths = list(TASK_ROOT.rglob("tasks.py"))
    paths.extend(
        p
        for p in TASK_ROOT.rglob("defs/*.py")
        if not p.name.startswith("_")
    )
    return sorted(paths)


def _find_implicit_concatenated_templates() -> list[str]:
    issues: list[str] = []

    for path in _task_definition_paths():
        tokens = list(tokenize.tokenize(BytesIO(path.read_bytes()).readline))
        in_templates = False
        pending_templates = False
        bracket_depth = 0
        previous_string: tokenize.TokenInfo | None = None

        for token in tokens:
            if token.type == tokenize.NAME and token.string == "templates":
                pending_templates = True
                previous_string = None
                continue

            if pending_templates and token.type == tokenize.OP and token.string == "=":
                continue

            if pending_templates and token.type == tokenize.OP and token.string == "[":
                in_templates = True
                pending_templates = False
                bracket_depth = 1
                previous_string = None
                continue

            if pending_templates and token.type not in IGNORED_TOKEN_TYPES:
                pending_templates = False

            if not in_templates:
                continue

            if token.type == tokenize.OP:
                if token.string == "[":
                    bracket_depth += 1
                elif token.string == "]":
                    bracket_depth -= 1
                    if bracket_depth == 0:
                        in_templates = False
                        previous_string = None
                        continue
                elif token.string == ",":
                    previous_string = None
                    continue

            if token.type == tokenize.STRING:
                if previous_string is not None:
                    issues.append(
                        f"{path.relative_to(TASK_ROOT.parent)}:"
                        f"{previous_string.start[0]}-{token.start[0]}"
                    )
                previous_string = token
            elif token.type not in IGNORED_TOKEN_TYPES:
                previous_string = None

    return issues


def _find_forbidden_template_terms() -> list[str]:
    issues: list[str] = []
    forbidden_terms = {
        "Xiaohongshu": "RedNote",
    }

    for path in _task_definition_paths():
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))

        for node in ast.walk(tree):
            if not isinstance(node, ast.Assign):
                continue
            if not any(isinstance(target, ast.Name) and target.id == "templates" for target in node.targets):
                continue
            if not isinstance(node.value, ast.List):
                continue

            for index, elt in enumerate(node.value.elts):
                if not isinstance(elt, ast.Constant) or not isinstance(elt.value, str):
                    continue
                text = elt.value
                for forbidden, replacement in forbidden_terms.items():
                    if forbidden in text:
                        issues.append(
                            f"{path.relative_to(TASK_ROOT.parent)}:{elt.lineno} "
                            f"templates[{index}] contains '{forbidden}', use '{replacement}'"
                        )

    return issues


def test_templates_do_not_use_implicit_string_concatenation() -> None:
    issues = _find_implicit_concatenated_templates()
    assert not issues, "templates 中存在隐式字符串拼接:\n" + "\n".join(issues)


def test_templates_do_not_use_deprecated_app_names() -> None:
    issues = _find_forbidden_template_terms()
    assert not issues, "templates 中存在过时的应用英文名:\n" + "\n".join(issues)
