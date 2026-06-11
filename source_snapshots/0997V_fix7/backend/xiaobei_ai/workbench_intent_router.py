from __future__ import annotations

import re
from copy import deepcopy
from typing import Any

from . import workbench_context_manager as context_manager
from . import workbench_context_switch as context_switch
from . import workbench_teacher_input_analysis as teacher_input_analysis


ROUTER_VERSION = "064A_openclaw_like_safe_router_v1"
AUTONOMY_POLICY_VERSION = "065A_agent_autonomy_policy_v1"
DEFAULT_AUTONOMY_LEVEL = "L2_proactive_planning"
ROUTER_MODES = {"rule_first", "ai_assisted"}
INTENT_IDS = {
    "new_topic",
    "continue_current",
    "scope_correction",
    "semester_plan_request",
    "unit_brief_request",
    "lesson_brief_request",
    "lesson_count_update",
    "course_catalog_query",
    "planning_info_query",
    "topic_selection_needed",
    "task_object_update",
    "lesson_component_split_request",
    "field_edit_request",
    "teacher_feedback_or_quality_complaint",
    "official_field_question_start",
    "activity_refine_request",
    "task_sheet_request",
    "resource_request",
    "package_check_request",
    "clarification_needed",
    "unknown",
    "accept_last_candidate",
    "write_last_candidate_to_card",
    "apply_last_candidate_to_preview",
    "reject_last_candidate",
    "modify_last_candidate",
}
CONTEXT_POLICIES = {
    "reset_for_new_lesson",
    "update_current_context",
    "use_current_context",
    "ask_clarifying_question",
    "block_due_to_ambiguity",
}
NEXT_ACTIONS = {
    "generate_unit_brief_candidate",
    "generate_semester_plan_candidate",
    "generate_lesson_brief_candidate",
    "start_official_field_question_flow",
    "refine_activity_candidate",
    "generate_task_sheet_candidate",
    "start_semester_schedule_planning",
    "open_resource_cards",
    "open_package_check",
    "ask_teacher_for_missing_slots",
    "show_course_catalog_if_available",
    "ask_teacher_to_choose_topic",
    "ask_for_textbook_or_grade_plan",
    "acknowledge_feedback_and_explain",
    "revise_current_candidate_using_teacher_content",
    "no_generation_reply_only",
    "apply_last_candidate_to_preview",
    "update_task_object_memory",
    "split_lesson_components",
    "ask_which_field_to_edit",
    "reject_last_candidate",
}
AUTONOMY_NEXT_ACTION_ALIASES = {
    "ask_one_clarifying_question": "ask_teacher_for_missing_slots",
    "continue_current_task": "no_generation_reply_only",
}
FORBIDDEN_ACTIONS = {
    "write_database",
    "feishu_write",
    "formal_scoring",
    "classroom_app_connect",
    "student_submit_create",
    "real_export",
    "shell_execute",
    "file_write",
    "free_tool_execution",
    "arbitrary_file_access",
}
GENERIC_TOPIC_WORDS = {
    "当前课题",
    "当前备课",
    "一下",
    "弄一下",
    "公开课",
    "示范课",
    "一节公开课",
    "一节课",
    "课",
    "课程",
    "备课",
    "大单元",
    "单元",
    "主题",
    "课题",
    "有哪些课",
    "有哪些课程",
    "有哪些课题",
    "有哪些单元",
    "有哪些内容",
    "怎么办",
    "怎么上",
    "如何设计",
    "有什么课题",
}
TECHNICAL_TEACHER_TERMS = ["API", "backend", "dry-run", "mock", "candidate_content", "official_field_name"]
OLD_CONTEXT_TERMS = ["青绿中国色", "青绿山水", "qinglv", "color_collision"]
FALSE_SAFETY_FLAGS = {
    "database_write_allowed": False,
    "direct_write_allowed": False,
    "overwrite_content_allowed": False,
    "feishu_write_allowed": False,
    "formal_scoring_allowed": False,
    "classroom_app_connect_allowed": False,
    "student_submit_connect_allowed": False,
    "real_export_allowed": False,
    "real_download_allowed": False,
    "teacher_review_required": True,
}


def resolve_intent_route(payload: dict[str, Any], teacher_message: str | None = None) -> dict[str, Any]:
    request = payload if isinstance(payload, dict) else {}
    text = str(teacher_message if teacher_message is not None else request.get("teacher_message") or "").strip()
    teacher_analysis = request.get("teacher_input_analysis") if isinstance(request.get("teacher_input_analysis"), dict) else teacher_input_analysis.analyze_teacher_input(text, request.get("runtime_state") if isinstance(request.get("runtime_state"), dict) else {})
    router_mode = _router_mode(request)
    resolved_context = context_switch.resolve_request_context(request, text)
    context_state = context_manager.build_context_state(request, resolved_context)
    base_route = context_switch.detect_route(text, resolved_context)
    missing_slots = _missing_slots(resolved_context, text)
    intent_id = _intent_id(text, resolved_context, base_route, missing_slots, request)
    context_policy = _context_policy_for_intent(intent_id)
    next_action = _next_action_for_intent(intent_id, base_route, resolved_context, teacher_analysis)
    route_id = base_route if base_route == "activity_scope_clarification" else _route_for_next_action(next_action, base_route)
    confidence = _confidence(intent_id, missing_slots, resolved_context, text)
    confidence_policy = _confidence_policy(confidence, intent_id, missing_slots, text, resolved_context, teacher_analysis)
    assumption = _assumption_payload(intent_id, next_action, confidence_policy, resolved_context, text, request)
    updated_context = context_manager.apply_context_policy(
        context_state,
        context_policy,
        {
            "topic": _public_topic(resolved_context),
            "grade": resolved_context.get("grade"),
            "subject": resolved_context.get("subject"),
            "lesson_no": resolved_context.get("lesson_no"),
            "design_scope": resolved_context.get("design_scope"),
            "planned_lessons": resolved_context.get("planned_lessons"),
            "missing_slots": missing_slots,
            "last_candidate": _last_candidate_from_request(request),
        },
    )
    if missing_slots:
        updated_context["pending_questions"] = missing_slots

    teacher_reply = _teacher_reply(intent_id, resolved_context, missing_slots)
    decision = {
        "success": True,
        "mode": "workbench_intent_router",
        "router_version": ROUTER_VERSION,
        "router_mode": router_mode,
        "route_source": "backend_runtime_router",
        "teacher_message": text,
        "intent": {
            "intent_id": intent_id,
            "confidence": confidence,
            "teacher_readable_reason": _teacher_reason(intent_id, resolved_context, missing_slots),
        },
        "entities": {
            "grade": resolved_context.get("grade"),
            "subject": resolved_context.get("subject"),
            "topic": _public_topic(resolved_context),
            "design_scope": resolved_context.get("design_scope"),
            "planned_lessons": resolved_context.get("planned_lessons"),
            "lesson_no": resolved_context.get("lesson_no"),
        },
        "missing_slots": missing_slots,
        "context_policy": context_policy,
        "next_action": next_action,
        "route_id": route_id,
        "teacher_reply": teacher_reply,
        "teacher_reply_hint": teacher_reply,
        "autonomy_policy": {
            "policy_version": AUTONOMY_POLICY_VERSION,
            "autonomy_level": DEFAULT_AUTONOMY_LEVEL,
            "l3_execute_enabled": False,
            "teacher_confirmation_required": True,
        },
        "confidence_policy": confidence_policy,
        "assumption_text": assumption.get("assumption_text", ""),
        "assumption_source": assumption.get("assumption_source", ""),
        "teacher_can_correct": bool(assumption.get("teacher_can_correct", False)),
        "teacher_input_analysis": deepcopy(teacher_analysis),
        "updated_context": updated_context,
        "request_patch": _request_patch(resolved_context, context_policy, intent_id),
        "resolved_context": resolved_context,
        "guard": _guard_result(next_action, teacher_reply),
        "safety_flags": deepcopy(FALSE_SAFETY_FLAGS),
    }
    decision = _guard_decision(decision)
    decision["canonical_route_context"] = _canonical_route_context(decision)
    decision["route_consistency"] = _route_consistency(request, decision)
    return decision


def public_decision(decision: dict[str, Any]) -> dict[str, Any]:
    return {
        "success": bool(decision.get("success", True)),
        "mode": decision.get("mode"),
        "router_version": decision.get("router_version"),
        "router_mode": decision.get("router_mode"),
        "route_source": decision.get("route_source") or "backend_runtime_router",
        "intent": deepcopy(decision.get("intent") or {}),
        "entities": deepcopy(decision.get("entities") or {}),
        "missing_slots": list(decision.get("missing_slots") or []),
        "context_policy": decision.get("context_policy"),
        "next_action": decision.get("next_action"),
        "route_id": decision.get("route_id"),
        "teacher_reply": decision.get("teacher_reply"),
        "teacher_reply_hint": decision.get("teacher_reply_hint"),
        "autonomy_policy": deepcopy(decision.get("autonomy_policy") or {}),
        "confidence_policy": deepcopy(decision.get("confidence_policy") or {}),
        "assumption_text": decision.get("assumption_text") or "",
        "assumption_source": decision.get("assumption_source") or "",
        "teacher_can_correct": bool(decision.get("teacher_can_correct", False)),
        "teacher_input_analysis": deepcopy(decision.get("teacher_input_analysis") or {}),
        "updated_context": deepcopy(decision.get("updated_context") or {}),
        "resolved_context": _public_resolved_context(decision.get("resolved_context") or {}),
        "canonical_route_context": deepcopy(decision.get("canonical_route_context") or {}),
        "route_consistency": deepcopy(decision.get("route_consistency") or {}),
        "guard": deepcopy(decision.get("guard") or {}),
        "safety_flags": deepcopy(FALSE_SAFETY_FLAGS),
    }


def route_preview(payload: dict[str, Any]) -> tuple[dict[str, Any], int]:
    request = payload if isinstance(payload, dict) else {}
    decision = resolve_intent_route(request, str(request.get("teacher_message") or ""))
    return public_decision(decision), 200


def is_clarification_needed(decision: dict[str, Any]) -> bool:
    return (decision.get("intent") or {}).get("intent_id") == "clarification_needed"


def _router_mode(payload: dict[str, Any]) -> str:
    requested = str(payload.get("router_mode") or "rule_first").strip()
    if requested == "ai_assisted":
        return "ai_assisted"
    return "rule_first"


def _intent_id(text: str, context: dict[str, Any], route_id: str, missing_slots: list[str], payload: dict[str, Any]) -> str:
    compact = str(text or "").replace(" ", "")
    context_intent = str(context.get("context_intent") or "")
    policy = str(context.get("context_policy") or "")
    if _looks_like_teacher_feedback_or_quality_complaint(text):
        return "teacher_feedback_or_quality_complaint"
    if _looks_like_reject_last_candidate(text):
        return "reject_last_candidate" if _last_candidate_from_request(payload) else "clarification_needed"
    if _looks_like_modify_last_candidate(text):
        return "modify_last_candidate" if _last_candidate_from_request(payload) else "clarification_needed"
    if (
        route_id == "semester_plan"
        or context_intent == "semester_plan_request"
        or context.get("design_scope") == "semester"
    ) and any(key in compact for key in ["生成", "预览", "教学工作计划", "学期计划", "学期规划", "课务安排", "右侧基础信息"]):
        return "semester_plan_request"
    if _looks_like_apply_last_candidate(text):
        candidate = _last_candidate_from_request(payload)
        if not candidate:
            missing_slots.append("last_candidate")
            return "clarification_needed"
        if str(candidate.get("status") or "") == "rejected":
            missing_slots.append("active_candidate")
            return "clarification_needed"
        if any(key in compact for key in ["写进卡片", "写入卡片", "放进卡片", "放入卡片", "放到右边", "写到右边", "写进去", "写入", "再次写入", "重新写入"]):
            return "write_last_candidate_to_card"
        if any(key in compact for key in ["放入预览", "本次备课预览"]):
            return "apply_last_candidate_to_preview"
        return "accept_last_candidate"
    if _looks_like_course_catalog_query(text):
        return "course_catalog_query"
    if _looks_like_planning_info_query(text):
        return "planning_info_query"
    if missing_slots:
        return "clarification_needed"
    if _looks_like_lesson_component_split(text):
        return "lesson_component_split_request"
    if _looks_like_field_edit_request(text):
        return "field_edit_request"
    if _looks_like_task_object_update(text, context, payload):
        return "task_object_update"
    if any(key in compact for key in ["官方字段追问", "字段追问", "按官方字段", "进入字段追问", "关键字段", "确认字段", "字段确认"]):
        return "official_field_question_start"
    if route_id == "task_sheet":
        return "task_sheet_request"
    if route_id == "resources":
        return "resource_request"
    if route_id == "package_check":
        return "package_check_request"
    if route_id in {"activity_refine", "activity_scope_clarification"}:
        return "activity_refine_request"
    if _looks_like_lesson_count_update(text, context):
        return "lesson_count_update"
    if (route_id == "unit_brief" or context_intent == "unit_brief_request") and "怎么办" in compact and context.get("current_topic_locked"):
        return "continue_current"
    if _looks_like_proactive_unit_request(text) and context.get("current_topic_locked"):
        return "unit_brief_request"
    if _looks_like_proactive_framework_request(text) and context.get("current_topic_locked"):
        if context.get("design_scope") == "semester":
            return "semester_plan_request"
        if context.get("design_scope") == "unit" or "大单元" in compact or "单元" in compact:
            return "unit_brief_request"
        return "lesson_brief_request"
    if route_id == "semester_plan" or context_intent == "semester_plan_request":
        return "semester_plan_request" if policy != "reset_for_new_lesson" else "new_topic"
    if context_intent == "scope_correction":
        return "scope_correction"
    if route_id == "unit_brief" or context_intent == "unit_brief_request":
        if "怎么办" in compact and context.get("current_topic_locked"):
            return "continue_current"
        return "unit_brief_request" if policy != "reset_for_new_lesson" else "new_topic"
    if route_id == "lesson_brief":
        return "new_topic" if policy == "reset_for_new_lesson" else "lesson_brief_request"
    if policy == "reset_for_new_lesson" or context_intent == "new_topic":
        return "new_topic"
    if policy == "use_current_context" or context.get("current_topic_locked"):
        if _looks_like_proactive_continue(text):
            if context.get("design_scope") == "semester":
                return "semester_plan_request"
            if context.get("design_scope") == "unit":
                return "unit_brief_request"
            return "lesson_brief_request"
        return "continue_current"
    return "unknown"


def _missing_slots(context: dict[str, Any], text: str) -> list[str]:
    missing: list[str] = []
    policy = str(context.get("context_policy") or "")
    raw_topic = str(context.get("raw_topic") or "").strip()
    topic = str(context.get("topic") or "").strip()
    compact = str(text or "").replace(" ", "")
    if policy == "reset_for_new_lesson" and (not raw_topic or _is_generic_topic(raw_topic) or _is_generic_topic(topic)):
        missing.append("topic")
    if (
        policy != "reset_for_new_lesson"
        and _looks_like_low_context_generation_request(text)
        and not context.get("current_topic_locked")
        and (_is_generic_topic(raw_topic) or _is_generic_topic(topic))
    ):
        missing.append("topic")
    if any(key in compact for key in ["单课还是大单元", "什么层级", "备课层级"]) and context.get("design_scope") == "unknown":
        missing.append("design_scope")
    return list(dict.fromkeys(missing[:1]))


def _context_policy_for_intent(intent_id: str) -> str:
    if intent_id == "new_topic":
        return "reset_for_new_lesson"
    if intent_id in {"scope_correction", "lesson_count_update", "task_object_update", "lesson_component_split_request", "field_edit_request"}:
        return "update_current_context"
    if intent_id in {"semester_plan_request", "course_catalog_query", "planning_info_query"}:
        return "use_current_context"
    if intent_id in {"clarification_needed", "topic_selection_needed"}:
        return "ask_clarifying_question"
    if intent_id == "teacher_feedback_or_quality_complaint":
        return "use_current_context"
    if intent_id == "unknown":
        return "block_due_to_ambiguity"
    return "use_current_context"


def _next_action_for_intent(
    intent_id: str,
    route_id: str,
    context: dict[str, Any],
    teacher_analysis: dict[str, Any] | None = None,
) -> str:
    if intent_id in {"clarification_needed", "topic_selection_needed"}:
        return "ask_teacher_for_missing_slots"
    if intent_id == "teacher_feedback_or_quality_complaint":
        if teacher_input_analysis.has_content_payload(teacher_analysis):
            return "revise_current_candidate_using_teacher_content"
        return "acknowledge_feedback_and_explain"
    if intent_id == "course_catalog_query":
        return "ask_teacher_to_choose_topic"
    if intent_id == "planning_info_query":
        return "ask_for_textbook_or_grade_plan"
    if intent_id == "task_object_update":
        return "update_task_object_memory"
    if intent_id == "lesson_component_split_request":
        return "split_lesson_components"
    if intent_id == "field_edit_request":
        return "ask_which_field_to_edit"
    if intent_id in {"accept_last_candidate", "write_last_candidate_to_card", "apply_last_candidate_to_preview"}:
        return "apply_last_candidate_to_preview"
    if intent_id == "reject_last_candidate":
        return "reject_last_candidate"
    if intent_id == "modify_last_candidate":
        return "ask_which_field_to_edit"
    if intent_id == "official_field_question_start":
        return "start_official_field_question_flow"
    if intent_id == "continue_current":
        if context.get("design_scope") == "semester":
            return "start_semester_schedule_planning"
        if context.get("design_scope") == "unit":
            return "generate_unit_brief_candidate"
        if context.get("current_topic_locked"):
            return "generate_lesson_brief_candidate"
        return "no_generation_reply_only"
    if intent_id == "semester_plan_request":
        return "start_semester_schedule_planning"
    if intent_id == "task_sheet_request":
        return "generate_task_sheet_candidate"
    if intent_id == "resource_request":
        return "open_resource_cards"
    if intent_id == "package_check_request":
        return "open_package_check"
    if intent_id == "activity_refine_request":
        if route_id == "activity_scope_clarification":
            return "no_generation_reply_only"
        return "refine_activity_candidate"
    if intent_id in {"scope_correction", "unit_brief_request", "lesson_count_update"}:
        return "generate_unit_brief_candidate" if context.get("design_scope") == "unit" else "generate_lesson_brief_candidate"
    if intent_id in {"new_topic", "lesson_brief_request"}:
        if context.get("design_scope") == "semester":
            return "start_semester_schedule_planning"
        return "generate_unit_brief_candidate" if context.get("design_scope") == "unit" else "generate_lesson_brief_candidate"
    if route_id == "semester_plan":
        return "start_semester_schedule_planning"
    if route_id == "unit_brief":
        return "generate_unit_brief_candidate"
    if route_id == "lesson_brief":
        return "generate_lesson_brief_candidate"
    return "no_generation_reply_only"


def _route_for_next_action(next_action: str, fallback_route: str) -> str:
    return {
        "generate_unit_brief_candidate": "unit_brief",
        "generate_semester_plan_candidate": "semester_plan",
        "start_semester_schedule_planning": "semester_schedule_planning",
        "generate_lesson_brief_candidate": "lesson_brief",
        "start_official_field_question_flow": "official_field_question",
        "refine_activity_candidate": "activity_refine",
        "generate_task_sheet_candidate": "task_sheet",
        "open_resource_cards": "resources",
        "open_package_check": "package_check",
        "ask_teacher_for_missing_slots": "fallback",
        "show_course_catalog_if_available": "course_catalog",
        "ask_teacher_to_choose_topic": "course_catalog",
        "ask_for_textbook_or_grade_plan": "planning_info",
        "acknowledge_feedback_and_explain": "feedback_acknowledgement",
        "revise_current_candidate_using_teacher_content": "feedback_revision",
        "apply_last_candidate_to_preview": "apply_last_candidate",
        "update_task_object_memory": "task_object_update",
        "split_lesson_components": "lesson_component_split",
        "ask_which_field_to_edit": "field_edit",
        "reject_last_candidate": "candidate_reject",
        "no_generation_reply_only": fallback_route if fallback_route != "download_manifest" else "fallback",
    }.get(next_action, "fallback")


def _teacher_reply(intent_id: str, context: dict[str, Any], missing_slots: list[str]) -> str:
    topic = _public_topic(context) or "当前课题"
    lessons = context.get("planned_lessons") or 3
    grade = str(context.get("grade") or "").strip()
    subject = str(context.get("subject") or "美术").strip()
    grade_subject = f"{grade}{subject}".strip() or "这个年级"
    if intent_id == "course_catalog_query":
        return f"我当前还没有接入{grade_subject}教材目录，不能假装已经查到完整课题。你可以上传目录，或告诉我想备哪一课，我再帮你进入备课。"
    if intent_id == "planning_info_query":
        return f"我当前还没有接入{grade_subject}的学期目录或进度表，不能直接给出完整安排。你可以上传教材目录、学期计划，或告诉我想备哪一课。"
    if intent_id == "teacher_feedback_or_quality_complaint":
        return (
            "你说得对，这里像占位模板，不应该继续生成教案。"
            "我先把这条理解为“占位信息过多 / 反馈语义”的问题。"
            "接下来可以重新生成一版更具体的课时组件，或按表格结构重做。"
        )
    if intent_id in {"clarification_needed", "topic_selection_needed"}:
        if "last_candidate" in missing_slots:
            return "我还没有看到可以放入工作卡的候选内容。你想先让我生成哪一种候选？"
        if "active_candidate" in missing_slots:
            return "刚才那版已经标记为不采用了，不能再直接放入预览。你可以让我重新生成一版，或指定另一版候选。"
        known = f"{grade}{subject}".strip()
        if "topic" in missing_slots and known:
            return f"我读到你要备{known}。你想备哪个课题或单元？"
        return "我先确认一下：你想备哪一课或哪个单元？"
    if intent_id in {"accept_last_candidate", "write_last_candidate_to_card", "apply_last_candidate_to_preview"}:
        topic = _last_candidate_topic(context)
        return f"可以，我把《{topic}》候选放入本次备课预览。确认前不会进入最终成果包。"
    if intent_id == "reject_last_candidate":
        return "好的，我先不采用这版候选，右侧预览不会更新。"
    if intent_id == "modify_last_candidate":
        return "可以，我先确认你想改哪个字段，再只处理那一处。确认前不会进入最终成果包。"
    if intent_id == "scope_correction":
        return f"明白，我把《{topic}》切换为{lessons}课时大单元。接下来我先帮你搭单元框架。"
    if intent_id == "lesson_count_update":
        return f"收到，我把《{topic}》补充为{lessons}课时结构。"
    if intent_id == "task_object_update":
        return f"收到，我把补充信息更新到《{topic}》当前任务里，先不重生成整套框架。"
    if intent_id == "lesson_component_split_request":
        return f"好，我进入《{topic}》的课时部分，先拆第1课时、第2课时、第3课时的组件。"
    if intent_id == "field_edit_request":
        return "你想先改大观念、基本问题，还是三课时安排？我会只处理你选的字段，不重生成整套框架。"
    if intent_id == "semester_plan_request":
        return (
            "可以，学期计划不能在信息不全时直接写成通用文档。"
            "我先打开“学期课务安排”，先和你确认课务日程，再生成教学工作计划预览。"
            "先告诉我：这是哪个学期、哪个年级学科？"
        )
    if intent_id == "official_field_question_start":
        return "可以，我们先不用写完整教案，我会按官方字段一步步问你。"
    if intent_id == "new_topic":
        if context.get("design_scope") == "semester":
            return (
                "收到，我先进入“学期课务安排”，不会直接生成通用学期计划。"
                "先确认：这是哪个学期、哪个年级学科？"
            )
        if context.get("design_scope") == "unit":
            return f"收到，我先按《{topic}》开启大单元候选框架。"
        return f"收到，我先按《{topic}》开启新的备课候选。"
    if intent_id == "unit_brief_request":
        return f"我先按《{topic}》大单元来处理，整理一版单元框架。"
    if intent_id == "lesson_brief_request":
        return f"我先按《{topic}》课时备课来处理，整理一版课时框架。"
    if intent_id == "activity_refine_request":
        if context.get("design_scope") == "unit" and not context.get("legacy_qinglv_continue"):
            return (
                f"我先确认一下：你说的“活动二”，是要精修《{topic}》第2课时里的活动，"
                "还是要切回之前旧课题的活动二？你可以回“精修当前第2课时”。"
            )
        return f"我会继续在《{topic}》里处理活动精修，先确认范围再给候选。"
    if intent_id == "task_sheet_request":
        return f"我会基于《{topic}》生成学生任务单候选，确认前不会写入正式成果。"
    if intent_id == "resource_request":
        return f"我会围绕《{topic}》打开资源建议。"
    if intent_id == "package_check_request":
        return "我会检查当前教学包还缺哪些内容，保持候选预览状态。"
    return "我先确认你的下一步意图，再继续处理当前备课。"


def _teacher_reason(intent_id: str, context: dict[str, Any], missing_slots: list[str]) -> str:
    topic = _public_topic(context) or "当前课题"
    if intent_id == "course_catalog_query":
        return "老师在询问课程目录或可选课题，不是直接要求生成教案。"
    if intent_id == "planning_info_query":
        return "老师在询问学期或周次内容安排，不是直接要求生成教案。"
    if intent_id == "teacher_feedback_or_quality_complaint":
        return "老师在反馈回复像占位或模板，不是要求继续生成备课内容。"
    if intent_id in {"clarification_needed", "topic_selection_needed"}:
        return f"还缺少关键信息：{','.join(missing_slots) or '课题'}。"
    if intent_id in {"accept_last_candidate", "write_last_candidate_to_card", "apply_last_candidate_to_preview"}:
        return "老师正在把最近一次候选放入当前工作卡预览。"
    if intent_id == "scope_correction":
        return "老师在修正当前课题的备课层级。"
    if intent_id == "lesson_count_update":
        return "老师在补充当前课题的课时数量。"
    if intent_id == "task_object_update":
        return "老师在补充当前任务对象的材料、限制或课时侧重。"
    if intent_id == "lesson_component_split_request":
        return "老师要进入课时部分，应该拆课时组件而不是重新生成大单元。"
    if intent_id == "field_edit_request":
        return "老师要修改候选里的具体字段。"
    if intent_id == "new_topic":
        return f"老师正在开启新的备课主题：{topic}。"
    return f"老师正在继续当前备课：{topic}。"


def _confidence(intent_id: str, missing_slots: list[str], context: dict[str, Any], text: str = "") -> float:
    if intent_id in {"course_catalog_query", "planning_info_query"}:
        return 0.78
    if intent_id == "teacher_feedback_or_quality_complaint":
        return 0.88
    if intent_id in {"clarification_needed", "topic_selection_needed"}:
        return 0.42 if missing_slots else 0.56
    if _needs_assumption(text, intent_id, context):
        return 0.72
    if intent_id in {"scope_correction", "lesson_count_update", "task_object_update", "lesson_component_split_request", "field_edit_request"}:
        return 0.9
    if context.get("current_topic_locked"):
        return 0.86
    if intent_id == "unknown":
        return 0.45
    return 0.8


def _confidence_policy(
    confidence: float,
    intent_id: str,
    missing_slots: list[str],
    text: str,
    context: dict[str, Any],
    teacher_analysis: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if intent_id in {"course_catalog_query", "planning_info_query"}:
        band = "low_confidence"
        behavior = "ask_one_topic_selection_question"
    elif intent_id == "teacher_feedback_or_quality_complaint":
        band = "high_confidence"
        behavior = "preserve_content_and_acknowledge_feedback" if teacher_input_analysis.has_content_payload(teacher_analysis) else "acknowledge_feedback_without_generation"
    elif missing_slots or intent_id in {"clarification_needed", "topic_selection_needed"} or confidence < 0.6:
        band = "low_confidence"
        behavior = "ask_one_clarifying_question"
    elif intent_id in {"task_object_update", "lesson_component_split_request", "field_edit_request"}:
        band = "high_confidence"
        behavior = "select_safe_skill"
    elif _needs_assumption(text, intent_id, context) or confidence < 0.85:
        band = "medium_confidence"
        behavior = "assume_then_generate_candidate"
    else:
        band = "high_confidence"
        behavior = "generate_candidate_directly"
    return {
        "policy_version": AUTONOMY_POLICY_VERSION,
        "confidence": confidence,
        "confidence_band": band,
        "behavior": behavior,
        "one_question_only": band == "low_confidence",
        "teacher_confirmation_required": True,
    }


def _assumption_payload(
    intent_id: str,
    next_action: str,
    confidence_policy: dict[str, Any],
    context: dict[str, Any],
    text: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    if confidence_policy.get("confidence_band") != "medium_confidence":
        return {"assumption_text": "", "assumption_source": "", "teacher_can_correct": False}
    topic = _public_topic(context) or _last_candidate_topic_from_request(payload) or "当前课题"
    lessons = context.get("planned_lessons") or 3
    if next_action == "apply_last_candidate_to_preview":
        candidate_topic = _last_candidate_topic_from_request(payload) or topic
        return {
            "assumption_text": f"我先按刚才那版《{candidate_topic}》候选来处理。如果不是这版，你可以直接说“不要这版”。",
            "assumption_source": "last_candidate",
            "teacher_can_correct": True,
        }
    if next_action == "generate_unit_brief_candidate" or intent_id in {"unit_brief_request", "scope_correction", "lesson_count_update"}:
        return {
            "assumption_text": f"我先按《{topic}》{lessons}课时大单元来处理。如果不是这个方向，你可以直接说“改成单课”。",
            "assumption_source": "current_context",
            "teacher_can_correct": True,
        }
    if next_action == "start_semester_schedule_planning" or intent_id == "semester_plan_request":
        return {
            "assumption_text": "我先按学期课务安排来处理，先协商周次和课时，不直接生成通用计划文档。",
            "assumption_source": "teacher_message_and_current_context",
            "teacher_can_correct": True,
        }
    if next_action == "generate_lesson_brief_candidate":
        return {
            "assumption_text": f"我先按《{topic}》课时备课来处理。如果这是大单元，你可以直接说“改成大单元”。",
            "assumption_source": "current_context",
            "teacher_can_correct": True,
        }
    return {"assumption_text": "", "assumption_source": "", "teacher_can_correct": False}


def _guard_decision(decision: dict[str, Any]) -> dict[str, Any]:
    guard = _guard_result(str(decision.get("next_action") or ""), str(decision.get("teacher_reply") or ""))
    decision["guard"] = guard
    if not guard["accepted"]:
        decision["success"] = False
        decision["context_policy"] = "block_due_to_ambiguity"
        decision["next_action"] = "no_generation_reply_only"
        decision["route_id"] = "fallback"
        decision["teacher_reply"] = "这个请求需要先确认安全边界，我不会执行写入、评分、发布或导出。"
        decision["teacher_reply_hint"] = decision["teacher_reply"]
    return decision


def _canonical_route_context(decision: dict[str, Any]) -> dict[str, Any]:
    intent = decision.get("intent") if isinstance(decision.get("intent"), dict) else {}
    return {
        "source": "backend_runtime_router",
        "source_version": ROUTER_VERSION,
        "route_source": "backend_runtime_router",
        "router_mode": decision.get("router_mode"),
        "intent_id": intent.get("intent_id") or "",
        "route_id": decision.get("route_id") or "",
        "next_action": decision.get("next_action") or "",
        "context_policy": decision.get("context_policy") or "",
        "entities": deepcopy(decision.get("entities") or {}),
        "missing_slots": list(decision.get("missing_slots") or []),
        "resolved_context": _public_resolved_context(decision.get("resolved_context") or {}),
        "updated_context": deepcopy(decision.get("updated_context") or {}),
        "teacher_review_required": True,
        "client_hint_used_as_fact": False,
    }


def _public_resolved_context(context: dict[str, Any]) -> dict[str, Any]:
    public = deepcopy(context if isinstance(context, dict) else {})
    public.pop("legacy_qinglv_continue", None)
    return public


def _route_consistency(request: dict[str, Any], decision: dict[str, Any]) -> dict[str, Any]:
    hints = _client_route_hints(request)
    mismatches: list[dict[str, Any]] = []
    canonical = {
        "intent_id": ((decision.get("intent") or {}).get("intent_id")) or "",
        "route_id": decision.get("route_id") or "",
        "next_action": decision.get("next_action") or "",
        "context_policy": decision.get("context_policy") or "",
    }
    for key, hinted in hints.items():
        if not hinted:
            continue
        target_key = "intent_id" if key in {"detected_intent", "intent_id"} else key
        actual = canonical.get(target_key)
        if actual and str(hinted) != str(actual):
            mismatches.append({"field": target_key, "client_hint": hinted, "backend_canonical": actual})
    return {
        "canonical_source": "backend_runtime_router",
        "client_hint_seen": bool(hints),
        "client_hint_used_as_fact": False,
        "mismatches": mismatches,
        "accepted": True,
    }


def _client_route_hints(request: dict[str, Any]) -> dict[str, Any]:
    payload = request if isinstance(request, dict) else {}
    hint = payload.get("frontend_route_hint") if isinstance(payload.get("frontend_route_hint"), dict) else {}
    legacy = payload.get("intent_route_decision") if isinstance(payload.get("intent_route_decision"), dict) else {}
    detected_context = payload.get("detected_context") if isinstance(payload.get("detected_context"), dict) else {}
    legacy_intent = legacy.get("intent") if isinstance(legacy.get("intent"), dict) else {}
    hint_intent = hint.get("intent") if isinstance(hint.get("intent"), dict) else {}
    return {
        "intent_id": (
            hint.get("intent_id")
            or hint_intent.get("intent_id")
            or legacy_intent.get("intent_id")
            or payload.get("detected_intent")
            or detected_context.get("context_intent")
        ),
        "route_id": hint.get("route_id") or legacy.get("route_id"),
        "next_action": hint.get("next_action") or legacy.get("next_action"),
        "context_policy": hint.get("context_policy") or legacy.get("context_policy") or payload.get("context_policy"),
    }


def _guard_result(next_action: str, teacher_reply: str) -> dict[str, Any]:
    blocked: list[str] = []
    next_action = AUTONOMY_NEXT_ACTION_ALIASES.get(next_action, next_action)
    if next_action not in NEXT_ACTIONS:
        blocked.append(next_action or "missing_next_action")
    combined = f"{next_action} {teacher_reply}".lower()
    for action in FORBIDDEN_ACTIONS:
        if action.lower() in combined:
            blocked.append(action)
    for term in ["已保存", "已写入", "已评分", "已发布", "已导出"]:
        if term in teacher_reply:
            blocked.append(term)
    return {
        "accepted": not blocked,
        "blocked_actions": blocked,
        "teacher_review_required": True,
        "candidate_only": True,
    }


def _request_patch(context: dict[str, Any], context_policy: str, intent_id: str) -> dict[str, Any]:
    topic = _public_topic(context)
    return {
        "context_policy": context_policy,
        "detected_context": {
            "grade": context.get("grade"),
            "subject": context.get("subject"),
            "topic": "" if intent_id == "clarification_needed" else topic,
            "lesson_no": context.get("lesson_no"),
            "design_scope": context.get("design_scope"),
            "context_intent": intent_id,
            "planned_lessons": context.get("planned_lessons"),
            "current_topic_locked": bool(topic),
        },
        "current_task": {
            "topic": "" if intent_id == "clarification_needed" else topic,
            "grade": context.get("grade"),
            "subject": context.get("subject"),
            "lesson": context.get("lesson_no"),
            "design_scope": context.get("design_scope"),
            "planned_lessons": context.get("planned_lessons"),
            "context_intent": intent_id,
            "current_topic_locked": bool(topic),
        },
    }


def _looks_like_lesson_count_update(text: str, context: dict[str, Any]) -> bool:
    compact = str(text or "").replace(" ", "")
    has_count = bool(
        re.search(r"(?:有|共|一共|总共|设置为|按)\s*[一二三四五六七八九十\d]+\s*课时", text or "")
        or re.search(r"[一二三四五六七八九十\d]+\s*课时\s*(?:大单元|单元|结构|安排)", text or "")
        or re.search(r"分\s*[一二三四五六七八九十\d]+\s*节课", text or "")
    )
    if not has_count:
        return False
    has_scope_words = any(key in compact for key in ["大单元", "单元", "不是单课", "这是"])
    return not has_scope_words and bool(context.get("current_topic_locked"))


def _looks_like_lesson_component_split(text: str) -> bool:
    compact = str(text or "").replace(" ", "")
    return any(key in compact for key in ["进入课时部分", "课时部分", "课时组件", "拆第1课时", "拆第一课时", "拆课时"])


def _looks_like_field_edit_request(text: str) -> bool:
    compact = str(text or "").replace(" ", "")
    fields = ["大观念", "基本问题", "表现性任务", "三课时安排", "学习证据", "评价建议", "单元主题"]
    return any(field in compact for field in fields) and any(key in compact for key in ["修改", "改", "调整", "重写", "重新生成"])


def _looks_like_task_object_update(text: str, context: dict[str, Any], payload: dict[str, Any]) -> bool:
    compact = str(text or "").replace(" ", "")
    has_detail = any(key in compact for key in ["废旧材料", "超轻彩泥", "彩泥", "预算", "技法", "第一课时", "第1课时"])
    if not has_detail:
        return False
    if any(key in compact for key in ["我要备", "我想备", "帮我备", "新建", "新开"]):
        return False
    candidate = _last_candidate_from_request(payload)
    return bool(context.get("current_topic_locked") or candidate)


def _looks_like_proactive_unit_request(text: str) -> bool:
    compact = str(text or "").replace(" ", "")
    return any(key in compact for key in ["我要备大单元怎么办", "备大单元怎么办", "大单元怎么办", "先做大单元", "按大单元来"])


def _looks_like_proactive_framework_request(text: str) -> bool:
    compact = str(text or "").replace(" ", "")
    return any(key in compact for key in ["先出个框架", "出个框架", "先给我一个能用的版本", "先给个能用的版本", "先帮我弄一下", "帮我弄一下"])


def _looks_like_proactive_continue(text: str) -> bool:
    compact = str(text or "").replace(" ", "")
    return any(key in compact for key in ["帮我继续", "继续", "接着来", "继续弄", "继续做", "先帮我弄一下", "先给我一个能用的版本", "先出个框架"])


def _looks_like_low_context_generation_request(text: str) -> bool:
    compact = str(text or "").replace(" ", "")
    return any(key in compact for key in ["帮我备一下", "我要备大单元怎么办", "先帮我弄一下", "帮我弄一下", "帮我继续", "先出个框架", "先给我一个能用的版本"])


def _looks_like_teacher_feedback_or_quality_complaint(text: str) -> bool:
    compact = str(text or "").replace(" ", "")
    if not compact:
        return False
    if compact in {"这次不对", "不对", "不是这个", "不要这个", "放弃这个", "暂不采用"}:
        return False
    return any(key in compact for key in [
        "什么意思",
        "占位信息",
        "像占位",
        "占位模板",
        "像模板",
        "模板感",
        "不是AI回复",
        "非AI回复",
        "词不达意",
        "谁让你写教案",
        "不是让你继续生成",
        "我不是让你继续生成",
        "这不对",
        "这个太空",
        "太空了",
        "回复太空",
        "太空泛",
        "假内容",
        "你理解错了",
        "理解错了",
        "不是这个意思",
    ])


def _looks_like_course_catalog_query(text: str) -> bool:
    compact = str(text or "").replace(" ", "")
    if _has_explicit_generation_action(compact):
        return False
    return any(key in compact for key in [
        "有哪些课",
        "有哪些课程",
        "有哪些课题",
        "有什么课题",
        "有哪些教材课题",
        "有哪些教材内容",
        "有哪些单元",
        "美术有哪些内容",
        "美术有哪些单元",
        "上什么课",
        "上哪些课",
        "这个年级上什么",
    ])


def _looks_like_planning_info_query(text: str) -> bool:
    compact = str(text or "").replace(" ", "")
    if _has_explicit_generation_action(compact):
        return False
    return any(key in compact for key in [
        "这学期有哪些内容",
        "这学期要上什么",
        "本周有哪些课",
        "这个年级还有哪些单元",
        "这册有哪些内容",
        "下册有哪些内容",
        "上册有哪些内容",
    ])


def _has_explicit_generation_action(compact: str) -> bool:
    return any(key in compact for key in [
        "我要备",
        "我想备",
        "帮我备",
        "生成",
        "设计一节",
        "做一个",
        "做一节",
        "生成教案",
        "设计教案",
    ])


def _looks_like_lesson_start_without_topic(text: str) -> bool:
    compact = str(text or "").replace(" ", "")
    return any(key in compact for key in ["我要备", "我想备", "帮我备", "备一下", "备一节", "我要做", "我想做", "开始备课"])


def _needs_assumption(text: str, intent_id: str, context: dict[str, Any]) -> bool:
    if intent_id == "clarification_needed":
        return False
    compact = str(text or "").replace(" ", "")
    fuzzy = any(key in compact for key in [
        "怎么办",
        "弄一下",
        "帮我继续",
        "先出个框架",
        "能用的版本",
        "按刚才那个",
        "就这样",
        "按这个来",
        "就用这个",
    ])
    return fuzzy and bool(context.get("current_topic_locked") or context.get("design_scope") in {"unit", "semester"})


def _looks_like_apply_last_candidate(text: str) -> bool:
    compact = str(text or "").replace(" ", "")
    return any(key in compact for key in [
        "写进去",
        "写入",
        "再次写入",
        "重新写入",
        "帮我写进去",
        "先帮我写进去",
        "放进卡片",
        "放入卡片",
        "写进卡片",
        "写入卡片",
        "写到卡片",
        "写到右侧",
        "把上面的内容写进卡片",
        "把前面的内容写进卡片",
        "把前面足球之光的内容写进卡片",
        "把刚才的内容放进去",
        "把上面的内容放进去",
        "把前面的内容放进去",
        "就用这个",
        "按这个来",
        "按刚才那个来",
        "按刚才那个",
        "就这样写进去",
        "就这样放进去",
        "采纳这个",
        "放到右边",
        "用这版",
        "采用这版",
    ])


def _looks_like_reject_last_candidate(text: str) -> bool:
    compact = str(text or "").replace(" ", "")
    return any(key in compact for key in ["不要这个", "放弃这个", "暂不采用", "不用这版", "删掉候选", "这次不对", "不对", "不是这个"])


def _looks_like_modify_last_candidate(text: str) -> bool:
    compact = str(text or "").replace(" ", "")
    return any(key in compact for key in ["改一下这个", "修改这版", "继续改这个", "再润色这个", "调整这版"])


def _last_candidate_from_request(payload: dict[str, Any]) -> dict[str, Any]:
    sources = [
        payload.get("last_candidate"),
        payload.get("pending_candidate"),
        (payload.get("current_context") or {}).get("last_candidate") if isinstance(payload.get("current_context"), dict) else None,
        (payload.get("current_context") or {}).get("pending_candidate") if isinstance(payload.get("current_context"), dict) else None,
    ]
    for source in sources:
        if isinstance(source, dict) and source:
            return deepcopy(source)
    return {}


def _last_candidate_topic_from_request(payload: dict[str, Any]) -> str:
    candidate = _last_candidate_from_request(payload)
    return str(candidate.get("topic") or "").strip()


def _last_candidate_topic(context: dict[str, Any]) -> str:
    return _public_topic(context) or "当前课题"


def _public_topic(context: dict[str, Any]) -> str:
    raw = str(context.get("raw_topic") or context.get("topic") or "").strip()
    return "" if _is_generic_topic(raw) else raw


def _is_generic_topic(value: Any) -> bool:
    text = str(value or "").strip("《》 ：:，。")
    return not text or text in GENERIC_TOPIC_WORDS or text.endswith("公开课") or _is_question_like_topic(text)


def _is_question_like_topic(value: str) -> bool:
    compact = str(value or "").replace(" ", "")
    return any(key in compact for key in [
        "有哪些课",
        "有哪些课程",
        "有哪些课题",
        "有什么课题",
        "有哪些单元",
        "有哪些内容",
        "教材内容",
        "怎么办",
        "怎么上",
        "如何设计",
        "怎么设计",
        "怎么做",
        "怎么弄",
    ])
