from __future__ import annotations

from copy import deepcopy
from typing import Any

from . import workbench_context_switch as context_switch
from . import workbench_intent_router as intent_router

SESSION_ID = "wb_20260514_grade3_qinglv_lesson2"
ALLOWED_STATUSES = {"candidate", "pending_review", "preview", "ready_for_teacher_review"}
FALSE_SAFETY_FLAGS = {
    "database_write_allowed": False,
    "direct_write_allowed": False,
    "overwrite_content_allowed": False,
    "feishu_write_allowed": False,
    "formal_scoring_allowed": False,
    "classroom_app_connect_allowed": False,
    "student_submit_allowed": False,
    "student_submit_connect_allowed": False,
    "real_export_allowed": False,
    "real_download_allowed": False,
    "teacher_review_required": True,
}
REQUIRED_FALSE_REQUEST_SAFETY_FLAGS = {
    "direct_write_allowed",
    "overwrite_content_allowed",
    "feishu_write_allowed",
    "formal_scoring_allowed",
    "classroom_app_connect_allowed",
    "student_submit_connect_allowed",
    "real_download_allowed",
}
RESPONSE_SAFETY = {
    "candidate_only": True,
    "teacher_review_required": True,
    "direct_write": False,
    "overwrite_content": False,
    "locked_cards_modified": False,
    "feishu_write_allowed": False,
    "formal_scoring_allowed": False,
    "classroom_app_connect_allowed": False,
    "student_submit_connect_allowed": False,
    "real_download_allowed": False,
}


def get_session_mock() -> tuple[dict[str, Any], int]:
    """Return a deterministic workbench session dry-run snapshot.

    This does not read or write a database. It only mirrors the current V1
    workbench sample state for frontend integration testing.
    """

    return {
        "success": True,
        "mode": "dry_run_session",
        "session": {
            "session_id": SESSION_ID,
            "current_mode": "lesson",
            "current_task": "新备课 · 当前课题",
            "selected_component_id": "activity_2_candidate",
            "teacher_input_mode": "single_composer",
            "agent_entry_policy": "one_xiaobei",
            "opened_components": ["current_tasks", "activity_2_candidate", "teaching_package_check"],
        },
        "component_cards": [
            {
                "card_id": "activity_2_candidate",
                "teacher_title": "活动候选",
                "status": "candidate",
                "locked": False,
                "teacher_summary": "活动环节正在等待老师确认。",
            },
            {
                "card_id": "teaching_package_check",
                "teacher_title": "教学包检查",
                "status": "preview",
                "locked": False,
                "teacher_summary": "教师阅读版已就绪，任务单和评价建议待确认。",
            },
        ],
        "teaching_package": {
            "package_id": "pkg_workbench_default",
            "status": "preview",
            "teacher_assets": {
                "teacher_read_view": "ready",
                "task_sheet": "pending_review",
                "materials_list": "ready",
            },
            "app_link": {
                "classroom_app_connect_allowed": False,
                "student_submit_connect_allowed": False,
                "formal_scoring_allowed": False,
                "feishu_write_allowed": False,
            },
        },
        "download_package": _download_manifest_payload(),
        "safety_flags": deepcopy(FALSE_SAFETY_FLAGS),
    }, 200


def ai_dry_run(payload: Any) -> tuple[dict[str, Any], int]:
    request_payload = payload if isinstance(payload, dict) else {}
    validation_error = _validate_ai_request(request_payload)
    if validation_error:
        return _error_response("request_rejected", validation_error), 400

    teacher_message = str(request_payload.get("teacher_message") or "").strip()
    session_integrity = _session_integrity_check(request_payload)
    intent_decision = intent_router.resolve_intent_route(request_payload, teacher_message)
    context = intent_decision["resolved_context"]
    locked_cards = set(request_payload.get("locked_cards") or [])
    route = str(intent_decision.get("route_id") or context_switch.detect_route(teacher_message, context))
    ai_mode = str(request_payload.get("ai_mode") or "mock").strip()
    if route == "apply_last_candidate":
        response = _apply_last_candidate_response(request_payload, intent_decision, RESPONSE_SAFETY)
        _attach_canonical_route(response, intent_decision)
        response["safety_flags"] = deepcopy(FALSE_SAFETY_FLAGS)
        return _with_session_integrity(response, session_integrity), 200
    if "last_candidate" in (intent_decision.get("missing_slots") or []):
        response = _missing_last_candidate_response(intent_decision, teacher_message)
        _attach_canonical_route(response, intent_decision)
        response["safety_flags"] = deepcopy(FALSE_SAFETY_FLAGS)
        return _with_session_integrity(response, session_integrity), 200
    if intent_router.is_clarification_needed(intent_decision) or context_switch.should_clarify_new_lesson(context):
        response = context_switch.build_clarification_response(context, teacher_message, RESPONSE_SAFETY)
        response["intent_route"] = intent_router.public_decision(intent_decision)
        _attach_canonical_route(response, intent_decision)
        response["safety_flags"] = deepcopy(FALSE_SAFETY_FLAGS)
        return _with_session_integrity(response, session_integrity), 200
    if ai_mode == "real_candidate":
        try:
            from . import workbench_ai_candidate_dry_run as candidate_dry_run

            candidate_route = "semester_plan" if route == "semester_schedule_planning" else route
            candidate_route = candidate_route if candidate_route in {"activity_refine", "task_sheet", "lesson_brief", "unit_brief", "semester_plan"} else "general_chat"
            response = candidate_dry_run.generate_candidate_response(request_payload, candidate_route, context=context)
            response.setdefault("request_echo", {
                "teacher_message": teacher_message,
                "candidate_generation": True,
                "context_policy": context.get("context_policy"),
                "detected_context": context.get("detected_context"),
            })
            response["request_echo"]["detected_route"] = route
            response["intent_route"] = intent_router.public_decision(intent_decision)
            _attach_canonical_route(response, intent_decision)
            _attach_last_candidate(response, context)
            return _with_session_integrity(response, session_integrity), 200
        except Exception as exc:
            reason = str(getattr(exc, "reason_code", "") or "real_candidate_unavailable")
            return _with_session_integrity(_real_candidate_unavailable_response(reason, teacher_message), session_integrity), 503
    response = context_switch.build_deterministic_response(route, teacher_message, locked_cards, context, RESPONSE_SAFETY)
    response["intent_route"] = intent_router.public_decision(intent_decision)
    _attach_canonical_route(response, intent_decision)
    _attach_last_candidate(response, context)
    response["safety_flags"] = deepcopy(FALSE_SAFETY_FLAGS)
    return _with_session_integrity(response, session_integrity), 200


def intent_route(payload: Any) -> tuple[dict[str, Any], int]:
    request_payload = payload if isinstance(payload, dict) else {}
    return intent_router.route_preview(request_payload)


def _attach_canonical_route(response: dict[str, Any], decision: dict[str, Any]) -> None:
    public = intent_router.public_decision(decision)
    response["route_source"] = public.get("route_source") or "backend_runtime_router"
    response["canonical_route_context"] = deepcopy(public.get("canonical_route_context") or {})
    response["route_consistency"] = deepcopy(public.get("route_consistency") or {})
    response.setdefault("intent_route", public)


def _attach_last_candidate(response: dict[str, Any], context: dict[str, Any]) -> None:
    updates = response.get("card_updates") if isinstance(response, dict) else None
    if not isinstance(updates, list) or not updates:
        return
    update = next((item for item in updates if isinstance(item, dict) and _candidate_type_for_card(item.get("card_id"))), None)
    if not update:
        return
    metadata = _candidate_metadata(update, response, context)
    response["last_candidate"] = metadata
    response["pending_candidate"] = deepcopy(metadata)
    intent_route = response.get("intent_route")
    if isinstance(intent_route, dict):
        updated_context = intent_route.get("updated_context")
        if isinstance(updated_context, dict):
            updated_context["last_candidate"] = deepcopy(metadata)
            updated_context["pending_candidate"] = deepcopy(metadata)


def _candidate_metadata(update: dict[str, Any], response: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    card_id = str(update.get("card_id") or "")
    candidate_type = _candidate_type_for_card(card_id)
    topic = str(context.get("topic") or context.get("raw_topic") or "当前课题")
    planned_lessons = context.get("planned_lessons")
    if candidate_type == "unit_brief_candidate" and planned_lessons in (None, ""):
        planned_lessons = 3
    return {
        "candidate_id": f"{response.get('session_id') or SESSION_ID}_{card_id}",
        "candidate_type": candidate_type,
        "topic": topic,
        "grade": context.get("grade") or "三年级",
        "subject": context.get("subject") or "美术",
        "design_scope": context.get("design_scope") or "unknown",
        "planned_lessons": planned_lessons,
        "candidate_text": str(update.get("candidate_text") or ""),
        "card_update_payload": deepcopy(update),
        "target_card": "current_task",
        "status": "pending_teacher_decision",
        "teacher_confirm_required": True,
    }


def _candidate_type_for_card(card_id: Any) -> str:
    return {
        "lesson_brief_candidate": "lesson_brief_candidate",
        "unit_brief_candidate": "unit_brief_candidate",
        "semester_plan_candidate": "semester_plan_candidate",
        "activity_2_candidate": "activity_candidate",
        "task_sheet_candidate": "task_sheet_candidate",
        "official_field_candidate": "official_field_candidate",
        "package_preview_candidate": "package_preview_candidate",
    }.get(str(card_id or ""), "")


def _last_candidate_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    current_context = payload.get("current_context") if isinstance(payload.get("current_context"), dict) else {}
    for value in [
        payload.get("last_candidate"),
        payload.get("pending_candidate"),
        current_context.get("last_candidate"),
        current_context.get("pending_candidate"),
    ]:
        if isinstance(value, dict) and value:
            return deepcopy(value)
    return {}


def _apply_last_candidate_response(payload: dict[str, Any], intent_decision: dict[str, Any], response_safety: dict[str, Any]) -> dict[str, Any]:
    candidate = _last_candidate_from_payload(payload)
    if not candidate:
        return _missing_last_candidate_response(intent_decision, str(payload.get("teacher_message") or ""))
    update = deepcopy(candidate.get("card_update_payload") or {})
    if not update:
        update = {
            "card_id": _card_id_for_candidate_type(candidate.get("candidate_type")),
            "update_type": "preview_update",
            "teacher_title": _apply_title(candidate),
            "status": "preview",
            "candidate_text": str(candidate.get("candidate_text") or ""),
            "teacher_summary": "已采纳到本次备课预览，待最终确认。",
            "impact_targets": ["教学包检查"],
            "requires_teacher_acceptance": True,
            "locked_target": False,
        }
    update["update_type"] = "preview_update"
    update["teacher_title"] = _apply_title(candidate)
    update["status"] = "preview"
    update["teacher_summary"] = _apply_summary(candidate)
    update["requires_teacher_acceptance"] = True
    update["locked_target"] = False
    if candidate.get("candidate_type") == "unit_brief_candidate":
        update["field_rows"] = context_switch.unit_field_rows_from_text(
            str(update.get("candidate_text") or candidate.get("candidate_text") or ""),
            applied=True,
        )
    if candidate.get("candidate_type") == "semester_plan_candidate":
        update["field_rows"] = context_switch.build_semester_field_rows(
            {
                "topic": candidate.get("topic"),
                "grade": candidate.get("grade"),
                "subject": candidate.get("subject"),
                "design_scope": candidate.get("design_scope"),
            },
            str(update.get("candidate_text") or candidate.get("candidate_text") or ""),
            applied=True,
        )
    applied = deepcopy(candidate)
    applied["status"] = "applied_to_workbench_preview"
    applied["card_update_payload"] = deepcopy(update)
    topic = str(candidate.get("topic") or "当前课题")
    scope_text = _candidate_scope_text(candidate)
    route_intent = str(((intent_decision.get("intent") or {}).get("intent_id")) or "accept_last_candidate")
    return {
        "success": True,
        "mode": "apply_last_candidate_to_preview",
        "response_id": "backend_ai_resp_apply_last_candidate_064B",
        "session_id": str(payload.get("session_id") or SESSION_ID),
        "assistant_message": (
            f"**已放入本次备课预览：**\n\n"
            f"- 已把《{topic}》{scope_text}候选放入右侧当前工作卡。\n"
            "- 确认前不会进入最终成果包。\n"
            "- 下一步建议：先确认关键字段，再进入官方字段追问。"
        ),
        "intent": {
            "intent_id": route_intent,
            "confidence": 0.9,
            "teacher_readable_reason": "老师正在采纳最近一次候选到当前工作卡预览。",
        },
        "card_updates": [update],
        "last_candidate": applied,
        "pending_candidate": applied,
        "content_written": False,
        "formal_content_kept": True,
        "next_actions": [
            {"label": "修改某个字段", "action_id": "modify_last_candidate"},
            {"label": "重新生成某个字段", "action_id": "generate_unit_brief_candidate"},
            {"label": "进入课时部分", "action_id": "generate_lesson_brief_candidate"},
        ],
        "intent_route": intent_router.public_decision(intent_decision),
        "safety_check": deepcopy(response_safety),
    }


def _missing_last_candidate_response(intent_decision: dict[str, Any], teacher_message: str) -> dict[str, Any]:
    return {
        "success": True,
        "mode": "last_candidate_missing_clarification",
        "response_id": "backend_ai_resp_missing_last_candidate_064B",
        "session_id": SESSION_ID,
        "assistant_message": (
            "**我还没有看到可以放入工作卡的候选内容。**\n\n"
            "- 你想先让我生成课时框架、大单元框架，还是任务单？\n"
            "- 生成候选后，你再说“就用这个”或“放进卡片”，我就能承接。"
        ),
        "intent": {
            "intent_id": "clarification_needed",
            "confidence": 0.78,
            "teacher_readable_reason": "老师想采纳上文候选，但当前没有可承接的候选内容。",
        },
        "card_updates": [],
        "next_actions": [
            {"label": "生成课时框架", "action_id": "generate_lesson_brief"},
            {"label": "生成大单元框架", "action_id": "generate_unit_brief"},
            {"label": "生成任务单", "action_id": "generate_task_sheet"},
        ],
        "request_echo": {"teacher_message": teacher_message},
        "intent_route": intent_router.public_decision(intent_decision),
        "safety_check": deepcopy(RESPONSE_SAFETY),
    }


def _card_id_for_candidate_type(candidate_type: Any) -> str:
    return {
        "lesson_brief_candidate": "lesson_brief_candidate",
        "unit_brief_candidate": "unit_brief_candidate",
        "semester_plan_candidate": "semester_plan_candidate",
        "activity_candidate": "activity_2_candidate",
        "task_sheet_candidate": "task_sheet_candidate",
        "official_field_candidate": "official_field_candidate",
        "package_preview_candidate": "package_preview_candidate",
    }.get(str(candidate_type or ""), "lesson_brief_candidate")


def _apply_title(candidate: dict[str, Any]) -> str:
    topic = str(candidate.get("topic") or "当前课题")
    if candidate.get("candidate_type") == "unit_brief_candidate":
        lessons = candidate.get("planned_lessons")
        return f"《{topic}》{int(lessons)}课时大单元候选" if lessons else f"《{topic}》大单元候选"
    if candidate.get("candidate_type") == "semester_plan_candidate":
        return f"《{topic}》学期规划候选"
    if candidate.get("candidate_type") == "task_sheet_candidate":
        return "学生任务单候选"
    if candidate.get("candidate_type") == "activity_candidate":
        return f"《{topic}》活动候选"
    return f"《{topic}》备课候选"


def _apply_summary(candidate: dict[str, Any]) -> str:
    topic = str(candidate.get("topic") or "当前课题")
    if candidate.get("candidate_type") == "unit_brief_candidate":
        return f"已采纳到本次备课预览，待最终确认：{topic}大单元。"
    if candidate.get("candidate_type") == "semester_plan_candidate":
        return f"已采纳到本次备课预览，待最终确认：{topic}学期规划。"
    return f"已采纳到本次备课预览，待最终确认：{topic}。"


def _candidate_scope_text(candidate: dict[str, Any]) -> str:
    if candidate.get("candidate_type") == "unit_brief_candidate":
        lessons = candidate.get("planned_lessons")
        return f"{int(lessons)}课时大单元" if lessons else "大单元"
    if candidate.get("candidate_type") == "semester_plan_candidate":
        return "学期规划"
    if candidate.get("candidate_type") == "task_sheet_candidate":
        return "学生任务单"
    if candidate.get("candidate_type") == "activity_candidate":
        return "活动"
    return "备课"


def ai_status() -> tuple[dict[str, Any], int]:
    try:
        import os

        from . import providers
        from . import workbench_ai_candidate_dry_run as candidate_dry_run

        provider = providers.provider_status() if hasattr(providers, "provider_status") else {}
        generation = provider.get("generation") if isinstance(provider, dict) else {}
        credential_available = bool(isinstance(generation, dict) and generation.get("credential_available"))
        if not credential_available:
            credential_available = bool(
                (os.environ.get("MINIMAX_API_KEY") or "").strip()
                or (os.environ.get("MINIAMX_API_KEY") or "").strip()
                or (os.environ.get("OPENAI_API_KEY") or "").strip()
            )
        candidate_enabled = candidate_dry_run._enabled()
        candidate_provider = candidate_dry_run._resolve_candidate_provider()
        if isinstance(generation, dict):
            generation = {**generation, "workbench_candidate_provider": candidate_provider}
        return {
            "success": True,
            "mode": "workbench_ai_status",
            "candidate_enabled": candidate_enabled,
            "model_ready": bool(candidate_enabled and credential_available),
            "provider": generation,
            "message": "真实候选模型配置已就绪。" if candidate_enabled and credential_available else "真实候选模型还没有接通。",
            "safety_flags": deepcopy(FALSE_SAFETY_FLAGS),
        }, 200
    except Exception:
        return {
            "success": False,
            "mode": "workbench_ai_status",
            "candidate_enabled": False,
            "model_ready": False,
            "message": "真实候选模型还没有接通。",
            "safety_flags": deepcopy(FALSE_SAFETY_FLAGS),
        }, 503


def accept_candidate_dry_run(payload: Any) -> tuple[dict[str, Any], int]:
    request_payload = payload if isinstance(payload, dict) else {}
    target_card_id = str(request_payload.get("card_id") or "activity_2_candidate")
    if request_payload.get("locked") is True or target_card_id in set(request_payload.get("locked_cards") or []):
        return _error_response("locked_card", "锁定卡片不能被采纳预演修改。"), 400
    return {
        "success": True,
        "mode": "accept_candidate_dry_run",
        "target_card_id": target_card_id,
        "would_update": ["活动二正式内容", "学生任务单", "评价证据", "教学包检查"],
        "teacher_review_required": True,
        "content_written": False,
        "message": "这是采纳预演：确认后会影响活动二、任务单和评价证据；当前不会写入正式内容。",
        "safety_flags": deepcopy(FALSE_SAFETY_FLAGS),
    }, 200


def discard_candidate_dry_run(payload: Any) -> tuple[dict[str, Any], int]:
    request_payload = payload if isinstance(payload, dict) else {}
    target_card_id = str(request_payload.get("card_id") or "activity_2_candidate")
    return {
        "success": True,
        "mode": "discard_candidate_dry_run",
        "target_card_id": target_card_id,
        "would_clear_candidate": [target_card_id],
        "formal_content_kept": True,
        "content_written": False,
        "message": "这是放弃预演：会保留正式内容，只清空本次候选。当前不会写入正式内容。",
        "safety_flags": deepcopy(FALSE_SAFETY_FLAGS),
    }, 200


def download_manifest_mock() -> tuple[dict[str, Any], int]:
    return {
        "success": True,
        "mode": "download_manifest_mock",
        "download_package": _download_manifest_payload(),
        "safety_flags": deepcopy(FALSE_SAFETY_FLAGS),
    }, 200


def _validate_ai_request(payload: dict[str, Any]) -> str:
    if not isinstance(payload.get("session_id"), str) or not payload.get("session_id"):
        return "session_id 必填。"
    if not isinstance(payload.get("teacher_message"), str):
        return "teacher_message 必须是文本。"
    safety_flags = payload.get("safety_flags")
    if not isinstance(safety_flags, dict):
        return "safety_flags 必须存在。"
    for key in REQUIRED_FALSE_REQUEST_SAFETY_FLAGS:
        if safety_flags.get(key) is not False:
            return f"{key} 必须为 false。"
    for key in FALSE_SAFETY_FLAGS:
        if key in REQUIRED_FALSE_REQUEST_SAFETY_FLAGS or key == "teacher_review_required":
            continue
        if key in safety_flags and safety_flags.get(key) is not False:
            return f"{key} 必须为 false。"
    if safety_flags.get("teacher_review_required") is not True:
        return "teacher_review_required 必须为 true。"
    forbidden_actions = set(payload.get("forbidden_actions") or [])
    for action in ["direct_write", "overwrite_content", "bypass_teacher_review"]:
        if action not in forbidden_actions:
            return f"forbidden_actions 缺少 {action}。"
    return ""


def _session_integrity_check(payload: dict[str, Any]) -> dict[str, Any]:
    runtime_state = payload.get("runtime_state") if isinstance(payload.get("runtime_state"), dict) else {}
    request_session_id = str(payload.get("session_id") or "").strip()
    runtime_session_id = str(runtime_state.get("session_id") or "").strip()
    request_browser_id = str(payload.get("browser_session_id") or "").strip()
    runtime_browser_id = str(runtime_state.get("browser_session_id") or "").strip()
    warnings: list[str] = []
    if not request_session_id:
        warnings.append("missing_session_id")
    if runtime_session_id and request_session_id and runtime_session_id != request_session_id:
        warnings.append("request_runtime_session_mismatch")
    if request_browser_id and runtime_browser_id and request_browser_id != runtime_browser_id:
        warnings.append("browser_session_mismatch")
    return {
        "ok": not warnings,
        "warnings": warnings,
        "request_session_id": request_session_id,
        "runtime_state_session_id": runtime_session_id,
        "request_browser_session_id": request_browser_id,
        "runtime_state_browser_session_id": runtime_browser_id,
        "safety_flags_kept_false": True,
        "write_capability_changed": False,
    }


def _with_session_integrity(response: dict[str, Any], session_integrity: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(response, dict):
        return response
    response["session_integrity"] = deepcopy(session_integrity)
    if session_integrity.get("warnings"):
        response["safety_warnings"] = list(session_integrity.get("warnings") or [])
    response["safety_flags"] = deepcopy(FALSE_SAFETY_FLAGS)
    return response


def _detect_route(teacher_message: str) -> str:
    text = teacher_message.replace(" ", "")
    if any(key in text for key in ["备一节", "备一下", "备课草稿", "第2课时备课", "青绿中国色第2课时"]):
        return "lesson_brief"
    if any(key in text for key in ["任务单", "学习单"]):
        return "task_sheet"
    if any(key in text for key in ["资源", "图片", "素材"]):
        return "resources"
    if any(key in text for key in ["下载", "导出", "成果包"]):
        return "download_manifest"
    if any(key in text for key in ["教学包", "检查", "还缺"]):
        return "package_check"
    if any(key in text for key in ["活动二", "精修", "太散", "三年级", "支架", "活动时间", "压缩", "12分钟", "学生可能不知道怎么做"]):
        return "activity_refine"
    return "fallback"


def _response_for_route(route: str, teacher_message: str, locked_cards: set[str]) -> dict[str, Any]:
    builders = {
        "activity_refine": _activity_refine_update,
        "task_sheet": _task_sheet_update,
        "lesson_brief": _lesson_brief_update,
        "resources": _resources_update,
        "package_check": _package_check_update,
        "download_manifest": _download_manifest_update,
        "fallback": _fallback_update,
    }
    response = builders.get(route, _fallback_update)(locked_cards)
    response["session_id"] = SESSION_ID
    response["request_echo"] = {"teacher_message": teacher_message, "dry_run_only": True}
    return response


def _base_response(response_id: str, intent_id: str, reason: str, assistant_message: str) -> dict[str, Any]:
    return {
        "response_id": response_id,
        "session_id": SESSION_ID,
        "assistant_message": assistant_message,
        "intent": {
            "intent_id": intent_id,
            "confidence": 0.9 if intent_id != "fallback" else 0.5,
            "teacher_readable_reason": reason,
        },
        "card_updates": [],
        "next_actions": [],
        "safety_check": deepcopy(RESPONSE_SAFETY),
    }


def _activity_refine_update(locked_cards: set[str]) -> dict[str, Any]:
    response = _base_response(
        "backend_ai_resp_activity_refine_001",
        "activity_refine",
        "老师希望降低活动二难度，让学生更容易完成观察和表达。",
        "**活动二候选：**\n\n- 建议把“自由试错”改成“颜色卡片观察”。\n- 三年级学生更容易看见差异，也能留下观察表作为课堂证据。\n- 当前仍是候选内容，需要你确认后才会进入备课预览。",
    )
    _append_update(response, locked_cards, {
        "card_id": "activity_2_candidate",
        "update_type": "candidate_update",
        "teacher_title": "活动二候选",
        "status": "candidate",
        "candidate_text": "用颜色卡片对比 3 组青绿色组合，学生先圈出最强烈的一组，再填写观察表，最后用 1 句话说明选择理由。时间控制在 12 分钟。",
        "teacher_summary": "活动二更有支架，学生输出更明确。",
        "impact_targets": ["学生任务单", "评价证据", "教学包检查"],
        "requires_teacher_acceptance": True,
        "locked_target": False,
    })
    response["next_actions"] = _actions(["采纳候选", "继续修改", "生成任务单"])
    return response



def _lesson_brief_update(locked_cards: set[str]) -> dict[str, Any]:
    response = _base_response(
        "backend_ai_resp_lesson_brief_001",
        "lesson_brief",
        "老师希望先形成《青绿中国色》第2课时的备课候选框架。",
        "**第2课时备课候选：**\n\n- 已整理《青绿中国色》第2课时备课框架。\n- 右侧会打开课时目标、教学流程、核心活动和学习证据候选。\n- 现在只作为候选内容，等你确认后再进入本次备课预览。",
    )
    update = {
        "card_id": "lesson_brief_candidate",
        "update_type": "open_card",
        "teacher_title": "青绿中国色第2课时备课候选",
        "status": "ready_for_teacher_review",
        "teacher_summary": "已形成课时目标、教学流程、核心活动、学生任务和学习证据的候选框架。",
        "candidate_text": (
            "课时目标：观察青绿色彩的层次，尝试用青绿色完成一幅小作品。\n"
            "教学流程：导入观察、颜色卡片比较、活动二创作、作品交流。\n"
            "核心活动：用颜色卡片对比 3 组青绿色，圈出最有画面感的一组。\n"
            "学生任务：看一看、说一说、试一试、写一写。\n"
            "学习证据：圈选记录、观察表、小作品、一句话说明。\n"
            "下一步建议：先继续精修活动二，再生成学生任务单。"
        ),
        "impact_targets": ["学生任务单", "评价证据", "教学包检查"],
        "requires_teacher_acceptance": True,
        "locked_target": False,
    }
    _append_update(response, locked_cards, update)
    response["next_actions"] = _actions(["继续精修活动二", "生成任务单", "检查教学包"])
    return response

def _task_sheet_update(locked_cards: set[str]) -> dict[str, Any]:
    response = _base_response(
        "backend_ai_resp_task_sheet_001",
        "task_sheet",
        "老师希望把活动二转成学生能直接完成的学习任务。",
        "**学生任务单草稿：**\n\n- 已把活动二整理成学生能直接完成的任务单草稿。\n- 状态保持“待老师确认”。\n- 确认前不会进入最终成果包，你可以继续改任务难度或表达方式。",
    )
    _append_update(response, locked_cards, {
        "card_id": "task_sheet_candidate",
        "update_type": "open_card",
        "teacher_title": "学生任务单草稿",
        "status": "pending_review",
        "candidate_text": "任务一：观察 3 组青绿色彩。任务二：圈出最有画面感的一组。任务三：完成一张青绿小作品。任务四：写 1-2 句创作说明。",
        "teacher_summary": "任务单已形成草稿，等待老师确认。",
        "impact_targets": ["教学包检查", "评价建议"],
        "requires_teacher_acceptance": True,
        "locked_target": False,
    })
    response["next_actions"] = _actions(["确认任务单", "继续修改", "检查教学包"])
    return response


def _resources_update(locked_cards: set[str]) -> dict[str, Any]:
    response = _base_response(
        "backend_ai_resp_resources_001",
        "resources",
        "老师希望找到能支持活动二的青绿资源。",
        "**青绿资源建议：**\n\n- 作品图：服务导入观察和作品比较。\n- 颜料介绍卡：帮助学生理解青绿色来源。\n- 色彩词汇卡：支撑学生在任务单里表达感受。\n\n你可以先加入本课资源清单。",
    )
    _append_update(response, locked_cards, {
        "card_id": "resource_cards",
        "update_type": "open_card",
        "teacher_title": "青绿资源建议",
        "status": "preview",
        "candidate_text": "青绿山水作品图、矿物颜料介绍卡、青绿色彩词汇卡。",
        "teacher_summary": "资源可服务导入、活动观察和学生表达。",
        "impact_targets": ["课件", "学生任务单", "本课资源清单"],
        "requires_teacher_acceptance": True,
        "locked_target": False,
    })
    response["next_actions"] = _actions(["加入本课资源清单", "生成任务单", "检查教学包"])
    return response


def _package_check_update(locked_cards: set[str]) -> dict[str, Any]:
    response = _base_response(
        "backend_ai_resp_package_check_001",
        "package_check",
        "老师希望确认本课材料是否已经能进入交付预览。",
        "**教学包检查：**\n\n- 教师阅读版：已就绪。\n- 学生任务单：仍待确认。\n- 评价建议：仍待确认。\n- 当前阶段：只做备课预览，不进入课堂应用。",
    )
    _append_update(response, locked_cards, {
        "card_id": "teaching_package_check",
        "update_type": "preview_update",
        "teacher_title": "教学包检查",
        "status": "preview",
        "candidate_text": "教师阅读版已就绪；学生任务单、评价建议仍待老师确认；当前暂不进入课堂使用。",
        "teacher_summary": "需要先确认任务单和评价建议。",
        "impact_targets": ["学生任务单", "评价建议", "下载清单"],
        "requires_teacher_acceptance": True,
        "locked_target": False,
    })
    response["next_actions"] = _actions(["继续完善", "生成下载清单"])
    return response


def _download_manifest_update(locked_cards: set[str]) -> dict[str, Any]:
    response = _base_response(
        "backend_ai_resp_download_manifest_001",
        "download_manifest",
        "老师希望查看当前可以准备哪些成果材料。",
        "**成果包下载清单预览：**\n\n| 内容 | 状态 |\n| --- | --- |\n| 教师阅读版 | 已就绪 |\n| 材料清单 | 已就绪 |\n| 学生任务单 | 待确认 |\n| 评价建议表 | 待确认 |\n\n确认完成后再生成可下载成果包。",
    )
    _append_update(response, locked_cards, {
        "card_id": "download_manifest_preview",
        "update_type": "open_card",
        "teacher_title": "成果包下载清单",
        "status": "preview",
        "candidate_text": "教师阅读版已就绪；材料清单已就绪；学生任务单和评价建议待确认。",
        "teacher_summary": "清单可预览，确认完成后再准备导出。",
        "impact_targets": ["教师阅读版", "学生任务单", "评价建议表"],
        "requires_teacher_acceptance": True,
        "locked_target": False,
    })
    response["next_actions"] = _actions(["继续确认", "检查教学包"])
    return response


def _fallback_update(locked_cards: set[str]) -> dict[str, Any]:
    response = _base_response(
        "backend_ai_resp_fallback_001",
        "fallback",
        "老师输入没有命中明确任务，先给出可继续操作。",
        "**我可以继续处理：**\n\n- 精修活动二。\n- 生成学生任务单。\n- 查青绿资源。\n- 检查教学包。\n- 查看下载清单。\n\n你可以直接告诉我下一步想做什么。",
    )
    response["next_actions"] = _actions(["精修活动二", "生成任务单", "查青绿资源", "检查教学包", "生成下载清单"])
    return response


def _append_update(response: dict[str, Any], locked_cards: set[str], update: dict[str, Any]) -> None:
    if update["card_id"] in locked_cards:
        response["safety_check"]["locked_cards_modified"] = False
        response["next_actions"] = _actions(["查看锁定内容", "换一个可编辑部分"])
        return
    response["card_updates"].append(update)


def _actions(labels: list[str]) -> list[dict[str, str]]:
    action_map = {
        "采纳候选": "accept_candidate",
        "确认任务单": "accept_candidate",
        "继续修改": "revise_candidate",
        "生成任务单": "generate_task_sheet",
        "检查教学包": "check_package",
        "生成下载清单": "show_download_manifest",
        "继续完善": "revise_candidate",
        "加入本课资源清单": "open_preview_card",
        "精修活动二": "revise_candidate",
        "查青绿资源": "open_preview_card",
        "继续确认": "revise_candidate",
        "查看锁定内容": "open_preview_card",
        "换一个可编辑部分": "suggest_next_actions",
    }
    return [{"label": label, "action_id": action_map.get(label, "suggest_next_actions")} for label in labels]


def _download_manifest_payload() -> dict[str, Any]:
    return {
        "download_package_id": "dl_pkg_workbench_default",
        "source_package_id": "pkg_workbench_default",
        "status": "not_ready",
        "download_allowed": False,
        "reason": "学生任务单和评价建议仍待老师确认。",
        "assets": [
            {"title": "教师阅读版", "status": "ready", "format": "html"},
            {"title": "学生任务单", "status": "pending_review", "format": "html"},
            {"title": "材料清单", "status": "ready", "format": "html"},
            {"title": "评价建议表", "status": "pending_review", "format": "html"},
        ],
    }


def _error_response(code: str, message: str) -> dict[str, Any]:
    return {
        "success": False,
        "error": {"code": code, "message": message},
        "safety_flags": deepcopy(FALSE_SAFETY_FLAGS),
    }


def _real_candidate_unavailable_response(reason: str, teacher_message: str) -> dict[str, Any]:
    return {
        "success": False,
        "mode": "real_candidate_unavailable",
        "error_code": "real_candidate_unavailable",
        "reason_code": reason,
        "assistant_message": "**真实候选未接通：**\n\n- 我没有生成占位候选。\n- 请先检查本机服务和模型配置。\n- 接通后再重新发送这条请求。",
        "request_echo": {"teacher_message": teacher_message, "candidate_generation": False},
        "card_updates": [],
        "next_actions": [{"label": "检查连接", "action_id": "check_connection"}],
        "safety_check": deepcopy(RESPONSE_SAFETY),
        "safety_flags": deepcopy(FALSE_SAFETY_FLAGS),
    }
