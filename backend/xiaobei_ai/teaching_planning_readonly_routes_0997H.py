from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Any


STAGE_ID = "0997H_TEACHING_PLANNING_BACKEND_READONLY_ROUTE_APPLY"
BASE_PATH = "/api/workbench/teaching-planning"


def _root() -> Path:
    return Path(__file__).resolve().parents[2]


def _load_json(rel_path: str) -> Any:
    import json

    return json.loads((_root() / rel_path).read_text(encoding="utf-8"))


def _boundary() -> dict[str, bool]:
    return {
        "readonly": True,
        "backend_route_created": True,
        "database_written": False,
        "registry_store_written": False,
        "feishu_called": False,
        "feishu_calendar_read": False,
        "student_data_read": False,
        "env_secret_read": False,
        "provider_called": False,
        "provider_context_injection": False,
        "memory_store_written": False,
        "retrieval_enabled": False,
        "frontend_modified": False,
        "visible_ui_button_layer_created": False,
        "official_export_created": False,
        "active_teaching_plan_written": False,
        "active_timetable_written": False,
        "deploy_performed": False,
    }


def _states() -> list[dict[str, Any]]:
    data = _load_json("outputs/teaching_planning_backend_0997D/readonly_backend_states_0997D.json")
    return data if isinstance(data, list) else []


def _payloads() -> list[dict[str, Any]]:
    data = _load_json("outputs/teaching_planning_backend_0997D/renderer_payload_previews_0997D.json")
    return data if isinstance(data, list) else []


def _find_state(session_id: str) -> dict[str, Any] | None:
    for state in _states():
        if state.get("session", {}).get("session_id") == session_id or state.get("state_id") == session_id:
            return deepcopy(state)
    return None


def _find_payload(session_id: str) -> dict[str, Any] | None:
    for payload in _payloads():
        if payload.get("session_id") == session_id or payload.get("state_id") == session_id:
            return deepcopy(payload)
    return None


def _wrap(payload: dict[str, Any], status: int = 200) -> tuple[dict[str, Any], int]:
    response = {
        "success": status < 400,
        "stage_id": STAGE_ID,
        "mode": "readonly_route_preview",
        "payload": payload,
        "runtime_boundary": _boundary(),
    }
    return response, status


def get_session(session_id: str) -> tuple[dict[str, Any], int]:
    state = _find_state(session_id)
    if not state:
        return _wrap({"error": "session_not_found", "session_id": session_id}, 404)
    return _wrap({"session_id": session_id, "state": state})


def build_session_dry_run(payload: dict[str, Any] | None) -> tuple[dict[str, Any], int]:
    request_payload = payload if isinstance(payload, dict) else {}
    preferred = str(request_payload.get("session_id") or "").strip()
    state = _find_state(preferred) if preferred else None
    if not state:
        states = _states()
        state = deepcopy(states[0]) if states else None
    if not state:
        return _wrap({"error": "readonly_state_unavailable"}, 404)
    state["dry_run_request_summary"] = {
        "input_keys": sorted(request_payload.keys()),
        "real_store_write_allowed": False,
    }
    return _wrap({"state": state, "database_written": False})


def agent_action_dry_run(payload: dict[str, Any] | None) -> tuple[dict[str, Any], int]:
    request_payload = payload if isinstance(payload, dict) else {}
    utterance = str(request_payload.get("utterance") or request_payload.get("teacher_utterance") or "").strip()
    lowered = utterance.lower()
    if any(token in utterance for token in ["采用", "可以", "确认"]) or "accept" in lowered:
        action_id = "accept_candidate"
    elif any(token in utterance for token in ["改", "调整", "修改"]) or "revise" in lowered:
        action_id = "revise_candidate"
    elif any(token in utterance for token in ["不要", "拒绝", "重来"]) or "reject" in lowered:
        action_id = "reject_candidate"
    elif any(token in utterance for token in ["先放", "稍后", "暂存"]) or "hold" in lowered:
        action_id = "hold_candidate"
    else:
        action_id = "request_missing_input"
    command = {
        "command_id": "cmd_0997H_preview",
        "action_id": action_id,
        "source_utterance_summary": utterance[:120] or "empty utterance preview",
        "target_candidate_ids": request_payload.get("target_candidate_ids") or [],
        "requires_teacher_confirmation": action_id not in {"request_missing_input"},
        "write_allowed": False,
        "teacher_visible_button_layer_created": False,
    }
    return _wrap({"agent_action_command": command})


def review_event_dry_run(payload: dict[str, Any] | None) -> tuple[dict[str, Any], int]:
    request_payload = payload if isinstance(payload, dict) else {}
    action_id = str(request_payload.get("action_id") or "hold_candidate")
    candidate_id = str(request_payload.get("candidate_id") or "candidate_preview_unknown")
    event = {
        "event_id": "review_event_0997H_preview",
        "candidate_id": candidate_id,
        "review_action": action_id,
        "append_only": True,
        "write_allowed": False,
        "official_write_allowed": False,
    }
    return _wrap({"teacher_review_event_preview": event})


def get_renderer_payload(session_id: str) -> tuple[dict[str, Any], int]:
    payload = _find_payload(session_id)
    if not payload:
        return _wrap({"error": "renderer_payload_not_found", "session_id": session_id}, 404)
    return _wrap({"renderer_payload_preview": payload})


def get_conflicts(session_id: str) -> tuple[dict[str, Any], int]:
    state = _find_state(session_id)
    if not state:
        return _wrap({"error": "session_not_found", "session_id": session_id}, 404)
    return _wrap({"session_id": session_id, "conflicts": state.get("conflicts", [])})


def status() -> tuple[dict[str, Any], int]:
    return _wrap(
        {
            "route_status": "readonly_route_active",
            "state_count": len(_states()),
            "renderer_payload_count": len(_payloads()),
            "teacher_confirmation_mode": "agent_conversation_first",
        }
    )


def register_routes(bp, cors_preflight):
    from flask import jsonify, request

    @bp.route(f"{BASE_PATH}/status", methods=["GET", "OPTIONS"])
    def teaching_planning_readonly_status_route_0997H():
        if request.method == "OPTIONS":
            return cors_preflight()
        response, status_code = status()
        return jsonify(response), status_code

    @bp.route(f"{BASE_PATH}/session/<session_id>", methods=["GET", "OPTIONS"])
    def teaching_planning_readonly_session_route_0997H(session_id):
        if request.method == "OPTIONS":
            return cors_preflight()
        response, status_code = get_session(session_id)
        return jsonify(response), status_code

    @bp.route(f"{BASE_PATH}/session/dry-run", methods=["POST", "OPTIONS"])
    def teaching_planning_readonly_session_dry_run_route_0997H():
        if request.method == "OPTIONS":
            return cors_preflight()
        response, status_code = build_session_dry_run(request.get_json(silent=True))
        return jsonify(response), status_code

    @bp.route(f"{BASE_PATH}/agent-action/dry-run", methods=["POST", "OPTIONS"])
    def teaching_planning_readonly_agent_action_route_0997H():
        if request.method == "OPTIONS":
            return cors_preflight()
        response, status_code = agent_action_dry_run(request.get_json(silent=True))
        return jsonify(response), status_code

    @bp.route(f"{BASE_PATH}/review-event/dry-run", methods=["POST", "OPTIONS"])
    def teaching_planning_readonly_review_event_route_0997H():
        if request.method == "OPTIONS":
            return cors_preflight()
        response, status_code = review_event_dry_run(request.get_json(silent=True))
        return jsonify(response), status_code

    @bp.route(f"{BASE_PATH}/renderer-payload/<session_id>", methods=["GET", "OPTIONS"])
    def teaching_planning_readonly_renderer_payload_route_0997H(session_id):
        if request.method == "OPTIONS":
            return cors_preflight()
        response, status_code = get_renderer_payload(session_id)
        return jsonify(response), status_code

    @bp.route(f"{BASE_PATH}/conflicts/<session_id>", methods=["GET", "OPTIONS"])
    def teaching_planning_readonly_conflicts_route_0997H(session_id):
        if request.method == "OPTIONS":
            return cors_preflight()
        response, status_code = get_conflicts(session_id)
        return jsonify(response), status_code

