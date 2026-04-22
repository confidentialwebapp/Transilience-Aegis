"""Skill registry — discoverable list of all AI capabilities."""

from __future__ import annotations

from .base import Skill


_REGISTRY: dict[str, Skill] = {}


def register(skill: Skill) -> Skill:
    if not skill.name:
        raise ValueError("skill.name must be set")
    _REGISTRY[skill.name] = skill
    return skill


def get(name: str) -> Skill | None:
    _ensure_loaded()
    return _REGISTRY.get(name)


def list_all() -> list[Skill]:
    _ensure_loaded()
    return list(_REGISTRY.values())


_loaded = False


def _ensure_loaded() -> None:
    """Lazy-load all skill modules. Adding a new skill only requires creating
    the module file and importing it here."""
    global _loaded
    if _loaded:
        return
    _loaded = True
    # Import every skill module so its register() side effect fires
    from . import (  # noqa: F401
        triage_alert,
        explain_threat_actor,
        summarize_advisory,
        draft_advisory,
        suggest_remediation,
        compare_iocs,
        summarize_investigation,
    )
