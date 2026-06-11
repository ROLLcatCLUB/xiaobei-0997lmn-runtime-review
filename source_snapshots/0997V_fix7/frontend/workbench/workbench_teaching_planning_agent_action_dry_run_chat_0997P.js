(function () {
  "use strict";

  const STAGE_ID = "0997P_TEACHING_PLANNING_AGENT_ACTION_DRY_RUN_CHAT_RUNTIME_APPLY";
  const DEFAULT_SESSION_ID = "tp_session_syn_001";
  const DEFAULT_BASE = "http://127.0.0.1:8082/api/workbench";
  const ACTION_LABELS = {
    accept_candidate: "老师倾向认可这一版，但本轮只做只读预演",
    revise_candidate: "老师想继续调整候选",
    reject_candidate: "老师不想采用这一版候选",
    hold_candidate: "老师想先放一放",
    request_missing_input: "小备需要继续追问关键信息"
  };

  function apiBase() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const value = String(params.get("teaching_planning_api_base") || window.SHIWEI_TEACHING_PLANNING_API_BASE_0997N || DEFAULT_BASE).replace(/\/+$/, "");
      if (/^https?:\/\/(127\.0\.0\.1|localhost):\d+\/api\/workbench$/i.test(value)) return value;
    } catch (_) {}
    return DEFAULT_BASE;
  }

  function runtime() {
    return window.SHIWEI_TEACHING_PLANNING_RUNTIME_0997N || {};
  }

  function sessionId() {
    return runtime().sessionId || DEFAULT_SESSION_ID;
  }

  function setStatus(partial) {
    window.SHIWEI_TEACHING_PLANNING_AGENT_ACTION_DRY_RUN_CHAT_0997P = {
      stageId: STAGE_ID,
      readonly: true,
      providerCalled: false,
      databaseWritten: false,
      memoryStoreWritten: false,
      reviewEventWritten: false,
      visibleActionButtonsCreated: false,
      ...(window.SHIWEI_TEACHING_PLANNING_AGENT_ACTION_DRY_RUN_CHAT_0997P || {}),
      ...(partial || {})
    };
  }

  function injectStyle() {
    if (document.getElementById("teaching-planning-agent-action-dry-run-chat-0997p-style")) return;
    const style = document.createElement("style");
    style.id = "teaching-planning-agent-action-dry-run-chat-0997p-style";
    style.textContent = `
      body.teaching-planning-agent-guided-0997p [data-0952f-r1-action],
      body.teaching-planning-agent-guided-0997p [data-0952g-r1-provider-candidate-action],
      body.teaching-planning-agent-guided-0997p .0952f-r4-primary-actions,
      body.teaching-planning-agent-guided-0997p .0952f-r4-more-actions,
      body.teaching-planning-agent-guided-0997p .provider-candidate-patch-0952g-r1 .component-actions,
      body.teaching-planning-agent-guided-0997p button[data-fill],
      body.teaching-planning-agent-guided-0997p .xb-issue-trigger,
      body.teaching-planning-agent-guided-0997p .inline-actions,
      body.teaching-planning-agent-guided-0997p .quick-prompt-row,
      body.teaching-planning-agent-guided-0997p .result-actions button,
      body.teaching-planning-agent-guided-0997p .component-actions button,
      body.teaching-planning-agent-guided-0997p .stage .doc-footer-actions,
      body.teaching-planning-agent-guided-0997p [data-card="focusWorkspace"] .component-actions,
      body.teaching-planning-agent-guided-0997p .doc-footer-actions button:not(#sendBtn) {
        display: none !important;
      }
      body.teaching-planning-agent-guided-0997p .teaching-planning-agent-note-0997p {
        margin: 8px 0 0;
        padding: 9px 10px;
        border: 1px solid rgba(22,132,111,.14);
        border-radius: 12px;
        color: #48635c;
        background: rgba(237,246,241,.64);
        font-size: 12px;
        line-height: 1.55;
      }
      body.teaching-planning-agent-guided-0997p .teaching-planning-runtime-zone-0997n {
        display: block;
      }
    `;
    document.head.appendChild(style);
  }

  function applyLightweightSurface(reason) {
    document.body.classList.add("teaching-planning-agent-guided-0997p");
    const card = document.querySelector('[data-card="focusWorkspace"]');
    if (card) {
      card.setAttribute("data-agent-guided-actions-0997p", "buttons_removed");
      if (!card.querySelector(".teaching-planning-agent-note-0997p")) {
        const note = document.createElement("p");
        note.className = "teaching-planning-agent-note-0997p";
        note.textContent = "本页取消采纳、追问、精修、锁定等按钮；老师直接在左侧告诉小备怎么处理，当前只返回 dry-run 语义动作，不写入正式结果。";
        card.appendChild(note);
      }
    }
    document.querySelectorAll([
      "[data-0952f-r1-action]",
      "[data-0952g-r1-provider-candidate-action]",
      "button[data-fill]",
      ".xb-issue-trigger",
      ".inline-actions button",
      ".quick-prompt-row button",
      ".result-actions button",
      ".component-actions button",
      ".doc-footer-actions button"
    ].join(", ")).forEach((button) => {
      if (button.id === "sendBtn") return;
      button.setAttribute("aria-hidden", "true");
      button.setAttribute("data-agent-guided-hidden-0997p", "true");
      button.tabIndex = -1;
      button.style.display = "none";
    });
    setStatus({ lightweightSurfaceApplied: true, lastSurfaceReason: reason, lastSurfaceAppliedAt: new Date().toISOString() });
  }

  function renderAssistantText(command) {
    const actionId = command.action_id || "request_missing_input";
    const label = ACTION_LABELS[actionId] || ACTION_LABELS.request_missing_input;
    const summary = command.source_utterance_summary || "老师输入为空";
    const next = actionId === "request_missing_input"
      ? "你可以直接补一句：年级、学期、每周课时或活动周，我会继续整理只读预览。"
      : "你可以继续用一句话补充修改要求；我会继续只读预演，不会替你点按钮或写入正式结果。";
    return `**我已按只读 dry-run 理解你的意思。**\n\n- 动作理解：${label}\n- 输入摘要：${summary}\n- 写入状态：未写数据库、未写记忆、未写正式教学计划\n\n${next}`;
  }

  function appendTeacher(text) {
    if (typeof window.appendTeacher === "function") {
      window.appendTeacher(text);
      return;
    }
    const stream = document.getElementById("chatStream");
    if (!stream) return;
    const node = document.createElement("div");
    node.className = "msg teacher";
    node.innerHTML = `<div class="bubble-wrap"><span class="speaker">老师</span><div class="bubble"></div></div>`;
    node.querySelector(".bubble").textContent = text || "";
    stream.appendChild(node);
    stream.scrollTop = stream.scrollHeight;
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
    node.dataset.xbPersist = "false";
    node.dataset.xbTransient = "true";
    node.innerHTML = `<div class="avatar">小备</div><div class="bubble-wrap"><span class="speaker">小备</span><div class="bubble"></div></div>`;
    node.querySelector(".bubble").textContent = text || "";
    stream.appendChild(node);
    stream.scrollTop = stream.scrollHeight;
  }

  async function postAgentAction(utterance) {
    const response = await fetch(`${apiBase()}/teaching-planning/agent-action/dry-run`, {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId(),
        utterance,
        source: "left_agent_chat_0997P",
        create_visible_action_buttons: false
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`agent_action_dry_run_failed_${response.status}`);
    return payload;
  }

  async function handleSend(event) {
    const input = document.getElementById("composer");
    if (!input) return;
    const utterance = String(input.value || "").trim();
    if (!utterance) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    appendTeacher(utterance);
    input.value = "";
    applyLightweightSurface("agent_chat_send");
    const modelEventDetail = {
      stageId: STAGE_ID,
      sessionId: sessionId(),
      utterance,
      command: {},
      payload: {},
      emittedAt: new Date().toISOString()
    };
    const modelBridge = window.SHIWEI_TEACHING_PLANNING_MODEL_CANDIDATE_DRY_RUN_API_0997V;
    const modelBridgeAccepted = Boolean(modelBridge && typeof modelBridge.handleAgentAction === "function");
    if (modelBridgeAccepted) {
      modelBridge.handleAgentAction(modelEventDetail);
    }
    try {
      const payload = await postAgentAction(utterance);
      const command = payload && payload.payload ? payload.payload.agent_action_command || {} : {};
      if (!modelBridgeAccepted) {
        modelEventDetail.command = command;
        modelEventDetail.payload = payload;
        window.dispatchEvent(new CustomEvent("shiwei:teaching-planning-agent-action-dry-run:0997P", { detail: modelEventDetail }));
        appendXiaobei(renderAssistantText(command));
      }
      window.setTimeout(() => applyLightweightSurface("agent_chat_response"), 0);
      setStatus({
        connected: true,
        lastActionCommand: command,
        lastActionId: command.action_id || null,
        agentActionDryRunCalled: true,
        agentActionDryRunResponseOk: true,
        modelCandidateBridgeAccepted: modelBridgeAccepted,
        lastUtterance: utterance,
        lastDryRunAt: new Date().toISOString()
      });
    } catch (error) {
      if (!modelBridgeAccepted) {
        window.dispatchEvent(new CustomEvent("shiwei:teaching-planning-agent-action-dry-run:0997P", { detail: modelEventDetail }));
        appendXiaobei("**真实模型桥正在尝试接管。**\n\n如果模型候选服务也不可用，页面会明确显示原因；当前没有写入任何正式内容。");
      }
      setStatus({
        connected: false,
        error: error && error.message,
        lastUtterance: utterance,
        modelCandidateBridgeAccepted: modelBridgeAccepted,
        agentActionDryRunResponseOk: false,
        failedAt: new Date().toISOString()
      });
    }
  }

  function bindSend() {
    const send = document.getElementById("sendBtn");
    const input = document.getElementById("composer");
    if (send && !send.__teachingPlanning0997P) {
      send.addEventListener("click", handleSend, true);
      send.__teachingPlanning0997P = true;
    }
    if (input && !input.__teachingPlanning0997P) {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) handleSend(event);
      }, true);
      input.__teachingPlanning0997P = true;
    }
    if (!window.__teachingPlanning0997PWindowCapture) {
      window.addEventListener("click", (event) => {
        const target = event.target && event.target.closest ? event.target.closest("#sendBtn") : null;
        if (target) handleSend(event);
      }, true);
      window.addEventListener("keydown", (event) => {
        if (event.target === document.getElementById("composer") && event.key === "Enter" && !event.shiftKey && !event.isComposing) {
          handleSend(event);
        }
      }, true);
      window.__teachingPlanning0997PWindowCapture = true;
    }
  }

  function observeDynamicActions() {
    if (window.__teachingPlanning0997PObserver) return;
    const observer = new MutationObserver(() => applyLightweightSurface("mutation_observer"));
    observer.observe(document.body, { childList: true, subtree: true });
    window.__teachingPlanning0997PObserver = observer;
  }

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }

  window.SHIWEI_TEACHING_PLANNING_AGENT_ACTION_DRY_RUN_CHAT_API_0997P = {
    stageId: STAGE_ID,
    applyLightweightSurface,
    postAgentAction,
    getStatus: () => window.SHIWEI_TEACHING_PLANNING_AGENT_ACTION_DRY_RUN_CHAT_0997P || null
  };

  ready(() => {
    injectStyle();
    bindSend();
    applyLightweightSurface("initial_load");
    observeDynamicActions();
    setStatus({ connected: true, installedAt: new Date().toISOString() });
    [500, 1200, 2200].forEach((delay) => window.setTimeout(() => applyLightweightSurface(`stabilize_${delay}`), delay));
  });
})();
