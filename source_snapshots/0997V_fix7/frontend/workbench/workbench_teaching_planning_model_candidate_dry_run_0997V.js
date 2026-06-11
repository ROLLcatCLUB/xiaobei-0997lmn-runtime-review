(function () {
  "use strict";

  const STAGE_ID = "0997V_TEACHING_PLANNING_MODEL_CANDIDATE_DRY_RUN_EXPERIENCE_APPLY";
  const DEFAULT_SESSION_ID = "tp_session_syn_001";
  const DEFAULT_MODEL_BASE = "http://127.0.0.1:8083/api/workbench";
  const REQUIRED_FALSE_FLAGS = {
    direct_write_allowed: false,
    overwrite_content_allowed: false,
    feishu_write_allowed: false,
    formal_scoring_allowed: false,
    classroom_app_connect_allowed: false,
    student_submit_connect_allowed: false,
    real_download_allowed: false,
    teacher_review_required: true
  };
  let lastRequestKey = "";

  function setStatus(partial) {
    window.SHIWEI_TEACHING_PLANNING_MODEL_CANDIDATE_DRY_RUN_0997V = {
      stageId: STAGE_ID,
      readonly: true,
      modelCandidateCalled: false,
      modelConnected: false,
      databaseWritten: false,
      memoryStoreWritten: false,
      reviewEventWritten: false,
      formalExportCreated: false,
      visibleActionButtonsCreated: false,
      ...(window.SHIWEI_TEACHING_PLANNING_MODEL_CANDIDATE_DRY_RUN_0997V || {}),
      ...(partial || {})
    };
  }

  function modelApiBase() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const value = String(params.get("teaching_planning_model_api_base") || window.SHIWEI_TEACHING_PLANNING_MODEL_API_BASE_0997V || DEFAULT_MODEL_BASE).replace(/\/+$/, "");
      if (/^https?:\/\/(127\.0\.0\.1|localhost):\d+\/api\/workbench$/i.test(value)) return value;
    } catch (_) {}
    return DEFAULT_MODEL_BASE;
  }

  function sessionId(detail) {
    return (detail && detail.sessionId) || (window.SHIWEI_TEACHING_PLANNING_RUNTIME_0997N || {}).sessionId || DEFAULT_SESSION_ID;
  }

  function appendXiaobei(text) {
    if (typeof window.appendXiaobei === "function") {
      window.appendXiaobei(text);
      return;
    }
    const stream = document.getElementById("chatStream");
    if (!stream) return;
    const node = document.createElement("div");
    node.className = "msg xb";
    node.innerHTML = '<div class="avatar">小备</div><div class="bubble-wrap"><span class="speaker">小备</span><div class="bubble"></div></div>';
    node.querySelector(".bubble").textContent = text || "";
    stream.appendChild(node);
    stream.scrollTop = stream.scrollHeight;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function appendThinking(text) {
    const stream = document.getElementById("chatStream");
    if (!stream) return null;
    const node = document.createElement("div");
    node.className = "msg xb is-thinking";
    node.dataset.xiaobeiThinking = "true";
    node.dataset.modelCandidateThinking0997v = "true";
    node.dataset.xbPersist = "false";
    node.dataset.xbTransient = "true";
    node.innerHTML = `
      <div class="avatar">小备</div>
      <div class="bubble-wrap">
        <span class="speaker">小备</span>
        <div class="bubble">
          <div class="wb-thinking" role="status" aria-live="polite">
            <div class="wb-thinking-head"><span aria-hidden="true"></span><strong>小备正在生成</strong></div>
            <p>${escapeHtml(text || "正在读取教学规划信息，并调用真实候选模型。")}</p>
            <div class="wb-thinking-track" aria-hidden="true"><i></i></div>
            <div class="wb-thinking-steps" aria-hidden="true">
              <em>读需求</em><em>查边界</em><em>生成候选</em>
            </div>
          </div>
        </div>
      </div>`;
    stream.appendChild(node);
    stream.scrollTop = stream.scrollHeight;
    return { node, startedAt: Date.now() };
  }

  async function removeThinking(thinking) {
    if (!thinking || !thinking.node) return;
    const remaining = 700 - (Date.now() - thinking.startedAt);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    thinking.node.remove();
  }

  function renderStatusPanel(payload, ok, reason) {
    const card = document.querySelector('[data-card="focusWorkspace"]') || document.querySelector(".teaching-planning-runtime-zone-0997n");
    if (!card) return;
    let panel = card.querySelector(".teaching-planning-model-candidate-0997v");
    if (!panel) {
      panel = document.createElement("section");
      panel.className = "teaching-planning-model-candidate-0997v";
      panel.setAttribute("data-model-candidate-dry-run-0997v", "readonly");
      panel.setAttribute("aria-label", "模型候选 dry-run 状态");
      card.appendChild(panel);
    }
    const source = payload && payload.candidate_source ? payload.candidate_source : "";
    const meta = payload && payload.provider_meta ? payload.provider_meta : {};
    const message = ok
      ? "真实候选模型已返回，只作为老师确认前的只读候选。"
      : `真实候选模型未接通：${reason || "unknown"}`;
    panel.innerHTML = "";
    const title = document.createElement("h4");
    title.textContent = ok ? "模型候选 dry-run 已接通" : "模型候选 dry-run 未接通";
    const desc = document.createElement("p");
    desc.textContent = message;
    const metaLine = document.createElement("p");
    metaLine.textContent = ok
      ? `candidate_source=${source || "model"} · provider=${meta.provider || "redacted"} · model=${meta.model || "redacted"}`
      : "需要确认本地模型服务、候选开关和 provider key；页面不会降级成假模型体验。";
    const guard = document.createElement("p");
    guard.textContent = "边界：不写数据库 · 不写记忆 · 不写飞书 · 不连接课堂应用 · 不真实导出";
    panel.append(title, desc, metaLine, guard);
  }

  function semesterApi() {
    return window.XIAOBEI_SEMESTER_SCHEDULE_PLANNING_V1 || null;
  }

  function focusSemesterSchedule() {
    const focus = window.XIAOBEI_FOCUS_WORKSPACE_V1;
    if (focus && typeof focus.setFocusTask === "function") {
      focus.setFocusTask("semesterSchedule");
      return;
    }
    if (typeof window.focusCard === "function") window.focusCard("semesterSchedule");
  }

  function refreshSemesterSchedule() {
    focusSemesterSchedule();
    window.setTimeout(focusSemesterSchedule, 0);
  }

  function normalizeText(text) {
    return String(text || "").replace(/\s+/g, "").trim();
  }

  function isMetaPing(text) {
    const compact = normalizeText(text);
    return /^(在吗|在线|小备在吗|你在吗|hello|hi|你好|您好)$/.test(compact);
  }

  function isTeachingPlanningSwitch(text) {
    const compact = normalizeText(text);
    if (/生成|预览|根据|输出|安排|制作|开始生成/.test(compact)) return false;
    return /教学规划|学期规划|学期计划|教学工作计划|课务安排|学期课务|周历|课表/.test(compact)
      && !/每周|活动周|年级|学科|第一学期|第二学期|上学期|下学期/.test(compact);
  }

  function isGenerateRequest(text) {
    const compact = normalizeText(text);
    return /生成|预览|根据右侧|整理|输出|做一版|给我一版/.test(compact)
      && /教学工作计划|教学规划|课务安排|学期计划|学期规划|右侧基础信息/.test(compact);
  }

  function fieldLabel(key) {
    return {
      semester: "学期",
      gradeSubject: "年级学科",
      weeklyLessons: "每周课时",
      activityWeeks: "活动周",
      textbookCatalog: "教材目录"
    }[key] || key;
  }

  function semesterRuntime() {
    const api = semesterApi();
    return api && typeof api.getRuntimeState === "function" ? api.getRuntimeState() : {};
  }

  function conciseMissingReply(prefix) {
    const runtime = semesterRuntime();
    const missing = Array.isArray(runtime.missing_slots) ? runtime.missing_slots : [];
    if (!missing.length) return prefix || "基础信息已同步。";
    return `${prefix || "已切到教学规划。"}\n\n还差：${missing.map(fieldLabel).join("、")}。你可以一句话一起发给我，我会同步右侧，不逐项打断。`;
  }

  function extractFieldUpdates(text) {
    const source = String(text || "").trim();
    const compact = normalizeText(source);
    const updates = [];
    const seen = new Set();
    function push(key, value) {
      const clean = String(value || "").replace(/[。；;，,\s]+$/g, "").trim();
      if (!key || !clean || seen.has(key)) return;
      seen.add(key);
      updates.push({ key, value: clean });
    }

    const semesterMatch = source.match(/(20\d{2}\s*[-—至到]\s*20\d{2}\s*学年\s*第[一二12]学期|20\d{2}\s*[-—至到]\s*20\d{2}\s*学年|第[一二12]学期|上学期|下学期|春季学期|秋季学期)/);
    if (semesterMatch) push("semester", semesterMatch[1]);

    const gradeSubjectMatch = source.match(/([一二三四五六七八九十\d]+年级)\s*([^\s，,。；;]{0,6}?(?:美术|艺术|音乐|语文|数学|英语|科学|体育))/);
    if (gradeSubjectMatch) push("gradeSubject", `${gradeSubjectMatch[1]}${gradeSubjectMatch[2]}`);
    else {
      const gradeMatch = source.match(/([一二三四五六七八九十\d]+年级)/);
      const subjectMatch = source.match(/(美术|艺术|音乐|语文|数学|英语|科学|体育)/);
      if (gradeMatch && subjectMatch) push("gradeSubject", `${gradeMatch[1]}${subjectMatch[1]}`);
    }

    const weeklyMatch = source.match(/每周\s*([一二两三四五六七八九十\d]+)\s*(节|课时|次)/);
    if (weeklyMatch) push("weeklyLessons", `每周${weeklyMatch[1]}${weeklyMatch[2] === "次" ? "节" : weeklyMatch[2]}`);

    if (/暂无活动周|没有活动周|无活动周|不安排活动周/.test(compact)) {
      push("activityWeeks", "暂无活动周");
    } else {
      const activityTokens = [];
      ["创艺节", "艺术节", "运动会", "考试周", "期中考试", "期末考试", "期末展示周", "期末展示", "家长开放日", "研学周"].forEach((token) => {
        if (source.includes(token)) activityTokens.push(token);
      });
      const activityMatch = source.match(/活动周(?:是|为|包括|有|安排)?([^。；;\n]+)/);
      if (activityMatch) activityTokens.unshift(activityMatch[1].replace(/^(：|:)/, "").trim());
      const unique = Array.from(new Set(activityTokens.map(item => item.trim()).filter(Boolean)));
      if (unique.length) push("activityWeeks", unique.join("、"));
    }

    return updates;
  }

  function localSemanticReply(detail) {
    const text = String((detail && detail.utterance) || "").trim();
    const api = semesterApi();
    if (!text || !api) return null;

    if (isMetaPing(text)) {
      return {
        handled: true,
        kind: "meta_ping",
        reply: "在的。你可以直接说要做哪类教学规划，或一次性把学期、年级学科、每周课时、活动周发给我。"
      };
    }

    if (isTeachingPlanningSwitch(text)) {
      if (typeof api.startGuidedQuestions === "function") api.startGuidedQuestions({ restart: false, resume: true });
      refreshSemesterSchedule();
      return {
        handled: true,
        kind: "switch_to_teaching_planning",
        reply: conciseMissingReply("已切到教学规划。"),
        activeKey: semesterRuntime().active_slot || ""
      };
    }

    const updates = extractFieldUpdates(text);
    if (updates.length) {
      updates.forEach((item) => {
        if (typeof api.updateField === "function") api.updateField(item.key, item.value);
      });
      const runtime = typeof api.getRuntimeState === "function" ? api.getRuntimeState() : {};
      if (!runtime.ready && typeof api.startGuidedQuestions === "function") api.startGuidedQuestions({ resume: true });
      refreshSemesterSchedule();
      const recorded = updates.map(item => `${fieldLabel(item.key)}：${item.value}`).join("；");
      return {
        handled: true,
        kind: "fill_teaching_planning_fields",
        fieldUpdates: updates,
        ready: !!runtime.ready,
        reply: [
          `已同步：${recorded}`,
          "",
          runtime.ready
            ? "基础信息已收齐。你可以直接说“生成教学工作计划预览”，我会把结果同步到右侧。"
            : conciseMissingReply("我会继续等你补齐剩余信息。")
        ].join("\n")
      };
    }

    if (isGenerateRequest(text) && !semesterRuntime().ready) {
      refreshSemesterSchedule();
      return {
        handled: true,
        kind: "generate_blocked_missing_fields",
        reply: conciseMissingReply("生成前还缺基础信息。")
      };
    }

    if (api.hasActiveQuestion && api.hasActiveQuestion() && typeof api.handleGuidedAnswer === "function") {
      const result = api.handleGuidedAnswer(text);
      refreshSemesterSchedule();
      return {
        handled: true,
        kind: "answer_active_teaching_planning_question",
        activeKey: result && result.activeKey ? result.activeKey : "",
        reply: semesterRuntime().ready
          ? "已同步到右侧。基础信息已收齐，可以生成教学工作计划预览。"
          : conciseMissingReply("已同步到右侧。")
      };
    }

    return null;
  }

  function injectStyle() {
    if (document.getElementById("teaching-planning-model-candidate-dry-run-0997v-style")) return;
    const style = document.createElement("style");
    style.id = "teaching-planning-model-candidate-dry-run-0997v-style";
    style.textContent = `
      .teaching-planning-model-candidate-0997v {
        margin: 10px 0 0;
        padding: 12px;
        border: 1px solid rgba(22,132,111,.18);
        border-radius: 12px;
        background: linear-gradient(135deg, rgba(237,246,241,.9), rgba(255,253,248,.96));
        color: #284a43;
        font-size: 12.5px;
        line-height: 1.6;
      }
      .teaching-planning-model-candidate-0997v h4 {
        margin: 0 0 8px;
        color: #163b35;
        font-size: 13px;
      }
      .teaching-planning-model-candidate-0997v p {
        margin: 5px 0 0;
      }
    `;
    document.head.appendChild(style);
  }

  function buildModelPayload(detail) {
    const utterance = String((detail && detail.utterance) || "").trim();
    const sid = sessionId(detail);
    const runtime = semesterRuntime();
    const fields = runtime.fields || {};
    const gradeSubject = String(fields.gradeSubject || "三年级美术");
    const gradeMatch = gradeSubject.match(/([一二三四五六七八九十\d]+年级)/);
    const subjectMatch = gradeSubject.match(/(美术|艺术|音乐|语文|数学|英语|科学|体育)/);
    const grade = gradeMatch ? gradeMatch[1] : "三年级";
    const subject = subjectMatch ? subjectMatch[1] : "美术";
    const taskInstruction = [
      "当前任务是学期教学工作计划预览，不是单元教案、不是课时教案。",
      "请基于右侧基础信息生成只读候选；教材目录缺失时标注待补即可，不要把教材明细作为继续追问的理由。",
      "输出应同步到教学工作计划预览区，确认前不写入正式教学工作计划。"
    ].join("\n");
    return {
      session_id: sid,
      teacher_message: `${utterance}\n\n${taskInstruction}`,
      ai_mode: "real_candidate",
      current_task: "教学规划 · 教学工作计划",
      opened_cards: ["semesterSchedule", "focusWorkspace", "teaching_work_plan"],
      locked_cards: [],
      current_context: {
        session_id: sid,
        grade,
        subject,
        design_scope: "semester",
        context_intent: "semester_plan_request",
        topic: `${gradeSubject}${fields.semester || ""}教学工作计划`,
        lesson_title: `${gradeSubject}${fields.semester || ""}教学工作计划`,
        semester_fields: fields,
        weekly_lessons: fields.weeklyLessons || "",
        activity_weeks: fields.activityWeeks || "",
        textbook_catalog: fields.textbookCatalog || ""
      },
      runtime_state: { session_id: sid, teaching_planning: runtime },
      safety_flags: { ...REQUIRED_FALSE_FLAGS },
      forbidden_actions: ["direct_write", "overwrite_content", "bypass_teacher_review"]
    };
  }

  function syncGeneratedPreview(payload) {
    const api = semesterApi();
    if (!api || typeof api.applyGeneratedPreview !== "function") return { synced: false };
    const result = api.applyGeneratedPreview(payload || {});
    refreshSemesterSchedule();
    try {
      const protocol = window.SHIWEI_RENDERER_PROTOCOL_V1;
      if (protocol && typeof protocol.select === "function") protocol.select("teaching_work_plan");
    } catch (_) {}
    return result || { synced: false };
  }

  async function postModelCandidate(detail) {
    const body = buildModelPayload(detail);
    const response = await fetch(`${modelApiBase()}/ai/dry-run`, {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reason = payload.reason_code || payload.error_code || `http_${response.status}`;
      const error = new Error(reason);
      error.payload = payload;
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function handleAgentAction(detail) {
    const utterance = String((detail && detail.utterance) || "").trim();
    if (!utterance) return false;
    const key = `${sessionId(detail)}::${utterance}`;
    if (key === lastRequestKey) return true;
    lastRequestKey = key;
    setStatus({
      modelCandidateCalled: true,
      modelConnected: false,
      lastUtterance: utterance,
      modelApiBase: modelApiBase(),
      requestStartedAt: new Date().toISOString()
    });
    const semantic = localSemanticReply(detail);
    if (semantic && semantic.handled) {
      appendXiaobei(semantic.reply);
      setStatus({
        modelCandidateCalled: false,
        modelConnected: false,
        localSemanticHandled: true,
        localSemanticKind: semantic.kind || "",
        localSemanticFieldUpdates: semantic.fieldUpdates || [],
        localSemanticReady: semantic.ready === true,
        responseReceivedAt: new Date().toISOString()
      });
      return true;
    }
    const thinking = appendThinking("正在调用真实候选模型，只读生成教学规划候选。");
    setStatus({ thinkingAnimationShown: Boolean(thinking), thinkingAnimationRemoved: false });
    try {
      const payload = await postModelCandidate(detail);
      const assistant = String(payload.assistant_message || "").trim() || "真实候选模型已返回，但没有给出可展示文本。";
      const syncResult = syncGeneratedPreview(payload);
      await removeThinking(thinking);
      appendXiaobei(assistant);
      renderStatusPanel(payload, true, "");
      setStatus({
        modelConnected: true,
        thinkingAnimationRemoved: true,
        candidateSource: payload.candidate_source || "model",
        providerMeta: payload.provider_meta || {},
        guardStatus: payload.guard_status || "",
        generatedPreviewSynced: syncResult.generated_preview_synced === true,
        generatedPreviewSectionCount: syncResult.section_count || 0,
        safetyCheck: payload.safety_check || {},
        lastResponseId: payload.response_id || "",
        responseReceivedAt: new Date().toISOString()
      });
      return true;
    } catch (error) {
      const payload = error && error.payload ? error.payload : {};
      const reason = payload.reason_code || payload.error_code || (error && error.message) || "model_candidate_unavailable";
      await removeThinking(thinking);
      appendXiaobei(`**真实候选模型现在没有接通。**\n\n原因：${reason}\n\n我不会把规则占位内容当成模型体验；当前页面仍然没有写数据库、没有写记忆、没有写正式教学计划。`);
      renderStatusPanel(payload, false, reason);
      setStatus({
        modelConnected: false,
        thinkingAnimationRemoved: true,
        error: reason,
        unavailablePayload: payload,
        failedAt: new Date().toISOString()
      });
      return false;
    }
  }

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }

  window.SHIWEI_TEACHING_PLANNING_MODEL_CANDIDATE_DRY_RUN_API_0997V = {
    stageId: STAGE_ID,
    handleAgentAction,
    postModelCandidate,
    getStatus: () => window.SHIWEI_TEACHING_PLANNING_MODEL_CANDIDATE_DRY_RUN_0997V || null
  };

  window.addEventListener("shiwei:teaching-planning-agent-action-dry-run:0997P", (event) => {
    handleAgentAction(event.detail || {});
  });

  ready(() => {
    injectStyle();
    setStatus({ installedAt: new Date().toISOString(), modelApiBase: modelApiBase() });
  });
})();
