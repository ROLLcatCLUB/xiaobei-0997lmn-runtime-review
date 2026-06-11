from __future__ import annotations

import re
from copy import deepcopy
from typing import Any

from . import workbench_context_switch as context_switch

SESSION_ID = "wb_20260514_grade3_qinglv_lesson2"
ALLOWED_STATUSES = {"candidate", "pending_review", "preview", "ready_for_teacher_review"}
ALLOWED_CARD_IDS = {"activity_2_candidate", "task_sheet_candidate", "lesson_brief_candidate", "unit_brief_candidate", "semester_plan_candidate"}
FALSE_SAFETY_FLAGS = {
    "direct_write_allowed": False,
    "overwrite_content_allowed": False,
    "feishu_write_allowed": False,
    "formal_scoring_allowed": False,
    "classroom_app_connect_allowed": False,
    "student_submit_connect_allowed": False,
    "real_download_allowed": False,
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
FORBIDDEN_TRUE_KEYS = {
    "direct_write",
    "overwrite_content",
    "content_write_allowed",
    "direct_write_allowed",
    "overwrite_content_allowed",
    "feishu_write_allowed",
    "formal_scoring_allowed",
    "classroom_app_connect_allowed",
    "student_submit_connect_allowed",
    "real_download_allowed",
}
FORBIDDEN_TEACHER_TERMS = [
    "API",
    "backend",
    "dry-run",
    "mock",
    "candidate_content",
    "app_link",
    "direct_write",
    "overwrite_content",
    "feishu_write",
    "formal_scoring",
]
FORBIDDEN_TEACHER_PHRASES = ["score", "grade", "成绩", "分数", "已保存", "已写入", "已推送", "已发布"]
INTERNAL_TARGET_LABELS = {
    "task_sheet": "学生任务单",
    "student_task_sheet": "学生任务单",
    "evaluation_evidence": "评价证据",
    "learning_evidence": "评价证据",
    "teaching_package": "教学包检查",
    "package_check": "教学包检查",
    "student_engagement": "学生参与",
    "color_theory_exploration": "色彩规律探索",
    "observation_skill_development": "观察能力培养",
    "活动二难度": "活动二难度",
    "学生操作流程": "学生操作流程",
    "学生任务单": "学生任务单",
    "评价证据": "评价证据",
    "教学包检查": "教学包检查",
}


def normalize_and_guard_response(raw_response: Any, request_payload: dict[str, Any], route: str) -> dict[str, Any]:
    """Normalize an AI candidate response and reject unsafe output.

    The guard is deliberately conservative: any attempt to write formal content,
    update a locked card, score students, connect external classroom features, or
    expose implementation language falls back to a safe candidate response.
    """

    if not isinstance(raw_response, dict):
        return safe_candidate_response(route, request_payload, "response_not_object")

    locked_cards = set(request_payload.get("locked_cards") or [])
    allowed_ids = _allowed_card_ids_for_route(route)
    try:
        _assert_no_true_flags(raw_response)
        _assert_teacher_text_clean(str(raw_response.get("assistant_message") or ""), "assistant_message")
        _assert_safety(raw_response)
        card_updates = raw_response.get("card_updates")
        if not isinstance(card_updates, list):
            raise ValueError("card_updates must be list")
        for update in card_updates:
            _assert_card_update(update, locked_cards, allowed_ids)
        normalized = _normalize_shape(raw_response, request_payload, route)
        return normalized
    except Exception:
        return safe_candidate_response(route, request_payload, "guard_rejected")


def safe_candidate_response(route: str, request_payload: dict[str, Any] | None = None, reason: str = "safe_fallback") -> dict[str, Any]:
    payload = request_payload or {}
    context = context_switch.context_from_payload(payload)
    locked_cards = set(payload.get("locked_cards") or [])
    if route == "general_chat":
        return {
            "response_id": "real_candidate_safe_general_chat_001",
            "session_id": str(payload.get("session_id") or SESSION_ID),
            "assistant_message": "**我在。**\n\n- 你可以直接告诉我想继续处理哪一块。\n- 我会按真实候选模式生成内容。\n- 确认前不会写入正式成果。",
            "intent": {
                "intent_id": "general_chat",
                "confidence": 0.68,
                "teacher_readable_reason": "老师正在和小备进行普通备课对话。",
            },
            "card_updates": [],
            "next_actions": _actions(["继续修改", "生成任务单", "检查教学包"]),
            "safety_check": deepcopy(RESPONSE_SAFETY),
            "guard_status": "safe_candidate",
            "guard_reason": reason,
        }
    if route == "unit_brief":
        card_id = "unit_brief_candidate"
        title = context_switch.title_for_route(route, context)
        topic = context.get("topic") or "当前课题"
        message = f"**明白，我把《{topic}》切换为大单元。**\n\n- 我先搭一版大单元框架。\n- 右侧会显示单元主题、大观念、基本问题、表现性任务和课时安排。\n- 现在仍是候选，等你确认后再进入本次备课预览。"
        candidate_text = context_switch.build_unit_brief_text(context)
        summary = f"已形成《{topic}》大单元候选框架，等待老师确认。"
        next_actions = _actions(["修改某个字段", "重新生成某个字段", "进入课时部分"])
        intent_id = "unit_brief"
    elif route == "semester_plan":
        card_id = "semester_plan_candidate"
        title = context_switch.title_for_route(route, context)
        message = f"**我切到{context_switch.semester_task_label(context)}。**\n\n- 我先搭一版教学工作计划候选。\n- 右侧会显示规划目标、教学内容与进度、周次节奏、学习证据和评价建议。\n- 现在仍是候选，等你确认后再进入本次备课预览。"
        candidate_text = context_switch.build_semester_plan_text(context)
        summary = "已生成教学工作计划候选，教材目录可稍后补充，等待老师复核活动周和课务节奏。"
        next_actions = _actions(["补充教材目录", "调整活动周", "生成课务日程", "查看教学工作计划"])
        intent_id = "semester_plan"
    elif route == "lesson_brief":
        card_id = "lesson_brief_candidate"
        title = context_switch.title_for_route(route, context)
        label = context_switch.current_task_label(context)
        message = f"**{label}备课候选：**\n\n- 已按当前课题整理备课框架。\n- 右侧会打开课时目标、教学流程、核心活动和学习证据候选。\n- 现在只作为候选内容，等你确认后再进入本次备课预览。"
        candidate_text = context_switch.build_lesson_brief_text(context)
        summary = "已形成课时目标、教学流程、核心活动、学生任务和学习证据的候选框架。"
        next_actions = _actions(["继续修改", "生成任务单", "检查教学包"])
        intent_id = "lesson_brief"
    elif route == "task_sheet":
        card_id = "task_sheet_candidate"
        title = "学生任务单草稿"
        message = "**学生任务单草稿：**\n\n- 已按当前课题整理成学生能直接完成的任务单草稿。\n- 状态保持“待老师确认”。\n- 确认前不会进入最终成果包，你可以继续调整任务难度或表达方式。"
        candidate_text = _enhanced_task_sheet_text("", context)
        summary = "任务单已形成草稿，等待老师确认。"
        next_actions = _actions(["确认任务单", "继续修改", "检查教学包"])
        intent_id = "task_sheet"
    else:
        card_id = "activity_2_candidate"
        title = context_switch.title_for_route(route, context)
        message = f"**{title}：**\n\n- 已整理成更适合学生完成的候选版本。\n- 右侧会显示候选卡片。\n- 你确认前，它不会进入最终成果包。"
        candidate_text = _enhanced_activity_text("", context)
        summary = "活动增加了观察支架，学生输出更明确。"
        next_actions = _actions(["采纳候选", "继续修改", "生成任务单"])
        intent_id = "activity_refine"

    updates = []
    if card_id not in locked_cards:
        updates.append({
            "card_id": card_id,
            "update_type": "candidate_update" if card_id == "activity_2_candidate" else "open_card",
            "teacher_title": title,
            "status": "candidate" if card_id == "activity_2_candidate" else ("pending_review" if card_id == "task_sheet_candidate" else "ready_for_teacher_review"),
            "candidate_text": candidate_text,
            "teacher_summary": summary,
            "impact_targets": ["学生任务单", "评价证据", "教学包检查"],
            "impact_summary": "可能影响：学生任务单、评价证据、教学包检查",
            "requires_teacher_acceptance": True,
            "locked_target": False,
        })
        if route == "unit_brief":
            updates[-1]["field_rows"] = context_switch.build_unit_field_rows(context, candidate_text)
        if route == "semester_plan":
            updates[-1]["field_rows"] = context_switch.build_semester_field_rows(context, candidate_text)

    return {
        "response_id": f"real_candidate_safe_{intent_id}_001",
        "session_id": str(payload.get("session_id") or SESSION_ID),
        "assistant_message": message,
        "intent": {
            "intent_id": intent_id,
            "confidence": 0.82,
            "teacher_readable_reason": "老师正在请求小备生成可确认的候选内容。",
        },
        "card_updates": updates,
        "next_actions": next_actions,
        "safety_check": deepcopy(RESPONSE_SAFETY),
        "guard_status": "safe_candidate",
        "guard_reason": reason,
    }


def guard_rejection_sample() -> dict[str, Any]:
    unsafe = {
        "response_id": "unsafe_ai_response_sample",
        "assistant_message": "已保存，并给学生打出分数。",
        "direct_write": True,
        "overwrite_content": True,
        "safety_check": {"formal_scoring_allowed": True},
        "card_updates": [{"card_id": "activity_2_candidate", "status": "completed", "locked_target": False}],
    }
    request = {"session_id": SESSION_ID, "locked_cards": [], "teacher_message": "精修活动二"}
    return {
        "guard_status": "rejected",
        "reason": "forbidden_write_or_scoring",
        "unsafe_response": unsafe,
        "fallback_response": normalize_and_guard_response(unsafe, request, "activity_refine"),
    }


def _normalize_shape(response: dict[str, Any], request_payload: dict[str, Any], route: str) -> dict[str, Any]:
    normalized = deepcopy(response)
    context = context_switch.context_from_payload(request_payload)
    normalized.setdefault("response_id", f"real_candidate_{route}_001")
    normalized["session_id"] = str(request_payload.get("session_id") or normalized.get("session_id") or SESSION_ID)
    normalized.setdefault("intent", {
        "intent_id": route,
        "confidence": 0.78,
        "teacher_readable_reason": "老师请求生成候选内容。",
    })
    normalized.setdefault("next_actions", _actions(["继续修改", "检查教学包"]))
    normalized["safety_check"] = deepcopy(RESPONSE_SAFETY)
    normalized["assistant_message"] = _normalize_assistant_message(str(normalized.get("assistant_message") or ""), route, context)
    for update in normalized.get("card_updates", []):
        update["requires_teacher_acceptance"] = True
        update["locked_target"] = False
        if update.get("status") not in ALLOWED_STATUSES:
            update["status"] = "pending_review"
        update["teacher_title"] = _teacher_title_for_update(update, route, context)
        update["teacher_summary"] = _teacher_summary_for_update(update, route)
        update["candidate_text"] = _normalize_candidate_text(str(update.get("candidate_text") or ""), route, context)
        update["impact_targets"] = _normalize_impact_targets(update.get("impact_targets"))
        update["impact_summary"] = _impact_summary(update["impact_targets"])
        if route == "unit_brief":
            update["field_rows"] = context_switch.unit_field_rows_from_text(update["candidate_text"], applied=False)
        if route == "semester_plan":
            update["field_rows"] = context_switch.build_semester_field_rows(context, update["candidate_text"])
    normalized["guard_status"] = "passed"
    return normalized


def _normalize_assistant_message(text: str, route: str, context: dict[str, Any]) -> str:
    cleaned = text.strip()
    if route != "unit_brief":
        return cleaned
    planned = context.get("planned_lessons")
    if planned and re.search(rf"(?<!第)(?!{int(planned)})\d+\s*课时", cleaned):
        topic = context.get("topic") or "当前课题"
        return (
            f"**明白，我把《{topic}》切换为{int(planned)}课时大单元。**\n\n"
            "- 我先搭一版大单元框架。\n"
            "- 右侧会显示单元主题、大观念、基本问题、表现性任务和课时安排。\n"
            "- 这些仍是候选，确认前不会写入正式成果。"
        )
    return cleaned


def _assert_card_update(update: Any, locked_cards: set[str], allowed_ids: set[str]) -> None:
    if not isinstance(update, dict):
        raise ValueError("card update must be dict")
    card_id = str(update.get("card_id") or "")
    if card_id not in allowed_ids:
        raise ValueError("card id not allowed")
    if card_id in locked_cards or update.get("locked_target") is True:
        raise ValueError("locked card update rejected")
    if update.get("status") not in ALLOWED_STATUSES:
        raise ValueError("status not allowed")
    if update.get("requires_teacher_acceptance") is not True:
        raise ValueError("teacher acceptance required")
    _assert_no_true_flags(update)
    for field in ["teacher_title", "candidate_text", "teacher_summary"]:
        if field in update:
            _assert_teacher_text_clean(str(update[field]), field)


def _assert_safety(response: dict[str, Any]) -> None:
    safety = response.get("safety_check")
    if not isinstance(safety, dict):
        raise ValueError("missing safety_check")
    if safety.get("candidate_only") is not True:
        raise ValueError("candidate_only must be true")
    if safety.get("teacher_review_required") is not True:
        raise ValueError("teacher review required")
    if safety.get("locked_cards_modified") is not False:
        raise ValueError("locked cards modified")
    _assert_no_true_flags(safety)


def _assert_no_true_flags(obj: Any) -> None:
    if isinstance(obj, dict):
        for key, value in obj.items():
            if key in FORBIDDEN_TRUE_KEYS and value is True:
                raise ValueError(f"forbidden true flag: {key}")
            _assert_no_true_flags(value)
    elif isinstance(obj, list):
        for item in obj:
            _assert_no_true_flags(item)


def _assert_teacher_text_clean(text: str, label: str) -> None:
    lowered = text.lower()
    for term in FORBIDDEN_TEACHER_TERMS:
        if term.lower() in lowered:
            raise ValueError(f"teacher text leaks technical term in {label}: {term}")
    for phrase in FORBIDDEN_TEACHER_PHRASES:
        if phrase.lower() in lowered:
            raise ValueError(f"teacher text has forbidden phrase in {label}: {phrase}")


def _allowed_card_ids_for_route(route: str) -> set[str]:
    if route == "general_chat":
        return set()
    if route == "unit_brief":
        return {"unit_brief_candidate"}
    if route == "semester_plan":
        return {"semester_plan_candidate"}
    if route == "lesson_brief":
        return {"lesson_brief_candidate"}
    if route == "task_sheet":
        return {"task_sheet_candidate"}
    return {"activity_2_candidate"}


def _teacher_title_for_update(update: dict[str, Any], route: str, context: dict[str, Any]) -> str:
    current = str(update.get("teacher_title") or "").strip()
    if route == "general_chat":
        return current or "小备回复"
    if route == "task_sheet":
        return current if current and "任务单" in current else "学生任务单草稿"
    if route == "unit_brief":
        return current if current and any(key in current for key in ["单元", "备课", "课程"]) else context_switch.title_for_route(route, context)
    if route == "semester_plan":
        return current if current and any(key in current for key in ["学期", "规划", "计划"]) else context_switch.title_for_route(route, context)
    if route == "lesson_brief":
        return current if current and any(key in current for key in ["课时", "备课", "课程"]) else context_switch.title_for_route(route, context)
    return current if current and "活动" in current else context_switch.title_for_route(route, context)


def _teacher_summary_for_update(update: dict[str, Any], route: str) -> str:
    current = str(update.get("teacher_summary") or "").strip()
    if route == "general_chat":
        return current or "小备已回复，未生成工作卡。"
    if route == "task_sheet":
        if not current or any(key in current for key in ["student_", "color_theory"]):
            return "任务单围绕观察、选择、创作和表达展开，等待老师确认。"
    elif route == "lesson_brief":
        if not current or len(current) < 12:
            return "课时备课候选已整理好，等待老师确认。"
    elif route == "semester_plan":
        if not current or len(current) < 12:
            return "学期规划候选已整理好，等待老师补充教材资料后继续细化。"
    else:
        if not current or len(current) < 12:
            return "活动环节已补充观察支架、学生输出和评价证据，等待老师确认。"
    return current


def _normalize_candidate_text(text: str, route: str, context: dict[str, Any]) -> str:
    cleaned = text.strip()
    if route == "general_chat":
        return cleaned
    if route == "lesson_brief":
        return _enhanced_lesson_brief_text(cleaned, context)
    if route == "unit_brief":
        return _enhanced_unit_brief_text(cleaned, context)
    if route == "semester_plan":
        return _enhanced_semester_plan_text(cleaned, context)
    if route == "task_sheet":
        if not _looks_like_child_task_sheet(cleaned):
            return _enhanced_task_sheet_text(cleaned, context)
        return _trim_task_sheet_text(cleaned)
    if not _looks_like_activity_plan(cleaned):
        return _enhanced_activity_text(cleaned, context)
    return cleaned


def _looks_like_activity_plan(text: str) -> bool:
    required = ["活动", "时间", "学生", "教师", "学习证据", "支架", "下一步"]
    return sum(1 for key in required if key in text) >= 5


def _looks_like_child_task_sheet(text: str) -> bool:
    required = ["看一看", "说一说", "试一试", "写一写"]
    return sum(1 for key in required if key in text) >= 3


def _enhanced_lesson_brief_text(source: str, context: dict[str, Any] | None = None) -> str:
    cleaned = source.strip()
    if len(cleaned) >= 120 and any(key in cleaned for key in ["课时", "活动", "学生", "学习证据", "材料"]):
        return cleaned
    return context_switch.build_lesson_brief_text(context or {})


def _enhanced_unit_brief_text(source: str, context: dict[str, Any] | None = None) -> str:
    cleaned = source.strip()
    planned = (context or {}).get("planned_lessons")
    if planned and re.search(rf"(?<!第)(?!{int(planned)})\d+\s*课时", cleaned):
        return context_switch.build_unit_brief_text(context or {})
    if len(cleaned) >= 180 and "课时" in cleaned and any(key in cleaned for key in ["单元", "大观念", "基本问题", "表现性任务"]):
        return cleaned
    return context_switch.build_unit_brief_text(context or {})


def _enhanced_semester_plan_text(source: str, context: dict[str, Any] | None = None) -> str:
    cleaned = source.strip()
    if len(cleaned) >= 180 and any(key in cleaned for key in ["学期", "周次", "单元安排", "规划目标"]):
        return cleaned
    return context_switch.build_semester_plan_text(context or {})


def _enhanced_activity_text(source: str, context: dict[str, Any] | None = None) -> str:
    return context_switch.build_activity_text(context or {}, source)


def _enhanced_task_sheet_text(source: str, context: dict[str, Any] | None = None) -> str:
    return context_switch.build_task_sheet_text(context or {}, source)


def _trim_task_sheet_text(text: str) -> str:
    # Keep model output when it already follows the child-facing structure.
    return text.strip()


def _normalize_impact_targets(value: Any) -> list[str]:
    raw_items = value if isinstance(value, list) else []
    normalized: list[str] = []
    for item in raw_items:
        label = INTERNAL_TARGET_LABELS.get(str(item), str(item))
        if label and label not in normalized and not any(marker in label for marker in ["_", "candidate_content", "app_link"]):
            normalized.append(label)
    if not normalized:
        normalized = ["学生任务单", "评价证据", "教学包检查"]
    return normalized


def _impact_summary(targets: list[str]) -> str:
    return "可能影响：" + "、".join(targets)


def _actions(labels: list[str]) -> list[dict[str, str]]:
    action_ids = {
        "采纳候选": "accept_candidate",
        "继续修改": "revise_candidate",
        "生成任务单": "generate_task_sheet",
        "确认任务单": "accept_candidate",
        "检查教学包": "check_package",
        "继续追问单元主题": "ask_unit_theme",
        "生成三课时结构": "generate_lesson_sequence",
        "修改某个字段": "modify_last_candidate",
        "重新生成某个字段": "generate_unit_brief_candidate",
        "进入课时部分": "generate_lesson_brief_candidate",
        "补充教材版本": "ask_for_textbook_version",
        "生成周次安排": "generate_semester_schedule",
        "进入单元规划": "generate_unit_brief_candidate",
    }
    return [{"label": label, "action_id": action_ids.get(label, "revise_candidate")} for label in labels]
