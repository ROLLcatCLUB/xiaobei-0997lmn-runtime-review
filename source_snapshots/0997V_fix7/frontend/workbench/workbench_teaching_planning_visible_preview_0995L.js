(function () {
  "use strict";

  const STAGE_ID = "0995L_TEACHING_PLANNING_WORKBENCH_READONLY_PAGE_APPLY";
  const CANDIDATE_ID = "teaching_planning_visible_preview_readonly_candidate_0995H";

  const candidate = {
    readonly: true,
    candidate_id: CANDIDATE_ID,
    fields: {
      semester: "2025-2026 学年第一学期",
      gradeSubject: "四年级美术",
      weeklyLessons: "每周 1 节",
      activityWeeks: "创艺节、期末展示周",
      textbookCatalog: ""
    },
    scheduleRows: [
      ["第1周", "开学准备与课程导入", "教学规划候选", "1", "只读预览"],
      ["第2周", "基础主题学习", "教学规划候选", "1", "只读预览"],
      ["第4周", "活动周避让或调整", "教学规划候选", "0", "创艺节需复核"]
    ],
    workPlanSections: [
      {
        title: "一、指导思想",
        body: "只读体验预览：先帮助老师确认本学期教学方向，确认前不会进入正式成果。"
      },
      {
        title: "二、学情分析",
        body: "只读体验预览：根据年级学科生成学情分析候选，后续需要结合真实班级情况修订。"
      },
      {
        title: "三、教材与单元分析",
        body: "只读体验预览：教材目录当前为可选项，后续可关联知识库或由老师上传补充。"
      },
      {
        title: "四、教学进度安排",
        body: "只读体验预览：课务日程会避让活动周，但日期和校历仍需老师复核。"
      },
      {
        title: "五、活动周与调整说明",
        body: "只读体验预览：创艺节、期末展示周等活动只作为候选约束，不自动写入正式课表。"
      }
    ]
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }

  function shouldSkipVisiblePreview() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      return Boolean(params.get("teaching_planning_model_api_base"))
        || params.get("structured_patch") === "0997T"
        || /0997V/i.test(String(params.get("v") || ""));
    } catch (_) {
      return false;
    }
  }

  function patchSemesterApi() {
    if (shouldSkipVisiblePreview()) return false;
    const api = window.XIAOBEI_SEMESTER_SCHEDULE_PLANNING_V1;
    if (!api || api.__teachingPlanningVisiblePreview0995L) return false;
    const originalGetFocusState = typeof api.getFocusState === "function" ? api.getFocusState.bind(api) : null;
    if (!originalGetFocusState) return false;
    api.getFocusState = function () {
      const base = originalGetFocusState() || {};
      return {
        ...base,
        layout: "teachingPlanning",
        workflowLabel: "教学规划",
        componentName: "学期规划",
        taskTitle: "学期规划：只读体验预览",
        taskStatus: "只读预览",
        taskVisualStatus: "done",
        currentStage: "学期规划",
        nextStep: "查看预览",
        pendingItems: "活动周和日期仍需老师复核",
        hideComponentName: true,
        hideIntro: true,
        agentThinkingPreviewVisible: true,
        demoStage: "review",
        demoStatus: "只读体验预览",
        prepMap: [
          ["规划类型", "done", "学期规划"],
          ["基础信息", "done", "已收齐"],
          ["课务日程", "current", "只读预览"],
          ["冲突检查", "pending", "待复核"],
          ["工作计划", "pending", "待确认"],
          ["自动排课", "pending", "未接入"]
        ],
        fields: [
          { key: "semester", label: "学期", text: candidate.fields.semester, value: candidate.fields.semester, editable: true, required: true, status: "done" },
          { key: "gradeSubject", label: "年级学科", text: candidate.fields.gradeSubject, value: candidate.fields.gradeSubject, editable: true, required: true, status: "done" },
          { key: "weeklyLessons", label: "每周课时", text: candidate.fields.weeklyLessons, value: candidate.fields.weeklyLessons, editable: true, required: true, status: "done" },
          { key: "activityWeeks", label: "活动周", text: candidate.fields.activityWeeks, value: candidate.fields.activityWeeks, editable: true, required: true, status: "done" },
          { key: "textbookCatalog", label: "教材目录", text: "", value: "", inputType: "file", placeholder: "可选：上传教材目录", emptyText: "可选，后续可关联知识库", required: false, status: "optional" }
        ],
        scheduleRows: clone(candidate.scheduleRows),
        workPlanSections: clone(candidate.workPlanSections),
        impacts: [
          ["教学工作计划", "已进入只读预览，待老师确认"],
          ["课务日程表", "已生成候选，待校历复核"],
          ["教学周历", "已同步为时间线预览"]
        ],
        statusAction: {
          label: "只读预览",
          ready: false,
          prompt: "",
          hint: "当前只做体验预览，不进入正式输出。"
        },
        readonlyVisiblePreview0995L: true,
        visiblePreviewStageId: STAGE_ID,
        visiblePreviewCandidateId: CANDIDATE_ID
      };
    };
    api.__teachingPlanningVisiblePreview0995L = true;
    return true;
  }

  function markCard() {
    const card = document.querySelector('[data-card="focusWorkspace"]');
    if (card) card.setAttribute("data-teaching-planning-visible-preview-0995l", "true");
  }

  function applyPreview() {
    if (shouldSkipVisiblePreview()) {
      window.SHIWEI_TEACHING_PLANNING_VISIBLE_PREVIEW_0995L = {
        stageId: STAGE_ID,
        candidateId: CANDIDATE_ID,
        readonly: true,
        applied: false,
        skippedForModelCandidate0997V: true,
        providerCalled: false,
        backendModified: false,
        memoryWritten: false,
        registryWritten: false
      };
      return;
    }
    const patched = patchSemesterApi();
    const focus = window.XIAOBEI_FOCUS_WORKSPACE_V1;
    if (focus && typeof focus.setFocusTask === "function") {
      focus.setFocusTask("semesterSchedule");
      markCard();
    }
    window.SHIWEI_TEACHING_PLANNING_VISIBLE_PREVIEW_0995L = {
      stageId: STAGE_ID,
      candidateId: CANDIDATE_ID,
      readonly: true,
      applied: !!patched,
      providerCalled: false,
      backendModified: false,
      memoryWritten: false,
      registryWritten: false
    };
  }

  ready(() => {
    applyPreview();
    window.setTimeout(applyPreview, 80);
    window.setTimeout(markCard, 260);
  });
})();
