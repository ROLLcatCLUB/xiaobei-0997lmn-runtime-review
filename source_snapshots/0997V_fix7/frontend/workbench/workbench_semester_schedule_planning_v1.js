(function () {
  "use strict";

  function scopedStorageKey(base) {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const session = String(params.get("teaching_planning_session") || window.SHIWEI_TEACHING_PLANNING_SESSION_0997N || "default")
        .trim()
        .replace(/[^\w.-]+/g, "_");
      return `${base}:${session || "default"}`;
    } catch (_) {
      return `${base}:default`;
    }
  }

  const BASIC_INFO_KEY = scopedStorageKey("xiaobei_semester_basic_info_inputs_v1");
  const ACTIVE_QUESTION_KEY = scopedStorageKey("xiaobei_semester_active_question_v1");
  const DEMO_STAGE_KEY = scopedStorageKey("xiaobei_semester_demo_stage_v1");

  function readStoredInputs() {
    try {
      const raw = window.localStorage && window.localStorage.getItem(BASIC_INFO_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function writeStoredInputs(values) {
    try {
      if (window.localStorage) window.localStorage.setItem(BASIC_INFO_KEY, JSON.stringify(values || {}));
    } catch (_) {}
  }

  const teacherInputs = readStoredInputs();

  function readActiveQuestionKey() {
    try {
      return window.sessionStorage ? String(window.sessionStorage.getItem(ACTIVE_QUESTION_KEY) || "") : "";
    } catch (_) {
      return "";
    }
  }

  function writeActiveQuestionKey(key) {
    try {
      if (!window.sessionStorage) return;
      if (key) window.sessionStorage.setItem(ACTIVE_QUESTION_KEY, key);
      else window.sessionStorage.removeItem(ACTIVE_QUESTION_KEY);
    } catch (_) {}
  }

  let activeQuestionKey = readActiveQuestionKey();
  let demoStage = readDemoStage();

  function readDemoStage() {
    try {
      return window.sessionStorage ? String(window.sessionStorage.getItem(DEMO_STAGE_KEY) || "input") : "input";
    } catch (_) {
      return "input";
    }
  }

  function writeDemoStage(stage) {
    demoStage = stage || "input";
    try {
      if (window.sessionStorage) window.sessionStorage.setItem(DEMO_STAGE_KEY, demoStage);
    } catch (_) {}
    return demoStage;
  }

  const basicFields = [
    {
      key: "semester",
      label: "学期",
      placeholder: "如 2025-2026 学年第一学期 / 第二学期",
      note: "第一学期一般从 9 月 1 日前后开始，到第二年 1 月或 2 月结束；第二学期通常从 1-3 月某一天开学，到 6 月 30 日前结束。小备需要查看校历和周末安排，判断第一周、寒假、期末最后 1-2 周是否排新课。"
    },
    {
      key: "gradeSubject",
      label: "年级学科",
      placeholder: "例如 四年级美术",
      note: "年级会影响学情判断、教材目录读取、教学节奏和任务容量，需要老师先确认。"
    },
    {
      key: "weeklyLessons",
      label: "每周课时",
      placeholder: "例如 每周 1 节 / 每周 2 节",
      note: "每周课时决定总课时容量。小备会结合校历周次、假期、活动周和教材目录，先估算进度节奏，再请老师确认。"
    },
    {
      key: "activityWeeks",
      label: "活动周",
      placeholder: "如创艺节、考试周、运动会、期末展示周",
      note: "活动周、考试周和期末整理周可能不排新课，需要提前标记，避免把核心单元压到不可教学周。"
    },
    {
      key: "textbookCatalog",
      label: "教材目录",
      inputType: "file",
      placeholder: "可选：上传教材目录",
      emptyText: "可选，后续可关联知识库",
      required: false,
      note: "教材目录是细化课题顺序和进度安排的依据。当前不是必填，后续可上传、粘贴或关联知识库。"
    }
  ];

  function filledValue(key) {
    return String(teacherInputs[key] || "").trim();
  }

  function allBasicInfoFilled() {
    return basicFields.filter(item => item.required !== false).every(item => filledValue(item.key));
  }

  function fieldByKey(key) {
    return basicFields.find(item => item.key === key) || null;
  }

  function firstMissingField() {
    return basicFields.find(item => item.required !== false && !filledValue(item.key)) || null;
  }

  function nextFieldAfter(key) {
    const index = basicFields.findIndex(item => item.key === key);
    if (index < 0) return firstMissingField();
    return basicFields.slice(index + 1).find(item => item.required !== false && !filledValue(item.key)) || firstMissingField();
  }

  function setActiveQuestion(key) {
    activeQuestionKey = key || "";
    writeActiveQuestionKey(activeQuestionKey);
    return activeQuestionKey;
  }

  function questionForField(field) {
    if (!field) return "";
    const questions = {
      semester: "先确认学期：这是哪个学年、第一学期还是第二学期？可以直接说：2025-2026学年第一学期。",
      gradeSubject: "接着确认年级学科：这份课务安排面向哪个年级和什么学科？例如：四年级美术。",
      weeklyLessons: "再确认每周课时：这个班每周上几节美术？例如：每周1节，或单双周不同。",
      activityWeeks: "还要标出活动周：这个学期有哪些不排新课或需要预留的周？例如运动会、创艺节、考试周、期末展示周；如果没有，也可以直接说“暂无活动周”。",
      textbookCatalog: "教材目录可以先不上传。后续可以从知识库关联教材目录，也可以在右侧手动上传。"
    };
    return questions[field.key] || field.placeholder || `请补充${field.label}。`;
  }

  function replyForQuestion(field, heading) {
    if (!field) return readyReply();
    setActiveQuestion(field.key);
    const current = filledValue(field.key);
    const currentLine = current
      ? `右侧当前显示：${field.inputType === "file" ? `已上传 ${current}` : current}。如果沿用，直接回复“沿用”；如果不对，就直接发新的内容。`
      : "";
    return [
      `### ${heading || "我先追问一个基础信息"}`,
      "",
      "我会尽量一次处理老师给到的信息；还缺的只集中提示一次，右侧只做同步工作区。",
      "",
      "---",
      "",
      `**需要老师确认：${field.label}**`,
      "",
      currentLine,
      currentLine ? "" : "",
      questionForField(field)
    ].join("\n");
  }

  function readyReply() {
    setActiveQuestion("");
    return [
      "### 基础信息已经收齐",
      "",
      "我已经把学期、年级学科、每周课时和活动周同步到右侧。教材目录是可选项，后续可上传或关联知识库。",
      "",
      "---",
      "",
      "**下一步**",
      "",
      "现在可以直接对我说“生成教学工作计划预览”，我会根据这些信息生成只读候选并同步到右侧。"
    ].join("\n");
  }

  function replyAfterFilled(field, value) {
    const next = nextFieldAfter(field.key);
    if (!next) return readyReply();
    setActiveQuestion(next.key);
    return [
      `### 已记录：${field.label}`,
      "",
      `我已把“${value || "已补充"}”同步到右侧的${field.label}。`,
      "",
      "---",
      "",
      `**继续确认：${next.label}**`,
      "",
      questionForField(next)
    ].join("\n");
  }

  function startGuidedQuestions(options = {}) {
    const current = options.resume && activeQuestionKey ? fieldByKey(activeQuestionKey) : null;
    const first = options.restart ? basicFields[0] : null;
    const target = current || first || firstMissingField() || basicFields[0];
    if (!target && allBasicInfoFilled()) {
      return { handled: true, done: true, reply: readyReply(), activeKey: "" };
    }
    return { handled: true, done: false, reply: replyForQuestion(target, "我先带你把学期课务信息搭起来"), activeKey: target.key };
  }

  function handleGuidedAnswer(answer) {
    const text = String(answer || "").trim();
    let field = fieldByKey(activeQuestionKey);
    if (!field) field = firstMissingField() || basicFields[0];
    if (!field) return { handled: true, done: true, reply: readyReply(), activeKey: "" };
    setActiveQuestion(field.key);
    if (!text) {
      return { handled: true, done: false, reply: replyForQuestion(field, "这个信息还没补上"), activeKey: field.key };
    }
    const current = filledValue(field.key);
    const useExisting = !!current && /^(沿用|用这个|继续用|保持|不改|不用改)$/.test(text);
    if (field.inputType === "file") {
      if (useExisting) {
        return { handled: true, done: allBasicInfoFilled(), filledKey: field.key, reply: replyAfterFilled(field, current), activeKey: activeQuestionKey };
      }
      return {
        handled: true,
        done: false,
        activeKey: field.key,
        reply: [
          "### 这里需要上传教材目录",
          "",
          "教材目录会影响课题顺序和进度细化；当前不是必填，可以稍后再补。",
          "",
          "---",
          "",
          "**可以稍后上传教材目录文件**",
          "",
          "如果暂时没有目录，我会先生成学期教学工作计划候选，并把目录相关位置标成待补。"
        ].join("\n")
      };
    }
    const value = useExisting ? current : text;
    teacherInputs[field.key] = value;
    writeStoredInputs(teacherInputs);
    return { handled: true, done: allBasicInfoFilled(), filledKey: field.key, reply: replyAfterFilled(field, value), activeKey: activeQuestionKey };
  }

  function handleUploadedField(key, fileName) {
    const field = fieldByKey(key);
    if (!field) return { ...statusAction(), handled: false };
    const shouldReply = activeQuestionKey === key;
    const reply = shouldReply ? replyAfterFilled(field, fileName || "教材目录") : "";
    return { ...statusAction(), handled: shouldReply, reply, done: allBasicInfoFilled(), activeKey: activeQuestionKey };
  }

  function buildFields() {
    return basicFields.map(item => ({
      ...item,
      text: filledValue(item.key),
      value: filledValue(item.key),
      editable: item.inputType !== "file",
      required: item.required !== false,
      status: filledValue(item.key) ? "done" : item.required === false ? "optional" : "warn"
    }));
  }

  function buildGeneratePrompt() {
    const lines = basicFields.map(item => {
      const value = filledValue(item.key);
      if (item.inputType === "file") return `${item.label}：${value ? `已上传 ${value}` : "可选，后续可关联知识库"}`;
      return `${item.label}：${value || "待补充"}`;
    });
    return [
      "请根据右侧基础信息生成学期教学工作计划预览，并给出必要的课务日程提示。",
      ...lines,
      "教材目录缺失时标注待补即可，不要把教材明细作为继续追问的理由；确认前不要进入最终成果包。"
    ].join("\n");
  }

  function statusAction() {
    const ready = allBasicInfoFilled();
    const generated = typeof state !== "undefined" && state.taskStatus === "模型候选已生成";
    if (generated) {
      return {
        label: "已生成预览",
        ready: false,
        prompt: "",
        agentOnly: true,
        hint: "模型候选已同步到右侧教学工作计划预览区，确认前不会写入正式结果。"
      };
    }
    return {
      label: ready ? "可让小备生成" : "待补充",
      ready,
      prompt: buildGeneratePrompt(),
      agentOnly: true,
      hint: ready ? "已补齐必填基础信息，直接在左侧对小备说生成教学工作计划预览。" : "请先补齐学期、年级学科、每周课时和活动周。教材目录可选。"
    };
  }

  function cleanGeneratedMarkdown(text) {
    return String(text || "")
      .replace(/^```(?:markdown|md)?/i, "")
      .replace(/```$/i, "")
      .trim();
  }

  function generatedSectionsFromMarkdown(markdown) {
    const text = cleanGeneratedMarkdown(markdown);
    if (!text) return [];
    const parts = text.split(/\n(?=#{1,4}\s+)/).map(item => item.trim()).filter(Boolean);
    if (!parts.length) return [{ title: "模型候选教学工作计划", body: text }];
    return parts.map((part, index) => {
      const lines = part.split(/\r?\n/);
      const first = String(lines.shift() || "").replace(/^#{1,4}\s*/, "").trim();
      return {
        title: first || `模型候选 ${index + 1}`,
        body: lines.join("\n").trim() || part
      };
    });
  }

  function applyGeneratedPreview(payload = {}) {
    const source = payload && typeof payload === "object" ? payload : {};
    const updates = Array.isArray(source.card_updates) ? source.card_updates : [];
    const candidateText = updates.map(item => item && (item.candidate_text || item.teacher_summary || "")).filter(Boolean).join("\n\n");
    const assistantText = source.assistant_message || candidateText || "";
    const sections = generatedSectionsFromMarkdown(assistantText);
    if (sections.length) {
      state.workPlanSections = sections;
      state.taskTitle = "教学工作计划：模型候选已生成";
      state.candidateText = "已生成模型候选，并同步到教学工作计划预览区。";
      state.taskStatus = "模型候选已生成";
      state.taskVisualStatus = "done";
      state.nextStep = "查看右侧预览";
      state.pendingItems = "待老师复核活动周、课务日程和工作计划内容";
      state.confirmations = ["模型候选只读同步到右侧", "确认前不写入正式教学工作计划"];
      state.impacts = [
        ["教学工作计划", "已同步模型候选预览"],
        ["课务日程表", "可继续根据活动周调整"],
        ["教材目录", "可稍后用于细化进度"]
      ];
      writeDemoStage("review");
    }
    return {
      ...statusAction(),
      generated_preview_synced: sections.length > 0,
      section_count: sections.length
    };
  }

  function demoPrepMap() {
    if (demoStage === "preview") {
      return [
        ["规划类型", "done", "学期规划"],
        ["基础信息", "done", "已完成"],
        ["课务日程", "current", "已生成"],
        ["冲突检查", "pending", "待处理"],
        ["工作计划", "pending", "待预览"],
        ["自动排课", "pending", "待接入"]
      ];
    }
    if (demoStage === "review") {
      return [
        ["规划类型", "done", "学期规划"],
        ["基础信息", "done", "已完成"],
        ["课务日程", "done", "已预览"],
        ["冲突检查", "done", "已检查"],
        ["工作计划", "current", "待确认"],
        ["自动排课", "pending", "待接入"]
      ];
    }
    return state.prepMap.map(item => item.slice());
  }

  function demoStatus() {
    if (demoStage === "preview") return "课务日程预览已生成";
    if (demoStage === "review") return "等待老师确认";
    return allBasicInfoFilled() ? "可生成教学工作计划预览" : "等待基础信息";
  }

  function demoImpacts() {
    if (demoStage === "preview") {
      return [
        ["学期课务日程表", "已生成预览候选"],
        ["教材目录", "可稍后用于细化进度"],
        ["教学工作计划", "待课务日程确认后预览"]
      ];
    }
    if (demoStage === "review") {
      return [
        ["学期课务日程表", "等待老师确认"],
        ["教材目录", "可稍后用于细化进度"],
        ["教学工作计划", "已进入预览区"]
      ];
    }
    return state.impacts.map(row => row.slice());
  }

  function setDemoState(stage) {
    const normalized = /^(empty|filled|preview|review)$/.test(String(stage || "")) ? String(stage) : "input";
    if (normalized === "empty") {
      basicFields.forEach(item => {
        delete teacherInputs[item.key];
      });
      writeDemoStage("empty");
      setActiveQuestion("");
      writeStoredInputs(teacherInputs);
      return statusAction();
    }
    if (normalized === "filled" || normalized === "preview" || normalized === "review") {
      Object.assign(teacherInputs, {
        semester: "2025-2026 学年第一学期",
        gradeSubject: "四年级美术",
        weeklyLessons: "每周 1 节",
        activityWeeks: "创艺节、期末展示周"
      });
      if (!teacherInputs.textbookCatalog) teacherInputs.textbookCatalog = "";
      writeDemoStage(normalized === "filled" ? "input" : normalized);
      setActiveQuestion("");
      writeStoredInputs(teacherInputs);
      return statusAction();
    }
    writeDemoStage("input");
    return statusAction();
  }

  const state = {
    layout: "teachingPlanning",
    workflowLabel: "教学规划",
    componentName: "教学工作计划",
    taskTitle: "教学工作计划：等待基础信息",
    taskStatus: "等待协商",
    taskVisualStatus: "warn",
    hideComponentName: true,
    hideIntro: true,
    currentStage: "学期规划",
    pendingItems: "学期格式、年级学科、每周课时、活动周",
    nextStep: "待补充",
    intro: "教学规划先确认规划类型和基础信息，再进入课务日程、冲突检查和工作计划预览。",
    officialLabel: "规划依据",
    officialText: "尚未确认学期、年级学科、每周课时和活动周。",
    candidateLabel: "当前状态",
    candidateText: "先确认基础信息和资料来源，再生成周次课务表候选。",
    prepMap: [
      ["规划类型", "done", "学期规划"],
      ["基础信息", "current", "待补充"],
      ["课务日程", "pending", "待生成"],
      ["冲突检查", "pending", "待处理"],
      ["工作计划", "pending", "待预览"],
      ["自动排课", "pending", "待接入"]
    ],
    fields: buildFields(),
    scheduleRows: [],
    confirmations: [],
    workPlanSections: [],
    impacts: [
      ["学期课务日程表", "等待基础信息后生成候选"],
      ["教学工作计划", "等待基础信息和模型候选"],
      ["教材目录", "可选，后续用于细化进度"]
    ],
    actions: []
  };

  window.XIAOBEI_SEMESTER_SCHEDULE_PLANNING_V1 = {
    getFocusState() {
      return {
        ...state,
        fields: buildFields(),
        statusAction: statusAction(),
        demoStage,
        demoStatus: demoStatus(),
        demoControls: false,
        generatedPreviewSynced: state.taskStatus === "模型候选已生成",
        generatedPreviewSectionCount: Array.isArray(state.workPlanSections) ? state.workPlanSections.length : 0,
        prepMap: demoPrepMap(),
        scheduleRows: state.scheduleRows.map(row => row.slice()),
        confirmations: state.confirmations.slice(),
        workPlanSections: state.workPlanSections.map(item => Array.isArray(item) ? item.slice() : { ...item }),
        impacts: demoImpacts(),
        actions: state.actions.map(row => row.slice())
      };
    },
    updateField(key, value) {
      const field = basicFields.find(item => item.key === key);
      if (!field) return statusAction();
      teacherInputs[key] = String(value || "").trim();
      writeStoredInputs(teacherInputs);
      return statusAction();
    },
    markUploaded(key, fileName) {
      const field = basicFields.find(item => item.key === key && item.inputType === "file");
      if (!field) return statusAction();
      teacherInputs[key] = String(fileName || "").trim();
      writeStoredInputs(teacherInputs);
      return handleUploadedField(key, fileName);
    },
    startGuidedQuestions,
    handleGuidedAnswer,
    hasActiveQuestion() {
      return !!activeQuestionKey && !allBasicInfoFilled();
    },
    getActiveQuestionKey() {
      return activeQuestionKey;
    },
    firstMissingKey() {
      const missing = firstMissingField();
      return missing ? missing.key : "";
    },
    getTeacherInputs() {
      return basicFields.reduce((result, item) => {
        result[item.key] = filledValue(item.key);
        return result;
      }, {});
    },
    getRuntimeState() {
      return {
        state_version: "070B20_semester_frontend_slots_v1",
        fields: basicFields.reduce((result, item) => {
          result[item.key] = filledValue(item.key);
          return result;
        }, {}),
        active_slot: activeQuestionKey,
        missing_slots: basicFields.filter(item => item.required !== false && !filledValue(item.key)).map(item => item.key),
        ready: allBasicInfoFilled(),
        generated_preview_synced: state.taskStatus === "模型候选已生成",
        generated_preview_section_count: Array.isArray(state.workPlanSections) ? state.workPlanSections.length : 0
      };
    },
    applyGeneratedPreview,
    syncBackendState(nextState) {
      const state = nextState && typeof nextState === "object" ? nextState : {};
      const fields = state.fields && typeof state.fields === "object" ? state.fields : {};
      let changed = false;
      basicFields.forEach(item => {
        const value = String(fields[item.key] || "").trim();
        if (value && teacherInputs[item.key] !== value) {
          teacherInputs[item.key] = value;
          changed = true;
        }
      });
      if (typeof state.active_slot === "string") setActiveQuestion(state.active_slot);
      if (changed) writeStoredInputs(teacherInputs);
      return statusAction();
    },
    buildGeneratePrompt,
    setDemoState,
    isReady() {
      return allBasicInfoFilled();
    }
  };
})();
