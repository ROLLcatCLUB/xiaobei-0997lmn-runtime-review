from __future__ import annotations

import importlib
import json
import os
import time
from typing import Any

from . import workbench_ai_candidate_guard as guard
from . import workbench_context_switch as context_switch

ALLOWED_REAL_CANDIDATE_ROUTES = {"activity_refine", "task_sheet", "lesson_brief", "unit_brief", "semester_plan", "general_chat"}
ENABLE_ENV = "XIAOBEI_WORKBENCH_AI_CANDIDATE_ENABLED"


class RealCandidateUnavailable(RuntimeError):
    def __init__(self, reason_code: str, message: str = ""):
        super().__init__(message or reason_code)
        self.reason_code = reason_code


def generate_candidate_response(
    request_payload: dict[str, Any],
    route: str | None = None,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return a guarded candidate response for the requested workbench route.

    Real-candidate mode must not silently fall back to deterministic placeholder
    content. If the model channel is unavailable, raise a typed error so the page
    can tell the teacher that real AI is not connected.
    """

    resolved_context = context or context_switch.resolve_request_context(request_payload, str(request_payload.get("teacher_message") or ""))
    request_payload = {**request_payload, "_resolved_context": resolved_context}
    resolved_route = route or context_switch.detect_route(str(request_payload.get("teacher_message") or ""), resolved_context)
    if resolved_route not in ALLOWED_REAL_CANDIDATE_ROUTES:
        resolved_route = "general_chat"

    if not _enabled():
        raise RealCandidateUnavailable("real_candidate_disabled")

    try:
        raw, provider_meta = _call_existing_model_channel(request_payload, resolved_route, resolved_context)
    except Exception as exc:
        raise RealCandidateUnavailable(_provider_reason_code(exc), str(exc)) from exc

    response = guard.normalize_and_guard_response(raw, request_payload, resolved_route)
    response["candidate_source"] = "model"
    response["provider_meta"] = provider_meta
    if response.get("guard_status") == "safe_candidate":
        response["candidate_source"] = "model_guarded_fallback"
        response.setdefault("guard_reason", "guard_rejected")
    return response


def build_candidate_prompt(request_payload: dict[str, Any], route: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
    resolved_context = context or context_switch.context_from_payload(request_payload)
    quality_requirements = _quality_requirements_for_route(route, resolved_context)
    lesson_context = {
        "context_policy": resolved_context.get("context_policy"),
        "grade": resolved_context.get("grade"),
        "subject": resolved_context.get("subject"),
        "topic": resolved_context.get("topic"),
        "lesson_no": resolved_context.get("lesson_no"),
        "design_scope": resolved_context.get("design_scope"),
        "context_intent": resolved_context.get("context_intent"),
        "planned_lessons": resolved_context.get("planned_lessons"),
        "lesson_title": resolved_context.get("lesson_title"),
        "detected_context": resolved_context.get("detected_context"),
    }
    if route == "general_chat":
        return {
            "role": "xiaobei_workbench_chat",
            "route": route,
            "grade": resolved_context.get("grade"),
            "subject": resolved_context.get("subject"),
            "unit_title": resolved_context.get("topic"),
            "lesson_title": resolved_context.get("lesson_title"),
            "lesson_context": lesson_context,
            "current_task": request_payload.get("current_task"),
            "teacher_message": request_payload.get("teacher_message"),
            "opened_cards": request_payload.get("opened_cards") or [],
            "locked_cards": request_payload.get("locked_cards") or [],
            "allowed_output": [
                "assistant_message",
                "next teacher actions",
                "empty card_updates unless the teacher asks for a concrete candidate",
            ],
            "forbidden_output": [
                "formal content write",
                "scores or grades",
                "saved or published claims",
                "external classroom connection",
                "Feishu write",
                "student submission creation",
                "real download",
            ],
            "teacher_language_rules": [
                "Use natural teacher-facing Chinese.",
                "Format assistant_message as compact Markdown: a bold short heading, then bullets or a small table when useful.",
                "Do not use markdown fences.",
                "Answer the teacher's short message directly.",
                "If the teacher only greets you, reply briefly and invite a concrete next step.",
                "Do not return a fixed menu-like placeholder.",
                "Do not expose implementation field names.",
            ],
            "quality_requirements": quality_requirements,
            "response_shape": {
                "response_id": "string",
                "session_id": "string",
                "assistant_message": "string",
                "intent": {"intent_id": route, "confidence": 0.0, "teacher_readable_reason": "string"},
                "card_updates": [],
                "next_actions": [{"label": "string", "action_id": "string"}],
                "safety_check": guard.RESPONSE_SAFETY,
            },
        }
    return {
        "role": "xiaobei_candidate_writer",
        "route": route,
        "grade": resolved_context.get("grade"),
        "subject": resolved_context.get("subject"),
        "unit_title": resolved_context.get("topic"),
        "lesson_title": resolved_context.get("lesson_title"),
        "lesson_context": lesson_context,
        "current_task": request_payload.get("current_task"),
        "teacher_message": request_payload.get("teacher_message"),
        "opened_cards": request_payload.get("opened_cards") or [],
        "locked_cards": request_payload.get("locked_cards") or [],
        "accepted_content": request_payload.get("accepted_content") or {},
        "candidate_content": request_payload.get("candidate_content") or {},
        "allowed_output": [
            "assistant_message",
            "candidate card update",
            "next teacher actions",
        ],
        "forbidden_output": [
            "formal content write",
            "scores or grades",
            "saved or published claims",
            "external classroom connection",
            "Feishu write",
            "student submission creation",
        ],
        "teacher_language_rules": [
            "Use teacher-facing language.",
            "Format assistant_message as compact Markdown: a bold short heading, then bullets or a small table when useful.",
            "Do not use markdown fences.",
            "Say the result is a draft awaiting teacher confirmation.",
            "Do not expose implementation field names.",
            "Avoid empty slogans such as more interesting or more interactive without concrete classroom actions.",
        ],
        "quality_requirements": quality_requirements,
        "response_shape": {
            "response_id": "string",
            "session_id": "string",
            "assistant_message": "string",
            "intent": {"intent_id": route, "confidence": 0.0, "teacher_readable_reason": "string"},
            "card_updates": [
                {
                    "card_id": (
                        "activity_2_candidate"
                        if route == "activity_refine"
                        else (
                            "task_sheet_candidate"
                            if route == "task_sheet"
                            else ("semester_plan_candidate" if route == "semester_plan" else ("unit_brief_candidate" if route == "unit_brief" else "lesson_brief_candidate"))
                        )
                    ),
                    "update_type": "candidate_update" if route == "activity_refine" else "open_card",
                    "teacher_title": "string",
                    "status": "candidate | pending_review | preview | ready_for_teacher_review",
                    "candidate_text": "string",
                    "teacher_summary": "string",
                    "impact_targets": ["string"],
                    "requires_teacher_acceptance": True,
                    "locked_target": False,
                }
            ],
            "next_actions": [{"label": "string", "action_id": "string"}],
            "safety_check": guard.RESPONSE_SAFETY,
        },
    }


def _call_existing_model_channel(
    request_payload: dict[str, Any],
    route: str,
    context: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    prompt = build_candidate_prompt(request_payload, route, context)
    try:
        module = importlib.import_module("backend.xiaobei_ai.providers")
    except ModuleNotFoundError:
        module = importlib.import_module("xiaobei_ai.providers")
    result = None
    attempts = _resolve_candidate_attempts()
    for attempt_index in range(attempts):
        try:
            result = module.generate_json_patch(
                {"workbench_request": request_payload, "candidate_prompt": prompt},
                {
                    "system_prompt": (
                        "你是小备教学助理，只能在师维智教内帮助老师备课。"
                        "必须返回 JSON，且 JSON 必须符合 candidate_prompt.response_shape。"
                        "必须优先使用 candidate_prompt.lesson_context 和 teacher_message 中的新课题；"
                        "当 context_policy 是 reset_for_new_lesson 时，不得沿用旧会话、旧活动或旧课题内容。"
                        "如果 route 是 general_chat，只回复 assistant_message，不要生成 card_updates。"
                        "不要声称已经保存、写入、评分、发布、推送或连接课堂应用。"
                        "不要生成分数、成绩或正式评价结论。"
                        "教师看到的文字必须自然、简洁、适合备课场景，并且 assistant_message 使用紧凑 Markdown（短标题+列表/必要时表格），不要使用 Markdown 代码块。"
                    ),
                    "user_prompt": json.dumps(prompt, ensure_ascii=False, indent=2),
                },
                {
                    "provider": _resolve_candidate_provider(),
                    **_candidate_model_option(),
                    "response_format": "json_object",
                    "temperature": 0.2,
                    "max_tokens": _resolve_candidate_max_tokens(),
                    "timeout_ms": _resolve_candidate_timeout_ms(),
                },
            )
            break
        except Exception as exc:
            if getattr(exc, "code", "") == "provider_overloaded_retryable" and attempt_index + 1 < attempts:
                time.sleep(_resolve_retry_delay_seconds())
                continue
            raise
    if result is None:
        raise ValueError("model_response_missing")
    raw_text = str(result.get("raw_text") or "").strip()
    parsed = _extract_json(raw_text)
    if isinstance(parsed, dict):
        return parsed, dict(result.get("provider_meta") or {})
    if route == "general_chat":
        loose_general = _loose_general_chat_response(raw_text, request_payload)
        if loose_general:
            return loose_general, dict(result.get("provider_meta") or {})
    loose = _loose_candidate_response(raw_text, request_payload, route)
    if loose:
        return loose, dict(result.get("provider_meta") or {})
    raise ValueError("model_response_not_json")


def _provider_reason_code(exc: Exception) -> str:
    code = str(getattr(exc, "code", "") or "")
    if code:
        return code
    text = str(exc).lower()
    if "not_json" in text or "json" in text:
        return "provider_response_not_json"
    if "timeout" in text:
        return "provider_timeout"
    return "provider_unavailable"


def _extract_json(text: str) -> Any:
    if not text:
        return None
    text = _strip_code_fence(text.strip())
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                return None
    return None


def _strip_code_fence(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].lstrip().startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    return cleaned


def _loose_candidate_response(raw_text: str, request_payload: dict[str, Any], route: str) -> dict[str, Any] | None:
    cleaned = _strip_code_fence(raw_text)
    candidate_text = _loose_json_string_field(cleaned, "candidate_text", "teacher_summary")
    if not candidate_text:
        candidate_text = _plain_candidate_text(cleaned)
    if len(candidate_text.strip()) < 80:
        return None

    card_id = (
        "activity_2_candidate"
        if route == "activity_refine"
        else (
            "task_sheet_candidate"
            if route == "task_sheet"
            else ("semester_plan_candidate" if route == "semester_plan" else ("unit_brief_candidate" if route == "unit_brief" else "lesson_brief_candidate"))
        )
    )
    update = {
        "card_id": card_id,
        "update_type": "candidate_update" if route == "activity_refine" else "open_card",
        "teacher_title": _loose_json_string_field(cleaned, "teacher_title", "status") or _title_for_route(route, request_payload),
        "status": "candidate" if route == "activity_refine" else ("pending_review" if route == "task_sheet" else "ready_for_teacher_review"),
        "candidate_text": candidate_text,
        "teacher_summary": _loose_json_string_field(cleaned, "teacher_summary", "impact_targets") or "这是一版模型生成的候选内容，等待老师确认。",
        "impact_targets": ["学生任务单", "评价证据", "教学包检查"],
        "requires_teacher_acceptance": True,
        "locked_target": False,
    }
    if route == "unit_brief":
        update["field_rows"] = context_switch.build_unit_field_rows(context_switch.context_from_payload(request_payload), candidate_text)
    if route == "semester_plan":
        update["field_rows"] = context_switch.build_semester_field_rows(context_switch.context_from_payload(request_payload), candidate_text)
    return {
        "response_id": f"real_candidate_loose_{route}_001",
        "session_id": str(request_payload.get("session_id") or "wb_20260514_grade3_qinglv_lesson2"),
        "assistant_message": _loose_json_string_field(cleaned, "assistant_message", "intent")
        or "我生成了一版候选内容，已经过安全门禁整理，等待你确认。",
        "intent": {
            "intent_id": route,
            "confidence": 0.72,
            "teacher_readable_reason": "模型返回内容已转成老师可审阅的候选卡片。",
        },
        "card_updates": [update],
        "next_actions": [{"label": "继续修改", "action_id": "revise_candidate"}, {"label": "检查教学包", "action_id": "check_package"}],
        "safety_check": guard.RESPONSE_SAFETY,
        "guard_status": "loose_json_recovered",
    }


def _loose_general_chat_response(raw_text: str, request_payload: dict[str, Any]) -> dict[str, Any] | None:
    cleaned = _plain_candidate_text(raw_text)
    if len(cleaned.strip()) < 2:
        return None
    return {
        "response_id": "real_candidate_general_chat_loose_001",
        "session_id": str(request_payload.get("session_id") or "wb_20260514_grade3_qinglv_lesson2"),
        "assistant_message": cleaned[:800],
        "intent": {
            "intent_id": "general_chat",
            "confidence": 0.7,
            "teacher_readable_reason": "老师正在和小备进行普通备课对话。",
        },
        "card_updates": [],
        "next_actions": [
            {"label": "继续精修活动", "action_id": "revise_candidate"},
            {"label": "生成任务单", "action_id": "generate_task_sheet"},
        ],
        "safety_check": guard.RESPONSE_SAFETY,
        "guard_status": "loose_text_recovered",
    }


def _loose_json_string_field(text: str, field: str, next_field: str) -> str:
    import re

    pattern = rf'"{re.escape(field)}"\s*:\s*"(.*?)"\s*,\s*"{re.escape(next_field)}"'
    match = re.search(pattern, text, flags=re.S)
    if not match:
        return ""
    return _clean_loose_text(match.group(1))


def _plain_candidate_text(text: str) -> str:
    cleaned = _clean_loose_text(text)
    if len(cleaned) > 4000:
        cleaned = cleaned[:4000].rstrip() + "\n..."
    return cleaned


def _clean_loose_text(value: str) -> str:
    return (
        str(value or "")
        .replace("\\n", "\n")
        .replace('\\"', '"')
        .replace("\\u300a", "《")
        .replace("\\u300b", "》")
        .strip()
    )


def _title_for_route(route: str, request_payload: dict[str, Any] | None = None) -> str:
    context = context_switch.context_from_payload(request_payload or {})
    if route == "task_sheet":
        return "学生任务单草稿"
    if route == "lesson_brief":
        return context_switch.title_for_route(route, context)
    if route == "unit_brief":
        return context_switch.title_for_route(route, context)
    if route == "semester_plan":
        return context_switch.title_for_route(route, context)
    return context_switch.title_for_route(route, context)


def _detect_route(teacher_message: str) -> str:
    context = context_switch.resolve_request_context({"teacher_message": teacher_message}, teacher_message)
    route = context_switch.detect_route(teacher_message, context)
    return route if route in ALLOWED_REAL_CANDIDATE_ROUTES else "general_chat"


def _enabled() -> bool:
    return str(os.environ.get(ENABLE_ENV) or "").strip().lower() in {"1", "true", "yes", "on"}


def _resolve_candidate_provider() -> str:
    raw = (
        (os.environ.get("XIAOBEI_WORKBENCH_AI_PROVIDER") or "").strip()
        or (os.environ.get("XIAOBEI_AI_PROVIDER_DEFAULT") or "").strip()
        or ("anthropic_compatible" if _has_minimax_credentials() else "")
        or "openai_compatible"
    )
    return _normalize_candidate_provider(raw)


def _normalize_candidate_provider(value: str) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return "openai_compatible"
    aliases = {
        "openai_like": "openai_compatible",
        "coze_like": "openai_compatible",
        "coze": "openai_compatible",
    }
    return aliases.get(text, (os.environ.get("XIAOBEI_WORKBENCH_AI_PROVIDER") or "").strip() or (os.environ.get("XIAOBEI_AI_PROVIDER_DEFAULT") or "").strip() or text)


def _candidate_model_option() -> dict[str, str]:
    model = (os.environ.get("XIAOBEI_WORKBENCH_AI_MODEL") or "").strip()
    if not model and _has_minimax_credentials():
        model = "MiniMax-M2.7-highspeed"
    return {"model": model} if model else {}


def _has_minimax_credentials() -> bool:
    return bool(
        (os.environ.get("MINIAMX_API_KEY") or "").strip()
        or (os.environ.get("MINIMAX_API_KEY") or "").strip()
    )


def _resolve_candidate_attempts() -> int:
    try:
        return max(1, min(3, int(os.environ.get("XIAOBEI_WORKBENCH_AI_CANDIDATE_ATTEMPTS") or "2")))
    except ValueError:
        return 2


def _resolve_retry_delay_seconds() -> float:
    try:
        return max(0.5, min(10.0, float(os.environ.get("XIAOBEI_WORKBENCH_AI_CANDIDATE_RETRY_DELAY") or "2")))
    except ValueError:
        return 2.0


def _resolve_candidate_timeout_ms() -> int:
    try:
        return max(30000, min(180000, int(os.environ.get("XIAOBEI_WORKBENCH_AI_CANDIDATE_TIMEOUT_MS") or "120000")))
    except ValueError:
        return 120000


def _resolve_candidate_max_tokens() -> int:
    try:
        return max(1200, min(6000, int(os.environ.get("XIAOBEI_WORKBENCH_AI_CANDIDATE_MAX_TOKENS") or "2200")))
    except ValueError:
        return 2200


def _quality_requirements_for_route(route: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
    ctx = context or {}
    grade = ctx.get("grade") or "三年级"
    subject = ctx.get("subject") or "美术"
    topic = ctx.get("topic") or "当前课题"
    if route == "task_sheet":
        return {
            "audience": f"{grade}学生",
            "must_be_child_facing": True,
            "style": "short sentences, clear actions, no adult teaching-research language",
            "required_steps": ["看一看", "说一说", "试一试", "写一写"],
            "must_include_learning_evidence": ["观察记录", "过程痕迹", "小作品", "一句说明"],
            "must_not_include": ["评分", "分数", "成绩", "打分", "正式评价结论"],
        }
    if route == "general_chat":
        return {
            "audience": f"小学{subject}老师",
            "must_be_natural_chat": True,
            "must_not_be_fixed_placeholder": True,
            "must_not_generate_formal_plan_unless_requested": True,
            "suggested_next_steps": ["继续精修活动", "生成学生任务单", "检查教学包"],
            "must_not_include": ["已保存", "已写入", "评分", "分数", "成绩"],
        }
    if route == "unit_brief":
        return {
            "audience": f"{grade}{subject}大单元",
            "topic": topic,
            "must_include_sections": [
                "单元名称",
                "单元主题",
                "大观念候选",
                "基本问题候选",
                "表现性任务候选",
                "三课时安排",
                "每课时任务",
                "学习证据",
                "评价建议",
                "下一步追问",
            ],
            "must_be_unit_not_single_lesson": True,
            "must_include_three_lesson_structure": True,
            "must_not_include": ["已保存", "已写入", "评分", "分数", "成绩"],
        }
    if route == "semester_plan":
        return {
            "audience": f"{grade}{subject}学期规划",
            "topic": topic,
            "must_include_sections": [
                "规划名称",
                "规划目标",
                "教材与资料",
                "教学内容与进度",
                "周次节奏",
                "学习证据",
                "评价建议",
                "待老师复核",
            ],
            "must_be_semester_plan_not_single_lesson": True,
            "must_not_ask_for_unit_name": True,
            "textbook_catalog_can_be_marked_pending": True,
            "must_not_include": ["已保存", "已写入", "评分", "分数", "成绩"],
        }
    return {
        "audience": f"{grade}{subject}课堂",
        "topic": topic,
        "must_include_sections": [
            "活动名称",
            "活动目标",
            "活动时间",
            "材料准备",
            "学生任务",
            "教师组织",
            "学习证据",
            "学生支架",
            "与任务单或评价证据的关系",
            "下一步建议",
        ],
        "must_be_concrete": True,
        "must_include_scaffold_words": ["我看见了", "我尝试了", "我想表达"],
        "must_not_include": ["已保存", "已写入", "评分", "分数", "成绩"],
    }
