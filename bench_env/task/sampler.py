"""
Task parameter sampler.

TaskSampler is responsible for sampling task parameters from the environment state.
It is called during task.setup() after environment preparation.
"""

from __future__ import annotations

import random
import re
from dataclasses import dataclass, field
from typing import Any

from bench_env.task.base import BaseApp


@dataclass
class SampleResult:
    """Result of parameter sampling."""
    params: dict[str, Any] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)


class TaskSampler:
    """
    Task parameter sampler.
    
    Samples parameters based on schema definition. Called during task.setup()
    when environment state is available.
    
    Schema format:
        {
            "param_name": {
                "type": "enum" | "string" | "int" | "float" | "bool",
                "values": [...],      # For enum
                "min": 0, "max": 10,  # For int/float
                "pattern": r"\\d{4}", # For string (generates digits)
                "source": "apps.wechat.contacts[name]",  # Sample from env state
                "default": "fallback_value",
            }
        }
    
    Example:
        sampler = TaskSampler(schema={
            "contact_name": {"source": "apps.wechat.contacts[name]"},
            "message": {"type": "string", "default": "Hello!"},
        })
        result = sampler.sample(env_state)
        # result.params = {"contact_name": "张三", "message": "Hello!"}
    """
    
    def __init__(self, schema: dict[str, dict] | None = None, seed: int | None = None):
        """
        Initialize sampler.
        
        Args:
            schema: Parameter schema dict
            seed: Random seed for reproducibility
        """
        self.schema = schema or {}
        self.rng = random.Random(seed)
    
    def sample(self, env_state: dict | None = None, task: Any = None) -> SampleResult:
        """
        Sample parameters based on schema.
        
        Args:
            env_state: Current environment state (for source-based sampling)
            task: Task instance (for method-based samplers)
            
        Returns:
            SampleResult with sampled params and any warnings
        """
        params: dict[str, Any] = {}
        warnings: list[str] = []
        
        for key, spec in self.schema.items():
            value = self._sample_param(key, spec, env_state or {}, task)
            
            # ``fields`` returns a dict — expand into params directly
            if isinstance(value, dict) and spec.get("fields"):
                params.update(value)
            elif value is not None:
                params[key] = value
            elif key in params:
                existing_value = params[key]
                if existing_value is not None:
                    # Already populated by an earlier multi-field expansion;
                    # don't clobber the real sampled value with a fallback default.
                    pass
                elif "default" in spec:
                    params[key] = spec["default"]
                    warnings.append(f"'{key}': multi-field expansion produced None, using default")
                else:
                    warnings.append(f"'{key}': multi-field expansion produced None, leaving param unresolved")
            elif "default" in spec:
                params[key] = spec["default"]
                if spec.get("source"):
                    warnings.append(f"'{key}': source returned empty, using default")
            else:
                warnings.append(f"'{key}': cannot sample (no source data, no default)")
        
        return SampleResult(params=params, warnings=warnings)
    
    def _sample_param(self, key: str, spec: dict, env_state: dict, task: Any = None) -> Any:
        """Sample a single parameter."""
        # 0. Custom sampler (highest priority)
        sampler = spec.get("sampler")
        if sampler:
            # String -> task method name
            if isinstance(sampler, str) and task:
                method = getattr(task, sampler, None)
                if callable(method):
                    return method(env_state)
            # Callable -> standalone function
            elif callable(sampler):
                return sampler(env_state, self.rng)

        # 0.5 Multi-field sampling: pick one dict object, extract named fields
        fields = spec.get("fields")
        if fields and isinstance(fields, dict):
            source = spec.get("source")
            if source:
                candidates = self._resolve_source(env_state, source)
                dicts = [c for c in candidates if isinstance(c, dict)]
                if dicts:
                    chosen = self.rng.choice(dicts)
                    return {field_key: chosen.get(obj_field) for field_key, obj_field in fields.items()}
            return None
        
        t = str(spec.get("type", "")).strip().lower()
        
        # 1. Try source first (if specified)
        source = spec.get("source")
        if source:
            candidates = self._resolve_source(env_state, source)
            if candidates:
                return self.rng.choice(candidates)
            # Source specified but no candidates - fall through to type-based sampling
        
        # 2. Type-based sampling
        if t == "enum":
            values = spec.get("values", [])
            if values:
                pool = list(values.values()) if isinstance(values, dict) else list(values)
                return self.rng.choice(pool)
            return None
        
        if t == "bool":
            values = spec.get("values")
            if isinstance(values, dict):
                return self.rng.choice(list(values.values()))
            return bool(self.rng.getrandbits(1))
        
        if t == "int":
            mn, mx = spec.get("min"), spec.get("max")
            if isinstance(mn, int) and isinstance(mx, int) and mn <= mx:
                return self.rng.randint(mn, mx)
            return None
        
        if t == "float":
            mn, mx = spec.get("min"), spec.get("max")
            if mn is not None and mx is not None:
                value = self.rng.uniform(float(mn), float(mx))
                round_digits = spec.get("round")
                if isinstance(round_digits, int):
                    value = round(value, round_digits)
                return value
            return None
        
        if t == "string":
            pattern = spec.get("pattern")
            if pattern:
                return self._sample_pattern(pattern)
            return None
        
        # No type specified and no source worked
        return None
    
    def _resolve_source(self, env_state: dict, source: str) -> list[Any]:
        """
        Resolve source path to candidate values.
        
        Supports:
            - "apps.wechat.contacts" -> list value at path
            - "apps.wechat.contacts[name]" -> extract 'name' field from each item
        """
        if not isinstance(source, str):
            return []
        
        source = source.strip()
        if not source:
            return []
        
        # Handle array field extraction: "path[field]"
        if "[" in source and "]" in source:
            base_path = source[:source.index("[")]
            field_name = source[source.index("[") + 1:source.index("]")].strip()
            
            base_val = BaseApp.get_by_path(env_state, base_path, None)
            if not isinstance(base_val, list):
                return []
            
            result = []
            for item in base_val:
                if isinstance(item, dict):
                    val = item.get(field_name)
                    if val is not None:
                        result.append(val)
            return result
        
        # Simple path
        value = BaseApp.get_by_path(env_state, source, None)
        if isinstance(value, list):
            return [v for v in value if v is not None]
        if value is not None:
            return [value]
        return []
    
    def _sample_pattern(self, pattern: str) -> str | None:
        """
        Sample string from pattern.
        
        Currently supports:
            - r"\\d{N}" -> generates N random digits
        """
        normalized = pattern.replace("\\\\", "\\")
        
        # Match \d{N} pattern
        m = re.fullmatch(r"\\d\{(\d+)\}", normalized)
        if m:
            n = int(m.group(1))
            return "".join(str(self.rng.randint(0, 9)) for _ in range(n))
        
        return None
    
    def set_seed(self, seed: int) -> None:
        """Set random seed."""
        self.rng = random.Random(seed)
