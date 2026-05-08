"""
Trajectory recording utilities.

分层设计：
- RunRecorder: 管理整个 run（线程安全）
- EpisodeRecorder: 管理单个 episode（每个任务独立实例）
"""

from __future__ import annotations

import base64
import io
import json
import logging
import math
import threading
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, Optional, Tuple

if TYPE_CHECKING:
    from bench_env.env.base import Action, Observation

from PIL import Image, ImageDraw, ImageFont

from bench_env.env.base import ActionType

logger = logging.getLogger(__name__)


def _safe_json_dump(obj: Any, indent: int = 2) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=indent, default=str)


def allocate_run_dir(runs_root: Path, timestamp: str) -> Path:
    """为同秒启动的多个 run 分配唯一目录。"""
    candidate = runs_root / timestamp
    if not candidate.exists():
        return candidate
    suffix = 1
    while True:
        candidate = runs_root / f"{timestamp}_{suffix:02d}"
        if not candidate.exists():
            return candidate
        suffix += 1


def _strip_image_data_from_messages(messages: list) -> list:
    """
    移除 messages 中的图片 base64 数据，替换为占位符。

    路径级结构拷贝（msg -> content[] -> item -> image_url），不原地修改
    传入的 messages（避免污染 agent.history 里共享的 llm_prompt 引用）。
    """
    result: list = []
    for msg in messages:
        msg = dict(msg)
        content = msg.get("content")
        if isinstance(content, list):
            new_content: list = []
            for item in content:
                if not isinstance(item, dict):
                    new_content.append(item)
                    continue
                item = dict(item)
                if item.get("type") == "image_url":
                    image_url = item.get("image_url")
                    if isinstance(image_url, dict):
                        image_url = dict(image_url)
                        url = image_url.get("url", "")
                        if url.startswith("data:image"):
                            image_url["url"] = "[IMAGE_DATA_STRIPPED]"
                        item["image_url"] = image_url
                elif item.get("type") == "image":
                    if "data" in item:
                        item["data"] = "[IMAGE_DATA_STRIPPED]"
                new_content.append(item)
            msg["content"] = new_content
        result.append(msg)
    return result


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _to_px_from_norm_0_1000(x: float, y: float, *, w: int, h: int) -> Tuple[float, float]:
    px = float(x) / 1000.0 * float(w)
    py = float(y) / 1000.0 * float(h)
    return _clamp(px, 0.0, float(max(0, w - 1))), _clamp(py, 0.0, float(max(0, h - 1)))


def _to_px_from_norm_0_1(x: float, y: float, *, w: int, h: int) -> Tuple[float, float]:
    px = float(x) * float(w)
    py = float(y) * float(h)
    return _clamp(px, 0.0, float(max(0, w - 1))), _clamp(py, 0.0, float(max(0, h - 1)))


def _load_font(size: int = 22):
    try:
        return ImageFont.load_default()
    except Exception:
        return None


def _annotate_image_bytes(
    *, img_bytes: bytes, action_type: str, action_data: dict[str, Any], coord_space: str, title: str,
) -> Optional[bytes]:
    """Annotate screenshot with action visualization."""
    try:
        # NOTE: Always work in RGBA so semi-transparent fills don't become opaque
        # black on RGB screenshots.
        img = Image.open(io.BytesIO(img_bytes)).convert("RGBA")
    except Exception:
        return None

    w, h = img.size
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    r = max(8, int(min(w, h) * 0.012))
    line_w = max(4, int(min(w, h) * 0.004))
    color_click = (255, 59, 48)
    color_slide = (10, 132, 255)
    color_text_bg = (0, 0, 0, 140)
    color_text = (255, 255, 255, 230)
    color_text_stroke = (0, 0, 0, 200)

    def _text_bbox(x: int, y: int, text: str, font_obj):
        """Return (l,t,r,b) bbox for text at x,y."""
        try:
            # PIL>=8
            return draw.textbbox((x, y), text, font=font_obj)
        except Exception:
            try:
                tw, th = draw.textsize(text, font=font_obj)  # type: ignore[attr-defined]
                return (x, y, x + int(tw), y + int(th))
            except Exception:
                # Very defensive fallback
                tw = max(1, int(len(text) * 10))
                th = 16
                return (x, y, x + tw, y + th)

    def _draw_label(
        *,
        x: float,
        y: float,
        text: str,
        fill: tuple[int, int, int],
        font_obj,
        anchor: str = "lt",
        padding: int = 6,
    ) -> None:
        """
        Draw a small pill label near (x,y).
        anchor: 'lt' (left-top) or 'lb' or 'rt' or 'rb'
        """
        if not text:
            return
        tx, ty = int(round(x)), int(round(y))
        # Initial bbox at (0,0) to compute size.
        l0, t0, r0, b0 = _text_bbox(0, 0, text, font_obj)
        tw, th = (r0 - l0), (b0 - t0)
        bw, bh = tw + padding * 2, th + padding * 2
        if anchor == "lt":
            bx, by = tx, ty
        elif anchor == "lb":
            bx, by = tx, ty - bh
        elif anchor == "rt":
            bx, by = tx - bw, ty
        else:  # rb
            bx, by = tx - bw, ty - bh
        # Clamp into view.
        bx = int(_clamp(bx, 2, max(2, w - bw - 2)))
        by = int(_clamp(by, 2, max(2, h - bh - 2)))
        radius = max(8, int(min(bw, bh) * 0.25))
        try:
            draw.rounded_rectangle((bx, by, bx + bw, by + bh), radius=radius, fill=color_text_bg)
        except Exception:
            draw.rectangle((bx, by, bx + bw, by + bh), fill=color_text_bg)
        # Text
        try:
            draw.text(
                (bx + padding, by + padding),
                text,
                fill=fill,
                font=font_obj,
                stroke_width=2,
                stroke_fill=color_text_stroke,
            )
        except Exception:
            try:
                draw.text((bx + padding, by + padding), text, fill=fill, font=font_obj)
            except Exception as e:
                logger.debug(f"Failed to draw label text: {type(e).__name__}: {e}")

    def to_px(pt: Any) -> Optional[Tuple[float, float]]:
        if pt is None:
            return None
        try:
            if isinstance(pt, (list, tuple)) and len(pt) >= 2:
                x, y = float(pt[0]), float(pt[1])
            elif isinstance(pt, dict) and "x" in pt and "y" in pt:
                x, y = float(pt["x"]), float(pt["y"])
            elif isinstance(pt, str) and "," in pt:
                a, b = pt.split(",", 1)
                x, y = float(a.strip()), float(b.strip())
            else:
                return None
        except Exception:
            return None
        # coord_space 统一约定：
        # - norm_0_1000: 0..1000
        # - norm_0_1:    0..1
        # - physical:    物理像素（w/h）
        if coord_space == "physical":
            return _clamp(x, 0.0, float(w - 1)), _clamp(y, 0.0, float(h - 1))
        if coord_space == "norm_0_1":
            return _to_px_from_norm_0_1(x, y, w=w, h=h)
        return _to_px_from_norm_0_1000(x, y, w=w, h=h)

    t_str = (action_type or "").strip().upper()
    label_text = t_str
    
    # Convert string to ActionType for comparison
    try:
        t = ActionType(t_str)
    except ValueError:
        logger.warning(f"Unknown action_type '{action_type}' in screenshot annotation, skipping annotation")
        t = None

    if t in {ActionType.CLICK, ActionType.LONG_PRESS, ActionType.DOUBLE_TAP}:
        p = to_px(action_data.get("point"))
        if p:
            x, y = p
            draw.ellipse((x - r, y - r, x + r, y + r), outline=color_click, width=line_w)
            draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill=color_click)
            font = _load_font()
            _draw_label(
                x=x + r + 8,
                y=y - r - 8,
                text=label_text,
                fill=color_text,
                font_obj=font,
                anchor="lt",
                padding=5,
            )

    elif t == ActionType.SWIPE:
        p1, p2 = to_px(action_data.get("point1")), to_px(action_data.get("point2"))
        if p1 and p2:
            x1, y1 = p1
            x2, y2 = p2
            draw.line((x1, y1, x2, y2), fill=color_slide, width=line_w)
            ang = math.atan2(y2 - y1, x2 - x1)
            ah = max(14, int(r * 1.6))
            a1, a2 = ang + math.radians(150), ang - math.radians(150)
            pA = (x2 + ah * math.cos(a1), y2 + ah * math.sin(a1))
            pB = (x2 + ah * math.cos(a2), y2 + ah * math.sin(a2))
            draw.polygon([pA, (x2, y2), pB], fill=color_slide)
            draw.ellipse((x1 - r, y1 - r, x1 + r, y1 + r), outline=color_slide, width=line_w)
            font = _load_font()
            _draw_label(
                x=x2 + 10,
                y=y2 + 10,
                text=label_text,
                fill=color_text,
                font_obj=font,
                anchor="lt",
                padding=5,
            )

    elif t == ActionType.TYPE:
        p = to_px(action_data.get("point"))
        if p:
            x, y = p
            draw.rectangle((x - r, y - r, x + r, y + r), outline=color_click, width=line_w)
            font = _load_font()
            _draw_label(
                x=x + r + 8,
                y=y - r - 8,
                text=label_text,
                fill=color_text,
                font_obj=font,
                anchor="lt",
                padding=5,
            )

    font = _load_font()
    if title.strip():
        # Small corner tag instead of a full-width black bar.
        _draw_label(
            x=10,
            y=10,
            text=title[:200],
            fill=color_text,
            font_obj=font,
            anchor="lt",
            padding=6,
        )

    out = io.BytesIO()
    try:
        composed = Image.alpha_composite(img, overlay).convert("RGB")
        composed.save(out, format="JPEG", quality=85)
        return out.getvalue()
    except Exception:
        return None


@dataclass
class TrajectoryStep:
    step: int
    route: dict[str, Any]
    action_type: str
    action_data: dict[str, Any]
    thought: str
    explain: str
    summary: str
    screenshot: str
    screenshot_annotated: Optional[str]
    model_response_path: Optional[str]
    model_prompt_path: Optional[str] = None  # 完整的 prompt 文件路径


# ==================== EpisodeRecorder ====================

class EpisodeRecorder:
    """
    记录单个 episode 的轨迹（线程独立）。
    
    每个 episode 有独立的 EpisodeRecorder 实例，互不干扰。
    """

    def __init__(
        self,
        run_recorder: "RunRecorder",
        task_id: str,
        task_name: str,
        episode_dir: Optional[Path],
    ):
        self._run_recorder = run_recorder
        self.task_id = task_id
        self.task_name = task_name
        self._episode_dir = episode_dir
        self._steps: list[TrajectoryStep] = []
        self._start_time = datetime.now()

    def record_step(
        self,
        *,
        step_idx: int,
        obs: "Observation",
        action: "Action",
        route: dict[str, Any],
        model_response: str = "",
        model_prompt: Optional[list] = None,
    ) -> None:
        """记录单步"""
        if self._episode_dir is None:
            return

        cfg = self._run_recorder
        img_bytes = b""
        shot_name = ""

        if cfg.save_screenshots:
            img_bytes = obs.get_screenshot_bytes()
            if img_bytes:
                img_ext = "jpg" if img_bytes[:2] == b"\xff\xd8" else "png"
                shot_name = f"step_{step_idx:03d}.{img_ext}"
                scale = cfg.screenshot_scale
                if scale and scale != 1.0:
                    try:
                        img = Image.open(io.BytesIO(img_bytes))
                        new_size = (int(img.width * scale), int(img.height * scale))
                        img = img.resize(new_size, Image.Resampling.LANCZOS)
                        buf = io.BytesIO()
                        img.save(buf, format="JPEG", quality=80)
                        img_bytes = buf.getvalue()
                        shot_name = f"step_{step_idx:03d}.jpg"
                    except Exception as e:
                        logger.debug(f"Screenshot resize failed, using original: {type(e).__name__}: {e}")
                (self._episode_dir / shot_name).write_bytes(img_bytes)

        resp_path: Optional[str] = None
        if cfg.save_model_response and model_response:
            resp_name = f"step_{step_idx:03d}_response.txt"
            (self._episode_dir / resp_name).write_text(str(model_response), encoding="utf-8")
            resp_path = resp_name

        # 保存完整的 prompt
        prompt_path: Optional[str] = None
        if cfg.save_model_response and model_prompt:
            prompt_name = f"step_{step_idx:03d}_prompt.json"
            # 将 prompt 中的图片数据替换为占位符，避免文件过大
            prompt_for_save = _strip_image_data_from_messages(model_prompt)
            (self._episode_dir / prompt_name).write_text(
                _safe_json_dump(prompt_for_save), encoding="utf-8"
            )
            prompt_path = prompt_name

        ann_name: Optional[str] = None
        if cfg.annotate and img_bytes:
            title = f"step {step_idx} | {action.action_type.value}"
            ann_bytes = _annotate_image_bytes(
                img_bytes=img_bytes,
                action_type=action.action_type,
                action_data=action.data,
                coord_space=cfg.coord_space,
                title=title,
            )
            if ann_bytes:
                ann_name = f"step_{step_idx:03d}_annot.jpg"
                (self._episode_dir / ann_name).write_bytes(ann_bytes)

        rec = TrajectoryStep(
            step=step_idx,
            route=dict(route or {}),
            action_type=action.action_type,
            action_data=action.data,
            thought=action.thought or "",
            explain=action.explain or "",
            summary=action.summary or "",
            screenshot=shot_name if cfg.save_screenshots else "",
            screenshot_annotated=ann_name,
            model_response_path=resp_path,
            model_prompt_path=prompt_path,
        )
        self._steps.append(rec)
        # 不再每步都写，改为 finish 时一次性写入

    def _flush_trajectory(self) -> None:
        """一次性写入 trajectory.json（在 finish 时调用）"""
        if self._episode_dir is None:
            return
        payload = [
            {
                "step": s.step, "route": s.route, "action_type": s.action_type,
                "action_data": s.action_data, "thought": s.thought, "explain": s.explain,
                "summary": s.summary, "screenshot": s.screenshot,
                "screenshot_annotated": s.screenshot_annotated,
                "model_response_path": s.model_response_path,
                "model_prompt_path": s.model_prompt_path,
            }
            for s in self._steps
        ]
        (self._episode_dir / "trajectory.json").write_text(_safe_json_dump(payload), encoding="utf-8")

    def get_trajectory_for_vlm(self) -> list[dict[str, Any]]:
        """
        获取用于 VLM 评估的轨迹数据。
        
        Returns:
            List of trajectory steps with screenshot base64 data.
        """
        result = []
        for step in self._steps:
            data: dict[str, Any] = {
                "step": step.step,
                "action_type": step.action_type.value if hasattr(step.action_type, 'value') else str(step.action_type),
                "action_data": step.action_data,
                "thought": step.thought,
            }
            # 读取已保存的截图并转为 base64
            if step.screenshot and self._episode_dir:
                screenshot_path = self._episode_dir / step.screenshot
                if screenshot_path.exists():
                    try:
                        data["screenshot_b64"] = base64.b64encode(
                            screenshot_path.read_bytes()
                        ).decode("utf-8")
                    except Exception as e:
                        logger.warning(f"Failed to read screenshot {screenshot_path}: {e}")
            result.append(data)
        return result

    def save_vlm_judge(self, prompt: list, response: str) -> None:
        """
        保存 VLM judge 的 prompt 和 response。
        
        Args:
            prompt: VLM judge 的完整 messages
            response: VLM 的原始响应文本
        """
        if self._episode_dir is None:
            return
        
        try:
            # 保存 prompt（图片替换为占位符，避免文件过大）
            prompt_for_save = _strip_image_data_from_messages(prompt)
            (self._episode_dir / "vlm_judge_prompt.json").write_text(
                _safe_json_dump(prompt_for_save), encoding="utf-8"
            )
            
            # 保存 response
            (self._episode_dir / "vlm_judge_response.txt").write_text(
                str(response), encoding="utf-8"
            )
            logger.debug(f"Saved VLM judge data to {self._episode_dir}")
        except Exception as e:
            logger.warning(f"Failed to save VLM judge data: {e}")

    def finish(self, result: dict[str, Any]) -> None:
        """完成 episode 并记录结果"""
        # 一次性写入轨迹
        self._flush_trajectory()
        
        end_time = datetime.now()
        result["start_time"] = self._start_time.isoformat()
        result["end_time"] = end_time.isoformat()
        self._run_recorder._record_result(result)
        self._steps.clear()


# ==================== RunRecorder ====================

class RunRecorder:
    """
    管理整个 benchmark run（线程安全）。
    
    Usage:
        recorder = RunRecorder(runs_root="./runs")
        recorder.start_run(agent="gelab")
        
        ep = recorder.start_episode(task_id="xxx", task_name="xxx")
        ep.record_step(step_idx=1, obs=obs, action=action, ...)
        ep.finish(result)
        
        recorder.finish_run()
    """

    def __init__(
        self,
        runs_root: str | Path,
        *,
        save_trajectory: bool = True,
        coord_space: str = "norm_0_1000",
        annotate: bool = True,
        save_model_response: bool = True,
        save_screenshots: bool = True,
        screenshot_scale: float = 1.0,  # JPEG 已足够小，默认保留原始分辨率
        fixed_run_dir: str | Path | None = None,
        trajectory_dir_override: str | Path | None = None,
    ):
        self.runs_root = Path(runs_root).expanduser().resolve()
        self.fixed_run_dir = Path(fixed_run_dir).expanduser().resolve() if fixed_run_dir else None
        # When set (e.g. by MultiProcessRunner) every shard writes trajectories
        # directly into this shared dir. Episode dirs are uniquely named per
        # task, so cross-shard collisions don't happen.
        self.trajectory_dir_override = (
            Path(trajectory_dir_override).expanduser().resolve()
            if trajectory_dir_override
            else None
        )
        self.save_trajectory = save_trajectory
        self.coord_space = coord_space
        self.annotate = annotate
        self.save_model_response = save_model_response
        self.save_screenshots = save_screenshots
        self.screenshot_scale = screenshot_scale

        self._run_dir: Optional[Path] = None
        self._trajectory_dir: Optional[Path] = None
        self._results_file = None
        self._errors_file = None
        self._write_lock = threading.Lock()
        self._run_start_time: Optional[datetime] = None
        self._repeat_n: int = 1  # For pass@k mode

    @property
    def run_dir(self) -> Optional[Path]:
        return self._run_dir

    def start_run(
        self,
        agent: str = "",
        model_name: str = "",
        extra_meta: Optional[dict[str, Any]] = None,
        repeat_n: int = 1,
    ) -> Path:
        """
        开始一次 run
        
        Args:
            agent: Agent name
            model_name: Model name
            extra_meta: Additional metadata
            repeat_n: Number of trials per task (for pass@k mode)
        """
        self._run_start_time = datetime.now()
        self._repeat_n = repeat_n

        timestamp = self._run_start_time.strftime("%Y%m%d_%H%M%S")
        self._run_dir = self.fixed_run_dir or allocate_run_dir(self.runs_root, timestamp)
        self._run_dir.mkdir(parents=True, exist_ok=True)

        if self.save_trajectory:
            self._trajectory_dir = self.trajectory_dir_override or (self._run_dir / "trajectory")
            self._trajectory_dir.mkdir(parents=True, exist_ok=True)

        self._results_file = (self._run_dir / "results.jsonl").open("w", encoding="utf-8")
        self._errors_file = (self._run_dir / "errors.jsonl").open("w", encoding="utf-8")

        meta = {
            "start_time": self._run_start_time.isoformat(),
            "agent": agent,
            "model_name": model_name,
            "repeat_n": repeat_n,
            "save_trajectory": self.save_trajectory,
            "coord_space": self.coord_space,
            "has_pil": True,
            **(extra_meta or {}),
        }
        (self._run_dir / "meta.json").write_text(_safe_json_dump(meta), encoding="utf-8")
        return self._run_dir

    def start_episode(
        self,
        task_id: str,
        task_name: str,
        extra_meta: Optional[dict[str, Any]] = None,
        trial_id: int = 0,
    ) -> EpisodeRecorder:
        """
        开始记录一个 episode，返回独立的 EpisodeRecorder。
        
        线程安全：每个 episode 有自己的 EpisodeRecorder 实例。
        
        Args:
            task_id: Task ID (e.g., "wechat.EnableDarkMode")
            task_name: Task description
            extra_meta: Additional metadata
            trial_id: Trial index for pass@k evaluation (0-indexed)
        """
        if self._run_dir is None:
            raise RuntimeError("Must call start_run() before start_episode()")

        episode_dir: Optional[Path] = None
        if self.save_trajectory and self._trajectory_dir:
            task_id_safe = task_id.replace(".", "_").replace("/", "_").replace(" ", "_")
            # Add trial suffix for pass@k mode (e.g., wechat_EnableDarkMode_t0)
            # In pass@k mode (repeat_n > 1), all trials get suffix for consistency
            if self._repeat_n > 1:
                dir_name = f"{task_id_safe}_t{trial_id}"
            else:
                dir_name = task_id_safe
            episode_dir = self._trajectory_dir / dir_name
            episode_dir.mkdir(parents=True, exist_ok=True)

            meta = {"task_id": task_id, "task_name": task_name, "trial_id": trial_id, **(extra_meta or {})}
            (episode_dir / "meta.json").write_text(_safe_json_dump(meta), encoding="utf-8")

        return EpisodeRecorder(self, task_id, task_name, episode_dir)

    def _record_result(self, result: dict[str, Any]) -> None:
        """内部方法：线程安全地记录结果"""
        from bench_env.metrics import build_error_entry, result_is_error

        with self._write_lock:
            if self._results_file:
                # jsonl should be compact; default=str makes Pattern / Path / etc serializable
                self._results_file.write(
                    json.dumps(result, ensure_ascii=False, default=str) + "\n"
                )
                self._results_file.flush()
            # Dedicated error stream for quick triage:
            # one line per errored task with task id + error payload.
            if result_is_error(result) and self._errors_file:
                self._errors_file.write(
                    json.dumps(build_error_entry(result), ensure_ascii=False, default=str)
                    + "\n"
                )
                self._errors_file.flush()

    def record_result(self, result: dict[str, Any]) -> None:
        """Public method to record a result without an EpisodeRecorder.

        This is used when setup/runtime fails before episode artifacts are created.
        """
        if "start_time" not in result:
            result["start_time"] = datetime.now().isoformat()
        if "end_time" not in result:
            result["end_time"] = datetime.now().isoformat()
        self._record_result(result)

    def finish_run(
        self,
        repeat_n: int = 1,
        pass_k: Optional[list[int]] = None,
    ) -> Path:
        """
        结束 run 并保存 summary
        
        Args:
            repeat_n: Number of trials per task (for pass@k context)
            pass_k: List of k values for pass@k metrics
        """
        if self._run_dir is None:
            raise RuntimeError("Must call start_run() before finish_run()")

        if self._results_file:
            self._results_file.close()
            self._results_file = None
        if self._errors_file:
            self._errors_file.close()
            self._errors_file = None

        results_path = self._run_dir / "results.jsonl"
        results: list[dict[str, Any]] = []
        if results_path.exists():
            text = results_path.read_text(encoding="utf-8")
            for line in text.splitlines():
                line = line.strip()
                if line:
                    results.append(json.loads(line))

        from bench_env.metrics import write_errors_jsonl, write_summary_json

        write_summary_json(
            self._run_dir,
            results,
            repeat_n=repeat_n,
            pass_k=pass_k,
            start_time=self._run_start_time.isoformat() if self._run_start_time else None,
        )
        write_errors_jsonl(self._run_dir, results)

        run_dir = self._run_dir
        self._run_dir = None
        self._trajectory_dir = None
        self._run_start_time = None
        self._repeat_n = 1
        return run_dir
