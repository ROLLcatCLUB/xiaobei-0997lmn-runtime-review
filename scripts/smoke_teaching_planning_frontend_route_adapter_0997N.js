const assert = require("assert");

const STATIC_BASE = process.env.SHIWEI_STATIC_BASE || "http://127.0.0.1:5177";
const API_BASE = process.env.SHIWEI_API_BASE || "http://127.0.0.1:8082/api/workbench";
const ORIGIN = "http://127.0.0.1:5177";

async function getText(url) {
  const response = await fetch(url, { headers: { Origin: ORIGIN } });
  assert.strictEqual(response.ok, true, `${url} should return 2xx`);
  return { response, text: await response.text() };
}

async function getJson(url) {
  const response = await fetch(url, { headers: { Origin: ORIGIN } });
  assert.strictEqual(response.ok, true, `${url} should return 2xx`);
  return { response, json: await response.json() };
}

async function main() {
  const index = await getText(`${STATIC_BASE}/frontend/workbench/index.html`);
  assert(index.text.includes("workbench_teaching_planning_route_adapter_0997N.js"), "index should include 0997N adapter");

  const adapter = await getText(`${STATIC_BASE}/frontend/workbench/workbench_teaching_planning_route_adapter_0997N.js`);
  assert(adapter.text.includes("0997N_TEACHING_PLANNING_FRONTEND_ROUTE_ADAPTER_READONLY_RUNTIME_APPLY"), "adapter should expose stage id");

  const status = await getJson(`${API_BASE}/teaching-planning/status`);
  assert.strictEqual(status.json.success, true, "status success");
  assert.strictEqual(status.json.payload.route_status, "readonly_route_active", "route active");
  assert.strictEqual(status.response.headers.get("access-control-allow-origin"), ORIGIN, "CORS origin should match 5177");

  const session = await getJson(`${API_BASE}/teaching-planning/session/tp_session_syn_001`);
  assert.strictEqual(session.json.success, true, "session success");
  assert.strictEqual(session.json.payload.state.session.session_id, "tp_session_syn_001", "session id");
  assert.strictEqual(session.json.runtime_boundary.database_written, false, "database boundary");
  assert.strictEqual(session.json.runtime_boundary.provider_called, false, "provider boundary");
  assert.strictEqual(session.json.runtime_boundary.memory_store_written, false, "memory boundary");

  const renderer = await getJson(`${API_BASE}/teaching-planning/renderer-payload/tp_session_syn_001`);
  assert.strictEqual(renderer.json.success, true, "renderer payload success");
  assert.strictEqual(renderer.json.payload.renderer_payload_preview.readonly, true, "renderer readonly");

  console.log("ALL_0997N_TEACHING_PLANNING_FRONTEND_ROUTE_ADAPTER_RUNTIME_SMOKE_OK");
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
