(function () {
  "use strict";

  const cards = () => window.XIAOBEI_DYNAMIC_CARDS_V1;
  const REAL_CANDIDATE_MODE = "real_candidate";
  const THINKING_MIN_MS = 1800;
  const TRACE_FINAL_HOLD_MS = 700;
  const CONTEXT_STORAGE_KEY = "xiaobei_workbench_context_state_v1";
  const CONTEXT_BASE_KEY = "context_state";

  function contextResolver() {
    return window.XIAOBEI_WORKBENCH_CONTEXT_RESOLVER_V1;
  }

  function intentRouter() {
    return window.XIAOBEI_WORKBENCH_INTENT_ROUTER_V1;
  }

  function runTraceMicroPanel() {
    return window.XIAOBEI_WORKBENCH_RUN_TRACE_MICRO_PANEL_070B27;
  }

  function safeReadJson(key) {
    const storage = window.XIAOBEI_WORKBENCH_SESSION_STORAGE_V1;
    if (!storage || typeof storage.getJson !== "function") return null;
    return storage.getJson(key === CONTEXT_STORAGE_KEY ? CONTEXT_BASE_KEY : key, null);
  }

  function activeContextState() {
    const current = window.XIAOBEI_WORKBENCH_CONTEXT_STATE_V1;
    const storage = window.XIAOBEI_WORKBENCH_SESSION_STORAGE_V1;
    const activeId = storage && typeof storage.getActiveWorkbenchSessionId === "function" ? storage.getActiveWorkbenchSessionId() : "";
    if (current && typeof current === "object" && current.session_id === activeId) return current;
    const stored = safeReadJson(CONTEXT_STORAGE_KEY);
    if (stored && typeof stored === "object") {
      window.XIAOBEI_WORKBENCH_CONTEXT_STATE_V1 = stored;
      return stored;
    }
    return {};
  }

  function resolveContextFromInput(text, options = {}) {
    const resolver = contextResolver();
    if (resolver && typeof resolver.resolveContextFromTeacherMessage === "function") {
      return resolver.resolveContextFromTeacherMessage(String(text || ""), options);
    }
    return null;
  }

  function clarificationMessage(result) {
    const missing = Array.isArray(result && result.missing_fields) ? result.missing_fields : [];
    const detected = (result && result.detected_context) || {};
    const known = [];
    if (detected.grade) known.push(detected.grade);
    if (detected.subject) known.push(detected.subject);
    const knownText = known.length ? `我读到你要备${known.join("")}。` : "";
    if (!missing.length) {
      return `**我先确认一下：**\n\n- ${knownText || "你想备什么年级、什么学科、什么课题？"}\n- 请再补充具体课题、单元名，或要使用的资料。`;
    }
    const hints = [];
    if (missing.includes("grade")) hints.push("年级");
    if (missing.includes("subject")) hints.push("学科");
    if (missing.includes("topic")) hints.push("课题/单元名");
    return `**我先确认一下：**\n\n- ${knownText || "你现在是新备一节。"}还缺：${hints.length ? hints.join("、") : "课题信息"}。\n- 你可以补一句具体课题、单元名，或要使用的资料。\n- 我可以先帮你搭一个课时框架。`;
  }

  function planIntentRoute(text, contextResult) {
    const router = intentRouter();
    if (router && typeof router.planIntentRoute === "function") {
      return router.planIntentRoute(String(text || ""), contextResult || {});
    }
    return null;
  }

  function rememberSyntheticTurn(input, assistantMessage, response = {}) {
    const runtimeClient = window.XIAOBEI_AGENT_RUNTIME_CLIENT_V1;
    const runtimeState = runtimeClient && typeof runtimeClient.getRuntimeState === "function"
      ? runtimeClient.getRuntimeState()
      : {};
    const normalized = {
      success: true,
      mode: response.mode || "frontend_intent_route",
      teacher_message: String(input || ""),
      assistant_message: assistantMessage,
      intent: response.intent || { intent_id: "unknown", confidence: 0.7 },
      intent_route_decision: response.intent_route_decision || null,
      next_action: response.next_action || "reply_only",
      context_policy: response.context_policy || "use_current_context",
      card_updates: response.card_updates || [],
      runtime_state: response.runtime_state || runtimeState,
      safety_flags: {
        database_write_allowed: false,
        feishu_write_allowed: false,
        formal_scoring_allowed: false,
        classroom_app_connect_allowed: false,
        student_submit_allowed: false,
        real_export_allowed: false,
        teacher_review_required: true
      },
      content_written: false,
      formal_content_kept: true
    };
    window.XIAOBEI_AGENT_LAST_TURN_V1 = {
      captured_at: new Date().toISOString(),
      request: {
        teacher_message: String(input || ""),
        runtime_state: runtimeState,
        current_context: {
          topic: runtimeState.current_topic || runtimeState.topic || "",
          grade: runtimeState.grade || "",
          subject: runtimeState.subject || "美术",
          design_scope: runtimeState.design_scope || "unknown",
          planned_lessons: runtimeState.planned_lessons,
          last_candidate: runtimeState.last_candidate || {},
          pending_candidate: runtimeState.pending_candidate || {}
        }
      },
      response: normalized
    };
    return normalized;
  }

  function looksLikeCandidateApply(text) {
    const compact = String(text || "").replace(/\s+/g, "");
    return /写进去|写入|再次写入|重新写入|帮我写进去|先帮我写进去|放进卡片|放入卡片|写进卡片|写入卡片|写到卡片|写到右侧|上面的内容|前面的内容|前面足球之光|刚才的内容|就用这个|按这个来|采纳这个|放到右边/.test(compact);
  }

  function looksLikeCandidateLocation(text) {
    const compact = String(text || "").replace(/\s+/g, "");
    return /候选在哪里|候选在哪|候选呢|刚才的候选|上面的候选|右侧在哪里|卡片在哪里|卡片在哪/.test(compact);
  }

  function looksLikeContextProbe(text) {
    const compact = String(text || "").replace(/\s+/g, "");
    if (!compact) return false;
    if (/^[?？]+$/.test(compact)) return true;
    if (looksLikeCandidateLocation(compact)) return true;
    return /(能不能|可以|是否|是不是|有没有|读取|读到|看得到|看到|记得|知道|上下文|上面|前面|刚才).*(上面|前面|刚才|内容|候选|上下文|足球之光|课题|备课)|^(上面|前面|刚才).*?(是什么|在哪|内容|候选)|上下文/.test(compact);
  }

  function semesterPlanningApi() {
    return window.XIAOBEI_SEMESTER_SCHEDULE_PLANNING_V1;
  }

  function looksLikeSemesterPlanning(text) {
    const compact = normalize(text);
    if (!compact) return false;
    const mentionsPlanning = /学期规划|学习规划|学期课务|课务安排|教学工作计划|学期计划/.test(compact);
    if (!mentionsPlanning) return false;
    const api = semesterPlanningApi();
    const ready = !!(api && typeof api.isReady === "function" && api.isReady());
    const generationFromFilledCard = isFilledSemesterGenerateRequest(compact);
    return !(ready && generationFromFilledCard);
  }

  function isFilledSemesterGenerateRequest(text) {
    return /根据右侧基础信息|生成学期课务安排|生成课务安排|先做校历周次判断/.test(normalize(text));
  }

  function openSemesterPlanningCard() {
    const focus = window.XIAOBEI_FOCUS_WORKSPACE_V1;
    if (focus && typeof focus.setFocusTask === "function") focus.setFocusTask("semesterSchedule");
    const dynamic = cards();
    if (dynamic && typeof dynamic.setActiveNav === "function") dynamic.setActiveNav("docs");
    if (dynamic && typeof dynamic.focusCard === "function") dynamic.focusCard("semesterSchedule", { sync: false });
  }

  function semesterPlanningInquiryReply() {
    const api = semesterPlanningApi();
    if (api && typeof api.startGuidedQuestions === "function") {
      const result = api.startGuidedQuestions({ restart: true });
      if (result && result.reply) return result.reply;
    }
    return [
      "### 我先带你把学期课务信息搭起来",
      "",
      "我不直接生成草稿。做学期课务安排前，需要先和你确认基础信息。",
      "",
      "---",
      "",
      "**需要老师确认：学期**",
      "",
      "这是哪个学年、第一学期还是第二学期？可以直接说：2025-2026学年第一学期。"
    ].join("\n");
  }

  function handleSemesterGuidedAnswer(input) {
    const api = semesterPlanningApi();
    if (!api || typeof api.hasActiveQuestion !== "function" || !api.hasActiveQuestion()) return null;
    const restartRequest = /我要|进行|做|开始|切到/.test(normalize(input)) && looksLikeSemesterPlanning(input);
    if (isFilledSemesterGenerateRequest(input) || restartRequest) {
      const result = typeof api.startGuidedQuestions === "function" ? api.startGuidedQuestions({ resume: !restartRequest, restart: restartRequest }) : null;
      return {
        reply: result && result.reply ? result.reply : semesterPlanningInquiryReply(),
        result: result || { handled: true },
        source: "semester_guided_resume"
      };
    }
    if (typeof api.handleGuidedAnswer !== "function") return null;
    const result = api.handleGuidedAnswer(input);
    if (!result || !result.handled) return null;
    return {
      reply: result.reply || semesterPlanningInquiryReply(),
      result,
      source: "semester_guided_answer"
    };
  }

  function responseLooksLikeSemesterPlanCandidate(response, activeCardId) {
    if (activeCardId === "semesterSchedule") return true;
    const responseText = JSON.stringify(response || {});
    return /semester_plan_candidate|semester_schedule_planning|semester_schedule|学期规划候选|学期规划候选稿|学期范围|规划目标|周次节奏|我已经切到|已切到/.test(responseText);
  }

  function semesterReplyForResponse(input, response, activeCardId) {
    const api = semesterPlanningApi();
    const ready = !!(api && typeof api.isReady === "function" && api.isReady());
    if (ready && isFilledSemesterGenerateRequest(input)) {
      return (response && response.assistant_message) || "**我开始根据右侧基础信息生成课务安排。**\n\n- 我会先检查校历周次、活动周和教材目录。\n- 生成结果仍是候选，需要老师确认后才会进入成果包。";
    }
    if (responseLooksLikeSemesterPlanCandidate(response, activeCardId)) {
      openSemesterPlanningCard();
      return semesterPlanningInquiryReply();
    }
    return "";
  }

  function cardIdForCandidate(candidate) {
    const type = candidate && candidate.candidate_type;
    if (type === "unit_brief_candidate") return "unitBrief";
    if (type === "lesson_brief_candidate") return "lessonBrief";
    if (type === "task_sheet_candidate") return "taskSheet";
    if (type === "activity_candidate") return "candidate";
    return "tasks";
  }

  function describeLastCandidateLocation() {
    const dynamic = window.XIAOBEI_DYNAMIC_CARDS_V1;
    const candidate = dynamic && typeof dynamic.getLastCandidate === "function" ? dynamic.getLastCandidate() : null;
    if (!candidate) {
      return {
        handled: false,
        message: "**我还没有看到可查看的候选。**\n\n- 你可以先让我生成课时框架、大单元框架或任务单。\n- 生成后你再问“候选在哪里”，我会直接定位到右侧工作卡。"
      };
    }
    const topic = candidate.topic || "当前课题";
    const cardId = cardIdForCandidate(candidate);
    const title = (candidate.card_update_payload && candidate.card_update_payload.teacher_title) || `${topic}候选`;
    if (dynamic && typeof dynamic.restoreLastCandidateCard === "function") {
      dynamic.restoreLastCandidateCard({ applied: candidate.status === "applied_to_preview" });
    } else if (dynamic && typeof dynamic.focusCard === "function") {
      dynamic.focusCard(cardId, { sync: false });
    }
    return {
      handled: true,
      cardId,
      message: `**候选在右侧当前工作卡。**\n\n- 当前候选：${title}。\n- 我已经帮你定位到右侧工作区。\n- 如果你认可这版，可以说“先帮我写进去”或“就用这个”。`
    };
  }

  function contextProbeReply() {
    const dynamic = window.XIAOBEI_DYNAMIC_CARDS_V1;
    const candidate = dynamic && typeof dynamic.getLastCandidate === "function" ? dynamic.getLastCandidate() : null;
    const contextState = activeContextState();
    const detected = (contextState && contextState.detected_context) || {};
    const task = (contextState && contextState.current_task) || {};
    const topic = (candidate && candidate.topic) || detected.topic || task.topic || task.title || "";
    const grade = (candidate && candidate.grade) || detected.grade || task.grade || "";
    const subject = (candidate && candidate.subject) || detected.subject || task.subject || "美术";
    const designScope = (candidate && candidate.design_scope) || detected.design_scope || task.design_scope || "unknown";
    const lessons = (candidate && candidate.planned_lessons) || detected.planned_lessons || task.planned_lessons || null;
    const scopeText = designScope === "unit" ? `${lessons ? lessons + "课时" : ""}大单元`.trim() : (designScope === "lesson" ? "单课" : "备课候选");

    if (candidate) {
      const restored = dynamic && typeof dynamic.restoreLastCandidateCard === "function"
        ? dynamic.restoreLastCandidateCard({ applied: candidate.status === "applied_to_preview" })
        : null;
      const cardId = (restored && restored.card_id) || cardIdForCandidate(candidate);
      if (!restored && dynamic && typeof dynamic.focusCard === "function") dynamic.focusCard(cardId, { sync: false });
      return {
        handled: true,
        cardId,
        message: `**我读到了。**\n\n- 最近候选：${grade || ""}${subject || "美术"}《${topic || "当前课题"}》${scopeText || "备课候选"}。\n- 我能继续基于这版候选修改、放入右侧工作卡，或进入字段追问。\n- 当前仍是本次备课预览，确认前不会进入最终成果包。`
      };
    }

    if (topic) {
      return {
        handled: true,
        cardId: "tasks",
        message: `**我读到当前上下文了。**\n\n- 当前课题：${grade || ""}${subject || "美术"}《${topic}》${scopeText ? `，${scopeText}` : ""}。\n- 但我还没有读到可放入工作卡的最近候选正文。\n- 你可以让我先生成大单元框架、课时框架，或继续字段追问。`
      };
    }

    return {
      handled: true,
      cardId: "tasks",
      message: "**我这边还没有读到上文候选。**\n\n- 你可以先告诉我课题和年级。\n- 例如：三年级的足球之光；如果是大单元，再补一句“这是一个大单元，有3课时”。"
    };
  }

  function makeBackendContext(contextResult, text, intentPlan) {
    const result = contextResult || {};
    const dynamic = window.XIAOBEI_DYNAMIC_CARDS_V1;
    const lastCandidate = dynamic && typeof dynamic.getLastCandidate === "function" ? dynamic.getLastCandidate() : null;
    const activeContext = activeContextState();
    const activeDetected = activeContext && typeof activeContext === "object" ? (activeContext.detected_context || {}) : {};
    const activeTask = activeContext && typeof activeContext === "object" ? (activeContext.current_task || {}) : {};
    const payload = {
      client_route_fact_source: "backend_canonical_required",
      frontend_route_hint: result && result.route_source === "frontend_display_hint"
        ? {
            source: "frontend_display_hint",
            intent_id: result.intent || null,
            context_policy: result.context_policy || "",
            route_id: intentPlan && intentPlan.route_id,
            next_action: intentPlan && intentPlan.next_action,
          }
        : null,
      last_candidate: lastCandidate || null,
      current_task: activeTask && Object.keys(activeTask).length ? activeTask : (lastCandidate ? {
        title: lastCandidate.topic || "当前备课",
        topic: lastCandidate.topic || "",
        grade: lastCandidate.grade || "",
        subject: lastCandidate.subject || "美术",
        design_scope: lastCandidate.design_scope || "unknown",
        planned_lessons: lastCandidate.planned_lessons || null,
        current_topic_locked: !!lastCandidate.topic,
      } : {}),
    };
    if (activeDetected && Object.keys(activeDetected).length) {
      payload.current_context = {
        ...(payload.current_context || {}),
        ...activeDetected,
        current_task: activeTask || {},
      };
    }
    if (lastCandidate) {
      payload.pending_candidate = lastCandidate;
      const candidateTask = {
        ...(payload.current_task || {}),
        title: lastCandidate.topic || (payload.current_task && payload.current_task.title) || "",
        topic: lastCandidate.topic || "",
        grade: lastCandidate.grade || "",
        subject: lastCandidate.subject || "美术",
        design_scope: lastCandidate.design_scope || "unknown",
        planned_lessons: lastCandidate.planned_lessons || null,
        current_topic_locked: !!lastCandidate.topic,
      };
      payload.current_task = candidateTask;
      payload.current_context = {
        ...(payload.current_context || {}),
        topic: lastCandidate.topic || "",
        grade: lastCandidate.grade || "",
        subject: lastCandidate.subject || "",
        design_scope: lastCandidate.design_scope || "unknown",
        planned_lessons: lastCandidate.planned_lessons || null,
        last_candidate: lastCandidate,
        pending_candidate: lastCandidate,
      };
    }
    return payload;
  }


  const ROUTES = [
    {
      id: "lesson_brief",
      match: ["帮我备", "备一节", "备一下", "备一份", "一节", "备课", "单元", "备课草稿", "新开备课", "新建备课"],
      nav: "lesson",
      cardId: "lessonBrief",
      reply: "**备课候选框架已开始：**\n\n- 我先整理你当前课题的备课框架。\n- 右侧会打开当前候选工作卡。\n- 现在仍是候选内容，需要你确认后才会进入成果包预览。",
      apply() {
        cards().ensureCard("lessonBrief", cards().cards.lessonBrief(), { featured: true });
      }
    },
    {
      id: "activity_refine",
      match: ["精修活动二", "继续精修", "活动二", "候选"],
      nav: "lesson",
      cardId: "candidate",
      reply: "**活动二候选：**\n\n- 已放到右侧当前任务区。\n- 仍然只是候选修改，不覆盖正式内容。\n- 你可以继续修改、采纳或放弃。",
      apply() {
        cards().ensureCard("candidate", cards().cards.activityRefine(), { featured: true });
      }
    },
    {
      id: "task_sheet",
      match: ["生成任务单", "学生任务单", "任务单"],
      nav: "package",
      cardId: "taskSheet",
      reply: "**学生任务单草稿：**\n\n- 来源：活动二候选。\n- 状态：待老师确认。\n- 边界：确认前不会进入最终成果包。",
      apply() {
        cards().ensureCard("taskSheet", cards().cards.taskSheet(), { featured: false });
        cards().updateStatusLine("<strong>青绿中国色第2课时</strong> · 任务单待确认 · 评价待完善");
      }
    },
    {
      id: "resources",
      match: ["\u67e5\u8d44\u6e90", "\u8d44\u6e90", "\u67e5\u627e\u8d44\u6e90", "\u8d44\u6e90\u63d0\u4f9b", "\u63d0\u4f9b\u8d44\u6e90"],
      nav: "resources",
      cardId: "resources",
      reply: "**资源建议：**\n\n- 我先按当前课题找一版可直接进入课堂的资源建议。\n- 你确认后我再整理成可用清单。",
      apply() {
        cards().ensureCard("resources", cards().cards.resources(), { featured: false });
      }
    },
    {
      id: "package_check",
      match: ["检查教学包", "教学包检查", "教学包"],
      nav: "package",
      cardId: "packageCheck",
      reply: "**教学包检查：**\n\n- 教师阅读版：已就绪。\n- 学生任务单：待确认。\n- 评价建议：待完善。\n- 课堂使用：保持未连接。",
      apply() {
        cards().ensureCard("packageCheck", cards().cards.packageCheck(), { featured: false });
      }
    },
    {
      id: "download_manifest",
      match: ["生成下载清单", "下载清单", "导出", "成果包"],
      nav: "download",
      cardId: "downloadPackage",
      reply: "**成果包下载清单预览：**\n\n| 内容 | 状态 |\n| --- | --- |\n| 教师阅读版 | 已生成 |\n| 学生任务单 | 待确认 |\n| 评价建议表 | 待确认 |\n\n任务单和评价建议确认前，不生成正式下载包。",
      apply() {
        cards().ensureCard("downloadPackage", cards().cards.download(), { featured: false });
      }
    }
  ];

  function normalize(text) {
    return String(text || "").replace(/\s+/g, "").toLowerCase();
  }

  function escapeHtml(value) {
    return cards().escapeHtml(value);
  }

  function renderMessage(role, contentFormat, content) {
    const renderer = window.XIAOBEI_MESSAGE_RENDERER_V1;
    if (renderer && typeof renderer.renderMessage === "function") {
      return renderer.renderMessage({
        role,
        content_format: contentFormat,
        content,
      });
    }
    return {
      html: escapeHtml(content || "").replace(/\r?\n/g, "<br>"),
      role,
      content_format: "plain_text",
      warnings: ["message_renderer_missing_fallback_plain_text"],
    };
  }

  function getStream() {
    return document.getElementById("chatStream");
  }

  function getComposer() {
    return document.getElementById("composer");
  }

  function shouldDeferToTeachingPlanning0997V(text) {
    const bridge = window.SHIWEI_TEACHING_PLANNING_MODEL_CANDIDATE_DRY_RUN_API_0997V;
    if (!bridge || typeof bridge.handleAgentAction !== "function") return false;
    const compact = String(text || "").replace(/\s+/g, "");
    if (!compact) return false;
    return /教学规划|学期规划|学期计划|教学工作计划|课务安排|周历|课表|右侧基础信息|活动周|每周|年级|学科|第一学期|第二学期|上学期|下学期|春季学期|秋季学期|在吗|在线/.test(compact);
  }

  function submitComposerText() {
    const composer = getComposer();
    if (!composer) return false;
    const text = composer.value.trim();
    if (!text) return false;
    if (shouldDeferToTeachingPlanning0997V(text)) return false;
    composer.value = "";
    composer.dispatchEvent(new Event("input", { bubbles: true }));
    routeInput(text);
    return true;
  }

  function appendTeacher(text) {
    const stream = getStream();
    if (!stream) return;
    const node = document.createElement("div");
    node.className = "msg teacher";
    const content = text || "继续处理当前任务";
    const result = renderMessage("teacher", "plain_text", content);
    node.dataset.xbMessageRole = "teacher";
    node.dataset.xbContentFormat = "plain_text";
    node.dataset.xbMessageContent = String(content || "");
    node.innerHTML = `<div class="bubble-wrap"><span class="speaker">老师</span><div class="bubble">${result.html}</div></div>`;
    stream.appendChild(node);
    stream.scrollTop = stream.scrollHeight;
  }

  function appendXiaobei(text, route) {
    const stream = getStream();
    if (!stream) return;
    const node = document.createElement("div");
    node.className = "msg xb";
    const action = route ? `<div class="inline-card"><div class="inline-actions"><button data-focus="${route.cardId}">查看工作卡</button><button data-fill="继续处理${escapeHtml(route.id)}">继续处理</button></div></div>` : "";
    const content = String(text || "");
    const result = renderMessage("assistant", "safe_markdown", content);
    node.dataset.xbMessageRole = "assistant";
    node.dataset.xbContentFormat = "safe_markdown";
    node.dataset.xbMessageContent = content;
    node.innerHTML = `<div class="avatar">小备</div><div class="bubble-wrap"><span class="speaker">小备</span><div class="bubble"><div class="wb-message-text">${result.html}</div></div>${action}</div>`;
    stream.appendChild(node);
    stream.scrollTop = stream.scrollHeight;
  }

  function renderThinking(text, traceViewModel) {
    const tracePanel = runTraceMicroPanel();
    if (tracePanel && typeof tracePanel.renderRunTraceMicroPanelHtml === "function") {
      const panel = tracePanel.renderRunTraceMicroPanelHtml(traceViewModel || {
        task_id: "workbench_current_task",
        subline: text || "正在读取上下文、找缺口、组织回复。"
      });
      return `<div class="wb-run-trace-micro-mount" data-run-trace-micro-mount="070B27">${panel}</div>`;
    }
    return `
      <div class="wb-thinking" role="status" aria-live="polite">
        <div class="wb-thinking-head">
          <span aria-hidden="true"></span>
          <strong>小备正在整理</strong>
        </div>
        <p>${escapeHtml(text || "正在读取上下文、找缺口、组织回复。")}</p>
        <div class="wb-thinking-track" aria-hidden="true"><i></i></div>
        <div class="wb-thinking-steps" aria-hidden="true">
          <em>读上下文</em>
          <em>找缺口</em>
          <em>组织回复</em>
        </div>
      </div>
    `;
  }

  function buildThinkingTrace(text, options = {}) {
    const tracePanel = runTraceMicroPanel();
    if (!tracePanel || typeof tracePanel.buildMockRunTraceViewModel !== "function") return null;
    return tracePanel.buildMockRunTraceViewModel({
      task_id: options.traceTaskId || traceTaskIdForInput(options.teacherMessage || ""),
      teacher_message: options.teacherMessage || "",
      subline: text || "",
      status: "running",
    });
  }

  function traceTaskIdForInput(text) {
    const tracePanel = runTraceMicroPanel();
    if (tracePanel && typeof tracePanel.inferTaskId === "function") return tracePanel.inferTaskId(text);
    const normalized = String(text || "").replace(/\s+/g, "");
    return /学期|课务|课时安排|课程表|排课/.test(normalized) ? "semester_service_setup" : "workbench_current_task";
  }

  function traceFinalStatusForResponse(response, fallback = "done") {
    const payload = response && typeof response === "object" ? response : {};
    const trace = payload.run_trace || payload.trace || {};
    const action = String(payload.final_next_action || payload.next_action || trace.final_next_action || "").trim();
    if (action === "block" || action === "handoff_later_not_enabled") return "blocked";
    if (action === "ask_question" || action === "wait_for_teacher") return "waiting_teacher";
    const guard = payload.runtime_guard || payload.safety_check || {};
    if (Array.isArray(guard.blocked_actions) && guard.blocked_actions.length) return "blocked";
    if (guard.guard_reason || guard.block_reason) return "blocked";
    return fallback;
  }

  function appendThinking(text, options = {}) {
    const stream = getStream();
    if (!stream) return null;
    const node = document.createElement("div");
    const traceViewModel = buildThinkingTrace(text, options);
    node.className = "msg xb is-thinking";
    node.dataset.xiaobeiThinking = "true";
    node.innerHTML = `<div class="avatar">小备</div><div class="bubble-wrap"><span class="speaker">小备</span><div class="bubble wb-run-trace-bubble">${renderThinking(text, traceViewModel)}</div></div>`;
    stream.appendChild(node);
    stream.scrollTop = stream.scrollHeight;
    const traceController = startThinkingTrace(node, traceViewModel);
    return { node, startedAt: Date.now(), traceController };
  }

  function startThinkingTrace(node, traceViewModel) {
    const tracePanel = runTraceMicroPanel();
    if (!tracePanel || typeof tracePanel.playMockRunTrace !== "function") return null;
    const mount = node && node.querySelector && node.querySelector("[data-run-trace-micro-mount='070B27']");
    return mount ? tracePanel.playMockRunTrace(mount, traceViewModel) : null;
  }

  function completeThinkingTrace(thinking, status) {
    const controller = thinking && thinking.traceController;
    if (controller && typeof controller.complete === "function") {
      controller.complete(status || "done");
    }
  }

  function stopThinkingTrace(thinking) {
    const controller = thinking && thinking.traceController;
    if (controller && typeof controller.stop === "function") controller.stop();
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function removeThinkingNow(thinking) {
    const node = thinking && (thinking.node || thinking);
    stopThinkingTrace(thinking);
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  async function finishThinking(thinking, options = {}) {
    if (!thinking) return;
    completeThinkingTrace(thinking, options.finalStatus || "done");
    const remaining = THINKING_MIN_MS - (Date.now() - thinking.startedAt);
    if (remaining > 0) await delay(remaining);
    if (options.holdFinal !== false) await delay(TRACE_FINAL_HOLD_MS);
    removeThinkingNow(thinking);
  }

  function findRoute(text) {
    const normalized = normalize(text);
    return ROUTES.find((route) => route.match.some((keyword) => normalized.includes(normalize(keyword)))) || null;
  }

  function routeInputLocal(text, options = {}) {
    const input = String(text || "").trim();
    const route = findRoute(input);
    if (!options.skipTeacherMessage) appendTeacher(input || "继续处理当前备课任务");

    if (!route) {
      appendXiaobei("**我可以继续处理：**\n\n- 精修候选。\n- 生成任务单。\n- 查找资源。\n- 检查教学包。\n- 生成下载清单。\n\n- 如果你要切新课题，请先说：\"我要新备一节三年级...\"。");
      return { handled: false, route_id: "fallback" };
    }

    route.apply();
    cards().setActiveNav(route.nav);
    appendXiaobei(route.reply, route);
    cards().focusCard(route.cardId);
    return { handled: true, route_id: route.id, card_id: route.cardId };
  }


  async function routeInput(text, options = {}) {
    const input = String(text || "").trim();
    if (!options.skipTeacherMessage) appendTeacher(input || "继续处理当前备课任务");
    const runtimeClient = window.XIAOBEI_AGENT_RUNTIME_CLIENT_V1;
    const semesterGuided = runtimeClient ? null : handleSemesterGuidedAnswer(input);
    if (semesterGuided) {
      const thinking = options.skipThinking ? null : appendThinking(
        "正在读取当前会话和右侧工作卡。",
        { teacherMessage: input, traceTaskId: "semester_service_setup" }
      );
      openSemesterPlanningCard();
      rememberSyntheticTurn(input, semesterGuided.reply, {
        mode: "frontend_semester_guided_questions",
        intent: { intent_id: "semester_schedule_planning", confidence: 0.9 },
        next_action: semesterGuided.result && semesterGuided.result.done ? "ask_teacher_to_generate_semester_schedule" : "ask_next_semester_basic_info",
        context_policy: "ask_clarifying_question",
        card_updates: [{ card_id: "semesterSchedule", status: "teacher_review_required" }]
      });
      await finishThinking(thinking, { finalStatus: semesterGuided.result && semesterGuided.result.done ? "done" : "waiting_teacher" });
      appendXiaobei(semesterGuided.reply, { id: "semester_guided_questions", cardId: "semesterSchedule" });
      return { handled: true, source: semesterGuided.source, card_id: "semesterSchedule", result: semesterGuided.result };
    }
    if (!runtimeClient && looksLikeSemesterPlanning(input)) {
      const thinking = options.skipThinking ? null : appendThinking(
        "正在读取当前会话和右侧工作卡。",
        { teacherMessage: input, traceTaskId: "semester_service_setup" }
      );
      const reply = semesterPlanningInquiryReply();
      openSemesterPlanningCard();
      rememberSyntheticTurn(input, reply, {
        mode: "frontend_semester_planning_inquiry",
        intent: { intent_id: "semester_schedule_planning", confidence: 0.86 },
        next_action: "ask_teacher_for_semester_basic_info",
        context_policy: "ask_clarifying_question"
      });
      await finishThinking(thinking, { finalStatus: "waiting_teacher" });
      appendXiaobei(reply, { id: "semester_planning_inquiry", cardId: "semesterSchedule" });
      return { handled: true, source: "semester_planning_inquiry", card_id: "semesterSchedule" };
    }
    if (!window.XIAOBEI_AGENT_RUNTIME_CLIENT_V1 && looksLikeCandidateLocation(input)) {
      const located = describeLastCandidateLocation();
      appendXiaobei(located.message, located.handled ? { id: "candidate_location", cardId: located.cardId } : null);
      return { handled: located.handled, source: "candidate_location" };
    }
    if (!window.XIAOBEI_AGENT_RUNTIME_CLIENT_V1 && looksLikeContextProbe(input)) {
      const probed = contextProbeReply();
      appendXiaobei(probed.message, probed.handled ? { id: "context_probe", cardId: probed.cardId } : null);
      return { handled: probed.handled, source: "context_probe" };
    }
    const client = window.XIAOBEI_WORKBENCH_API_CLIENT_V1;
    const dynamic = window.XIAOBEI_DYNAMIC_CARDS_V1;
    const backendAvailable = !!(client && dynamic && options.backendDryRun !== false);
    let contextResult = null;
    let intentPlan = null;
    if (!backendAvailable) {
      contextResult = resolveContextFromInput(input, { remember: true });
      intentPlan = planIntentRoute(input, contextResult);
    }
    if (!runtimeClient && intentPlan && intentPlan.intent && intentPlan.intent.intent_id === "clarification_needed") {
      const reply = intentPlan.teacher_reply_hint || clarificationMessage(contextResult || {});
      rememberSyntheticTurn(input, reply, {
        mode: "frontend_intent_clarification",
        intent: intentPlan.intent,
        next_action: "ask_teacher_for_missing_slots",
        context_policy: "ask_clarifying_question"
      });
      appendXiaobei(reply);
      return { handled: true, source: "intent_clarification", missing_fields: intentPlan.missing_slots || [] };
    }
    if (!runtimeClient && contextResult && contextResult.require_user_clarification) {
      const reply = clarificationMessage(contextResult);
      rememberSyntheticTurn(input, reply, {
        mode: "frontend_context_clarification",
        intent: { intent_id: "clarification_needed", confidence: 0.76 },
        next_action: "ask_teacher_for_missing_slots",
        context_policy: "ask_clarifying_question"
      });
      appendXiaobei(reply);
      return { handled: true, source: "context_clarification", missing_fields: contextResult.missing_fields || [] };
    }
    const thinking = options.skipThinking ? null : appendThinking(
      window.XIAOBEI_WORKBENCH_AI_MODE === REAL_CANDIDATE_MODE
        ? "正在调用本机小备，读取当前会话和右侧工作卡。"
        : "正在读取当前会话、匹配工作卡、组织回复。",
      { teacherMessage: input }
    );

    const officialFlow = window.XIAOBEI_OFFICIAL_FIELD_QUESTION_FLOW_V1;
    if (!window.XIAOBEI_AGENT_RUNTIME_CLIENT_V1 && officialFlow && typeof officialFlow.handleTeacherInput === "function" && options.officialFieldFlow !== false) {
      const flowResult = officialFlow.handleTeacherInput(input);
      if (flowResult && flowResult.handled) {
        removeThinkingNow(thinking);
        return flowResult;
      }
    }

    if (client && dynamic && options.backendDryRun !== false) {
      try {
        const resolvedMode = client.resolveAiMode && client.resolveAiMode({});
        const backendContext = makeBackendContext(null, input, null);
        if (runtimeClient && typeof runtimeClient.agentTurn === "function" && options.agentRuntime !== false) {
          try {
            const runtimeResult = await runtimeClient.agentTurn(input, { ai_mode: resolvedMode === REAL_CANDIDATE_MODE ? REAL_CANDIDATE_MODE : undefined, ...backendContext });
            const activeCardId = dynamic.applyAiDryRunResponse(runtimeResult.response) || "tasks";
            await finishThinking(thinking, { finalStatus: traceFinalStatusForResponse(runtimeResult.response) });
            const semesterReply = semesterReplyForResponse(input, runtimeResult.response, activeCardId);
            appendXiaobei(semesterReply || runtimeResult.response.assistant_message || "**小备已整理当前状态：**\n\n- 请在右侧查看。\n- 确认前不会进入最终成果包。", {
              id: "agent_runtime",
              cardId: semesterReply ? "semesterSchedule" : activeCardId
            });
            window.dispatchEvent(new CustomEvent("xiaobei:ai-connection", {
              detail: {
                ok: true,
                source: "agent_runtime",
                api_base: window.XIAOBEI_WORKBENCH_API_LAST_STATUS && window.XIAOBEI_WORKBENCH_API_LAST_STATUS.api_base,
                guard_reason: runtimeResult.response && runtimeResult.response.runtime_guard && runtimeResult.response.runtime_guard.blocked_actions && runtimeResult.response.runtime_guard.blocked_actions.join(",")
              }
            }));
            return { handled: true, source: "agent_runtime", response: runtimeResult.response };
          } catch (runtimeError) {
            if (window.console && console.info) console.info("Xiaobei agent runtime fallback", runtimeError && (runtimeError.reason || runtimeError.message));
            await finishThinking(thinking);
            window.dispatchEvent(new CustomEvent("xiaobei:ai-connection", {
              detail: {
                ok: false,
                source: "agent_runtime_unavailable",
                error: runtimeError && (runtimeError.reason || runtimeError.message)
              }
            }));
            const fallbackSemester = handleSemesterGuidedAnswer(input);
            if (fallbackSemester || looksLikeSemesterPlanning(input)) {
              const reply = fallbackSemester ? fallbackSemester.reply : semesterPlanningInquiryReply();
              openSemesterPlanningCard();
              rememberSyntheticTurn(input, reply, {
                mode: "frontend_semester_guided_questions",
                intent: { intent_id: "semester_schedule_planning", confidence: 0.78 },
                next_action: "ask_next_semester_basic_info",
                context_policy: "ask_clarifying_question",
                card_updates: [{ card_id: "semesterSchedule", status: "teacher_review_required" }]
              });
              appendXiaobei(reply, { id: "semester_runtime_fallback", cardId: "semesterSchedule" });
              return { handled: true, source: "semester_runtime_fallback", error: runtimeError };
            }
            appendXiaobei("**小备暂时没有接通：**\n\n- 我没有启用本地占位候选。\n- 请稍后重试，或检查本机小备服务。");
            return { handled: false, source: "agent_runtime_unavailable", error: runtimeError };
          }
        }
        const result = await client.aiDryRun(input, { ai_mode: resolvedMode === REAL_CANDIDATE_MODE ? REAL_CANDIDATE_MODE : undefined, ...backendContext });
        const activeCardId = dynamic.applyAiDryRunResponse(result.response) || "tasks";
        await finishThinking(thinking, { finalStatus: traceFinalStatusForResponse(result.response) });
        const semesterReply = semesterReplyForResponse(input, result.response, activeCardId);
        appendXiaobei(semesterReply || result.response.assistant_message || "**候选工作卡已整理：**\n\n- 请在右侧查看。\n- 仍需老师确认后才会进入后续预览。", {
          id: "backend_dry_run",
          cardId: semesterReply ? "semesterSchedule" : activeCardId
        });
        window.dispatchEvent(new CustomEvent("xiaobei:ai-connection", {
          detail: {
            ok: true,
            source: "backend_dry_run",
            api_base: window.XIAOBEI_WORKBENCH_API_LAST_STATUS && window.XIAOBEI_WORKBENCH_API_LAST_STATUS.api_base,
            guard_reason: result.response && result.response.safety_check && result.response.safety_check.guard_reason
          }
        }));
        return { handled: true, source: "backend_dry_run", response: result.response };
      } catch (error) {
        if (window.console && console.info) console.info("Xiaobei local preview fallback", error && (error.reason || error.message));
        const realMode = client.resolveAiMode ? client.resolveAiMode({}) === REAL_CANDIDATE_MODE : window.XIAOBEI_WORKBENCH_AI_MODE === REAL_CANDIDATE_MODE;
        const payload = error && error.payload;
        await finishThinking(thinking);
        window.dispatchEvent(new CustomEvent("xiaobei:ai-connection", {
          detail: {
            ok: false,
            source: realMode ? "real_candidate_unavailable" : "local_preview",
            error: (payload && (payload.reason_code || payload.error_code)) || (error && (error.reason || error.message))
          }
        }));
        if (realMode) {
          appendXiaobei((payload && payload.assistant_message) || "**真实候选未接通：**\n\n- 我没有生成占位候选。\n- 请先检查本机服务和模型配置。");
          return { handled: false, source: "real_candidate_unavailable", error: payload || error };
        }
        appendXiaobei("**小备服务未连接：**\n\n- 我先按本地预览处理。\n- 你仍然可以继续查看右侧工作卡。\n- 确认前不会进入最终成果包。");
      }
    }

    await finishThinking(thinking);
    return routeInputLocal(input, { skipTeacherMessage: true });
  }
  function wireComposer() {
    const composer = getComposer();
    const send = document.getElementById("sendBtn");
    if (!composer || !send) return;

    if (send.dataset.xiaobeiSendBound !== "true") {
      send.dataset.xiaobeiSendBound = "true";
      send.addEventListener("click", function (event) {
        const composer = getComposer();
        const text = composer ? composer.value.trim() : "";
        if (shouldDeferToTeachingPlanning0997V(text)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        submitComposerText();
      }, true);
    }

    if (composer.dataset.xiaobeiEnterBound !== "true") {
      composer.dataset.xiaobeiEnterBound = "true";
      composer.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
          if (shouldDeferToTeachingPlanning0997V(composer.value.trim())) return;
          event.preventDefault();
          submitComposerText();
        }
      });
    }
  }

  let semesterUploadFeedbackBound = false;

  function wireSemesterUploadFeedback() {
    if (semesterUploadFeedbackBound) return;
    semesterUploadFeedbackBound = true;
    window.addEventListener("xiaobei:semester-field-uploaded", function (event) {
      const detail = (event && event.detail) || {};
      const result = detail.result || {};
      if (!result.reply) return;
      openSemesterPlanningCard();
      rememberSyntheticTurn(`上传${detail.label || "教材目录"}`, result.reply, {
        mode: "frontend_semester_guided_questions",
        intent: { intent_id: "semester_schedule_planning", confidence: 0.9 },
        next_action: result.done ? "ask_teacher_to_generate_semester_schedule" : "ask_next_semester_basic_info",
        context_policy: "ask_clarifying_question",
        card_updates: [{ card_id: "semesterSchedule", status: "teacher_review_required" }]
      });
      appendXiaobei(result.reply, { id: "semester_guided_upload", cardId: "semesterSchedule" });
    });
  }

  document.addEventListener("keydown", function (event) {
    const composer = getComposer();
    if (!composer || event.target !== composer) return;
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    if (shouldDeferToTeachingPlanning0997V(composer.value.trim())) return;
    event.preventDefault();
    event.stopPropagation();
    submitComposerText();
  }, true);

  window.XIAOBEI_MOCK_AGENT_ROUTER_V1 = {
    routes: ROUTES.map((route) => ({ id: route.id, match: route.match, card_id: route.cardId })),
    routeInput,
    routeInputLocal,
    findRoute
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      wireComposer();
      wireSemesterUploadFeedback();
    });
  } else {
    wireComposer();
    wireSemesterUploadFeedback();
  }
})();





