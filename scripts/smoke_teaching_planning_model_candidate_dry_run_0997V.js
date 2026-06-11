const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const STAGE_ID = "0997V_TEACHING_PLANNING_MODEL_CANDIDATE_DRY_RUN_EXPERIENCE_APPLY";
const FRONTEND_URL = "http://127.0.0.1:5177/frontend/workbench/index.html?teaching_planning_session=tp_session_syn_001&structured_patch=0997T&teaching_planning_model_api_base=http%3A%2F%2F127.0.0.1%3A8083%2Fapi%2Fworkbench";
const OUT_DIR = path.join(ROOT, "outputs", "teaching_planning_frontend_0997V");
const SUMMARY_PATH = path.join(OUT_DIR, "model_candidate_dry_run_smoke_0997V.json");
const SCREENSHOT_PATH = path.join(OUT_DIR, "model_candidate_dry_run_smoke_0997V.png");
const SUCCESS = "ALL_0997V_TEACHING_PLANNING_MODEL_CANDIDATE_DRY_RUN_SMOKE_OK";
const SWITCH_UTTERANCE = "我要做教学规划";
const FILL_UTTERANCE = "三年级美术，第二学期，每周一节，活动周是创艺节";
const TEACHER_UTTERANCE = "请根据右侧基础信息生成教学工作计划预览";

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\EdgeCore\\149.0.4022.62\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\EdgeCore\\148.0.3967.96\\msedge.exe",
];

function findBrowser() {
  for (const candidate of CHROME_CANDIDATES) if (fs.existsSync(candidate)) return candidate;
  throw new Error("No local Chrome or Edge executable found for 0997V smoke.");
}
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function requestJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } });
    });
    req.on("error", reject);
  });
}
async function waitForDebugPort(port) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { return await requestJson(`http://127.0.0.1:${port}/json/version`); } catch (_) { await delay(100); }
  }
  throw new Error("Chrome DevTools port did not become available.");
}
function cdpClient(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map();
    const handlers = new Map();
    ws.onopen = () => resolve({
      send(method, params = {}) {
        const id = nextId++;
        ws.send(JSON.stringify({ id, method, params }));
        return new Promise((res, rej) => pending.set(id, { res, rej, method }));
      },
      on(method, handler) {
        if (!handlers.has(method)) handlers.set(method, []);
        handlers.get(method).push(handler);
      },
      close() { ws.close(); },
    });
    ws.onerror = (event) => reject(new Error(`WebSocket error: ${event.message || "unknown"}`));
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const entry = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) entry.rej(new Error(`${entry.method}: ${message.error.message}`));
        else entry.res(message.result || {});
        return;
      }
      for (const handler of handlers.get(message.method) || []) handler(message.params || {});
    };
  });
}
function pngSize(buffer) {
  if (buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("Screenshot is not PNG.");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}
function sha256(buffer) { return crypto.createHash("sha256").update(buffer).digest("hex"); }
function localUrlOnly(url) {
  if (url === "about:blank" || url.startsWith("data:") || url.startsWith("blob:")) return true;
  try {
    const parsed = new URL(url);
    return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  } catch (_) { return false; }
}
function responseAllowed(response) {
  if (response.status < 400) return true;
  try { return new URL(response.url).pathname.toLowerCase().endsWith("/favicon.ico"); } catch (_) { return false; }
}

async function evaluatePage(client) {
  const expression = `(() => new Promise((resolve) => {
    const input = document.getElementById("composer");
    const send = document.getElementById("sendBtn");
    const started = Date.now();
    function visible(el) {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }
    function sendUtterance(text) {
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      send.click();
    }
    let step = 0;
    let initialRuntime = null;
    function sample() {
      const statusV = window.SHIWEI_TEACHING_PLANNING_MODEL_CANDIDATE_DRY_RUN_0997V || {};
      const statusP = window.SHIWEI_TEACHING_PLANNING_AGENT_ACTION_DRY_RUN_CHAT_0997P || {};
      const statusT = window.SHIWEI_TEACHING_PLANNING_STRUCTURED_PATCH_DRY_RUN_0997T || {};
      const semesterApi = window.XIAOBEI_SEMESTER_SCHEDULE_PLANNING_V1;
      const semesterRuntime = semesterApi && typeof semesterApi.getRuntimeState === "function" ? semesterApi.getRuntimeState() : {};
      const semesterFields = semesterRuntime.fields || {};
      if (!initialRuntime) initialRuntime = JSON.parse(JSON.stringify(semesterRuntime || {}));
      if (step === 0) {
        step = 1;
        sendUtterance(${JSON.stringify(SWITCH_UTTERANCE)});
      } else if (step === 1 && statusV.localSemanticKind === "switch_to_teaching_planning") {
        step = 2;
        setTimeout(() => sendUtterance(${JSON.stringify(FILL_UTTERANCE)}), 150);
      } else if (step === 2 && statusV.localSemanticKind === "fill_teaching_planning_fields") {
        step = 3;
        setTimeout(() => sendUtterance(${JSON.stringify(TEACHER_UTTERANCE)}), 150);
      }
      const rendererTabs = Array.from(document.querySelectorAll(".renderer-v1-tab")).filter(visible).map((button) => (button.innerText || button.textContent || "").trim()).filter(Boolean);
      const panel = document.querySelector(".teaching-planning-model-candidate-0997v");
      const panelText = panel ? panel.innerText || "" : "";
      const bodyText = document.body.innerText || "";
      if (statusV.modelConnected === true && window.XiaobeiWorkbenchSessionManagerV1 && typeof window.XiaobeiWorkbenchSessionManagerV1.persist === "function") {
        window.XiaobeiWorkbenchSessionManagerV1.persist("0997V_smoke");
      }
      const transientTokens = [
        "只读 dry-run 暂时没有连上",
        "页面没有写入任何正式内容；请稍后再试",
        "我正在调用真实候选模型",
        "真实模型桥正在尝试接管",
        "真实候选模型现在没有接通",
        "我不会把规则占位内容当成模型体验"
      ];
      const sessionStates = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i) || "";
        if (!key.includes("xiaobei_workbench_v1_chat_session:state")) continue;
        try {
          const parsed = JSON.parse(localStorage.getItem(key) || "{}");
          sessionStates.push({ key, messages: Array.isArray(parsed.messages) ? parsed.messages : [] });
        } catch (_) {}
      }
      const persistedTexts = sessionStates.flatMap((state) => state.messages.map((message) => String(message.text || "")));
      const persistedTransientMessages = persistedTexts.filter((text) => transientTokens.some((token) => text.includes(token)));
      const persistedThinkingMessages = persistedTexts.filter((text) => text.includes("小备正在生成"));
      const initialFields = initialRuntime && initialRuntime.fields ? initialRuntime.fields : {};
      const initialMissing = Array.isArray(initialRuntime && initialRuntime.missing_slots) ? initialRuntime.missing_slots : [];
      const focusInputs = Array.from(document.querySelectorAll('[data-card="focusWorkspace"] input')).map((item) => String(item.value || "").trim()).filter(Boolean);
      const rightPreview = document.querySelector('[data-card="focusWorkspace"] .planning-content-preview-zone') || document.querySelector(".planning-content-preview-zone");
      const rightPreviewText = rightPreview ? rightPreview.innerText || "" : "";
      const result = {
        api_0997v_present: Boolean(window.SHIWEI_TEACHING_PLANNING_MODEL_CANDIDATE_DRY_RUN_API_0997V),
        script_0997v_present: Array.from(document.scripts || []).some((script) => String(script.src || "").includes("workbench_teaching_planning_model_candidate_dry_run_0997V.js")),
        initial_semester_fields_empty: ["semester", "gradeSubject", "weeklyLessons", "activityWeeks", "textbookCatalog"].every((key) => !String(initialFields[key] || "").trim()),
        initial_required_slots_missing: ["semester", "gradeSubject", "weeklyLessons", "activityWeeks"].every((key) => initialMissing.includes(key)),
        initial_generated_preview_not_synced: initialRuntime && initialRuntime.generated_preview_synced !== true,
        initial_generated_preview_section_count_zero: !Number(initialRuntime && initialRuntime.generated_preview_section_count || 0),
        agent_action_called: statusP.agentActionDryRunCalled === true,
        model_bridge_accepted: statusP.modelCandidateBridgeAccepted === true,
        model_candidate_called: statusV.modelCandidateCalled === true,
        model_connected: statusV.modelConnected === true,
        local_semantic_kind: statusV.localSemanticKind || "",
        semester_fields: semesterFields,
        semester_fields_filled: semesterFields.gradeSubject === "三年级美术" && semesterFields.weeklyLessons === "每周一节" && semesterFields.activityWeeks.includes("创艺节") && /第二学期/.test(semesterFields.semester || ""),
        generated_preview_synced: semesterRuntime.generated_preview_synced === true || statusV.generatedPreviewSynced === true,
        generated_preview_section_count: semesterRuntime.generated_preview_section_count || statusV.generatedPreviewSectionCount || 0,
        candidate_source: statusV.candidateSource || "",
        provider_meta_present: Boolean(statusV.providerMeta && statusV.providerMeta.model),
        guard_status: statusV.guardStatus || "",
        thinking_animation_shown: statusV.thinkingAnimationShown === true,
        thinking_animation_removed: statusV.thinkingAnimationRemoved === true,
        thinking_bubble_leftover_count: document.querySelectorAll('[data-model-candidate-thinking-0997v="true"]').length,
        persisted_session_state_count: sessionStates.length,
        persisted_transient_message_count: persistedTransientMessages.length,
        persisted_thinking_message_count: persistedThinkingMessages.length,
        persisted_message_count: persistedTexts.length,
        panel_visible: Boolean(panel && visible(panel)),
        panel_mentions_model: !panel || panelText.includes("模型候选 dry-run 已接通"),
        panel_mentions_readonly: !panel || (panelText.includes("不写数据库") && panelText.includes("不写记忆") && panelText.includes("不写飞书")),
        switch_message_visible: bodyText.includes(${JSON.stringify(SWITCH_UTTERANCE)}),
        fill_message_visible: bodyText.includes(${JSON.stringify(FILL_UTTERANCE)}),
        teacher_message_visible: bodyText.includes(${JSON.stringify(TEACHER_UTTERANCE)}),
        local_switch_reply_visible: bodyText.includes("已切到教学规划") && bodyText.includes("不逐项打断"),
        local_fill_reply_visible: bodyText.includes("已同步：") && bodyText.includes("活动周"),
        assistant_model_visible: statusV.modelConnected === true && Boolean(statusV.lastResponseId),
        assistant_no_unit_name_followup: !/(补充|确认|追问|还差)[^。！？\\n]{0,18}(单元名称|单元名|具体单元|必须覆盖的单元)/.test(bodyText),
        legacy_mock_router_reply_absent: !bodyText.includes("我还没有看到可以放入工作卡的候选内容") && !bodyText.includes("生成课时框架、大单元框架") && !bodyText.includes("生成大单元框架、课时框架"),
        right_fields_match_teacher_input: focusInputs.includes("第二学期") && focusInputs.includes("三年级美术") && focusInputs.includes("每周一节") && focusInputs.includes("创艺节"),
        right_preview_not_runtime_placeholder: !rightPreviewText.includes("已从后端只读状态读取候选结构") && !rightPreviewText.includes("本次 runtime 只读接入"),
        right_preview_text: rightPreviewText.slice(0, 240),
        right_focus_input_values: focusInputs,
        structured_patch_still_rendered: statusT.structuredPatchRendered === true,
        renderer_switch_tabs_visible: ["教学工作计划", "学期周历表", "课务日程表", "单元课时分配", "课表"].every((label) => rendererTabs.includes(label)),
        renderer_switch_tabs: rendererTabs,
        database_written_false: statusV.databaseWritten === false,
        memory_store_written_false: statusV.memoryStoreWritten === false,
        review_event_written_false: statusV.reviewEventWritten === false,
        visible_action_buttons_created_false: statusV.visibleActionButtonsCreated === false,
      };
      const ready = step >= 3 && result.model_connected && result.generated_preview_synced && result.structured_patch_still_rendered && result.persisted_session_state_count > 0;
      if (ready || Date.now() - started > 70000) resolve(result);
      else setTimeout(sample, 250);
    }
    sample();
  }))();`;
  const result = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  return result.result.value;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = findBrowser();
  const port = 18600 + Math.floor(Math.random() * 2000);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "xiaobei-0997V-"));
  const network = { requests: [], responses: [], loading_failed: [], runtime_exceptions: [], log_errors: [] };
  const chrome = childProcess.spawn(browser, [
    "--headless=new", "--disable-gpu", "--disable-extensions", "--disable-background-networking",
    "--disable-default-apps", "--no-first-run", `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`, "about:blank",
  ], { stdio: "ignore" });
  let client;
  try {
    await waitForDebugPort(port);
    const pages = await requestJson(`http://127.0.0.1:${port}/json`);
    const page = pages.find((item) => item.type === "page") || pages[0];
    client = await cdpClient(page.webSocketDebuggerUrl);
    client.on("Network.requestWillBeSent", (params) => network.requests.push({ method: params.request ? params.request.method : "", url: params.request ? params.request.url : "", type: params.type || "" }));
    client.on("Network.responseReceived", (params) => network.responses.push({ status: params.response ? params.response.status : 0, url: params.response ? params.response.url : "" }));
    client.on("Network.loadingFailed", (params) => network.loading_failed.push(params.errorText || ""));
    client.on("Runtime.exceptionThrown", (params) => network.runtime_exceptions.push(params.exceptionDetails ? params.exceptionDetails.text || "runtime_exception" : "runtime_exception"));
    client.on("Log.entryAdded", (params) => {
      const entry = params.entry || {};
      if (entry.level === "error" && !(entry.url || "").endsWith("/favicon.ico")) network.log_errors.push(entry.text || "");
    });
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Network.enable");
    await client.send("Log.enable");
    await client.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
    await client.send("Page.navigate", { url: FRONTEND_URL });
    await delay(1800);
    const assertions = await evaluatePage(client);
    await delay(400);
    const screenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: true });
    const screenshotBuffer = Buffer.from(screenshot.data, "base64");
    const dimensions = pngSize(screenshotBuffer);
    fs.writeFileSync(SCREENSHOT_PATH, screenshotBuffer);
    const requests = network.requests.filter((request) => request.url && request.url !== "about:blank");
    const agentActionRequests = requests.filter((request) => request.url.includes("/api/workbench/teaching-planning/agent-action/dry-run"));
    const agentRuntimeRequests = requests.filter((request) => request.url.includes("/api/workbench/agent/turn"));
    const modelRequests = requests.filter((request) => request.url.includes("/api/workbench/ai/dry-run"));
    const reviewEventRequests = requests.filter((request) => request.url.includes("/api/workbench/teaching-planning/review-event"));
    const sessionDryRunRequests = requests.filter((request) => request.url.includes("/api/workbench/teaching-planning/session/dry-run"));
    const forbiddenWriteRequests = requests.filter((request) => {
      if (request.method === "GET" || request.method === "OPTIONS") return false;
      if (request.url.includes("/api/workbench/teaching-planning/agent-action/dry-run")) return false;
      if (request.url.includes("/api/workbench/ai/dry-run")) return false;
      return request.url.includes("/api/");
    });
    const externalRequests = requests.filter((request) => !localUrlOnly(request.url));
    const badResponses = network.responses.filter((response) => !responseAllowed(response));
    const pass = [
      assertions.api_0997v_present, assertions.script_0997v_present, assertions.agent_action_called,
      assertions.initial_semester_fields_empty, assertions.initial_required_slots_missing,
      assertions.initial_generated_preview_not_synced, assertions.initial_generated_preview_section_count_zero,
      assertions.model_bridge_accepted, assertions.model_candidate_called, assertions.model_connected,
      assertions.semester_fields_filled, assertions.switch_message_visible, assertions.fill_message_visible,
      assertions.local_switch_reply_visible, assertions.local_fill_reply_visible,
      assertions.generated_preview_synced, assertions.generated_preview_section_count > 0,
      assertions.candidate_source === "model" || assertions.candidate_source === "model_guarded_fallback",
      assertions.thinking_animation_shown, assertions.thinking_animation_removed,
      assertions.thinking_bubble_leftover_count === 0, assertions.panel_mentions_model,
      assertions.persisted_session_state_count > 0, assertions.persisted_transient_message_count === 0,
      assertions.persisted_thinking_message_count === 0,
      assertions.panel_mentions_readonly, assertions.teacher_message_visible, assertions.assistant_model_visible,
      assertions.assistant_no_unit_name_followup, assertions.legacy_mock_router_reply_absent,
      assertions.right_fields_match_teacher_input, assertions.right_preview_not_runtime_placeholder,
      assertions.structured_patch_still_rendered, assertions.renderer_switch_tabs_visible,
      assertions.database_written_false, assertions.memory_store_written_false, assertions.review_event_written_false,
      assertions.visible_action_buttons_created_false,
      agentActionRequests.filter((request) => request.method === "POST").length >= 1,
      modelRequests.filter((request) => request.method === "POST").length === 1,
      agentRuntimeRequests.length === 0,
      reviewEventRequests.length === 0, sessionDryRunRequests.length === 0, forbiddenWriteRequests.length === 0,
      externalRequests.length === 0, badResponses.length === 0, network.loading_failed.length === 0,
      network.runtime_exceptions.length === 0, network.log_errors.length === 0,
    ].every(Boolean);
    const summary = {
      stage_id: STAGE_ID,
      stage_code: "0997V",
      final_status: "MODEL_CANDIDATE_DRY_RUN_SMOKE_PASS",
      pass,
      frontend_url: FRONTEND_URL,
      teacher_utterance: TEACHER_UTTERANCE,
      switch_utterance: SWITCH_UTTERANCE,
      fill_utterance: FILL_UTTERANCE,
      screenshot_path: "outputs/teaching_planning_frontend_0997V/model_candidate_dry_run_smoke_0997V.png",
      screenshot_sha256: sha256(screenshotBuffer),
      screenshot_width: dimensions.width,
      screenshot_height: dimensions.height,
      assertions,
      network_summary: {
        request_count: requests.length,
        agent_action_dry_run_post_count: agentActionRequests.filter((request) => request.method === "POST").length,
        agent_runtime_request_count: agentRuntimeRequests.length,
        model_candidate_dry_run_post_count: modelRequests.filter((request) => request.method === "POST").length,
        review_event_request_count: reviewEventRequests.length,
        session_dry_run_request_count: sessionDryRunRequests.length,
        forbidden_write_request_count: forbiddenWriteRequests.length,
        external_request_count: externalRequests.length,
        bad_response_count: badResponses.length,
        loading_failed_count: network.loading_failed.length,
        runtime_exception_count: network.runtime_exceptions.length,
        browser_log_error_count: network.log_errors.length,
      },
      boundary_flags: {
        readonly: true,
        model_candidate_called: true,
        database_written: false,
        memory_store_written: false,
        review_event_written: false,
        visible_action_buttons_created: false,
        formal_export_created: false,
        deploy_performed: false,
      },
    };
    fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    if (!pass) throw new Error("0997V smoke failed. See outputs/teaching_planning_frontend_0997V/model_candidate_dry_run_smoke_0997V.json");
    console.log(SUCCESS);
  } finally {
    if (client) client.close();
    chrome.kill();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
