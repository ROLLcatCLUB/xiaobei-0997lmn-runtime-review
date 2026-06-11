(function () {
  "use strict";

  const STAGE_ID = "0992NOP_TEACHING_PLANNING_RENDERER_PROTOCOL_VISUAL_V1";
  const DEFAULT_KEY = "teaching_work_plan";
  const EXTERNAL_BINDING_STAGE_ID = "0993D_TEACHING_WORK_PLAN_RENDER_PACKET_READONLY_VISUAL_BINDING_APPLY";
  const SUPPORTED_DIRECTORY_TYPES = ["markdown_document", "schedule_table", "module_call"];

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));
  }

  function packetBase(partial) {
    return {
      source_stage: STAGE_ID,
      source_ids: ["workbench_semester_schedule_planning_v1"],
      status: "preview",
      theme: "teacher_planner",
      allowed_actions: [],
      safety: {
        raw_html_allowed: false,
        provider_raw_stream_allowed: false,
        teacher_confirmation_required: true
      },
      ...partial
    };
  }

  function buildMarkdownFromSections(sections, previewReady) {
    if (!previewReady) {
      return "### 等待生成\n\n补齐基础信息后，小备会把教学目标、学情分析、教学措施和进度安排整理到这里。";
    }
    if (!Array.isArray(sections) || !sections.length) {
      return "### 教学工作计划\n\n当前没有可预览章节。";
    }
    return sections.map(item => {
      if (!item || typeof item !== "object") return `### ${String(item || "")}`;
      return `### ${item.title || ""}\n\n${item.body || ""}`;
    }).join("\n\n");
  }

  function fieldValue(state, key) {
    const fields = state && state.fields;
    if (Array.isArray(fields)) {
      const item = fields.find(row => row && row.key === key);
      return item ? String(item.text || item.value || "").trim() : "";
    }
    if (fields && typeof fields === "object") return String(fields[key] || "").trim();
    return "";
  }

  function unitAllocationRows(state, previewReady) {
    if (previewReady && Array.isArray(state.unitLessonAllocation) && state.unitLessonAllocation.length) {
      return state.unitLessonAllocation.map(item => ({
        name: Array.isArray(item) ? item[0] : item.name,
        lessons: Array.isArray(item) ? item[1] : item.lessons,
        status: Array.isArray(item) ? item[2] : item.status
      }));
    }
    return [
      { name: "教材目录", lessons: "待补充", status: "可选" },
      { name: "进度细化", lessons: "待生成", status: "老师复核后定稿" }
    ];
  }

  function buildStatePackets(state = {}, previewReady = false) {
    const sections = Array.isArray(state.workPlanSections) ? state.workPlanSections : [];
    const sourceRows = Array.isArray(state.scheduleRows) ? state.scheduleRows : [];
    const scheduleRows = previewReady && sourceRows.length
      ? sourceRows.map(row => [
        row[0] || "待定",
        row[1] || "待确认内容",
        row[2] || "待确认单元",
        row[3] || "待定",
        row[5] || row[4] || "待老师确认"
      ])
      : [["待生成", "等待基础信息", "待定", "待定", "日期不自动定稿"]];
    const reviewReady = state.demoStage === "review";
    return [
      packetBase({
        packet_id: "rp_0992NOP_teaching_work_plan",
        render_type: "markdown_document",
        key: "teaching_work_plan",
        title: "教学工作计划",
        directory_status: previewReady ? reviewReady ? "待采纳" : "预览中" : "待生成",
        payload: {
          markdown: buildMarkdownFromSections(sections, previewReady)
        },
        allowed_actions: previewReady ? ["review", "request_revision"] : []
      }),
      packetBase({
        packet_id: "rp_0992NOP_semester_schedule_table",
        render_type: "schedule_table",
        key: "semester_schedule_table",
        title: "课务日程表",
        directory_status: previewReady ? "预览中" : "待生成",
        payload: {
          columns: ["周次", "内容", "单元", "课时", "备注"],
          rows: scheduleRows
        },
        allowed_actions: previewReady ? ["review", "adjust_date"] : []
      }),
      packetBase({
        packet_id: "rp_0992NOP_unit_lesson_allocation",
        render_type: "module_call",
        key: "unit_lesson_allocation",
        title: "单元课时分配",
        directory_status: previewReady ? "可微调" : "可选关联",
        payload: {
          module_id: "renderUnitAllocation",
          module_payload: {
            units: unitAllocationRows(state, previewReady)
          }
        },
        allowed_actions: ["review", "link_textbook_catalog"]
      }),
      packetBase({
        packet_id: "rp_0992NOP_calendar_context",
        render_type: "module_call",
        key: "teaching_calendar_context",
        title: "学期周历表",
        directory_status: "待复核",
        payload: {
          module_id: "renderCalendarContext",
          module_payload: {
            items: previewReady
              ? [
                `活动周：${fieldValue(state, "activityWeeks") || "待老师补充"}。`,
                "日期只做候选，不自动写入正式课表。",
                "需要老师或校历数据确认后，才能进入正式课务安排。"
              ]
              : [
                "活动周待补充。",
                "校历未接入前，只能预览边界和追问提示。",
                "Agent 可以建议避开考试周、展示周和不可教学周。"
              ]
          }
        },
        allowed_actions: ["review", "confirm_calendar"]
      }),
      packetBase({
        packet_id: "rp_0992NOP_status_stream",
        render_type: "status_stream",
        key: "agent_status_stream",
        title: "小备思考状态",
        directory_status: "运行态",
        payload: {
          pulse_color: "orange",
          message: previewReady
            ? "小备正在把基础信息映射成教学规划预览，确认前不会进入正式输出。"
            : "小备正在等待基础信息，补齐后会生成教学工作计划和课务日程候选。"
        },
        allowed_actions: ["cancel_preview"]
      })
    ];
  }

  function normalizeExternalPacket(packet) {
    if (!packet || typeof packet !== "object") return null;
    return {
      source_stage: packet.source_stage || EXTERNAL_BINDING_STAGE_ID,
      source_ids: Array.isArray(packet.source_ids) ? packet.source_ids : [],
      status: packet.status || "preview",
      theme: packet.theme || "teacher_planner",
      allowed_actions: Array.isArray(packet.allowed_actions) ? packet.allowed_actions : [],
      safety: {
        raw_html_allowed: false,
        provider_raw_stream_allowed: false,
        teacher_confirmation_required: true,
        ...(packet.safety && typeof packet.safety === "object" ? packet.safety : {})
      },
      ...packet
    };
  }

  function shouldPreferRuntimeStatePackets() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      return Boolean(params.get("teaching_planning_model_api_base"))
        || params.get("structured_patch") === "0997T"
        || /0997V/i.test(String(params.get("v") || ""));
    } catch (_) {
      return false;
    }
  }

  function externalBundlePackets() {
    if (shouldPreferRuntimeStatePackets()) return [];
    const bundle = window.SHIWEI_TEACHING_WORK_PLAN_PACKET_BUNDLE_0993D;
    if (!bundle || typeof bundle !== "object") return [];
    if (bundle.readonly !== true || !Array.isArray(bundle.packets)) return [];
    return bundle.packets.map(normalizeExternalPacket).filter(Boolean);
  }

  function teachingWeekTimelinePacketFromSchedule(packets) {
    const schedulePacket = Array.isArray(packets)
      ? packets.find(packet => packet && packet.key === "semester_schedule_table")
      : null;
    const rows = schedulePacket && schedulePacket.payload && Array.isArray(schedulePacket.payload.rows)
      ? schedulePacket.payload.rows
      : [];
    if (!rows.length) return null;
    const registry = window.SHIWEI_RENDERER_MODULE_REGISTRY_0993H;
    const registeredModule = registry && typeof registry.selectRendererForPacket === "function"
      ? registry.selectRendererForPacket(schedulePacket)
      : null;
    if (registeredModule && registeredModule.enabled === false) return null;
    const moduleId = registeredModule && registeredModule.module_id
      ? registeredModule.module_id
      : "renderTeachingWeekTimeline";
    return normalizeExternalPacket({
      packet_id: "rp_0993G_teaching_week_timeline",
      render_type: "module_call",
      key: "teaching_week_timeline",
      title: "课表",
      source_stage: "0993G_TEACHING_PLANNING_CALENDAR_RENDERER_LAB_LIGHTWEIGHT_APPLY",
      source_ids: [schedulePacket.packet_id || "semester_schedule_table"],
      status: "preview",
      theme: "teacher_calendar",
      registered_renderer_stage: registeredModule ? registry.stageId : "unregistered_lightweight_fallback",
      registered_renderer_module_id: moduleId,
      agent_registration_policy: registeredModule ? registeredModule.agent_policy : {
        agent_can_recommend: true,
        agent_can_select_for_preview: true,
        agent_can_replace_teacher_selection: false,
        teacher_review_required: true,
        write_allowed: false,
        provider_call_allowed: false,
        provider_context_injection_allowed: false,
        feishu_read_allowed: false,
        feishu_write_allowed: false,
        real_schedule_write_allowed: false,
        formal_export_allowed: false
      },
      payload: {
        module_id: moduleId,
        module_payload: {
          rows
        }
      },
      allowed_actions: ["review", "adjust_week"],
      safety: {
        raw_html_allowed: false,
        teacher_confirmation_required: true,
        provider_context_injection_allowed: false,
        memory_store_write_allowed: false,
        retrieval_enabled: false,
        feishu_read_allowed: false,
        feishu_write_allowed: false,
        formal_schedule_write_allowed: false
      }
    });
  }

  function buildPackets(state = {}, previewReady = false) {
    const externalPackets = externalBundlePackets();
    if (externalPackets.length) {
      const timelinePacket = teachingWeekTimelinePacketFromSchedule(externalPackets);
      return timelinePacket ? [...externalPackets, timelinePacket] : externalPackets;
    }
    const statePackets = buildStatePackets(state, previewReady);
    const timelinePacket = teachingWeekTimelinePacketFromSchedule(statePackets);
    return timelinePacket ? [...statePackets, timelinePacket] : statePackets;
  }

  function markdownToHtml(markdown) {
    const lines = String(markdown || "").split(/\r?\n/);
    let html = "";
    let listOpen = "";
    function closeList() {
      if (listOpen) {
        html += `</${listOpen}>`;
        listOpen = "";
      }
    }
    lines.forEach(line => {
      if (!line.trim()) {
        closeList();
        return;
      }
      if (line.startsWith("### ")) {
        closeList();
        html += `<h3>${escapeHtml(line.slice(4))}</h3>`;
        return;
      }
      if (line.startsWith("## ")) {
        closeList();
        html += `<h3>${escapeHtml(line.slice(3))}</h3>`;
        return;
      }
      const ordered = line.match(/^\d+\.\s+(.*)$/);
      if (ordered) {
        if (listOpen !== "ol") {
          closeList();
          listOpen = "ol";
          html += "<ol>";
        }
        html += `<li>${escapeHtml(ordered[1])}</li>`;
        return;
      }
      if (/^[-*]\s+/.test(line)) {
        if (listOpen !== "ul") {
          closeList();
          listOpen = "ul";
          html += "<ul>";
        }
        html += `<li>${escapeHtml(line.replace(/^[-*]\s+/, ""))}</li>`;
        return;
      }
      closeList();
      html += `<p>${escapeHtml(line)}</p>`;
    });
    closeList();
    return html;
  }

  function renderStatusStream(packet) {
    const message = packet && packet.payload ? packet.payload.message : "";
    return `
      <div class="renderer-v1-status-stream" data-render-type="status_stream">
        <span class="renderer-v1-pulse" aria-hidden="true"></span>
        <p>${escapeHtml(message)}</p>
      </div>`;
  }

  function renderMarkdownDocument(packet) {
    return `<article class="renderer-v1-document" data-render-type="markdown_document">${markdownToHtml(packet.payload && packet.payload.markdown)}</article>`;
  }

  function renderScheduleTable(packet) {
    const columns = packet.payload && Array.isArray(packet.payload.columns) ? packet.payload.columns : [];
    const rows = packet.payload && Array.isArray(packet.payload.rows) ? packet.payload.rows : [];
    return `
      <div class="renderer-v1-table-wrap" data-render-type="schedule_table">
        <table class="renderer-v1-table">
          <thead><tr>${columns.map(column => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>
          <tbody>${rows.map(row => `<tr>${columns.map((_, index) => `<td>${escapeHtml(row[index] || "")}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>`;
  }

  function renderUnitAllocation(packet) {
    const payload = packet.payload && packet.payload.module_payload ? packet.payload.module_payload : {};
    const units = Array.isArray(payload.units) ? payload.units : [];
    const max = Math.max(1, ...units.map(unit => Number(unit.lessons) || 1));
    return `
      <div class="renderer-v1-unit-list" data-render-type="module_call" data-module-id="renderUnitAllocation">
        ${units.map(unit => {
          const lessons = Number(unit.lessons) || 1;
          const lessonLabel = Number(unit.lessons) ? `${unit.lessons} 课时` : String(unit.lessons || "待定");
          return `
            <div class="renderer-v1-unit">
              <b>${escapeHtml(unit.name)}</b>
              <span class="renderer-v1-track"><span class="renderer-v1-fill" style="width:${Math.round(lessons / max * 100)}%"></span></span>
              <span>${escapeHtml(lessonLabel)}</span>
            </div>`;
        }).join("")}
      </div>`;
  }

  function renderCalendarContext(packet) {
    const payload = packet.payload && packet.payload.module_payload ? packet.payload.module_payload : {};
    const items = Array.isArray(payload.items) ? payload.items : [];
    return `<ul class="renderer-v1-note-list" data-render-type="module_call" data-module-id="renderCalendarContext">${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function normalizeWeekTimelineRows(packet) {
    const payload = packet.payload && packet.payload.module_payload ? packet.payload.module_payload : {};
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    return rows.map((row, index) => {
      const week = row[0] || `第${index + 1}周`;
      const title = row[1] || "待确认课题";
      const unit = row[2] || "待确认单元";
      const hours = row[3] || "待定";
      const note = row[4] || "";
      const text = `${title} ${unit} ${note}`;
      return {
        week,
        title,
        unit,
        hours,
        note,
        state: /创艺节|活动|展示/.test(text) ? "activity" : /复核|待/.test(text) ? "review" : "planned"
      };
    });
  }

  function renderTeachingWeekTimeline(packet) {
    const rows = normalizeWeekTimelineRows(packet);
    return `
      <div class="renderer-v1-week-timeline is-polished-0993K" data-render-type="module_call" data-module-id="renderTeachingWeekTimeline" data-visual-stage="0993K">
        <div class="renderer-v1-week-scale" aria-hidden="true">
          <span>周次</span>
          <span>安排</span>
          <span>课时</span>
        </div>
        <div class="renderer-v1-week-rail" aria-hidden="true"></div>
        ${rows.map(item => `
          <div class="renderer-v1-week-node is-${escapeHtml(item.state)}">
            <span>${escapeHtml(item.week)}</span>
            <i aria-hidden="true"></i>
            <div class="renderer-v1-week-content">
              <strong>${escapeHtml(item.title)}</strong>
              <em>${escapeHtml(`${item.unit}${item.note ? ` · ${item.note}` : ""}`)}</em>
            </div>
            <b>${escapeHtml(item.hours)} 课时</b>
          </div>`).join("")}
      </div>`;
  }

  function renderModuleCall(packet) {
    const moduleId = packet.payload && packet.payload.module_id;
    if (moduleId === "renderUnitAllocation") return renderUnitAllocation(packet);
    if (moduleId === "renderCalendarContext") return renderCalendarContext(packet);
    if (moduleId === "renderTeachingWeekTimeline") return renderTeachingWeekTimeline(packet);
    return `<div class="renderer-v1-empty">未知模块：${escapeHtml(moduleId || "未提供 module_id")}。当前按安全占位处理。</div>`;
  }

  function renderPacket(packet) {
    if (!packet || packet.safety && packet.safety.raw_html_allowed !== false) {
      return `<div class="renderer-v1-empty">渲染包未通过安全检查。</div>`;
    }
    if (packet.render_type === "markdown_document") return renderMarkdownDocument(packet);
    if (packet.render_type === "schedule_table") return renderScheduleTable(packet);
    if (packet.render_type === "module_call") return renderModuleCall(packet);
    if (packet.render_type === "status_stream") return renderStatusStream(packet);
    return `<div class="renderer-v1-empty">${escapeHtml(packet.title || "未知内容")} 暂无可用渲染器。</div>`;
  }

  function renderPlanningPreview(state = {}, selectedKey = DEFAULT_KEY, previewReady = false) {
    const packets = buildPackets(state, previewReady);
    const visiblePackets = packets.filter(packet => packet.key !== "agent_status_stream" && SUPPORTED_DIRECTORY_TYPES.includes(packet.render_type));
    const active = visiblePackets.find(packet => packet.key === selectedKey) || visiblePackets[0];
    const statusPacket = packets.find(packet => packet.render_type === "status_stream");
    return `
      <section class="planning-render-zone renderer-v1-shell" data-render-protocol-stage="${STAGE_ID}" aria-label="教学规划渲染协议 v1">
        <div class="renderer-v1-directory">
          ${visiblePackets.map(packet => `
            <button class="renderer-v1-tab${active && active.key === packet.key ? " is-selected" : ""}" type="button" data-planning-preview-select="${escapeHtml(packet.key)}" data-render-type="${escapeHtml(packet.render_type)}">
              <strong>${escapeHtml(packet.title)}</strong>
            </button>`).join("")}
        </div>
        ${statusPacket ? renderStatusStream(statusPacket) : ""}
      </section>
      ${renderContentZone(active)}`;
  }

  function renderContentZone(packet) {
    if (!packet) return "";
    return `
      <section class="planning-content-preview-zone renderer-v1-preview" data-planning-content-preview="0992K" data-render-packet-id="${escapeHtml(packet.packet_id)}" aria-label="生成内容预览区">
        <div class="renderer-v1-preview-head">
          <div><strong>${escapeHtml(packet.title)}</strong></div>
        </div>
        <div class="renderer-v1-body">${renderPacket(packet)}</div>
      </section>`;
  }

  window.SHIWEI_RENDERER_PROTOCOL_V1 = {
    stageId: STAGE_ID,
    externalBindingStageId: EXTERNAL_BINDING_STAGE_ID,
    supportedDirectoryTypes: SUPPORTED_DIRECTORY_TYPES.slice(),
    buildStatePackets,
    buildPackets,
    externalBundlePackets,
    teachingWeekTimelinePacketFromSchedule,
    renderPlanningPreview,
    renderContentZone,
    renderPacket
  };
})();
