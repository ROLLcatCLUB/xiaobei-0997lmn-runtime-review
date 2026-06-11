(function () {
  "use strict";

  const STAGE_ID = "0996D_TEACHING_PLANNING_SYSTEM_VISUALS_REALTIME_BINDING";
  const SEMESTER_START = "2026-03-02";

  const weekRows = [
    ["第1周", "开学第一课：美术世界，我来了！", "开学", "2", "周四、周五，待校历复核", "review"],
    ["第2周", "第一单元第1课 画中的生活", "第一单元", "2", "记录生活", "planned"],
    ["第3周", "第一单元第2课 流淌的情感", "第一单元", "2", "记录生活", "planned"],
    ["第4周", "第二单元第1课 色彩的渐变", "第二单元", "2", "多彩的世界", "planned"],
    ["第5周", "第二单元第2课 渐变的节奏", "第二单元", "2", "清明节需复核", "review"],
    ["第6周", "第二单元第3课 多彩的生活", "第二单元", "2", "多彩的世界", "planned"],
    ["第7周", "第三单元第1课 奇异的海洋生物", "第三单元", "2", "辽阔的海洋", "planned"],
    ["第8周", "第三单元第2课 跳动的蓝色心脏", "第三单元", "2", "辽阔的海洋", "planned"],
    ["第9周", "第三单元第3课 守护生命的摇篮", "第三单元", "2", "劳动节需复核", "review"],
    ["第10周", "青绿中国色", "特别主题", "2", "创艺节开始", "activity"],
    ["第11周", "创艺节活动", "创艺节", "2", "活动周", "activity"],
    ["第12周", "创艺节活动", "创艺节", "2", "活动周", "activity"],
    ["第13周", "创艺节活动", "创艺节", "2", "活动周", "activity"],
    ["第14周", "第五单元 足下生辉（3课整合）", "第五单元", "2", "儿童节需复核", "review"],
    ["第15周", "第六单元 装点生活（2课）", "第六单元", "2", "纹样与生活", "planned"],
    ["第16周", "第七单元 虎虎生威（2课）", "第七单元", "2", "期末前复核", "review"]
  ];

  const calendarEvents = [
    ["2026-06-08", "周一", "08:30", "09:10", "作品展示准备", "展陈说明", "teaching", "preview"],
    ["2026-06-10", "周三", "08:30", "09:10", "线描装饰画", "当前日期示例课务", "teaching", "current"],
    ["2026-06-10", "周三", "14:30", "16:00", "校本培训", "教学环节复盘", "meeting", "review"],
    ["2026-06-11", "周四", "14:00", "15:20", "创艺节公开展示", "需确认场地", "activity", "review"],
    ["2026-06-12", "周五", "10:20", "11:00", "六年级美术", "毕业作品指导", "teaching", "current"],
    ["2026-06-13", "周六", "09:00", "11:30", "校园美术作品展布置", "布展与布置", "activity", "pending"]
  ];

  const timetableSlots = [
    ["周一", "第1节", "三年级美术", "三(2)班", "美术教室"],
    ["周一", "第3节", "四年级美术", "四(1)班", "美术教室"],
    ["周二", "第2节", "二年级美术", "二(3)班", "美术教室"],
    ["周二", "第5节", "美术兴趣小组", "社团", "创作室"],
    ["周三", "第1节", "三年级美术", "三(1)班", "美术教室"],
    ["周三", "第4节", "教研备课", "美术组", "教研室"],
    ["周四", "第2节", "公开课展示", "四(2)班", "录播室"],
    ["周五", "第1节", "六年级美术", "六(1)班", "美术教室"],
    ["周五", "第6节", "作品整理", "全校", "展厅"]
  ];

  const unitMindmap = [
    ["第一单元 记录生活", [
      ["第1课时 画中的生活", "观察生活场景，提取人物、环境和情绪线索"],
      ["第2课时 流淌的情感", "用线条、色彩和构图表达生活记忆"]
    ]],
    ["第二单元 多彩的世界", [
      ["第1课时 色彩的渐变", "认识渐变色并组织画面"],
      ["第2课时 渐变的节奏", "把渐变规律用于装饰纹样"],
      ["第3课时 多彩的生活", "完成生活色彩节奏作品"]
    ]],
    ["第三单元 辽阔的海洋", [
      ["第1课时 奇异的海洋生物", "观察形态并进行想象设计"],
      ["第2课时 跳动的蓝色心脏", "用蓝色系组织海洋主题画面"],
      ["第3课时 守护生命的摇篮", "结合环保主题完成表达说明"]
    ]],
    ["创艺节主题 青绿中国色", [
      ["第1课时 青绿色彩采集", "从传统色和校园场景中采集色彩"],
      ["第2课时 水墨与肌理实验", "用水墨、拼贴或拓印形成青绿肌理"],
      ["第3课时 作品制作", "完成创艺节展示作品主体"],
      ["第4课时 展示与调整", "根据展陈空间修改说明文字和细节"]
    ]]
  ];

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));
  }

  function parseDateKey(key) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ""));
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function todayDate() {
    const params = new URLSearchParams(window.location.search);
    return parseDateKey(params.get("demoDate")) || new Date();
  }

  function weekdayName(date) {
    return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
  }

  function mondayOf(date) {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() - ((next.getDay() + 6) % 7));
    return next;
  }

  function addDays(date, count) {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() + count);
    return next;
  }

  function semesterWeek() {
    const start = parseDateKey(SEMESTER_START);
    const diff = Math.floor((mondayOf(todayDate()) - mondayOf(start)) / 86400000);
    return Math.max(1, Math.floor(diff / 7) + 1);
  }

  function realtimeStrip() {
    const today = todayDate();
    return `<div class="shiwei-realtime-strip" data-system-realtime-binding-0996d><span>今天 ${escapeHtml(dateKey(today))} · ${escapeHtml(weekdayName(today))}</span><strong>第 ${escapeHtml(semesterWeek())} 教学周</strong><em>只读时间绑定</em></div>`;
  }

  function shouldSkipSystemVisuals() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      return Boolean(params.get("teaching_planning_model_api_base"))
        || params.get("structured_patch") === "0997T"
        || /0997V/i.test(String(params.get("v") || ""));
    } catch (_) {
      return false;
    }
  }

  function packetBase(partial) {
    return {
      source_stage: STAGE_ID,
      source_ids: ["workbench_teaching_planning_system_visuals_0996D"],
      status: "preview",
      theme: "teacher_planner",
      allowed_actions: ["review"],
      safety: {
        raw_html_allowed: false,
        provider_raw_stream_allowed: false,
        teacher_confirmation_required: true
      },
      ...partial
    };
  }

  function buildPackets(state = {}, previewReady = false) {
    const oldSections = Array.isArray(state.workPlanSections) ? state.workPlanSections : [];
    return [
      packetBase({
        packet_id: "rp_0996D_teaching_work_plan",
        render_type: "markdown_document",
        key: "teaching_work_plan",
        title: "教学工作计划",
        directory_status: previewReady ? "预览中" : "待生成",
        payload: {
          markdown: oldSections.map(item => `### ${item.title || ""}\n\n${item.body || ""}`).join("\n\n") || "### 等待生成\n\n补齐基础信息后生成教学工作计划。"
        }
      }),
      packetBase({
        packet_id: "rp_0996D_semester_week_calendar",
        render_type: "module_call",
        key: "teaching_week_timeline",
        title: "学期周历表",
        directory_status: "当前周高亮",
        component_role: "EventCalendar",
        payload: {
          module_id: "renderSemesterWeekAgenda0996D",
          module_payload: { rows: weekRows, current_week: semesterWeek() }
        }
      }),
      packetBase({
        packet_id: "rp_0996D_course_schedule_calendar",
        render_type: "module_call",
        key: "semester_schedule_table",
        title: "课务日程表",
        directory_status: "月历/周历",
        component_role: "Schedule-X",
        payload: {
          module_id: "renderScheduleXMonth0996D",
          module_payload: { events: calendarEvents, today: dateKey(todayDate()) }
        }
      }),
      packetBase({
        packet_id: "rp_0996D_unit_lesson_mindmap",
        render_type: "module_call",
        key: "unit_lesson_allocation",
        title: "单元课时分配",
        directory_status: "思维导图",
        component_role: "Markmap",
        payload: {
          module_id: "renderUnitLessonMindmap0996D",
          module_payload: { units: unitMindmap }
        }
      }),
      packetBase({
        packet_id: "rp_0996D_teacher_timetable",
        render_type: "module_call",
        key: "teacher_timetable",
        title: "课表",
        directory_status: "课表候选",
        component_role: "React Big Calendar",
        payload: {
          module_id: "renderTeacherTimetable0996D",
          module_payload: { slots: timetableSlots, today_weekday: weekdayName(todayDate()) }
        }
      }),
      packetBase({
        packet_id: "rp_0996D_status_stream",
        render_type: "status_stream",
        key: "agent_status_stream",
        title: "小备思考状态",
        directory_status: "运行态",
        payload: {
          pulse_color: "orange",
          message: "小备已把教学规划接入正式工作台渲染区，并按当前日期标记今天和教学周。"
        }
      })
    ];
  }

  function renderMonth(packet) {
    const payload = packet.payload && packet.payload.module_payload ? packet.payload.module_payload : {};
    const today = parseDateKey(payload.today) || todayDate();
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    const first = new Date(y, m - 1, 1);
    const leading = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m, 0).getDate();
    const total = Math.ceil((leading + daysInMonth) / 7) * 7;
    const events = Array.isArray(payload.events) ? payload.events : [];
    const todayKey = dateKey(today);
    const weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
    return `${realtimeStrip()}<div class="shiwei-month-calendar" data-render-type="module_call" data-module-id="renderScheduleXMonth0996D"><div class="shiwei-month-head">${escapeHtml(y)}年${escapeHtml(m)}月 · Schedule-X 月历候选</div><div class="shiwei-month-weekdays">${weekdays.map(day => `<span>${escapeHtml(day)}</span>`).join("")}</div><div class="shiwei-month-board">${Array.from({ length: total }, (_, index) => {
      const dayNo = index - leading + 1;
      const inMonth = dayNo >= 1 && dayNo <= daysInMonth;
      const key = inMonth ? `${y}-${String(m).padStart(2, "0")}-${String(dayNo).padStart(2, "0")}` : "";
      const items = events.filter(item => item[0] === key);
      return `<article class="shiwei-month-day${inMonth ? "" : " is-empty"}${key === todayKey ? " is-today" : ""}"><time>${inMonth ? dayNo : ""}</time>${items.slice(0, 3).map(item => `<div class="shiwei-calendar-chip is-${escapeHtml(item[7] || "")}"><b>${escapeHtml(item[4])}</b><span>${escapeHtml(item[2])}-${escapeHtml(item[3])}</span></div>`).join("")}</article>`;
    }).join("")}</div></div>`;
  }

  function renderWeekScheduler(packet) {
    const payload = packet.payload && packet.payload.module_payload ? packet.payload.module_payload : {};
    const events = Array.isArray(payload.events) ? payload.events : calendarEvents;
    const today = todayDate();
    const start = mondayOf(today);
    const weekdays = Array.from({ length: 7 }, (_, index) => addDays(start, index));
    const hours = ["08", "09", "10", "11", "14", "15", "16"];
    return `${realtimeStrip()}<div class="shiwei-week-scheduler" data-render-type="module_call" data-module-id="renderEventCalendarWeek0996D"><div class="shiwei-week-grid"><div class="shiwei-week-head">时间</div>${weekdays.map(day => `<div class="shiwei-week-head${dateKey(day) === dateKey(today) ? " is-today" : ""}">${escapeHtml(weekdayName(day))}<br>${escapeHtml(String(day.getMonth() + 1))}/${escapeHtml(String(day.getDate()))}</div>`).join("")}${hours.map(hour => `<div class="shiwei-week-time">${escapeHtml(hour)}:00</div>${weekdays.map(day => {
      const key = dateKey(day);
      const item = events.find(event => event[0] === key && String(event[2]).startsWith(hour));
      return `<div class="shiwei-week-lane${key === dateKey(today) ? " is-today" : ""}">${item ? `<article class="shiwei-week-event is-${escapeHtml(item[7] || "")}"><b>${escapeHtml(item[2])}-${escapeHtml(item[3])}</b><span>${escapeHtml(item[4])}</span></article>` : ""}</div>`;
    }).join("")}`).join("")}</div></div>`;
  }

  function renderSemesterWeekAgenda(packet) {
    const payload = packet.payload && packet.payload.module_payload ? packet.payload.module_payload : {};
    const rows = Array.isArray(payload.rows) ? payload.rows : weekRows;
    const current = Number(payload.current_week) || semesterWeek();
    return `${realtimeStrip()}<div class="renderer-v1-week-timeline is-polished-0993K" data-render-type="module_call" data-module-id="renderSemesterWeekAgenda0996D">${rows.map(row => {
      const weekNo = Number(String(row[0]).replace(/\D/g, ""));
      return `<div class="renderer-v1-week-node is-${escapeHtml(row[5] || "planned")}${weekNo === current ? " is-real-current" : ""}"><span>${escapeHtml(row[0])}</span><i aria-hidden="true"></i><div class="renderer-v1-week-content"><strong>${escapeHtml(row[1])}</strong><em>${escapeHtml(row[2])}${row[4] ? " · " + escapeHtml(row[4]) : ""}</em></div><b>${escapeHtml(row[3])} 课时</b></div>`;
    }).join("")}</div>`;
  }

  function renderTimetable(packet) {
    const payload = packet.payload && packet.payload.module_payload ? packet.payload.module_payload : {};
    const slots = Array.isArray(payload.slots) ? payload.slots : timetableSlots;
    const today = payload.today_weekday || weekdayName(todayDate());
    const days = ["周一", "周二", "周三", "周四", "周五"];
    const periods = ["第1节", "第2节", "第3节", "第4节", "第5节", "第6节"];
    return `${realtimeStrip()}<div class="shiwei-timetable" data-render-type="module_call" data-module-id="renderTeacherTimetable0996D"><div class="shiwei-timetable-head">节次</div>${days.map(day => `<div class="shiwei-timetable-head${day === today ? " is-today" : ""}">${escapeHtml(day)}</div>`).join("")}${periods.map(period => `<div class="shiwei-timetable-period">${escapeHtml(period)}</div>${days.map(day => {
      const slot = slots.find(item => item[0] === day && item[1] === period);
      return `<article class="shiwei-timetable-cell${slot ? " has-slot" : ""}${day === today ? " is-today" : ""}">${slot ? `<b>${escapeHtml(slot[2])}</b><span>${escapeHtml(slot[3])} · ${escapeHtml(slot[4])}</span>` : ""}</article>`;
    }).join("")}`).join("")}</div>`;
  }

  function renderMindmap(packet) {
    const payload = packet.payload && packet.payload.module_payload ? packet.payload.module_payload : {};
    const units = Array.isArray(payload.units) ? payload.units : unitMindmap;
    return `<div class="shiwei-mindmap" data-render-type="module_call" data-module-id="renderUnitLessonMindmap0996D">${units.map(unit => `<div class="shiwei-mind-row"><div class="shiwei-mind-unit">${escapeHtml(unit[0])}</div><div class="shiwei-mind-lessons">${(unit[1] || []).map(lesson => `<div class="shiwei-mind-lesson"><b>${escapeHtml(lesson[0])}</b><span>${escapeHtml(lesson[1])}</span></div>`).join("")}</div></div>`).join("")}</div>`;
  }

  function patchProtocol() {
    if (shouldSkipSystemVisuals()) return false;
    const protocol = window.SHIWEI_RENDERER_PROTOCOL_V1;
    if (!protocol || protocol.__systemVisuals0996D) return false;
    const originalRenderPacket = protocol.renderPacket && protocol.renderPacket.bind(protocol);
    protocol.buildPackets = buildPackets;
    protocol.supportedDirectoryTypes = ["markdown_document", "schedule_table", "module_call"];
    protocol.renderPacket = function (packet) {
      const moduleId = packet && packet.payload && packet.payload.module_id;
      if (moduleId === "renderScheduleXMonth0996D") return renderMonth(packet);
      if (moduleId === "renderEventCalendarWeek0996D") return renderWeekScheduler(packet);
      if (moduleId === "renderSemesterWeekAgenda0996D") return renderSemesterWeekAgenda(packet);
      if (moduleId === "renderTeacherTimetable0996D") return renderTimetable(packet);
      if (moduleId === "renderUnitLessonMindmap0996D") return renderMindmap(packet);
      return originalRenderPacket ? originalRenderPacket(packet) : "";
    };
    protocol.renderContentZone = function (packet) {
      if (!packet) return "";
      return `<section class="planning-content-preview-zone renderer-v1-preview" data-visual-binding-0996d="true" data-planning-content-preview="0992K" data-render-packet-id="${escapeHtml(packet.packet_id)}" aria-label="生成内容预览区"><div class="renderer-v1-preview-head"><div><strong>${escapeHtml(packet.title)}</strong></div></div><div class="renderer-v1-body">${protocol.renderPacket(packet)}</div></section>`;
    };
    protocol.renderPlanningPreview = function (state = {}, selectedKey = "teaching_work_plan", previewReady = false) {
      const packets = buildPackets(state, previewReady);
      const visible = packets.filter(packet => packet.key !== "agent_status_stream" && protocol.supportedDirectoryTypes.includes(packet.render_type));
      const active = visible.find(packet => packet.key === selectedKey) || visible[0];
      const statusPacket = packets.find(packet => packet.render_type === "status_stream");
      return `<section class="planning-render-zone renderer-v1-shell" data-render-protocol-stage="${STAGE_ID}" aria-label="教学规划正式渲染协议 0996D"><div class="renderer-v1-directory" data-component-role-registry-0996d="true">${visible.map(packet => `<button class="renderer-v1-tab${active && active.key === packet.key ? " is-selected" : ""}" type="button" data-planning-preview-select="${escapeHtml(packet.key)}" data-component-role-0996d="${escapeHtml(packet.component_role || "")}" data-render-type="${escapeHtml(packet.render_type)}"><strong>${escapeHtml(packet.title)}</strong></button>`).join("")}</div>${statusPacket && originalRenderPacket ? originalRenderPacket(statusPacket) : ""}</section>${protocol.renderContentZone(active)}`;
    };
    protocol.__systemVisuals0996D = true;
    return true;
  }

  function patchSemesterState() {
    if (shouldSkipSystemVisuals()) return false;
    const api = window.XIAOBEI_SEMESTER_SCHEDULE_PLANNING_V1;
    if (!api || api.__systemVisuals0996D) return false;
    const original = typeof api.getFocusState === "function" ? api.getFocusState.bind(api) : null;
    if (!original) return false;
    api.getFocusState = function () {
      const state = original() || {};
      return {
        ...state,
        taskTitle: "教学规划：正式可视化预览",
        taskStatus: "可视化预览",
        taskVisualStatus: "done",
        currentStage: "教学规划",
        nextStep: "查看月历、周历、课表和单元课时",
        demoStage: "review",
        demoStatus: "正式工作台预览",
        agentThinkingPreviewVisible: true,
        scheduleRows: weekRows.map(row => [row[0], row[1], row[2], row[3], "待老师确认", row[4], "预览"]),
        teachingPlanningSystemVisuals0996D: true,
        readonlyRealtimeBinding0996D: true
      };
    };
    api.__systemVisuals0996D = true;
    return true;
  }

  function apply() {
    if (shouldSkipSystemVisuals()) {
      window.SHIWEI_TEACHING_PLANNING_SYSTEM_VISUALS_0996D = {
        stageId: STAGE_ID,
        appliedToWorkbench: false,
        skippedForModelCandidate0997V: true,
        readonly: true,
        browserLocalDateRead: false,
        backendConnected: false,
        providerCalled: false,
        memoryStoreWritten: false,
        registryStoreWritten: false,
        feishuCalled: false
      };
      return;
    }
    patchProtocol();
    patchSemesterState();
    const focus = window.XIAOBEI_FOCUS_WORKSPACE_V1;
    if (focus && typeof focus.setFocusTask === "function") {
      focus.setFocusTask("semesterSchedule");
    }
    const card = document.querySelector('[data-card="focusWorkspace"]');
    if (card) card.setAttribute("data-teaching-planning-system-visuals-0996d", "true");
    window.SHIWEI_TEACHING_PLANNING_SYSTEM_VISUALS_0996D = {
      stageId: STAGE_ID,
      appliedToWorkbench: true,
      readonly: true,
      browserLocalDateRead: true,
      backendConnected: false,
      providerCalled: false,
      memoryStoreWritten: false,
      registryStoreWritten: false,
      feishuCalled: false
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply, { once: true });
  else apply();
  window.setTimeout(apply, 80);
  window.setTimeout(apply, 260);
})();
