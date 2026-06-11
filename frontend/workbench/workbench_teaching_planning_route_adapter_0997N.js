(function () {
  "use strict";

  const STAGE_ID = "0997N_TEACHING_PLANNING_FRONTEND_ROUTE_ADAPTER_READONLY_RUNTIME_APPLY";
  const DEFAULT_SESSION_ID = "tp_session_syn_001";
  const DEFAULT_BASE = "http://127.0.0.1:8082/api/workbench";

  function apiBase() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const fromQuery = params.get("teaching_planning_api_base") || params.get("api_base");
      const fromWindow = window.SHIWEI_TEACHING_PLANNING_API_BASE_0997N;
      const fromStorage = window.localStorage && window.localStorage.getItem("shiwei_teaching_planning_api_base_0997N");
      const value = String(fromQuery || fromWindow || fromStorage || DEFAULT_BASE).replace(/\/+$/, "");
      if (/^https?:\/\/(127\.0\.0\.1|localhost):\d+\/api\/workbench$/i.test(value)) return value;
    } catch (_) {}
    return DEFAULT_BASE;
  }

  function sessionId() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      return String(params.get("teaching_planning_session") || window.SHIWEI_TEACHING_PLANNING_SESSION_0997N || DEFAULT_SESSION_ID).trim() || DEFAULT_SESSION_ID;
    } catch (_) {
      return DEFAULT_SESSION_ID;
    }
  }

  function setRuntimeStatus(partial) {
    window.SHIWEI_TEACHING_PLANNING_RUNTIME_0997N = {
      stageId: STAGE_ID,
      readonly: true,
      providerCalled: false,
      databaseWritten: false,
      memoryStoreWritten: false,
      registryStoreWritten: false,
      frontendRuntimeAdapterCreated: true,
      ...(window.SHIWEI_TEACHING_PLANNING_RUNTIME_0997N || {}),
      ...(partial || {})
    };
    const card = document.querySelector('[data-card="focusWorkspace"]');
    if (card) card.setAttribute("data-teaching-planning-runtime-0997n", partial && partial.connected ? "connected" : "pending");
  }

  async function fetchJson(path, options) {
    const response = await fetch(`${apiBase()}${path}`, {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      ...(options || {})
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error("teaching_planning_runtime_request_failed");
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function fieldValue(state, key, fallback) {
    const fields = state && state.teacher_input && state.teacher_input.fields ? state.teacher_input.fields : {};
    const value = fields[key];
    if (Array.isArray(value)) return value.join("、");
    return value == null || value === "" ? fallback : String(value);
  }

  function workPlanSections(state) {
    const semester = fieldValue(state, "semester", "本学期");
    const gradeSubject = fieldValue(state, "grade_subject", "美术");
    const weekly = fieldValue(state, "weekly_lessons", "待确认");
    const activities = fieldValue(state, "activity_weeks", "待老师补充");
    return [
      { title: "一、基本信息", body: `${semester}，${gradeSubject}，每周 ${weekly} 节。` },
      { title: "二、教学安排", body: "已从后端只读状态读取候选结构，当前仅作为工作台 runtime 预览。" },
      { title: "三、活动周处理", body: `活动周：${activities}。小备会在后续正式规划时提示老师复核。` },
      { title: "四、确认边界", body: "本次 runtime 只读接入不写数据库、不写记忆、不发布正式教学计划。" }
    ];
  }

  function patchSemesterApi(runtimeState) {
    const api = window.XIAOBEI_SEMESTER_SCHEDULE_PLANNING_V1;
    if (!api || api.__runtime0997N) return false;
    const original = typeof api.getFocusState === "function" ? api.getFocusState.bind(api) : null;
    if (!original) return false;
    api.getFocusState = function () {
      const base = original() || {};
      const state = runtimeState || {};
      const fields = state.teacher_input && state.teacher_input.fields ? state.teacher_input.fields : {};
      const baseFields = Array.isArray(base.fields) ? base.fields : [];
      const baseHasTeacherInput = baseFields.some(item => item && typeof item === "object" && (item.text || item.value));
      const baseSections = Array.isArray(base.workPlanSections) ? base.workPlanSections : [];
      const generatedPreviewSynced = base.generatedPreviewSynced === true || base.taskStatus === "模型候选已生成";
      return {
        ...base,
        taskTitle: generatedPreviewSynced ? (base.taskTitle || "教学工作计划：模型候选已生成") : (base.taskTitle || "教学规划：runtime 只读接入"),
        taskStatus: generatedPreviewSynced ? "模型候选已生成" : (base.taskStatus || "runtime 已连接"),
        currentStage: "教学规划",
        nextStep: generatedPreviewSynced ? (base.nextStep || "查看右侧预览") : (base.nextStep || "等待老师输入"),
        runtimeConnected0997N: true,
        runtimeStageId: STAGE_ID,
        fields: baseHasTeacherInput ? baseFields : [
          { key: "semester", label: "学期", text: fieldValue(state, "semester", ""), value: fields.semester || "", editable: true, required: true, status: fields.semester ? "done" : "pending" },
          { key: "gradeSubject", label: "年级学科", text: fieldValue(state, "grade_subject", ""), value: fields.grade_subject || "", editable: true, required: true, status: fields.grade_subject ? "done" : "pending" },
          { key: "weeklyLessons", label: "每周课时", text: fieldValue(state, "weekly_lessons", ""), value: fields.weekly_lessons || "", editable: true, required: true, status: fields.weekly_lessons ? "done" : "pending" },
          { key: "activityWeeks", label: "活动周", text: fieldValue(state, "activity_weeks", ""), value: fieldValue(state, "activity_weeks", ""), editable: true, required: true, status: fields.activity_weeks ? "done" : "pending" },
          { key: "textbookCatalog", label: "教材目录", text: "", value: "", inputType: "file", placeholder: "可选：上传教材目录", emptyText: "可选，后续可关联知识库", required: false, status: "optional" }
        ],
        workPlanSections: generatedPreviewSynced ? baseSections : [],
        generatedPreviewSynced,
        runtimeBackendState0997N: state
      };
    };
    api.__runtime0997N = true;
    return true;
  }

  function renderRuntimePreview(state, rendererPayload) {
    const protocol = window.SHIWEI_RENDERER_PROTOCOL_V1;
    const focus = window.XIAOBEI_FOCUS_WORKSPACE_V1;
    patchSemesterApi(state);
    if (focus && typeof focus.setFocusTask === "function") focus.setFocusTask("semesterSchedule");
    if (protocol && typeof protocol.renderPlanningPreview === "function") {
      const target = document.querySelector('[data-card="focusWorkspace"] .focus-body') || document.querySelector('[data-card="focusWorkspace"]');
      if (target) {
        const html = protocol.renderPlanningPreview({ workPlanSections: workPlanSections(state) }, "teaching_work_plan", true);
        const zone = document.createElement("div");
        zone.className = "teaching-planning-runtime-zone-0997n";
        zone.setAttribute("data-runtime-stage", STAGE_ID);
        zone.innerHTML = html;
        const old = target.querySelector(".teaching-planning-runtime-zone-0997n");
        if (old) old.replaceWith(zone);
        else target.appendChild(zone);
      }
    }
    setRuntimeStatus({ connected: true, state, rendererPayload, connectedAt: new Date().toISOString(), apiBase: apiBase(), sessionId: sessionId() });
  }

  async function connect() {
    setRuntimeStatus({ connected: false, connecting: true, apiBase: apiBase(), sessionId: sessionId() });
    try {
      const sid = sessionId();
      const status = await fetchJson("/teaching-planning/status");
      const session = await fetchJson(`/teaching-planning/session/${encodeURIComponent(sid)}`);
      const rendererPayload = await fetchJson(`/teaching-planning/renderer-payload/${encodeURIComponent(sid)}`);
      const state = session && session.payload ? session.payload.state : {};
      renderRuntimePreview(state, rendererPayload);
      setRuntimeStatus({ connected: true, status, state, rendererPayload, apiBase: apiBase(), sessionId: sid, connectedAt: new Date().toISOString() });
    } catch (error) {
      setRuntimeStatus({ connected: false, error: error && error.message, errorStatus: error && error.status, failedAt: new Date().toISOString(), apiBase: apiBase(), sessionId: sessionId() });
    }
  }

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }

  window.SHIWEI_TEACHING_PLANNING_ROUTE_ADAPTER_0997N = {
    stageId: STAGE_ID,
    connect,
    getStatus: () => window.SHIWEI_TEACHING_PLANNING_RUNTIME_0997N || null
  };

  ready(() => {
    connect();
    window.setTimeout(connect, 350);
  });
})();
