# Teaching Planning Runtime Handoff: 0997N -> Next Session

Date: 2026-06-11

Workspace: `D:\Documents\SmartEdu\xiaobei-core`

## Current Status

The teaching planning line has moved from readonly preflight into a local readonly runtime connection.

Latest completed stage:

```text
0997N_TEACHING_PLANNING_FRONTEND_ROUTE_ADAPTER_READONLY_RUNTIME_APPLY
final_status=RUNTIME_READONLY_APPLY_PASS
```

The current runtime is not yet full "talk to Xiaobei with model generation." It means:

```text
frontend/workbench/index.html
-> frontend/workbench/workbench_teaching_planning_route_adapter_0997N.js
-> http://127.0.0.1:8082/api/workbench/teaching-planning/*
-> readonly teaching planning backend state and renderer payload
```

It does not yet mean:

```text
teacher input
-> provider/model call
-> generated new plan
-> persisted state/database/memory
```

Provider, database, memory, Feishu, formal export, and active teaching plan writes remain disabled.

## Runtime URLs

Frontend:

```text
http://127.0.0.1:5177/frontend/workbench/index.html
```

Backend status:

```text
http://127.0.0.1:8082/api/workbench/teaching-planning/status
```

Default teaching planning session:

```text
tp_session_syn_001
```

The local backend runtime was started with:

```powershell
python scripts/run_teaching_planning_runtime_0997N.py
```

If the next session needs to restart it:

```powershell
cd D:\Documents\SmartEdu\xiaobei-core
python scripts/run_teaching_planning_runtime_0997N.py
```

This uses Flask on port `8082`.

## Important Environment Note

During 0997N, Flask was installed into the local user Python environment because the default Python 3.14 initially lacked Flask:

```powershell
python -m pip install --user Flask
```

After that, `scripts/smoke_teaching_planning_backend_readonly_route_0997I.py` changed from the old fallback mode to:

```text
SMOKE_MODE=FLASK_TEST_CLIENT_PASS
```

0997M validator was updated to tolerate this environment upgrade while preserving the historical HOLD result.

## Completed Stages In This Segment

### 0997L

```text
0997L_TEACHING_PLANNING_FRONTEND_READONLY_ROUTE_BINDING_SMOKE_AND_SEAL
final_status=SEALED_WITH_UPSTREAM_EVIDENCE_CAVEAT
validator no-arg PASS
validator --root PASS
ZIP_ENTRY_COUNT=21
SHA256=4122CCF334A050DEC53E0767D3694952E9AFFB5B5FDDAC2AE2E9BB55ECC28976
marker=ALL_0997L_TEACHING_PLANNING_FRONTEND_READONLY_ROUTE_BINDING_SMOKE_AND_SEAL_CHECKS_OK
```

Purpose: seal 0997K's readonly frontend route binding preflight chain.

### 0997M

Original decision:

```text
0997M_TEACHING_PLANNING_RUNTIME_REACHABILITY_AND_FRONTEND_BINDING_GATE
final_status=HOLD_RUNTIME_REACHABILITY_NEEDS_FLASK_ENV
```

After Flask was installed, validator was made compatible with upgraded runtime smoke.

Latest package hash after validator update:

```text
validator no-arg PASS
validator --root PASS
ZIP_ENTRY_COUNT=19
SHA256=30EEC9D7B661949A13A2DBA8E67FA1E24FFE7CD50056185E0B98D0292E99F833
marker=ALL_0997M_TEACHING_PLANNING_RUNTIME_REACHABILITY_AND_FRONTEND_BINDING_GATE_CHECKS_OK
```

Purpose: decide whether runtime reachability allows frontend binding. Historical result remains HOLD, but 0997N resolves the local runtime condition.

### 0997N

```text
0997N_TEACHING_PLANNING_FRONTEND_ROUTE_ADAPTER_READONLY_RUNTIME_APPLY
final_status=RUNTIME_READONLY_APPLY_PASS
validator no-arg PASS
validator --root PASS
ZIP_ENTRY_COUNT=17
SHA256=940CD2396373C93E8512B71F193B23B817D8727A290E285609A1E6CFAB8FECA7
marker=ALL_0997N_TEACHING_PLANNING_FRONTEND_ROUTE_ADAPTER_READONLY_RUNTIME_APPLY_CHECKS_OK
```

Purpose: create a narrow readonly frontend route adapter and local Flask runtime launcher.

## Files To Inherit

### Runtime Apply Files

```text
frontend/workbench/workbench_teaching_planning_route_adapter_0997N.js
scripts/run_teaching_planning_runtime_0997N.py
scripts/smoke_teaching_planning_frontend_route_adapter_0997N.js
scripts/validate_teaching_planning_frontend_route_adapter_readonly_runtime_apply_0997N.py
```

Modified existing files:

```text
frontend/workbench/index.html
backend/xiaobei_ai/routes.py
```

`frontend/workbench/index.html` now includes:

```html
<script src="./workbench_teaching_planning_route_adapter_0997N.js"></script>
```

`backend/xiaobei_ai/routes.py` now allows local CORS origins:

```text
http://127.0.0.1:5177
http://localhost:5177
```

### 0997N Evidence

```text
docs/foundation/teaching_planning_frontend_route_adapter_readonly_runtime_apply_0997N.md
docs/foundation/teaching_planning_frontend_route_adapter_readonly_runtime_apply_0997N.json
outputs/teaching_planning_frontend_0997N/runtime_http_smoke_0997N.json
docs/audit/teaching_planning_frontend_route_adapter_readonly_runtime_apply_0997N_report.md
docs/audit/teaching_planning_frontend_route_adapter_readonly_runtime_apply_0997N_result.json
docs/audit/teaching_planning_frontend_route_adapter_readonly_runtime_apply_0997N_checklist.json
docs/audit_packages/teaching_planning_frontend_route_adapter_readonly_runtime_apply_0997N_manifest.json
docs/audit_packages/teaching_planning_frontend_route_adapter_readonly_runtime_apply_0997N.zip
```

### Upstream Evidence

```text
docs/foundation/teaching_planning_frontend_readonly_route_binding_smoke_and_seal_0997L.*
docs/audit/teaching_planning_frontend_readonly_route_binding_smoke_and_seal_0997L_*
docs/audit_packages/teaching_planning_frontend_readonly_route_binding_smoke_and_seal_0997L.*

docs/foundation/teaching_planning_runtime_reachability_and_frontend_binding_gate_0997M.*
docs/audit/teaching_planning_runtime_reachability_and_frontend_binding_gate_0997M_*
docs/audit_packages/teaching_planning_runtime_reachability_and_frontend_binding_gate_0997M.*
```

### Backend Source

```text
backend/xiaobei_ai/teaching_planning_readonly_routes_0997H.py
outputs/teaching_planning_backend_0997D/readonly_backend_states_0997D.json
outputs/teaching_planning_backend_0997D/renderer_payload_previews_0997D.json
scripts/smoke_teaching_planning_backend_readonly_route_0997I.py
```

## Validation Commands

From repo root:

```powershell
python scripts/smoke_teaching_planning_backend_readonly_route_0997I.py
node scripts/smoke_teaching_planning_frontend_route_adapter_0997N.js
python scripts/validate_teaching_planning_frontend_route_adapter_readonly_runtime_apply_0997N.py
python scripts/validate_teaching_planning_frontend_route_adapter_readonly_runtime_apply_0997N.py --root .
```

Expected markers:

```text
ALL_0997I_TEACHING_PLANNING_BACKEND_READONLY_ROUTE_HTTP_SMOKE_OK
ALL_0997N_TEACHING_PLANNING_FRONTEND_ROUTE_ADAPTER_RUNTIME_SMOKE_OK
ALL_0997N_TEACHING_PLANNING_FRONTEND_ROUTE_ADAPTER_READONLY_RUNTIME_APPLY_CHECKS_OK
```

## Current Boundary

Allowed now:

```text
readonly backend route read
readonly frontend adapter
readonly renderer payload preview
local Flask runtime for teaching planning
local browser fetch from workbench to 8082
```

Still forbidden:

```text
provider/model call
database write
memory store write
retrieval
Feishu read/write
student data read
formal export
active teaching plan write
active timetable write
deploy
automatic confirmation
```

## Important Product Interpretation

The user asked whether runtime means they can chat with Xiaobei.

Answer: not yet.

Current runtime means the teaching planning module can read backend state and renderer payload from a real local backend route.

The next step toward chatting with Xiaobei should be:

```text
teacher input
-> teaching-planning agent-action dry-run route
-> readonly semantic action result
-> left chat message / right renderer update preview
```

This should still be dry-run and readonly before real provider/model integration.

## Recommended Next Stage

Proceed with:

```text
0997O_TEACHING_PLANNING_BROWSER_RUNTIME_VISUAL_SMOKE_AND_SEAL
```

Goal:

- open `frontend/workbench/index.html`
- verify the page loads `workbench_teaching_planning_route_adapter_0997N.js`
- verify browser-side runtime status:

```js
window.SHIWEI_TEACHING_PLANNING_RUNTIME_0997N
```

- verify the backend data is visible in the teaching planning render area
- verify no provider/database/memory/Feishu writes happen
- seal 0997N runtime apply

Suggested outputs:

```text
docs/foundation/teaching_planning_browser_runtime_visual_smoke_and_seal_0997O.md
docs/foundation/teaching_planning_browser_runtime_visual_smoke_and_seal_0997O.json
outputs/teaching_planning_frontend_0997O/browser_runtime_visual_smoke_0997O.json
docs/audit/teaching_planning_browser_runtime_visual_smoke_and_seal_0997O_report.md
docs/audit/teaching_planning_browser_runtime_visual_smoke_and_seal_0997O_result.json
docs/audit/teaching_planning_browser_runtime_visual_smoke_and_seal_0997O_checklist.json
scripts/validate_teaching_planning_browser_runtime_visual_smoke_and_seal_0997O.py
docs/audit_packages/teaching_planning_browser_runtime_visual_smoke_and_seal_0997O_manifest.json
docs/audit_packages/teaching_planning_browser_runtime_visual_smoke_and_seal_0997O.zip
```

Expected final status:

```text
0997O=RUNTIME_VISUAL_SMOKE_SEALED
next_stage=0997P_TEACHING_PLANNING_AGENT_ACTION_DRY_RUN_CHAT_RUNTIME_APPLY
next_stage_requires_explicit_decision=false
```

## Stage After 0997O

After visual smoke seal, continue to:

```text
0997P_TEACHING_PLANNING_AGENT_ACTION_DRY_RUN_CHAT_RUNTIME_APPLY
```

Goal:

- connect teacher chat input to `/api/workbench/teaching-planning/agent-action/dry-run`
- return readonly semantic action candidates
- display Xiaobei's action suggestion in the chat
- optionally update the right preview in readonly mode
- still no provider call, no database write, no memory write

This is the first step where the user can "talk to Xiaobei" in a limited runtime sense.

## Notes For Next Codex Session

Do not restart from old 0997M HOLD unless the 8082 backend cannot run.

Start by checking:

```powershell
Get-NetTCPConnection -LocalPort 8082 -ErrorAction SilentlyContinue
Invoke-RestMethod http://127.0.0.1:8082/api/workbench/teaching-planning/status
Invoke-WebRequest http://127.0.0.1:5177/frontend/workbench/index.html -UseBasicParsing
```

If 8082 is down, restart:

```powershell
python scripts/run_teaching_planning_runtime_0997N.py
```

Then continue with 0997O.
