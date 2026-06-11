(function () {
  "use strict";

  const BASE_STATE = {
    componentName: "教学业务入口",
    taskTitle: "还没有选择备课任务",
    taskStatus: "等待开始",
    currentStage: "新课设计",
    pendingItems: "年级、课题、备课类型",
    nextStep: "待补充",
    intro: "当前还没有选择备课任务。你可以从左侧告诉小备课题、年级和类型，小备会先生成候选，确认前不会进入最终成果包。",
    officialLabel: "当前状态",
    officialText: "尚未选择课题，也没有正式内容被修改。",
    candidateLabel: "下一步候选",
    candidateText: "等待老师输入课题后生成候选框架。",
    fields: [
      ["课题", "等待老师输入"],
      ["年级", "等待老师输入"],
      ["类型", "可选择单课、大单元或学期规划"],
      ["候选状态", "尚未生成"]
    ],
    impacts: [
      ["教学业务", "等待课题后同步", "新建备课任务"],
      ["学生任务单", "等待候选确认后生成", "生成学生任务单"],
      ["成果包预览", "等待候选确认后同步", "查看成果包状态"]
    ],
    actions: [
      ["primary", "新建大单元", "fill", "我要备四年级的创艺节大单元课程，名字叫足球微缩模型"],
      ["ai", "查看目录", "fill", "五年级有哪些课？"],
      ["ghost", "做学期规划", "fill", "我要做学期规划"]
    ]
  };

  const FOCUS_STATES = {
    tasks: {
      componentName: "教学业务入口",
      taskTitle: "还没有选择备课任务",
      taskStatus: "等待选择",
      currentStage: "业务选择",
      nextStep: "从左侧告诉小备要备哪一课",
      intro: "当前还没有选择备课任务。小备会在你输入课题后打开对应工作卡。",
      officialLabel: "当前状态",
      officialText: "尚未选择课题。",
      candidateLabel: "任务选择",
      candidateText: "等待老师输入年级、课题或查询目录。",
      fields: [
        ["当前课题", "等待选择"],
        ["当前阶段", "任务选择"],
        ["待确认项", "年级、课题、备课类型"],
        ["下一步", "输入课题或查看目录"]
      ],
      actions: [
        ["primary", "新建大单元", "fill", "我要备四年级的创艺节大单元课程，名字叫足球微缩模型"],
        ["ai", "查看目录", "fill", "五年级有哪些课？"],
        ["ghost", "做学期规划", "fill", "我要做学期规划"]
      ]
    },
    candidate: {
      ...BASE_STATE,
      componentName: "课堂设计",
      taskTitle: "当前任务候选"
    },
    semesterSchedule: {
      layout: "teachingPlanning",
      workflowLabel: "教学规划",
      componentName: "学期规划",
      taskTitle: "学期规划：基础信息待补充",
      taskStatus: "待补充",
      taskVisualStatus: "warn",
      hideComponentName: true,
      hideIntro: true,
      currentStage: "学期规划",
      pendingItems: "学期格式、年级学科、每周课时、活动周、教材目录",
      nextStep: "待补充",
      intro: "教学规划先确认规划类型和基础信息，再进入课务日程、冲突检查和工作计划预览。",
      officialLabel: "规划依据",
      officialText: "等待老师确认学期、年级学科、每周课时、活动周和教材目录。",
      candidateLabel: "当前状态",
      candidateText: "基础信息待补充；课务日程、冲突检查和工作计划仍为预览能力。",
      prepMap: [
        ["规划类型", "done", "学期规划"],
        ["基础信息", "current", "待补充"],
        ["课务日程", "pending", "待生成"],
        ["冲突检查", "pending", "待处理"],
        ["工作计划", "pending", "待预览"],
        ["自动排课", "pending", "待接入"]
      ],
      fields: [
        {
          label: "学期",
          text: "待老师填写：如 2025-2026 学年第一学期 / 第二学期",
          note: "第一学期一般从 9 月 1 日前后开始，到第二年 1 月或 2 月结束；第二学期通常从 1-3 月某一天开学，到 6 月 30 日前结束。小备需要查看校历和周末安排。"
        },
        {
          label: "年级学科",
          text: "待老师填写：例如 四年级美术",
          note: "年级会影响学情判断、教材目录读取、单元难度和每课时任务容量，需要老师先确认。"
        },
        {
          label: "每周课时",
          text: "待老师填写：例如 每周 1 节 / 每周 2 节",
          note: "每周课时决定总课时容量，小备会结合校历周次、假期、活动周和教材目录估算单元课时。"
        },
        {
          label: "活动周",
          text: "待老师填写：如创艺节、考试周、运动会、期末展示周",
          note: "活动周、考试周和期末整理周可能不排新课，需要提前标记。"
        },
        {
          key: "textbookCatalog",
          label: "教材目录",
          text: "",
          inputType: "file",
          placeholder: "请上传教材目录文件",
          emptyText: "未上传教材目录",
          note: "教材目录是单元课时分配的主要依据。"
        }
      ],
      impacts: [
        ["课务日程", "待基础信息补充后生成预览"],
        ["单元课时分配", "待教材目录和周课时确认"],
        ["工作计划", "待课务日程确认后预览"]
      ],
      actions: []
    },
    activityRefine: {
      ...BASE_STATE,
      componentName: "活动精修组件",
      taskTitle: "活动精修候选"
    },
    lessonBrief: {
      actionCardId: "lessonBrief",
      componentName: "课时备课候选组件",
      taskTitle: "第2课时备课候选",
      taskStatus: "待老师确认",
      currentStage: "课时框架",
      pendingItems: "课时目标、流程、学习证据",
      nextStep: "确认课时框架后精修活动二",
      intro: "我已把当前课题整理成一版备课候选。你先确认框架，再进入活动和任务单。",
      officialLabel: "当前基础",
      officialText: "已有课题和资料，但课时目标、流程和学习证据还需要形成可审阅版本。",
      candidateLabel: "候选框架",
      candidateText: "围绕主题素材与表现方法，形成目标、流程、核心活动、学生任务和学习证据。",
      fields: [
        ["课时目标", "观察主题素材的层次，尝试用合适材料完成一件小作品。"],
        ["教学流程", "导入观察、颜色卡片比较、活动二创作、作品交流。"],
        ["核心活动", "用素材卡片对比 3 组方案，圈出最有画面感的一组。"],
        ["下一步", "继续精修活动二，再生成学生任务单。"]
      ],
      actions: [
        ["primary", "确认课时框架", "candidate-action", "accept"],
        ["ai", "继续精修活动二", "fill", "继续精修活动二候选"],
        ["ghost", "生成任务单", "fill", "根据活动二生成学生任务单"]
      ]
    },
    unitBrief: {
      actionCardId: "unitBrief",
      componentName: "大单元结果预览",
      taskTitle: "足球微缩模型 · 大单元概要",
      taskStatus: "待老师确认",
      currentStage: "大单元预览",
      pendingItems: "单元主题、大观念、基本问题、表现性任务、三课时安排、学习证据、评价建议",
      nextStep: "进入课时部分，拆第1课时、第2课时、第3课时",
      intro: "右侧直接展示本次大单元概要结果。确认前仍只是备课预览，你可以继续改字段，或进入课时部分拆第1课时、第2课时、第3课时。",
      resultFirst: true,
      resultLabel: "大单元概要",
      resultText: "足球微缩模型大单元概要，含大观念、基本问题、表现性任务、三课时安排、学习证据与评价建议。",
      prepMap: [
        ["业务选择", "done", "课堂设计"],
        ["新课设计", "current", "进行中"],
        ["模板方案", "pending", "待确认"],
        ["字段补充", "pending", "待补充"],
        ["候选修改", "pending", "待处理"],
        ["成果预览", "pending", "待处理"]
      ],
      fields: [
        ["单元主题", "以足球微缩模型为载体，探索空间缩放与细节表现。"],
        ["大观念", "艺术创作可以通过观察、缩放、取舍和细节再现，把真实场景转化为有情境的视觉表达。"],
        ["基本问题", "如何让足球场景按比例缩小后仍保持关键特征？怎样用有限材料表现丰富的视觉效果？"],
        ["表现性任务", "设计并制作一件足球主题微缩场景作品，呈现构思、材料选择、制作过程与最终说明。"],
        ["三课时安排", "第1课时观察与构思；第2课时制作与完善；第3课时展示与交流。"],
        ["学习证据", "设计草图、材料清单、制作过程记录、最终作品与表达说明。"],
        ["评价建议", "围绕构思完整度、比例关系、结构稳定、细节表现与表达说明做预览评价。"]
      ],
      actions: [
        ["primary", "进入课时部分", "fill", "进入课时部分，先拆第1课时、第2课时、第3课时的课时组件"],
        ["ai", "修改某个字段", "fill", "我想修改大观念/基本问题/三课时安排中的一个字段"],
        ["ghost", "重新生成某个字段", "fill", "请重新生成大观念，其他字段先保留"]
      ]
    },
    taskSheet: {
      actionCardId: "taskSheet",
      componentName: "学生任务单组件",
      taskTitle: "学生任务单草稿",
      taskStatus: "待老师确认",
      currentStage: "任务单生成",
      pendingItems: "学生任务单、评价建议",
      nextStep: "确认任务单或继续儿童化表达",
      intro: "我已根据活动二候选生成学生任务单草稿。你只需要确认任务是否清楚、是否适合三年级。",
      officialLabel: "来源活动",
      officialText: "活动二候选已把观察、圈选、说明理由作为核心任务。",
      candidateLabel: "任务单草稿",
      candidateText: "看一看、说一说、试一试、写一写，保留圈选记录、观察表、小作品和一句说明。",
      fields: [
        ["任务一", "观察 3 组主题素材，圈出你最喜欢的一组。"],
        ["任务二", "说出这组颜色给你的感觉。"],
        ["任务三", "用选出的材料或方法完成一个小作品局部。"],
        ["任务四", "写一句话说明选择理由。"]
      ],
      actions: [
        ["primary", "确认任务单", "candidate-action", "accept"],
        ["ai", "继续修改", "fill", "请把学生任务单语言再儿童化一点，步骤更短。"],
        ["ghost", "暂不采用", "candidate-action", "discard"]
      ]
    },
    resources: {
      componentName: "资源建议组件",
      taskTitle: "资源建议",
      taskStatus: "预览待确认",
      currentStage: "资源支架",
      pendingItems: "资源清单、任务单素材",
      nextStep: "选择是否加入本课资源清单",
      intro: "我已挑出能直接服务活动二和任务单的资源。确认后再加入教学包候选。",
      officialLabel: "已有资料",
      officialText: "当前学期计划、作品参考图。",
      candidateLabel: "建议加入",
      candidateText: "作品参考图、材料方法卡、表达词汇卡。",
      fields: [
        ["作品图", "用于导入观察和课件展示。"],
        ["材料方法卡", "用于解释材料来源和操作方法。"],
        ["色彩词汇卡", "用于学生任务单表达支架。"]
      ],
      actions: [
        ["primary", "加入教学包", "fill", "把当前课题资源加入本课资源清单区"],
        ["ai", "加入课件", "fill", "把作品参考图加入课件候选"],
        ["ghost", "稍后再说", "fill", "先不加入资源，继续处理活动二"]
      ]
    },
    packageCheck: {
      componentName: "教学包检查组件",
      taskTitle: "教学包检查",
      taskStatus: "仍有待确认",
      currentStage: "成果包门禁",
      pendingItems: "学生任务单、评价建议",
      nextStep: "先确认任务单和评价建议",
      intro: "我已重新检查教学包。教师阅读版已就绪，但任务单和评价建议确认前不会生成最终成果包。",
      officialLabel: "已就绪",
      officialText: "教师阅读版、材料清单可以进入预览。",
      candidateLabel: "待确认",
      candidateText: "学生任务单和评价建议仍需老师确认；课堂使用保持未连接。",
      fields: [
        ["教师阅读版", "已生成，可继续预览。"],
        ["学生任务单", "已生成草稿，仍待老师确认。"],
        ["评价建议", "需要和活动二观察证据再对齐。"],
        ["课堂使用", "当前只做备课预览，不进入课堂使用。"]
      ],
      actions: [
        ["primary", "继续完善", "fill", "继续完善教学包检查中的待确认项"],
        ["ai", "生成下载清单", "fill", "生成下载清单"],
        ["ghost", "回到活动二", "fill", "继续精修活动二候选"]
      ]
    },
    downloadPackage: {
      componentName: "成果包下载清单组件",
      taskTitle: "成果包下载清单",
      taskStatus: "暂不可下载",
      currentStage: "下载前检查",
      pendingItems: "学生任务单、评价建议表",
      nextStep: "继续确认阻塞项",
      intro: "我已生成下载清单预览。任务单和评价建议确认前，只能看清单，不生成下载包。",
      officialLabel: "可预览",
      officialText: "教师阅读版和材料清单已就绪。",
      candidateLabel: "待完成",
      candidateText: "学生任务单和评价建议表仍待确认。",
      fields: [
        ["教师阅读版", "已就绪。"],
        ["材料清单", "已就绪。"],
        ["学生任务单", "待确认。"],
        ["评价建议表", "待确认。"]
      ],
      actions: [
        ["primary", "继续确认", "fill", "先确认任务单和评价建议，再准备导出成果包"],
        ["ai", "检查教学包", "fill", "检查教学包"],
        ["ghost", "回到活动二", "fill", "继续精修活动二候选"]
      ]
    }
  };

  const COMPONENT_NAV_ITEMS = [
    ["tasks", "教学业务"],
    ["candidate", "任务候选"],
    ["semesterSchedule", "学期课务"],
    ["activityRefine", "活动精修"],
    ["lessonBrief", "课时备课"],
    ["unitBrief", "大单元预览"],
    ["taskSheet", "任务单"],
    ["resources", "资源"],
    ["packageCheck", "教学包"],
    ["downloadPackage", "成果包"]
  ];

  const packageRows = [
    ["教师阅读版", "已进入本次备课预览", "打开预览稿"],
    ["学生任务单", "待最终确认", "去确认"],
    ["材料清单", "已确认", "打开预览稿"],
    ["评价建议表", "待最终确认", "去确认"]
  ];

  let currentState = { ...BASE_STATE };
  let currentFocusKey = "tasks";
  let selectedPlanningPreviewKey = "teaching_work_plan";

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }

  function grid() {
    return document.getElementById("componentGrid");
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function normalizeCardId(cardId) {
    const map = {
      activity_2_candidate: "candidate",
      task_sheet_candidate: "taskSheet",
      lesson_brief_candidate: "lessonBrief",
      unit_brief_candidate: "unitBrief",
      resource_cards: "resources",
      teaching_package_check: "packageCheck",
      download_manifest_preview: "downloadPackage",
      semester_plan_candidate: "semesterSchedule",
      semester_schedule_planning: "semesterSchedule",
      semester_schedule: "semesterSchedule",
      semester_plan: "semesterSchedule",
      planning: "semesterSchedule",
      package_check: "packageCheck",
      download: "downloadPackage"
    };
    return map[cardId] || cardId || "candidate";
  }

  function stateFor(cardId) {
    const key = normalizeCardId(cardId);
    if (key === "semesterSchedule") {
      const api = window.XIAOBEI_SEMESTER_SCHEDULE_PLANNING_V1;
      if (api && typeof api.getFocusState === "function") {
        return { ...BASE_STATE, ...api.getFocusState() };
      }
    }
    return { ...BASE_STATE, ...(FOCUS_STATES[key] || FOCUS_STATES.candidate) };
  }

  function fieldRow(field, maybeText) {
    const label = Array.isArray(field) ? field[0] : field && typeof field === "object" ? field.label || field.field : field;
    const text = Array.isArray(field) ? field[1] : field && typeof field === "object" ? field.text || field.value || field.summary : maybeText;
    const note = Array.isArray(field) ? field[2] : field && typeof field === "object" ? field.note || field.help || field.pending : "";
    const status = Array.isArray(field) ? "warn" : field && typeof field === "object" ? field.status || "warn" : "warn";
    const editable = !!(field && typeof field === "object" && field.editable);
    const key = field && typeof field === "object" ? field.key || field.field || label : label;
    const placeholder = field && typeof field === "object" ? field.placeholder || field.text || field.summary || "" : "";
    const inputType = field && typeof field === "object" ? field.inputType || "" : "";
    const isUpload = inputType === "file";
    const help = note
      ? `<span class="focus-field-help ${escapeHtml(status)}" aria-label="${escapeHtml(note)}" title="${escapeHtml(note)}">!</span>`
      : "";
    const content = isUpload
      ? `<label class="focus-field-upload${text ? " has-file" : ""}"><input type="file" data-focus-field-file data-field-key="${escapeHtml(key)}" aria-label="${escapeHtml(label)}" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg" /><span>${escapeHtml(placeholder || "上传文件")}</span><em class="focus-upload-status">${escapeHtml(text ? `已上传：${text}` : field.emptyText || "未上传")}</em></label>`
      : editable
      ? `<input class="focus-field-input" type="text" data-focus-field-input data-field-key="${escapeHtml(key)}" aria-label="${escapeHtml(label)}" value="${escapeHtml(text || "")}" placeholder="${escapeHtml(placeholder)}" autocomplete="off" />`
      : `<div class="focus-field-content">${escapeHtml(text)}</div>`;
    return `<div class="focus-field-row${editable || isUpload ? " is-editable" : ""}${isUpload ? " is-upload" : ""}"><div class="focus-field-label">${help}<span>${escapeHtml(label)}</span></div>${content}</div>`;
  }

  function mapImpactRow(title, text) {
    return `<li><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></li>`;
  }

  function actionButton(action) {
    const [tone, label, type, value] = action;
    if (type === "candidate-action") {
      return `<button class="btn ${escapeHtml(tone)}" type="button" data-candidate-action="${escapeHtml(value)}" data-card-id="${escapeHtml(currentState.actionCardId || "candidate")}">${escapeHtml(label)}</button>`;
    }
    return `<button class="btn ${escapeHtml(tone)}" type="button" data-fill="${escapeHtml(value || label)}">${escapeHtml(label)}</button>`;
  }

  function taskVisualStatus(state = {}) {
    const explicit = String(state.taskVisualStatus || "");
    if (/^(done|warn|pending)$/.test(explicit)) return explicit;
    return "";
  }

  function taskStatusIcon(state = {}) {
    const tone = taskVisualStatus(state);
    if (!tone) return "";
    const label = tone === "done" ? "已完成" : tone === "warn" ? "未完成" : "待处理";
    const icon = tone === "done"
      ? `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.1 8.1 6.8 10.8 12 5.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      : tone === "warn"
        ? `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5 14 13H2L8 2.5Z" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/><path d="M8 6.2v3.2M8 11.3v.2" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/></svg>`
        : `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.35"/></svg>`;
    return `<span class="focus-task-status-icon ${escapeHtml(tone)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${icon}</span>`;
  }

  function packageRow(title, status, action) {
    const wait = /待|确认/.test(status) ? " wait" : "";
    return `<div class="focus-status-row"><strong>${escapeHtml(title)}</strong><span class="pill${wait}">${escapeHtml(status)}</span><button class="btn ai" type="button" data-fill="${escapeHtml(title + action)}">${escapeHtml(action)}</button></div>`;
  }

  function docxRows() {
    const api = window.XIAOBEI_DOCX_PREVIEW_LINKS_V1;
    const items = api && typeof api.getItems === "function" ? api.getItems() : [];
    if (!items.length) return "";
    return `<div class="focus-mini-title">文档预览稿</div>${items.map(item => `
      <div class="focus-status-row focus-docx-row">
        <strong>${escapeHtml(item.title)}</strong>
        <span class="pill wait">待最终确认</span>
        <a class="btn ai" target="_blank" rel="noopener" href="${escapeHtml(item.href)}">打开预览稿</a>
      </div>`).join("")}`;
  }

  function scheduleTable(rows) {
    if (!Array.isArray(rows) || !rows.length) return "";
    const headers = ["周次", "教学内容", "所属单元", "课时", "状态", "备注", "操作"];
    return `
      <section class="focus-schedule-section" aria-label="学期课务日程表">
        <div class="focus-mini-title">学期课务日程表</div>
        <div class="focus-schedule-table-wrap">
          <table class="focus-schedule-table">
            <thead><tr>${headers.map(item => `<th>${escapeHtml(item)}</th>`).join("")}</tr></thead>
            <tbody>${rows.map(row => `<tr>${headers.map((_, index) => `<td>${escapeHtml(row[index] || "")}</td>`).join("")}</tr>`).join("")}</tbody>
          </table>
        </div>
      </section>`;
  }

  function confirmationList(items) {
    if (!Array.isArray(items) || !items.length) return "";
    return `
      <section class="focus-confirm-section" aria-label="老师确认项">
        <div class="focus-mini-title">待确认项</div>
        <ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>`;
  }

  function workPlanSections(items) {
    if (!Array.isArray(items) || !items.length) return "";
    return `
      <section class="focus-plan-preview-section" aria-label="教学工作计划预览章节">
        <div class="focus-mini-title">教学工作计划预览</div>
        <p>先按工作计划常用结构生成样稿；正式报告会在确认年级、教材目录、校历周次和课时分配后补全。</p>
        <div class="focus-plan-section-grid">${items.map(item => {
          if (item && typeof item === "object" && !Array.isArray(item)) {
            return `<article class="focus-plan-section-item"><strong>${escapeHtml(item.title || "")}</strong><span>${escapeHtml(item.body || "")}</span></article>`;
          }
          return `<article class="focus-plan-section-item"><strong>${escapeHtml(item)}</strong></article>`;
        }).join("")}</div>
      </section>`;
  }

  function planningFieldRows(fields) {
    if (!Array.isArray(fields) || !fields.length) return "";
    return fields.map(item => {
      const label = item && typeof item === "object" ? item.label || item.field : Array.isArray(item) ? item[0] : item;
      const value = item && typeof item === "object" ? item.text || item.value || "" : Array.isArray(item) ? item[1] : "";
      const inputType = item && typeof item === "object" ? item.inputType || "" : "";
      const isUpload = inputType === "file";
      const key = item && typeof item === "object" ? item.key || item.field || label : label;
      const placeholder = item && typeof item === "object" ? item.placeholder || "" : "";
      const optional = !!(item && typeof item === "object" && item.required === false);
      const statusTone = value ? "done" : optional ? "optional" : "missing";
      const control = isUpload
        ? `<label class="planning-upload${value ? " has-file" : ""}"><input type="file" data-focus-field-file data-field-key="${escapeHtml(key)}" aria-label="${escapeHtml(label)}" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg" /><span>${escapeHtml(placeholder || "上传文件")}</span><em>${escapeHtml(value ? `已上传：${value}` : item.emptyText || "未上传")}</em></label>`
        : `<input class="planning-field-input" type="text" data-focus-field-input data-field-key="${escapeHtml(key)}" aria-label="${escapeHtml(label)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder || "待补充")}" autocomplete="off" />`;
      return `
        <div class="planning-field-item${value ? " is-filled" : ""}${optional ? " is-optional" : ""}" data-planning-field-status="${escapeHtml(statusTone)}">
          <div class="planning-field-meta">
            <span class="planning-field-dot" aria-label="${escapeHtml(statusTone)}"></span>
            <strong>${escapeHtml(label || "")}</strong>
          </div>
          ${control}
        </div>`;
    }).join("");
  }

  function planningWorkspace(state = {}, fields = []) {
    return `
          <section class="planning-basic-panel" aria-label="基础信息采集">
            <div class="planning-field-grid">${planningFieldRows(fields)}</div>
            ${state.demoControls ? planningDemoControls(state.demoStage) : ""}
          </section>`;
  }

  function planningReadinessBadge(fields = []) {
    const requiredFields = fields.filter(item => !(item && typeof item === "object" && item.required === false));
    const filledCount = requiredFields.filter(item => item && typeof item === "object" && (item.text || item.value)).length;
    const totalCount = requiredFields.length || 0;
    const missingCount = Math.max(0, totalCount - filledCount);
    const readinessTone = missingCount === 0 ? "done" : "missing";
    return `<span class="planning-readiness" data-readiness="${escapeHtml(readinessTone)}" aria-label="基础信息完成度"><strong>${escapeHtml(String(filledCount))}/${escapeHtml(String(totalCount))}</strong></span>`;
  }

  function planningDemoControls(activeStage) {
    const options = [
      ["empty", "未填"],
      ["filled", "已填"],
      ["preview", "预览"],
      ["review", "待确认"]
    ];
    const normalized = activeStage === "empty" || activeStage === "preview" || activeStage === "review" ? activeStage : "";
    return `
      <div class="planning-demo-controls" aria-label="教学规划状态演示">
        <span>演示</span>
        ${options.map(item => {
          const active = (item[0] === normalized) || (!normalized && item[0] === "filled");
          return `<button type="button" class="${active ? "active" : ""}" data-planning-demo-state="${escapeHtml(item[0])}">${escapeHtml(item[1])}</button>`;
        }).join("")}
      </div>`;
  }

  function planningPreviewReady(state = {}) {
    const stage = state.demoStage || "input";
    return stage === "preview"
      || stage === "review"
      || state.generatedPreviewSynced === true
      || state.generated_preview_synced === true
      || state.taskStatus === "模型候选已生成";
  }

  function planningPreviewDemo(state = {}) {
    const previewReady = planningPreviewReady(state);
    if (window.SHIWEI_RENDERER_PROTOCOL_V1 && typeof window.SHIWEI_RENDERER_PROTOCOL_V1.renderPlanningPreview === "function") {
      return window.SHIWEI_RENDERER_PROTOCOL_V1.renderPlanningPreview(state, selectedPlanningPreviewKey, previewReady);
    }
    const stage = state.demoStage || "input";
    const reviewReady = stage === "review";
    const items = previewReady
      ? [
        {
          title: "教学工作计划",
          key: "teaching_work_plan",
          status: reviewReady ? "待采纳" : "预览中",
          body: "",
          meta: "学期目标 / 教学进度 / 教学措施",
          action: reviewReady ? "采纳" : "打开预览"
        },
        {
          title: "课务日程表",
          key: "semester_schedule_table",
          status: reviewReady ? "已复核" : "预览中",
          body: "",
          meta: "周次 / 课题 / 活动周避让",
          action: "查看日程"
        },
        {
          title: "单元课时分配",
          key: "unit_lesson_allocation",
          status: reviewReady ? "可微调" : "待采纳",
          body: "",
          meta: "单元 / 课时 / 调整建议",
          action: "查看分配"
        },
        {
          title: "校历与活动周",
          key: "teaching_calendar_context",
          status: "待复核",
          body: "",
          meta: "创艺节 / 展示周 / 期末整理",
          action: "复核"
        }
      ]
      : [
        {
          title: "教学工作计划",
          key: "teaching_work_plan",
          status: "待生成",
          body: "",
          meta: "学情 / 目标 / 进度",
          action: "待生成"
        },
        {
          title: "课务日程表",
          key: "semester_schedule_table",
          status: "待生成",
          body: "",
          meta: "周次 / 课题 / 课时",
          action: "待生成"
        },
        {
          title: "单元课时分配",
          key: "unit_lesson_allocation",
          status: "可选关联",
          body: "",
          meta: "教材目录 / 知识库",
          action: "可选关联"
        },
        {
          title: "校历与活动周",
          key: "teaching_calendar_context",
          status: "待复核",
          body: "",
          meta: "活动周 / 假期 / 展示周",
          action: "待复核"
        }
      ];
    return `
      <section class="planning-render-zone" aria-label="教学规划资料目录">
        <div class="planning-render-card-grid">
          ${items.map(item => `
            <button class="planning-render-card${selectedPlanningPreviewKey === item.key ? " is-selected" : ""}" type="button" data-planning-preview-select="${escapeHtml(item.key)}" data-render-card-status="${escapeHtml(item.status)}">
              <strong>${escapeHtml(item.title)}</strong>
            </button>`).join("")}
        </div>
      </section>
      ${planningContentPreviewZone(state, previewReady)}`;
  }

  function planningContentPreviewZone(state = {}, previewReady = false) {
    if (window.SHIWEI_RENDERER_PROTOCOL_V1 && typeof window.SHIWEI_RENDERER_PROTOCOL_V1.buildPackets === "function" && typeof window.SHIWEI_RENDERER_PROTOCOL_V1.renderContentZone === "function") {
      const supportedTypes = Array.isArray(window.SHIWEI_RENDERER_PROTOCOL_V1.supportedDirectoryTypes)
        ? window.SHIWEI_RENDERER_PROTOCOL_V1.supportedDirectoryTypes
        : ["markdown_document", "schedule_table", "module_call"];
      const packets = window.SHIWEI_RENDERER_PROTOCOL_V1.buildPackets(state, previewReady)
        .filter(packet => packet.key !== "agent_status_stream" && supportedTypes.includes(packet.render_type));
      const activePacket = packets.find(packet => packet.key === (selectedPlanningPreviewKey || "teaching_work_plan")) || packets[0];
      return window.SHIWEI_RENDERER_PROTOCOL_V1.renderContentZone(activePacket);
    }
    const sections = Array.isArray(state.workPlanSections) ? state.workPlanSections : [];
    const activeKey = selectedPlanningPreviewKey || "teaching_work_plan";
    const status = previewReady ? "只读预览" : "结构占位";
    const contentMap = {
      teaching_work_plan: {
        title: "教学工作计划",
        eyebrow: status,
        body: sections.length
          ? `<article class="planning-md-document">${sections.map(item => `<h4>${escapeHtml(item.title || "")}</h4><p>${escapeHtml(item.body || "")}</p>`).join("")}</article>`
          : `<article class="planning-md-document"><h4>等待生成</h4><p>补齐基础信息后，小备会把教学目标、学情分析、教学措施和进度安排整理到这里。</p></article>`
      },
      semester_schedule_table: {
        title: "课务日程表",
        eyebrow: previewReady ? "候选日程" : "待生成",
        body: planningSchedulePreviewTable(state, previewReady)
      },
      unit_lesson_allocation: {
        title: "单元课时分配",
        eyebrow: previewReady ? "候选分配" : "可选关联",
        body: planningUnitAllocationPreview(state, previewReady)
      },
      teaching_calendar_context: {
        title: "校历与活动周",
        eyebrow: "待老师确认",
        body: planningCalendarContextPreview(state, previewReady)
      }
    };
    const active = contentMap[activeKey] || contentMap.teaching_work_plan;
    return `
      <section class="planning-content-preview-zone" data-planning-content-preview="0992K" aria-label="生成内容预览区">
        <div class="planning-content-preview-head">
          <div><strong>生成内容预览区</strong><span>${escapeHtml(active.title)}</span></div>
          <em>${escapeHtml(active.eyebrow)}</em>
        </div>
        <div class="planning-content-preview-body planning-md-renderer">${active.body}</div>
      </section>`;
  }

  function updatePlanningContentPreview(key) {
    selectedPlanningPreviewKey = key || "teaching_work_plan";
    const zone = document.querySelector("[data-planning-content-preview=\"0992K\"]");
    const renderZone = document.querySelector(".planning-render-zone");
    if (!zone || !renderZone) {
      setFocusTask("semesterSchedule");
      return;
    }
    const state = { ...stateFor("semesterSchedule") };
    const previewReady = planningPreviewReady(state);
    const fresh = planningContentPreviewZone(state, previewReady);
    zone.outerHTML = fresh;
    renderZone.querySelectorAll("[data-planning-preview-select]").forEach(button => {
      button.classList.toggle("is-selected", button.getAttribute("data-planning-preview-select") === selectedPlanningPreviewKey);
    });
    const nextZone = document.querySelector("[data-planning-content-preview=\"0992K\"]");
    if (nextZone) nextZone.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function planningSchedulePreviewTable(state = {}, previewReady = false) {
    const sourceRows = Array.isArray(state.scheduleRows) ? state.scheduleRows : [];
    const rows = previewReady && sourceRows.length
      ? sourceRows.map(row => [
        row[0] || "待定",
        row[1] || "待确认内容",
        row[2] || "待确认单元",
        row[3] || "待定",
        row[5] || row[4] || "待老师确认"
      ])
      : [["待生成", "等待基础信息", "待定", "待定", "日期不自动定稿"]];
    return `
      <table class="planning-content-table">
        <thead><tr><th>周次</th><th>内容</th><th>单元</th><th>课时</th><th>备注</th></tr></thead>
        <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>`;
  }

  function planningUnitAllocationPreview(state = {}, previewReady = false) {
    const units = previewReady && Array.isArray(state.unitLessonAllocation) && state.unitLessonAllocation.length
      ? state.unitLessonAllocation
      : [
        ["教材目录", "待补充或待关联知识库", "可选"],
        ["进度细化", "生成后由老师复核", "待确认"]
      ];
    return `
      <article class="planning-md-document">
        <h4>单元课时分配候选</h4>
        <ul>${units.map(item => `<li><strong>${escapeHtml(item[0])}</strong>：${escapeHtml(item[1])} <em>${escapeHtml(item[2])}</em></li>`).join("")}</ul>
      </article>`;
  }

  function planningCalendarContextPreview(state = {}, previewReady = false) {
    const fields = Array.isArray(state.fields) ? state.fields : [];
    const activityField = fields.find(item => item && item.key === "activityWeeks");
    const activity = (activityField && (activityField.text || activityField.value)) || "活动周待补充";
    return `
      <article class="planning-md-document">
        <h4>日期规则</h4>
        <p>当前日期只能帮助判断学年或学期提示，不能直接定稿校历。正式课务日期需要老师确认校历、活动周和考试周。</p>
        <p><strong>活动周候选：</strong>${escapeHtml(activity)}</p>
      </article>`;
  }

  function prepMapSteps(state = {}) {
    const source = Array.isArray(state.prepMap) && state.prepMap.length
      ? state.prepMap
      : [
        ["业务选择", "done", "课堂设计"],
        [state.currentStage || "新课设计", "current", "进行中"],
        ["模板方案", "pending", "待确认"],
        ["字段补充", "pending", "待补充"],
        ["候选修改", "pending", "待处理"],
        ["成果预览", "pending", "待处理"]
      ];
    return source.map(item => {
      const label = Array.isArray(item) ? item[0] : item.label;
      const status = Array.isArray(item) ? item[1] : item.status;
      const note = label === "字段补充" ? "待补充" : (Array.isArray(item) ? item[2] : item.note);
      const normalized = /done|current|pending/.test(String(status || "")) ? String(status) : "pending";
      return `<span class="focus-map-step ${escapeHtml(normalized)}" data-status="${escapeHtml(normalized)}" aria-label="${escapeHtml(`${label || ""}：${note || normalized}`)}"><strong>${escapeHtml(label || "")}</strong></span>`;
    }).join("");
  }

  function prepMapSection(state = {}, className = "") {
    return `
      <section class="focus-prep-map focus-prep-map-head ${escapeHtml(className)}" data-context-render-slot="0980D" data-render-slot-kind="workflow_secondary_menu_progress" aria-label="当前业务渲染区和进度条栏">
        <div class="focus-render-slot-label"><span>${escapeHtml(state.workflowLabel || "课堂设计")} / ${escapeHtml(state.currentStage || "新课设计")}</span><em>${escapeHtml(state.nextStep || "等待老师确认下一步")}</em></div>
        <div class="focus-map-track">${prepMapSteps(state)}</div>
      </section>`;
  }

  function stageThinkingStrip(state = {}) {
    if (!state.agentThinkingPreviewVisible) return "";
    const text = state.demoStage === "preview"
      ? "小备正在复核校历周次、活动周和课务日程候选..."
        : state.demoStage === "review"
        ? "小备正在等待老师确认，后续可继续调整工作计划预览..."
        : state.statusAction && state.statusAction.ready
          ? "小备已拿到基础信息，准备生成教学工作计划预览..."
          : "小备正在等待基础信息，并会根据老师输入继续追问。";
    return `
      <section class="stage-thinking-strip" data-agent-thinking-preview="0980K" aria-label="Agent 思考等待条">
        <div class="stage-thinking-pulse" aria-hidden="true"><i></i></div>
        <p>${escapeHtml(text)}</p>
      </section>`;
  }

  function resultPreview(state = {}) {
    if (!state.resultFirst) return "";
    return `
            <section class="focus-result-preview" aria-label="结果预览">
              <div class="focus-result-label">${escapeHtml(state.resultLabel || "结果预览")}</div>
              <p>${escapeHtml(state.resultText || "")}</p>
            </section>`;
  }

  function componentSwitcher() {
    const options = COMPONENT_NAV_ITEMS.map(item => {
      const key = item[0];
      const label = item[1];
      const selected = normalizeCardId(key) === normalizeCardId(currentFocusKey) ? " selected" : "";
      return `<option value="${escapeHtml(key)}"${selected}>${escapeHtml(label)}</option>`;
    }).join("");
    return `
      <section class="focus-component-switcher" data-workbench-task-list-menu="0980D" aria-label="教学业务置顶菜单">
        <select class="focus-component-select" data-focus-component-select aria-label="切换任务">${options}</select>
      </section>`;
  }

  function statusControl(state = {}) {
    const action = state.statusAction;
    if (!action) return `<span class="pill wait">${escapeHtml(state.taskStatus)}</span>`;
    const ready = !!action.ready;
    const label = action.label || state.taskStatus || "等待协商";
    const hint = action.hint || "";
    if (action.agentOnly) {
      return `<span class="pill wait focus-status-action${ready ? " is-ready" : " is-waiting"}" title="${escapeHtml(hint)}" aria-label="${escapeHtml(label)}">${escapeHtml(label)}</span>`;
    }
    return `<button class="pill wait focus-status-action${ready ? " is-ready" : " is-waiting"}" type="button" data-focus-status-action="${ready ? "generate" : "wait"}" data-fill="${escapeHtml(action.prompt || "")}" title="${escapeHtml(hint)}" aria-label="${escapeHtml(label)}"${ready ? "" : " disabled"}>${escapeHtml(label)}</button>`;
  }

  function html() {
    const state = currentState;
    const componentName = componentNameForState(state);
    const fields = Array.isArray(state.fields) ? state.fields : BASE_STATE.fields;
    const impacts = Array.isArray(state.impacts) ? state.impacts : BASE_STATE.impacts;
    const actions = Array.isArray(state.actions) ? state.actions : BASE_STATE.actions;
    const statusIcon = taskStatusIcon(state);
    const componentLabel = state.hideComponentName ? "" : `<span class="focus-component-name">${escapeHtml(componentName)}</span>`;
    const intro = state.hideIntro ? "" : `<p class="focus-intro">${escapeHtml(state.intro)}</p>`;
    const isPlanningLayout = state.layout === "teachingPlanning" || normalizeCardId(currentFocusKey) === "semesterSchedule";
    const readinessBadge = isPlanningLayout ? planningReadinessBadge(fields) : "";
    const packageFold = isPlanningLayout
      ? planningPreviewDemo(state)
      : `<details class="focus-package-fold" data-focus-package-fold>
          <summary><span>预览状态</span><strong>当前内容仍是预览 · 确认前不进入正式输出</strong><em>展开预览详情</em></summary>
          <div class="focus-package-note">学生任务单、评价建议或工作计划仍待老师确认。</div>
          <div class="focus-status-list">${packageRows.map(item => packageRow(item[0], item[1], item[2])).join("")}</div>
          <div class="focus-docx-list">${docxRows()}</div>
          <div class="focus-action-row focus-package-actions">
            <button class="btn ai" type="button" data-focus-package="true">查看预览详情</button>
            <button class="btn primary" type="button" data-export-record-preview="true">生成预览记录</button>
          </div>
        </details>`;
    return `
      <div class="focus-workspace-shell">
        <div class="component-head focus-head focus-head-compact">
          <div class="focus-head-title${statusIcon ? " has-status-icon" : ""}">${statusIcon}<div class="focus-head-copy">${componentLabel}<h3>${escapeHtml(state.taskTitle)}</h3></div></div>
          <div class="focus-head-controls">${readinessBadge}${statusControl(state)}</div>
        </div>
        ${isPlanningLayout ? planningWorkspace(state, fields, impacts) : `<div class="focus-task-layout">
          <div class="focus-primary-panel">
            ${intro}
            ${resultPreview(state)}
            <section class="focus-main-task" aria-label="当前组件字段">
              ${fields.map(item => fieldRow(item)).join("")}
              ${actions.length ? `<div class="focus-action-row">${actions.map(actionButton).join("")}</div>` : ""}
            </section>
            ${scheduleTable(state.scheduleRows)}
            ${confirmationList(state.confirmations)}
            ${workPlanSections(state.workPlanSections)}
          </div>
          <section class="focus-impact focus-impact-inline" aria-label="可能影响">
            <div class="focus-mini-title">可能影响</div>
            <ul class="focus-side-impact">${impacts.map(item => mapImpactRow(item[0], item[1])).join("")}</ul>
          </section>
        </div>`}
        ${packageFold}
      </div>`;
  }

  function progressDetail() {
    return {
      topic: currentState.taskTitle || "当前备课",
      stage: currentState.currentStage || "活动设计",
      pending: currentState.pendingItems || "活动二、学生任务单、评价证据",
      nextStep: currentState.nextStep || "确认下一步操作",
      title: currentState.taskTitle,
      componentName: componentNameForState(currentState),
      status: currentState.taskStatus
    };
  }

  function componentNameForState(state = {}) {
    return state.componentName || state.taskTitle || "教学业务入口";
  }

  function updateStageTitle() {
    const title = document.getElementById("stageTitle");
    if (title) title.textContent = "当前业务";
    const meta = document.querySelector(".doc-workspace-meta");
    if (meta) {
      meta.textContent = "";
      meta.hidden = true;
    }
    syncStageHeadTools();
  }

  function syncStageHeadTools() {
    const head = document.querySelector(".doc-workspace-head") || document.querySelector(".stage-head");
    if (!head) return;
    const title = document.getElementById("stageTitle");
    const titleBlock = title && title.parentElement;
    if (titleBlock) {
      const oldSwitcher = titleBlock.querySelector(".focus-component-switcher");
      if (oldSwitcher) oldSwitcher.remove();
      const oldInline = titleBlock.querySelector(".focus-render-slot-label");
      if (oldInline) oldInline.remove();
    }
    const actions = head.querySelector(".stage-actions");
    if (actions) {
      const oldMap = actions.querySelector(".focus-stage-map");
      if (oldMap) oldMap.remove();
      const oldThinking = actions.querySelector(".stage-thinking-strip");
      if (oldThinking) oldThinking.remove();
      actions.insertAdjacentHTML("afterbegin", prepMapSection(currentState, "focus-stage-map"));
      const newMap = actions.querySelector(".focus-stage-map");
      const label = newMap && newMap.querySelector(".focus-render-slot-label");
      if (titleBlock && label) titleBlock.appendChild(label);
      const afterMap = actions.querySelector(".focus-stage-map");
      if (afterMap) {
        const thinkingHtml = stageThinkingStrip(currentState);
        if (thinkingHtml) afterMap.insertAdjacentHTML("afterend", thinkingHtml);
      }
    }
  }

  function refreshStatusControl() {
    currentState = { ...stateFor(currentFocusKey) };
    const head = document.querySelector(".focus-workspace-card .focus-head");
    if (!head) return;
    const old = head.querySelector("[data-focus-status-action], .pill.wait");
    if (old) old.outerHTML = statusControl(currentState);
    syncStageHeadTools();
    dispatchFocusChanged();
  }

  function updateEditableField(input) {
    const api = window.XIAOBEI_SEMESTER_SCHEDULE_PLANNING_V1;
    const key = input && input.getAttribute("data-field-key");
    if (!api || typeof api.updateField !== "function" || !key) return;
    api.updateField(key, input.value || "");
    refreshStatusControl();
    if (normalizeCardId(currentFocusKey) === "semesterSchedule") {
      setFocusTask("semesterSchedule");
      const freshInput = document.querySelector(`[data-focus-field-input][data-field-key="${CSS.escape(key)}"]`);
      if (freshInput) {
        freshInput.focus();
        const length = freshInput.value.length;
        freshInput.setSelectionRange(length, length);
      }
    }
  }

  function updateUploadField(input) {
    const api = window.XIAOBEI_SEMESTER_SCHEDULE_PLANNING_V1;
    const key = input && input.getAttribute("data-field-key");
    const file = input && input.files && input.files[0];
    if (!api || typeof api.markUploaded !== "function" || !key || !file) return;
    const result = api.markUploaded(key, file.name || "");
    const wrapper = input.closest(".focus-field-upload");
    if (wrapper) {
      wrapper.classList.add("has-file");
      const status = wrapper.querySelector(".focus-upload-status");
      if (status) status.textContent = `已上传：${file.name || "教材目录"}`;
    }
    refreshStatusControl();
    window.dispatchEvent(new CustomEvent("xiaobei:semester-field-uploaded", {
      detail: {
        key,
        label: "教材目录",
        fileName: file.name || "教材目录",
        result
      }
    }));
  }

  function runStatusAction(button) {
    if (!button || button.disabled) {
      const firstEmpty = document.querySelector(".focus-field-input:not([value]), .focus-field-input:placeholder-shown");
      if (firstEmpty) firstEmpty.focus();
      return;
    }
    const prompt = button.getAttribute("data-fill") || "";
    if (window.XiaobeiLeftChatLayout && typeof window.XiaobeiLeftChatLayout.setFill === "function") {
      window.XiaobeiLeftChatLayout.setFill(prompt);
    }
    const send = document.getElementById("sendBtn");
    if (send) send.click();
  }

  function dispatchFocusChanged() {
    window.dispatchEvent(new CustomEvent("xiaobei:workbench-focus-changed", { detail: progressDetail() }));
  }

  function syncPrimaryNavForFocus() {
    const focusToOpen = {
      semesterSchedule: "planning",
      candidate: "lesson",
      lessonBrief: "lesson",
      unitBrief: "lesson",
      activityRefine: "lesson",
      taskSheet: "implementation",
      resources: "resources",
      impact: "evaluation"
    };
    const openKey = focusToOpen[currentFocusKey];
    if (!openKey) return;
    const active = document.querySelector(`[data-open="${openKey}"]`);
    if (active) {
      document.querySelectorAll(".nav-tab").forEach(tab => tab.classList.toggle("active", tab === active));
      const statusChip = document.querySelector('[data-workbench-task-status="0980D"]');
      if (statusChip) statusChip.textContent = `当前：${active.textContent.trim()}`;
    }
  }

  function ensureFocusCard() {
    const host = grid();
    if (!host) return null;
    host.classList.add("focus-workspace-grid");
    let card = host.querySelector('[data-card="focusWorkspace"]');
    if (!card) {
      card = document.createElement("article");
      card.dataset.card = "focusWorkspace";
      host.prepend(card);
    }
    card.className = "component featured focus-workspace-card focus-visible";
    card.innerHTML = html();
    updateStageTitle();
    syncPrimaryNavForFocus();
    dispatchFocusChanged();
    return card;
  }

  function setFocusTask(cardId, override = {}) {
    currentFocusKey = normalizeCardId(cardId);
    currentState = { ...stateFor(cardId), ...override };
    ensureFocusCard();
    return currentState;
  }

  function syncFromCard(cardId) {
    return setFocusTask(cardId);
  }

  function syncFromUpdate(update = {}) {
    const cardId = normalizeCardId(update.card_id);
    if (cardId === "semesterSchedule") {
      const api = window.XIAOBEI_SEMESTER_SCHEDULE_PLANNING_V1;
      const semanticState = update.semester_schedule_state && typeof update.semester_schedule_state === "object"
        ? update.semester_schedule_state
        : null;
      if (api && semanticState && typeof api.syncBackendState === "function") {
        api.syncBackendState(semanticState);
      }
      return setFocusTask("semesterSchedule");
    }
    const targets = Array.isArray(update.impact_targets) ? update.impact_targets : [];
    const override = {
      componentName: update.teacher_title || stateFor(cardId).componentName,
      taskTitle: update.teacher_title || stateFor(cardId).taskTitle,
      taskStatus: update.status ? "待老师确认" : stateFor(cardId).taskStatus,
      intro: update.teacher_summary || stateFor(cardId).intro
    };
    if (update.candidate_text) override.candidateText = update.candidate_text;
    if (Array.isArray(update.field_rows) && update.field_rows.length) {
      override.fields = update.field_rows.map(row => [String(row.field || ""), String(row.value || row.summary || row.status || "等待老师确认")]);
      override.pendingItems = update.field_rows.map(row => String(row.field || "")).filter(Boolean).join("、");
      override.currentStage = /大单元|课时/.test(update.teacher_title || "") ? "大单元预览" : stateFor(cardId).currentStage;
      override.nextStep = cardId === "unitBrief" ? "进入课时部分，拆第1课时、第2课时、第3课时" : "确认关键字段后继续处理";
      if (cardId === "unitBrief") override.resultFirst = true;
    }
    const recommended = Array.isArray(update.recommended_teacher_actions) ? update.recommended_teacher_actions : [];
    if (recommended.length) {
      override.actions = recommended.map((item, index) => [
        index === 0 ? "primary" : index === 1 ? "ai" : "ghost",
        String(item.label || ""),
        "fill",
        String(item.fill || item.label || "")
      ]);
    } else if (cardId === "unitBrief") {
      override.actions = [
        ["primary", "进入课时部分", "fill", "进入课时部分，先拆第1课时、第2课时、第3课时的课时组件"],
        ["ai", "修改某个字段", "fill", "我想修改大观念/基本问题/三课时安排中的一个字段"],
        ["ghost", "重新生成某个字段", "fill", "请重新生成大观念，其他字段先保留"]
      ];
    }
    if (update.status === "preview") {
      override.taskStatus = "已放入本次备课预览";
      override.resultFirst = cardId === "unitBrief" ? true : override.resultFirst;
      override.resultLabel = cardId === "unitBrief" ? "大单元概要" : override.resultLabel;
      override.resultText = cardId === "unitBrief"
        ? (override.candidateText || override.intro || "当前只是本次备课预览，确认前不会进入最终成果包。")
        : override.resultText;
    }
    if (targets.length) {
      override.impacts = targets.map(target => [String(target), "确认前不会进入最终成果包。", `继续处理${target}`]);
      if (!override.pendingItems) override.pendingItems = targets.join("、");
    }
    return setFocusTask(cardId, override);
  }

  function applyLayout() {
    const app = document.querySelector(".app") || document.body;
    app.classList.add("focus-workspace-layout");
    document.querySelectorAll(".layout-mode-switch,.ui-mode-switch,.layout-note,.layout-node-strip").forEach(node => {
      node.classList.add("debug-only");
      node.setAttribute("aria-hidden", "true");
    });
    ensureFocusCard();
  }

  function bind() {
    window.addEventListener("shiwei:teaching-work-plan-render-packet-bundle-ready", () => {
      if (normalizeCardId(currentFocusKey) === "semesterSchedule") {
        setFocusTask("semesterSchedule");
      }
    });
    document.addEventListener("click", event => {
      const statusAction = event.target.closest("[data-focus-status-action]");
      if (statusAction) {
        runStatusAction(statusAction);
        return;
      }
      const packageButton = event.target.closest("[data-focus-package]");
      if (packageButton) {
        const fold = document.querySelector("[data-focus-package-fold]");
        if (fold) {
          fold.open = true;
          fold.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
      const demoButton = event.target.closest("[data-planning-demo-state]");
      if (demoButton) {
        const api = window.XIAOBEI_SEMESTER_SCHEDULE_PLANNING_V1;
        if (api && typeof api.setDemoState === "function") {
          api.setDemoState(demoButton.getAttribute("data-planning-demo-state") || "filled");
          setFocusTask("semesterSchedule");
        }
        return;
      }
      const previewButton = event.target.closest("[data-planning-preview-select]");
      if (previewButton) {
        updatePlanningContentPreview(previewButton.getAttribute("data-planning-preview-select") || "teaching_work_plan");
        return;
      }
      const componentButton = event.target.closest("[data-focus-component]");
      if (componentButton) {
        setFocusTask(componentButton.getAttribute("data-focus-component") || "tasks");
        return;
      }
      const button = event.target.closest("button[data-fill]");
      if (button && window.XiaobeiLeftChatLayout && typeof window.XiaobeiLeftChatLayout.setFill === "function") {
        window.XiaobeiLeftChatLayout.setFill(button.getAttribute("data-fill") || button.textContent.trim());
      }
    });
    document.addEventListener("change", event => {
      const componentSelect = event.target.closest("[data-focus-component-select]");
      if (componentSelect) {
        setFocusTask(componentSelect.value || "tasks");
      }
      const fieldInput = event.target.closest("[data-focus-field-input]");
      if (fieldInput) updateEditableField(fieldInput);
      const fileInput = event.target.closest("[data-focus-field-file]");
      if (fileInput) updateUploadField(fileInput);
    });
    document.addEventListener("input", event => {
      const fieldInput = event.target.closest("[data-focus-field-input]");
      if (fieldInput) updateEditableField(fieldInput);
    });
  }

  ready(() => {
    applyLayout();
    bind();
    window.setTimeout(applyLayout, 50);
    window.setTimeout(applyLayout, 250);
  });

  window.XIAOBEI_FOCUS_WORKSPACE_V1 = {
    applyLayout,
    ensureFocusCard,
    setFocusTask,
    syncFromCard,
    syncFromUpdate,
    progressDetail
  };
})();
