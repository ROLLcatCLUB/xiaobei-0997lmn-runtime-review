from __future__ import annotations

import re
from copy import deepcopy
from typing import Any


DEFAULT_SESSION_ID = "wb_workbench_default_session"
DEFAULT_GRADE = "三年级"
DEFAULT_SUBJECT = "美术"
DEFAULT_TOPIC = "当前课题"
DEFAULT_LESSON_NO = ""
ALLOWED_CONTEXT_POLICIES = {
    "reset_for_new_lesson",
    "use_current_context",
    "infer_from_teacher_message",
}
DESIGN_SCOPES = {"lesson", "unit", "semester", "unknown"}
CONTEXT_INTENTS = {
    "new_topic",
    "continue_current",
    "scope_correction",
    "semester_plan_request",
    "unit_brief_request",
    "lesson_brief_request",
    "course_catalog_query",
    "planning_info_query",
    "topic_selection_needed",
    "task_object_update",
    "lesson_component_split_request",
    "field_edit_request",
    "clarification_needed",
    "inferred",
}
LEGACY_QINGLV_TERMS = ["青绿", "青绿中国色", "青绿山水", "qinglv", "color_collision"]


def resolve_request_context(payload: dict[str, Any], teacher_message: str | None = None) -> dict[str, Any]:
    request = payload if isinstance(payload, dict) else {}
    text = str(teacher_message if teacher_message is not None else request.get("teacher_message") or "").strip()
    detected = request.get("detected_context") if isinstance(request.get("detected_context"), dict) else {}
    current_context = request.get("current_context") if isinstance(request.get("current_context"), dict) else {}
    task = request.get("current_task") if isinstance(request.get("current_task"), dict) else {}
    text_design_scope = _extract_design_scope(text)
    design_scope = _normalize_design_scope(
        detected.get("design_scope")
        or (text_design_scope if text_design_scope != "unknown" else "")
        or current_context.get("design_scope")
        or task.get("design_scope")
        or text_design_scope
    )
    planned_lessons = _first_number(
        detected.get("planned_lessons"),
        current_context.get("planned_lessons"),
        task.get("planned_lessons"),
        _extract_planned_lessons(text),
    )
    text_context_intent = _infer_context_intent(text, design_scope)
    context_intent = _normalize_context_intent(
        detected.get("context_intent")
        or current_context.get("context_intent")
        or (text_context_intent if text_context_intent != "inferred" else "")
        or task.get("context_intent")
        or detected.get("intent")
        or text_context_intent
    )
    policy = _normalize_policy(request.get("context_policy") or detected.get("context_policy") or _infer_policy(text, context_intent))
    if policy == "reset_for_new_lesson":
        design_scope = _normalize_design_scope(detected.get("design_scope") or text_design_scope)
        planned_lessons = _first_number(detected.get("planned_lessons"), _extract_planned_lessons(text))

    legacy_continue = policy == "use_current_context" and _looks_like_legacy_qinglv_continue(text, request, task)
    if policy == "reset_for_new_lesson":
        grade = _first_text(detected.get("grade"), _extract_grade(text), current_context.get("grade"), task.get("grade"), DEFAULT_GRADE)
        subject = _first_text(detected.get("subject"), _extract_subject(text), current_context.get("subject"), task.get("subject"), DEFAULT_SUBJECT)
        lesson_no = _first_text(detected.get("lesson_no"), _extract_lesson_no(text), DEFAULT_LESSON_NO)
        topic = _first_text(detected.get("topic"), _extract_topic(text), "")
    else:
        grade = _first_text(detected.get("grade"), current_context.get("grade"), task.get("grade"), _extract_grade(text), DEFAULT_GRADE)
        subject = _first_text(detected.get("subject"), current_context.get("subject"), task.get("subject"), _extract_subject(text), DEFAULT_SUBJECT)
        lesson_no = _first_text(detected.get("lesson_no"), current_context.get("lesson_no"), task.get("lesson"), _extract_lesson_no(text), DEFAULT_LESSON_NO)
        topic = _first_text(detected.get("topic"), current_context.get("topic"), task.get("topic"), _extract_topic(text), "")
    if context_intent in {"course_catalog_query", "planning_info_query"}:
        grade = _first_text(detected.get("grade"), _extract_grade(text), grade, DEFAULT_GRADE)
        subject = _first_text(detected.get("subject"), _extract_subject(text), subject, DEFAULT_SUBJECT)

    if not topic and policy == "use_current_context":
        topic = _topic_from_current_task(task)
    if not topic and context_intent in {"scope_correction", "unit_brief_request"}:
        topic = _topic_from_current_task(task)
    if legacy_continue and not topic:
        topic = "青绿中国色"
    if legacy_continue and not lesson_no:
        lesson_no = "第2课时"
    if context_intent in {"scope_correction", "unit_brief_request"}:
        design_scope = "unit"
    if design_scope == "unit" and planned_lessons is None and _extract_planned_lessons(text):
        planned_lessons = _extract_planned_lessons(text)

    missing_topic = policy == "reset_for_new_lesson" and not topic
    visible_topic = topic or DEFAULT_TOPIC
    session_id = _session_id_for_request(request, task, policy)
    lesson_title = compose_lesson_title(visible_topic, lesson_no)

    return {
        "context_policy": policy,
        "grade": grade,
        "subject": subject,
        "topic": visible_topic,
        "raw_topic": topic,
        "lesson_no": lesson_no,
        "design_scope": design_scope,
        "context_intent": context_intent,
        "planned_lessons": planned_lessons,
        "current_topic_locked": bool(topic),
        "lesson_title": lesson_title,
        "session_id": session_id,
        "legacy_qinglv_continue": legacy_continue,
        "missing_topic": missing_topic,
        "intent": detected.get("intent") or _intent_for_policy(policy),
        "detected_context": {
            "grade": grade,
            "subject": subject,
            "topic": topic,
            "lesson_no": lesson_no,
            "design_scope": design_scope,
            "context_intent": context_intent,
            "planned_lessons": planned_lessons,
            "current_topic_locked": bool(topic),
            "intent": detected.get("intent") or context_intent or _intent_for_policy(policy),
        },
    }


def context_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    cached = payload.get("_resolved_context") if isinstance(payload, dict) else None
    if isinstance(cached, dict) and cached.get("context_policy"):
        return cached
    return resolve_request_context(payload, str(payload.get("teacher_message") or "") if isinstance(payload, dict) else "")


def detect_route(teacher_message: str, context: dict[str, Any] | None = None) -> str:
    ctx = context or {}
    text = str(teacher_message or "").replace(" ", "")
    if ctx.get("context_intent") == "course_catalog_query" or _looks_like_course_catalog_query(teacher_message):
        return "course_catalog"
    if ctx.get("context_intent") == "planning_info_query" or _looks_like_planning_info_query(teacher_message):
        return "planning_info"
    if ctx.get("design_scope") == "semester" or ctx.get("context_intent") == "semester_plan_request":
        return "semester_plan"
    if any(key in text for key in ["学期规划", "学期计划", "教学进度", "全册规划", "整册规划"]):
        return "semester_plan"
    if ctx.get("design_scope") == "unit" or ctx.get("context_intent") in {"scope_correction", "unit_brief_request"}:
        if any(key in text for key in ["任务单", "学习单"]):
            return "task_sheet"
        if any(key in text for key in ["活动二", "继续精修活动二"]) and not ctx.get("legacy_qinglv_continue"):
            return "activity_scope_clarification"
        return "unit_brief"
    if ctx.get("context_policy") == "reset_for_new_lesson":
        if any(key in text for key in ["任务单", "学习单"]):
            return "task_sheet"
        return "lesson_brief"
    if any(key in text for key in ["备一节", "备一下", "备课草稿", "新开备课", "新建备课", "新备课", "帮我备", "我要备", "我要做"]):
        return "lesson_brief"
    if any(key in text for key in ["任务单", "学习单"]):
        return "task_sheet"
    if any(key in text for key in ["资源", "图片", "素材"]):
        return "resources"
    if any(key in text for key in ["下载", "导出", "成果包"]):
        return "download_manifest"
    if any(key in text for key in ["教学包", "检查", "还缺"]):
        return "package_check"
    if any(key in text for key in ["活动二", "活动", "精修", "继续精修", "太散", "支架", "活动时间", "压缩", "学生可能不知道怎么做"]):
        return "activity_refine"
    return "fallback"


def should_clarify_new_lesson(context: dict[str, Any]) -> bool:
    return bool(context.get("context_policy") == "reset_for_new_lesson" and context.get("missing_topic"))


def current_task_label(context: dict[str, Any]) -> str:
    topic = str(context.get("topic") or DEFAULT_TOPIC).strip() or DEFAULT_TOPIC
    lesson_no = str(context.get("lesson_no") or "").strip()
    return compose_lesson_title(topic, lesson_no)


def unit_task_label(context: dict[str, Any]) -> str:
    label = str(context.get("topic") or DEFAULT_TOPIC).strip() or DEFAULT_TOPIC
    count = context.get("planned_lessons")
    if count:
        return f"{label}{int(count)}课时大单元"
    return f"{label}大单元"


def semester_task_label(context: dict[str, Any]) -> str:
    grade = str(context.get("grade") or DEFAULT_GRADE).strip()
    subject = str(context.get("subject") or DEFAULT_SUBJECT).strip()
    topic = re.sub(r"(?:的)?教案$", "", str(context.get("topic") or "").strip())
    if any(key in topic for key in ["上册", "下册", "全册", "整册"]):
        return f"{grade}{subject}{topic}学期规划"
    if topic and topic != DEFAULT_TOPIC:
        return f"{grade}{subject}《{topic}》学期规划"
    return f"{grade}{subject}学期规划"


def compose_lesson_title(topic: str, lesson_no: str = "") -> str:
    clean_topic = str(topic or DEFAULT_TOPIC).strip() or DEFAULT_TOPIC
    clean_lesson = str(lesson_no or "").strip()
    if clean_lesson and clean_lesson not in clean_topic:
        return f"{clean_topic}{clean_lesson}"
    return clean_topic


def title_for_route(route: str, context: dict[str, Any] | None = None) -> str:
    ctx = context or {}
    label = current_task_label(ctx)
    if route == "task_sheet":
        return "学生任务单草稿"
    if route == "lesson_brief":
        return f"{label}备课候选"
    if route == "unit_brief":
        return f"{unit_task_label(ctx)}候选"
    if route == "semester_plan":
        return f"{semester_task_label(ctx)}候选"
    if route == "general_chat":
        return "小备回复"
    if ctx.get("legacy_qinglv_continue"):
        return "活动二候选"
    return "活动环节候选"


def build_clarification_response(context: dict[str, Any], teacher_message: str, response_safety: dict[str, Any]) -> dict[str, Any]:
    grade_subject = f"{context.get('grade') or DEFAULT_GRADE}{context.get('subject') or DEFAULT_SUBJECT}"
    return {
        "success": True,
        "mode": "workbench_context_clarification",
        "session_id": context.get("session_id") or DEFAULT_SESSION_ID,
        "assistant_message": (
            "**我先确认一下：**\n\n"
            f"- 你像是在新开备课，我已经看到方向是{grade_subject}。\n"
            "- 还差具体课题或单元名。\n"
            "- 你补一句要备哪一课，我就先搭一个课时框架。"
        ),
        "intent": {
            "intent_id": "need_more_context",
            "confidence": 0.76,
            "teacher_readable_reason": "新备课缺少课题，小备先追问关键信息。",
        },
        "card_updates": [],
        "next_actions": [{"label": "补充课题", "action_id": "check_context"}],
        "request_echo": {
            "teacher_message": teacher_message,
            "context_policy": context.get("context_policy"),
            "detected_context": context.get("detected_context"),
        },
        "safety_check": deepcopy(response_safety),
    }


def build_deterministic_response(
    route: str,
    teacher_message: str,
    locked_cards: set[str],
    context: dict[str, Any],
    response_safety: dict[str, Any],
) -> dict[str, Any]:
    if should_clarify_new_lesson(context):
        return build_clarification_response(context, teacher_message, response_safety)

    builders = {
        "activity_refine": _activity_response,
        "activity_scope_clarification": _activity_scope_clarification_response,
        "task_sheet": _task_sheet_response,
        "lesson_brief": _lesson_brief_response,
        "unit_brief": _unit_brief_response,
        "semester_plan": _semester_plan_response,
        "resources": _resources_response,
        "package_check": _package_check_response,
        "download_manifest": _download_manifest_response,
        "fallback": _fallback_response,
    }
    response = builders.get(route, _fallback_response)(context, response_safety)
    response["session_id"] = context.get("session_id") or DEFAULT_SESSION_ID
    response["request_echo"] = {
        "teacher_message": teacher_message,
        "context_policy": context.get("context_policy"),
        "detected_context": context.get("detected_context"),
        "detected_route": route,
    }
    response["card_updates"] = [
        update for update in response.get("card_updates", [])
        if update.get("card_id") not in locked_cards
    ]
    return response


def build_lesson_brief_text(context: dict[str, Any], source: str = "") -> str:
    label = current_task_label(context)
    if len(str(source or "").strip()) >= 120 and label in source:
        return str(source).strip()
    return (
        f"课题：{label}\n"
        f"适用对象：{context.get('grade') or DEFAULT_GRADE}{context.get('subject') or DEFAULT_SUBJECT}。\n"
        "课时目标：学生能观察核心视觉特征，尝试用合适材料完成一个小作品，并用简单语言说明自己的选择。\n"
        "教学流程：导入观察、方法示范、学生尝试、作品展示与交流。\n"
        "核心活动：围绕课题完成一次可观察、可记录、可表达的创作任务。\n"
        "学生任务：看一看、试一试、做一做、说一说。\n"
        "学习证据：观察记录、过程草图、小作品、创作说明。\n"
        "下一步建议：先确认活动环节，再生成学生任务单。"
    )


def build_unit_brief_text(context: dict[str, Any], source: str = "") -> str:
    label = str(context.get("topic") or DEFAULT_TOPIC).strip() or DEFAULT_TOPIC
    lessons = int(context.get("planned_lessons") or 3)
    if len(str(source or "").strip()) >= 180 and label in source and "课时" in source:
        return str(source).strip()
    return (
        f"单元名称：《{label}》{lessons}课时大单元\n"
        f"单元主题：用美术方式观察、表现和表达《{label}》中的运动精神与视觉力量。\n"
        "大观念候选：美术可以把运动中的力量、速度、合作和情感转化为可见的形象。\n"
        "基本问题候选：怎样用线条、色彩、构图或材料表现足球运动的光彩与精神？\n"
        "表现性任务候选：完成一件足球主题作品，并用简短说明表达自己的设计想法。\n"
        "三课时安排：\n"
        "第1课时：观察足球瞬间，提炼人物动态、动作线和画面构图。\n"
        "第2课时：围绕足球主题完成绘画、海报或综合材料作品创作。\n"
        "第3课时：展示交流，完善作品说明，形成班级小展览。\n"
        "每课时任务：看运动瞬间、试表现方法、做主题作品、说创作理由。\n"
        "学习证据：观察记录、动态草图、作品过程稿、最终作品、展示说明。\n"
        "评价建议：关注是否抓住足球主题，是否能表现动态和画面重点，是否能说清创作选择。\n"
        "下一步追问：这个单元最后想让学生完成绘画、海报、纸雕灯、综合材料，还是展览类作品？"
    )


def build_semester_plan_text(context: dict[str, Any], source: str = "") -> str:
    label = semester_task_label(context)
    if len(str(source or "").strip()) >= 180 and any(key in source for key in ["学期", "周次", "教学内容", "规划目标"]):
        return str(source).strip()
    return (
        f"规划名称：{label}\n"
        "规划目标：先搭建一学期美术学习的目标、内容进度、活动周避让和学习证据，不直接展开完整课时教案。\n"
        "教材与资料：教材版本、目录或已上传资料可稍后补充；缺失时先标注待补，不作为生成前置条件。\n"
        "教学内容与进度：先按学期周次预留教学推进、材料准备、作品展示和复盘整理的位置，后续再按教材目录细化。\n"
        "周次节奏：开学诊断与材料准备 1 周，常规教学推进若干周，活动周避让，期末展示与复盘 1-2 周。\n"
        "学习证据：过程草图、观察记录、阶段作品、创作说明、展示交流记录。\n"
        "评价建议：关注学生是否能持续观察、尝试材料方法、完成作品并说明自己的选择，不写分数或成绩。\n"
        "待老师复核：校历、活动周、教材目录和课务节奏；教材目录缺失时先标待补。"
    )


def build_semester_field_rows(context: dict[str, Any], source: str = "", applied: bool = False) -> list[dict[str, str]]:
    text = build_semester_plan_text(context, source)
    labels = ["规划名称", "规划目标", "教材与资料", "教学内容与进度", "周次节奏", "学习证据", "评价建议", "待老师复核"]
    label_to_field = {
        "规划名称": "学期范围",
        "规划目标": "规划目标",
        "教材与资料": "教材与资料",
        "教学内容与进度": "教学内容与进度",
        "周次节奏": "周次节奏",
        "学习证据": "学习证据",
        "评价建议": "评价建议",
        "待老师复核": "待复核项",
    }
    return [
        {
            "field": label_to_field[label],
            "status": "已放入本次备课预览" if applied and label == "规划名称" else ("候选待确认" if applied else "候选"),
            "value": _extract_labeled_value(text, label),
        }
        for label in labels
    ]


def build_unit_field_rows(context: dict[str, Any], source: str = "", applied: bool = False) -> list[dict[str, str]]:
    text = build_unit_brief_text(context, source)
    return unit_field_rows_from_text(text, applied=applied)


def unit_field_rows_from_text(text: str, applied: bool = False) -> list[dict[str, str]]:
    value = str(text or "")
    labels = ["单元主题", "大观念候选", "基本问题候选", "表现性任务候选", "学习证据", "评价建议"]
    label_to_field = {
        "单元主题": "单元主题",
        "大观念候选": "大观念",
        "基本问题候选": "基本问题",
        "表现性任务候选": "表现性任务",
        "学习证据": "学习证据",
        "评价建议": "评价建议",
    }
    rows: list[dict[str, str]] = []
    for label in labels:
        extracted = _extract_labeled_value(value, label)
        if extracted:
            rows.append({
                "field": label_to_field[label],
                "status": "已放入本次备课预览" if applied and label == "单元主题" else ("候选待确认" if applied else "候选"),
                "value": extracted,
            })
    schedule = _extract_unit_schedule(value)
    if schedule:
        insert_index = 4 if len(rows) >= 4 else len(rows)
        rows.insert(insert_index, {
            "field": "三课时安排",
            "status": "候选待确认" if applied else "候选",
            "value": schedule,
        })
    fallback_fields = ["单元主题", "大观念", "基本问题", "表现性任务", "三课时安排", "学习证据", "评价建议"]
    existing = {row["field"] for row in rows}
    for field in fallback_fields:
        if field not in existing:
            rows.append({"field": field, "status": "候选待确认" if applied else "候选", "value": ""})
    return rows


def _extract_labeled_value(text: str, label: str) -> str:
    base_label = label.replace("候选", "")
    variants = [label, base_label, f"{base_label}候选"]
    for item in dict.fromkeys(variants):
        pattern = rf"(?:^|\n)\s*(?:[-*]\s*)?(?:\*\*)?\s*{re.escape(item)}\s*(?:\*\*)?\s*[：:]\s*(.+)"
        match = re.search(pattern, text or "")
        if match:
            return _clean_markdown_value(match.group(1))
    block = _extract_markdown_section(text, variants)
    if block:
        return block
    compact = _markdown_plain_text(text)
    for item in dict.fromkeys(variants):
        pattern = rf"{re.escape(item)}[：:]\s*([^。\n；;]+)"
        match = re.search(pattern, compact)
        if match:
            return _clean_markdown_value(match.group(1))
    return ""


def _extract_unit_schedule(text: str) -> str:
    lines = [line.strip() for line in str(text or "").splitlines()]
    capture = False
    items: list[str] = []
    inline = ""
    for line in lines:
        normalized = _normalize_markdown_heading(line)
        if normalized.startswith("三课时安排"):
            capture = True
            inline = re.sub(r"^三课时安排[：:]?\s*", "", normalized).strip()
            if inline:
                items.append(inline)
            continue
        if capture:
            if not line:
                continue
            if _is_markdown_section_heading(line):
                break
            if line.startswith("|") and "课时" in line and "---" not in line:
                parts = [part.strip() for part in line.strip("|").split("|")]
                if len(parts) >= 3 and parts[0] != "课时":
                    items.append(f"{parts[0]}：{parts[1]}，{parts[2]}")
                continue
            if line.startswith("|") and "---" in line:
                continue
            if line.startswith("第"):
                items.append(line)
                continue
            break
    return "；".join(items[:3])


def _extract_markdown_section(text: str, labels: list[str]) -> str:
    lines = [line.rstrip() for line in str(text or "").splitlines()]
    capture = False
    items: list[str] = []
    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            if capture and items:
                continue
            continue
        normalized = _normalize_markdown_heading(line)
        if not capture and any(normalized == item or normalized.startswith(f"{item}：") or normalized.startswith(f"{item}:") for item in labels):
            capture = True
            inline = ""
            for item in labels:
                if normalized.startswith(f"{item}：") or normalized.startswith(f"{item}:"):
                    inline = re.sub(rf"^{re.escape(item)}[：:]\s*", "", normalized).strip()
                    break
            if inline:
                items.append(inline)
            continue
        if not capture:
            continue
        if _is_markdown_section_heading(line):
            break
        if line.startswith("|") and "---" in line:
            continue
        if line.startswith("|"):
            cells = [cell.strip() for cell in line.strip("|").split("|")]
            if cells and cells[0] not in {"课时", "字段", "项目"}:
                items.append("，".join(cell for cell in cells if cell))
            continue
        cleaned = _clean_markdown_value(line)
        if cleaned:
            items.append(cleaned)
    return "；".join(items[:4])


def _normalize_markdown_heading(line: str) -> str:
    value = str(line or "").strip()
    value = re.sub(r"^[#>\-\*\s]+", "", value)
    value = re.sub(r"[*_`]+", "", value)
    return value.strip()


def _is_markdown_section_heading(line: str) -> bool:
    normalized = _normalize_markdown_heading(line)
    if not normalized:
        return False
    known_heads = [
        "单元名称",
        "单元主题",
        "大观念",
        "大观念候选",
        "基本问题",
        "基本问题候选",
        "表现性任务",
        "表现性任务候选",
        "三课时安排",
        "学习证据",
        "评价建议",
        "下一步追问",
    ]
    return any(normalized == head or normalized.startswith(f"{head}：") or normalized.startswith(f"{head}:") for head in known_heads)


def _markdown_plain_text(text: str) -> str:
    value = str(text or "")
    value = re.sub(r"[*_`#>-]+", "", value)
    value = re.sub(r"\|", " ", value)
    return value


def _clean_markdown_value(value: str) -> str:
    cleaned = re.sub(r"[*_`]+", "", str(value or "")).strip()
    cleaned = cleaned.strip(" -|")
    return cleaned


def build_activity_text(context: dict[str, Any], source: str = "") -> str:
    if context.get("legacy_qinglv_continue"):
        source_line = source or "观察 3 组青绿色彩卡，圈出最有画面感的一组，并说出理由。"
        return (
            "活动二：青绿色彩小侦探\n"
            "活动目标：让学生通过比较青绿色彩卡，发现不同青绿组合带来的画面感受。\n"
            "活动时间：约 12 分钟。\n"
            "材料准备：青绿色彩卡、对比色卡、观察记录表、铅笔。\n"
            f"学生任务：{source_line}\n"
            "教师组织：先出示 3 组色彩卡，再让学生两人一组比较，最后请 2-3 名学生说出选择理由。\n"
            "学习证据：颜色圈选记录、观察表、一句话说明。\n"
            "三年级支架：提供“最亮、最安静、最像山水”三个判断词，帮助学生表达感受。\n"
            "下一步建议：确认活动二后，同步生成学生任务单。"
        )
    label = current_task_label(context)
    source_line = source or f"围绕「{label}」完成一次观察、尝试和表达。"
    return (
        "活动环节：观察与创作小任务\n"
        f"活动目标：让学生理解「{label}」的核心视觉线索，并能转化为作品。\n"
        "活动时间：约 12-15 分钟。\n"
        "材料准备：参考图、常用美术工具、观察记录纸。\n"
        f"学生任务：{source_line}\n"
        "教师组织：先用一个示例带学生观察，再给出步骤提示，最后组织学生展示说明。\n"
        "学习证据：观察记录、过程草图、小作品、简短表达。\n"
        "支架提示：给学生提供“我看见了什么、我用了什么方法、我想表达什么”三个句式。\n"
        "下一步建议：确认活动后，同步生成学生任务单。"
    )


def build_task_sheet_text(context: dict[str, Any], source: str = "") -> str:
    if context.get("legacy_qinglv_continue"):
        return (
            "小任务一：看一看\n"
            "请观察 3 组青绿色彩，圈出你最喜欢的一组。\n\n"
            "小任务二：说一说\n"
            "这组颜色给你的感觉是：安静 / 明亮 / 有层次 / 像山水。\n\n"
            "小任务三：试一试\n"
            "用你选的青绿色画一座小山。\n\n"
            "小任务四：写一写\n"
            "我选择这组颜色，是因为：________。\n\n"
            "留下的学习证据：圈出的颜色、观察记录、小山作品和一句说明。"
        )
    label = current_task_label(context)
    return (
        "小任务一：看一看\n"
        f"请观察和「{label}」有关的图片、材料或作品，圈出一个最重要的发现。\n\n"
        "小任务二：试一试\n"
        "按老师给出的步骤完成一次小练习，留下草图或过程记录。\n\n"
        "小任务三：做一做\n"
        "完成一个小作品，注意把观察到的特点用到作品里。\n\n"
        "小任务四：说一说\n"
        "用一句话说明：我这样做，是因为________。\n\n"
        "留下的学习证据：观察记录、练习痕迹、小作品和一句说明。"
    )


def _base_response(response_id: str, route: str, reason: str, message: str, response_safety: dict[str, Any]) -> dict[str, Any]:
    return {
        "response_id": response_id,
        "assistant_message": message,
        "intent": {
            "intent_id": route,
            "confidence": 0.88 if route != "fallback" else 0.58,
            "teacher_readable_reason": reason,
        },
        "card_updates": [],
        "next_actions": [],
        "safety_check": deepcopy(response_safety),
    }


def _lesson_brief_response(context: dict[str, Any], response_safety: dict[str, Any]) -> dict[str, Any]:
    label = current_task_label(context)
    response = _base_response(
        "backend_ai_resp_lesson_brief_063A",
        "lesson_brief",
        f"老师正在新开或重置到「{label}」的备课。",
        (
            f"**{label}备课候选：**\n\n"
            "- 已按新课题搭出一版课时框架。\n"
            "- 右侧会显示目标、流程、活动和学习证据候选。\n"
            "- 这仍是候选，确认前不会写入正式成果。"
        ),
        response_safety,
    )
    response["card_updates"].append({
        "card_id": "lesson_brief_candidate",
        "update_type": "open_card",
        "teacher_title": f"{label}备课候选",
        "status": "ready_for_teacher_review",
        "candidate_text": build_lesson_brief_text(context),
        "teacher_summary": f"已切换到「{label}」，并形成备课候选框架。",
        "impact_targets": ["学生任务单", "评价证据", "教学包检查"],
        "requires_teacher_acceptance": True,
        "locked_target": False,
    })
    response["next_actions"] = _actions(["继续精修", "生成任务单", "检查教学包"])
    return response


def _unit_brief_response(context: dict[str, Any], response_safety: dict[str, Any]) -> dict[str, Any]:
    label = unit_task_label(context)
    topic = str(context.get("topic") or DEFAULT_TOPIC)
    lessons = int(context.get("planned_lessons") or 3)
    response = _base_response(
        "backend_ai_resp_unit_brief_063A1",
        "unit_brief",
        f"老师正在把「{topic}」切换为{lessons}课时大单元。",
        (
            f"**明白，我把《{topic}》切换为{lessons}课时大单元。**\n\n"
            "- 我先搭一版大单元框架。\n"
            "- 右侧会显示单元主题、大观念、基本问题、表现性任务和三课时安排。\n"
            "- 这些仍是候选，确认前不会写入正式成果。"
        ),
        response_safety,
    )
    response["card_updates"].append({
        "card_id": "unit_brief_candidate",
        "update_type": "open_card",
        "teacher_title": f"《{label}》候选框架",
        "status": "ready_for_teacher_review",
        "candidate_text": build_unit_brief_text(context),
        "teacher_summary": f"已形成《{topic}》{lessons}课时大单元候选框架，等待老师确认。",
        "impact_targets": ["三课时安排", "学习证据", "评价建议", "教学包检查"],
        "requires_teacher_acceptance": True,
        "locked_target": False,
        "field_rows": [
            *build_unit_field_rows(context),
        ],
    })
    response["next_actions"] = _actions(["修改某个字段", "重新生成某个字段", "进入课时部分"])
    return response


def _semester_plan_response(context: dict[str, Any], response_safety: dict[str, Any]) -> dict[str, Any]:
    label = semester_task_label(context)
    response = _base_response(
        "backend_ai_resp_semester_plan_064D8",
        "semester_plan",
        f"老师正在请求「{label}」。",
        (
            f"**我切到{label}。**\n\n"
            "- 我先搭一版学期规划候选，不展开完整课时教案。\n"
            "- 右侧会显示规划目标、教学内容与进度、周次节奏、学习证据和评价建议。\n"
            "- 这仍是候选，确认前不会进入最终成果包。"
        ),
        response_safety,
    )
    candidate_text = build_semester_plan_text(context)
    response["card_updates"].append({
        "card_id": "semester_plan_candidate",
        "update_type": "open_card",
        "teacher_title": f"{label}候选",
        "status": "ready_for_teacher_review",
        "candidate_text": candidate_text,
        "teacher_summary": "已生成学期规划候选，教材目录可稍后补充，等待老师复核活动周和课务节奏。",
        "impact_targets": ["教学工作计划", "课务日程", "活动周复核", "教学包检查"],
        "requires_teacher_acceptance": True,
        "locked_target": False,
        "field_rows": build_semester_field_rows(context, candidate_text),
    })
    response["next_actions"] = _actions(["补充教材目录", "调整活动周", "生成课务日程", "查看教学工作计划"])
    return response


def _activity_scope_clarification_response(context: dict[str, Any], response_safety: dict[str, Any]) -> dict[str, Any]:
    topic = str(context.get("topic") or DEFAULT_TOPIC)
    response = _base_response(
        "backend_ai_resp_activity_scope_clarification_063A1",
        "scope_clarification",
        "老师说继续精修活动二，但当前上下文是大单元，需要确认活动范围。",
        (
            f"**我先确认一下：**\n\n"
            f"- 当前正在处理《{topic}》大单元。\n"
            "- 你说的“活动二”是指《足球之光》第2课时里的活动，还是要切回之前某个课题？\n"
            "- 你回一句“精修足球之光第2课时”，我就继续在当前大单元里处理。"
        ),
        response_safety,
    )
    response["next_actions"] = _actions(["精修当前第2课时", "继续修改", "检查教学包"])
    return response


def _activity_response(context: dict[str, Any], response_safety: dict[str, Any]) -> dict[str, Any]:
    label = current_task_label(context)
    title = "活动二候选" if context.get("legacy_qinglv_continue") else "活动环节候选"
    response = _base_response(
        "backend_ai_resp_activity_refine_063A",
        "activity_refine",
        f"老师正在继续优化「{label}」的活动设计。",
        (
            f"**{title}：**\n\n"
            f"- 已围绕「{label}」整理活动步骤、学生输出和学习证据。\n"
            "- 当前仍是候选内容，需要你确认后才进入备课预览。"
        ),
        response_safety,
    )
    response["card_updates"].append({
        "card_id": "activity_2_candidate",
        "update_type": "candidate_update",
        "teacher_title": title,
        "status": "candidate",
        "candidate_text": build_activity_text(context),
        "teacher_summary": "活动步骤和学生输出更清楚，等待老师确认。",
        "impact_targets": ["学生任务单", "评价证据", "教学包检查"],
        "requires_teacher_acceptance": True,
        "locked_target": False,
    })
    response["next_actions"] = _actions(["采纳候选", "继续修改", "生成任务单"])
    return response


def _task_sheet_response(context: dict[str, Any], response_safety: dict[str, Any]) -> dict[str, Any]:
    label = current_task_label(context)
    response = _base_response(
        "backend_ai_resp_task_sheet_063A",
        "task_sheet",
        f"老师希望把「{label}」转成学生能完成的任务单。",
        (
            "**学生任务单草稿：**\n\n"
            f"- 已按「{label}」生成学生能读懂的任务单草稿。\n"
            "- 状态保持待确认，确认前不会进入最终成果包。"
        ),
        response_safety,
    )
    response["card_updates"].append({
        "card_id": "task_sheet_candidate",
        "update_type": "open_card",
        "teacher_title": "学生任务单草稿",
        "status": "pending_review",
        "candidate_text": build_task_sheet_text(context),
        "teacher_summary": "任务单已形成草稿，等待老师确认。",
        "impact_targets": ["教学包检查", "评价证据"],
        "requires_teacher_acceptance": True,
        "locked_target": False,
    })
    response["next_actions"] = _actions(["确认任务单", "继续修改", "检查教学包"])
    return response


def _resources_response(context: dict[str, Any], response_safety: dict[str, Any]) -> dict[str, Any]:
    label = current_task_label(context)
    response = _base_response(
        "backend_ai_resp_resources_063A",
        "resources",
        f"老师希望补充「{label}」的资源。",
        (
            f"**{label}资源建议：**\n\n"
            "- 准备一组导入观察图或实物材料。\n"
            "- 准备一份步骤提示，帮助学生完成创作。\n"
            "- 准备一句表达支架，帮助学生说清楚作品想法。"
        ),
        response_safety,
    )
    response["card_updates"].append({
        "card_id": "resource_cards",
        "update_type": "open_card",
        "teacher_title": f"{label}资源建议",
        "status": "preview",
        "candidate_text": "观察资源、材料工具、步骤提示、表达句式，可先作为本课资源清单候选。",
        "teacher_summary": "资源可服务导入、练习和学生表达。",
        "impact_targets": ["课件", "学生任务单", "本课资源清单"],
        "requires_teacher_acceptance": True,
        "locked_target": False,
    })
    response["next_actions"] = _actions(["加入本课资源清单", "生成任务单", "检查教学包"])
    return response


def _package_check_response(context: dict[str, Any], response_safety: dict[str, Any]) -> dict[str, Any]:
    response = _base_response(
        "backend_ai_resp_package_check_063A",
        "package_check",
        "老师希望确认本课材料是否已经能进入交付预览。",
        "**教学包检查：**\n\n- 教师阅读版：已就绪。\n- 学生任务单：仍待确认。\n- 评价建议：仍待确认。\n- 当前阶段：只做备课预览，不进入课堂应用。",
        response_safety,
    )
    response["card_updates"].append({
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


def _download_manifest_response(context: dict[str, Any], response_safety: dict[str, Any]) -> dict[str, Any]:
    response = _base_response(
        "backend_ai_resp_download_manifest_063A",
        "download_manifest",
        "老师希望查看当前可以准备哪些成果材料。",
        "**成果包下载清单预览：**\n\n| 内容 | 状态 |\n| --- | --- |\n| 教师阅读版 | 已就绪 |\n| 材料清单 | 已就绪 |\n| 学生任务单 | 待确认 |\n| 评价建议表 | 待确认 |\n\n确认完成后再生成可下载成果包。",
        response_safety,
    )
    response["card_updates"].append({
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


def _fallback_response(context: dict[str, Any], response_safety: dict[str, Any]) -> dict[str, Any]:
    label = current_task_label(context)
    response = _base_response(
        "backend_ai_resp_fallback_063A",
        "fallback",
        "老师输入没有命中明确任务，先给出可继续操作。",
        (
            f"**我在当前备课「{label}」。**\n\n"
            "- 你可以让我继续精修活动、生成任务单、找资源或检查教学包。\n"
            "- 如果要切换课题，请直接说：我要新备一节《课题名》。"
        ),
        response_safety,
    )
    response["next_actions"] = _actions(["继续精修", "生成任务单", "查找资源", "检查教学包", "生成下载清单"])
    return response


def _actions(labels: list[str]) -> list[dict[str, str]]:
    action_map = {
        "采纳候选": "accept_candidate",
        "确认任务单": "accept_candidate",
        "继续修改": "revise_candidate",
        "继续精修": "revise_candidate",
        "生成任务单": "generate_task_sheet",
        "检查教学包": "check_package",
        "生成下载清单": "show_download_manifest",
        "继续完善": "revise_candidate",
        "加入本课资源清单": "open_preview_card",
        "查找资源": "open_preview_card",
        "继续确认": "revise_candidate",
        "继续追问单元主题": "ask_unit_theme",
        "生成三课时结构": "generate_lesson_sequence",
        "进入字段追问": "start_field_question_flow",
        "补充教材版本": "ask_for_textbook_version",
        "生成周次安排": "generate_semester_schedule",
        "进入单元规划": "generate_unit_brief_candidate",
        "修改某个字段": "modify_last_candidate",
        "重新生成某个字段": "generate_unit_brief_candidate",
        "进入课时部分": "generate_lesson_brief_candidate",
        "精修当前第2课时": "revise_current_lesson_2",
    }
    return [{"label": label, "action_id": action_map.get(label, "suggest_next_actions")} for label in labels]


def _normalize_policy(value: Any) -> str:
    text = str(value or "").strip()
    return text if text in ALLOWED_CONTEXT_POLICIES else "infer_from_teacher_message"


def _normalize_design_scope(value: Any) -> str:
    text = str(value or "").strip()
    return text if text in DESIGN_SCOPES else "unknown"


def _normalize_context_intent(value: Any) -> str:
    text = str(value or "").strip()
    if text == "new_lesson_brief":
        return "new_topic"
    if text == "continue_current_lesson":
        return "continue_current"
    return text if text in CONTEXT_INTENTS else "inferred"


def _infer_policy(text: str, context_intent: str = "") -> str:
    compact = str(text or "").replace(" ", "")
    if context_intent in {"task_object_update", "lesson_component_split_request", "field_edit_request"}:
        return "use_current_context"
    if context_intent in {"course_catalog_query", "planning_info_query", "topic_selection_needed"}:
        return "use_current_context"
    if context_intent == "semester_plan_request":
        return "use_current_context"
    if context_intent in {"scope_correction", "unit_brief_request"}:
        return "use_current_context"
    if any(key in compact for key in ["新备课", "新开备课", "新建备课", "我要新备", "我要备", "我想备", "备一节", "备一下", "帮我备", "我要做", "我想做", "开始备课", "新单元", "新课程"]):
        return "reset_for_new_lesson"
    if _looks_like_course_catalog_query(text) or _looks_like_planning_info_query(text):
        return "use_current_context"
    if _extract_grade(text) and _extract_topic(text):
        return "reset_for_new_lesson"
    if any(key in compact for key in ["继续精修", "继续做", "继续写", "继续处理", "接着做", "接着写", "基于当前", "沿用当前", "继续当前", "继续上次", "延续当前"]):
        return "use_current_context"
    return "infer_from_teacher_message"


def _intent_for_policy(policy: str) -> str:
    if policy == "reset_for_new_lesson":
        return "new_lesson_brief"
    if policy == "use_current_context":
        return "continue_current_lesson"
    return "inferred"


def _infer_context_intent(text: str, design_scope: str) -> str:
    compact = str(text or "").replace(" ", "")
    extracted_topic = _extract_topic(text)
    has_new_start = any(key in compact for key in ["我要备", "我想备", "帮我备", "备一下", "备一节", "我要做", "我想做"])
    if _looks_like_course_catalog_query(text):
        return "course_catalog_query"
    if _looks_like_planning_info_query(text):
        return "planning_info_query"
    if _looks_like_lesson_component_split(text):
        return "lesson_component_split_request"
    if _looks_like_field_edit_request(text):
        return "field_edit_request"
    if _looks_like_task_object_update(text):
        return "task_object_update"
    if has_new_start and not extracted_topic:
        return "topic_selection_needed"
    if _is_scope_correction(text):
        return "scope_correction"
    if design_scope == "semester" and any(key in compact for key in ["学期", "学年", "上册", "下册", "全册", "整册", "教学进度", "教学计划", "规划", "教案"]):
        return "new_topic" if has_new_start else "semester_plan_request"
    if design_scope == "unit" and any(key in compact for key in ["怎么办", "怎么备", "如何备", "三课时安排", "生成三课时", "大单元"]):
        if not extracted_topic:
            return "unit_brief_request"
    if has_new_start:
        return "new_topic"
    if _extract_grade(text) and extracted_topic:
        return "new_topic"
    if any(key in compact for key in ["继续", "接着", "沿用"]):
        return "continue_current"
    return "inferred"


def _first_text(*values: Any) -> str:
    for value in values:
        text = str(value or "").strip()
        if text:
            return text
    return ""


def _first_number(*values: Any) -> int | None:
    for value in values:
        if value in ("", None):
            continue
        try:
            number = int(value)
        except (TypeError, ValueError):
            continue
        if number > 0:
            return number
    return None


def _extract_grade(text: str) -> str:
    zh_map = {"一": "1", "二": "2", "三": "3", "四": "4", "五": "5", "六": "6", "七": "7", "八": "8", "九": "9", "十": "10"}
    match_zh = re.search(r"([一二三四五六七八九十]+)\s*年级", text or "")
    if match_zh:
        return f"{zh_map.get(match_zh.group(1), match_zh.group(1))}年级"
    match_num = re.search(r"(\d+)\s*年级", text or "")
    if match_num:
        return f"{match_num.group(1)}年级"
    return ""


def _extract_subject(text: str) -> str:
    for subject in ["语文", "数学", "英语", "美术", "音乐", "科学", "道法", "体育"]:
        if subject in str(text or ""):
            return subject
    return ""


def _extract_lesson_no(text: str) -> str:
    match = re.search(r"第\s*([一二三四五六七八九十\d]+)\s*(课时|课|节)", text or "")
    if match:
        return f"第{match.group(1)}{match.group(2)}"
    return ""


def _extract_planned_lessons(text: str) -> int | None:
    value = str(text or "")
    zh_map = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}
    matches = [
        re.search(r"(?:有|共|一共|总共|设置为|按)\s*([一二三四五六七八九十\d]+)\s*课时", value),
        re.search(r"([一二三四五六七八九十\d]+)\s*课时\s*(?:大单元|单元|结构|安排)", value),
        re.search(r"分\s*([一二三四五六七八九十\d]+)\s*节课", value),
    ]
    match = next((item for item in matches if item), None)
    if not match:
        return None
    raw = match.group(1)
    if raw.isdigit():
        return int(raw)
    return zh_map.get(raw)


def _extract_design_scope(text: str) -> str:
    compact = str(text or "").replace(" ", "")
    if any(key in compact for key in ["大单元", "一个单元", "做一个单元", "单元备课", "单元设计", "这是一个大单元", "不是单课"]):
        return "unit"
    if _extract_planned_lessons(text):
        return "unit"
    if any(key in compact for key in ["学期", "学年", "上册", "下册", "全册", "整册", "整本书", "一册", "教学进度", "教学计划"]):
        return "semester"
    if any(key in compact for key in ["单课", "一节课", "一课时"]):
        return "lesson"
    return "unknown"


def _is_scope_correction(text: str) -> bool:
    compact = str(text or "").replace(" ", "")
    if any(key in compact for key in ["这是一个大单元", "不是单课", "不是一节课", "我是要做大单元", "这个是大单元", "这个课题要分几课时做"]):
        return True
    return bool(_extract_planned_lessons(text) and not _extract_topic(text))


def _extract_topic(text: str) -> str:
    value = str(text or "")
    quoted = re.search(r"《([^》]{2,40})》", value)
    if quoted:
        return quoted.group(1).strip()
    quoted2 = re.search(r"[“\"]([^”\"]{2,40})[”\"]", value)
    if quoted2:
        return quoted2.group(1).strip()
    named = re.search(r"(?:名字|名称|课题|主题)\s*(?:叫|是|为|叫做|名为)\s*([^，。！？、\n]{2,40})", value)
    if named:
        return _clean_topic(named.group(1))
    titled = re.search(r"(?:题为|名为)\s*([^，。！？、\n]{2,40})", value)
    if titled:
        return _clean_topic(titled.group(1))
    brief = re.search(r"(?:我要做|我想做|开始做|备一下|帮我备|我要备|我想备)\s*(?:一个|一节|一份)?\s*([^，。！？、\n]{2,24})", value)
    if brief:
        return _clean_topic(brief.group(1))
    if _looks_like_course_catalog_query(value) or _looks_like_planning_info_query(value):
        return ""
    unit_match = re.search(r"(?:一个|一份|一节|一套)?\s*([^，。！？、\s]{2,24})\s*(?:单元|课题)", value)
    if unit_match:
        return _clean_topic(unit_match.group(1))
    bare_grade_topic = re.search(r"(?:[一二三四五六七八九十\d]+)\s*年级(?:的)?(?:美术)?(?:的)?([^，。！？、\n]{2,24})$", value)
    if bare_grade_topic:
        return _clean_topic(bare_grade_topic.group(1))
    return ""


def _clean_topic(value: str) -> str:
    cleaned = re.sub(
        r"^(?:一节|一个|一份|一套|一年级|二年级|三年级|四年级|五年级|六年级|美术|语文|数学|英语|的)+",
        "",
        str(value or ""),
    ).strip("《》：: ")
    cleaned = re.sub(r"(?:怎么办|怎么做|如何做|怎么备|备课|大单元课程|大单元|单元课程|单元|课程)$", "", cleaned).strip()
    return "" if cleaned in {"大单元", "单元", "课时", "一下", "弄一下"} or _is_question_like_topic(cleaned) else cleaned


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


def _looks_like_lesson_component_split(text: str) -> bool:
    compact = str(text or "").replace(" ", "")
    return any(key in compact for key in ["进入课时部分", "课时部分", "课时组件", "拆第1课时", "拆第一课时", "拆课时"])


def _looks_like_field_edit_request(text: str) -> bool:
    compact = str(text or "").replace(" ", "")
    fields = ["大观念", "基本问题", "表现性任务", "三课时安排", "学习证据", "评价建议", "单元主题"]
    return any(field in compact for field in fields) and any(key in compact for key in ["修改", "改", "调整", "重写", "重新生成"])


def _looks_like_task_object_update(text: str) -> bool:
    compact = str(text or "").replace(" ", "")
    return any(key in compact for key in ["废旧材料", "超轻彩泥", "预算", "技法", "第一课时", "第1课时"])


def _topic_from_current_task(task: dict[str, Any]) -> str:
    title = str(task.get("title") or "").strip()
    if not title or "新备课" in title or "当前备课" in title:
        return ""
    title = re.sub(r"^\d+年级[^·]*·", "", title)
    return title.strip()


def _session_id_for_request(request: dict[str, Any], task: dict[str, Any], policy: str) -> str:
    current_context = request.get("current_context") if isinstance(request.get("current_context"), dict) else {}
    if policy == "reset_for_new_lesson" and task.get("task_id"):
        return str(task.get("task_id"))
    return str(request.get("session_id") or current_context.get("session_id") or task.get("task_id") or DEFAULT_SESSION_ID)


def _looks_like_legacy_qinglv_continue(text: str, request: dict[str, Any], task: dict[str, Any]) -> bool:
    combined = " ".join([
        str(text or ""),
        str(request.get("session_id") or ""),
        str(task.get("task_id") or ""),
        str(task.get("title") or ""),
    ]).lower()
    return any(term.lower() in combined for term in LEGACY_QINGLV_TERMS)
