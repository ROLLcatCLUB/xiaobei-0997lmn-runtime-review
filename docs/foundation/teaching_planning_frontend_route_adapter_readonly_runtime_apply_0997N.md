# 0997N Teaching Planning Frontend Route Adapter Readonly Runtime Apply

`0997N_TEACHING_PLANNING_FRONTEND_ROUTE_ADAPTER_READONLY_RUNTIME_APPLY=RUNTIME_READONLY_APPLY_PASS`

## Purpose

This stage moves teaching planning from preflight into a local readonly runtime experience. It creates a narrow frontend adapter and a local Flask runtime launcher so the workbench can read teaching planning state from the backend readonly route.

## Runtime Surface

- frontend page: `http://127.0.0.1:5177/frontend/workbench/index.html`
- backend runtime: `http://127.0.0.1:8082/api/workbench/teaching-planning/status`
- default session: `tp_session_syn_001`
- adapter: `frontend/workbench/workbench_teaching_planning_route_adapter_0997N.js`

## Changes

- Added a readonly teaching planning frontend adapter.
- Added a local Flask runtime launcher.
- Added local CORS allowlist entries for `127.0.0.1:5177` and `localhost:5177`.
- Added the adapter script to `frontend/workbench/index.html`.

## Runtime Smoke

- Flask test client PASS
- real HTTP status endpoint PASS
- real HTTP session endpoint PASS
- real HTTP renderer payload endpoint PASS
- static index includes adapter PASS
- static adapter file served PASS
- CORS for `http://127.0.0.1:5177` PASS

## Boundary

- readonly=true
- database_written=false
- provider_called=false
- provider_context_injection=false
- memory_store_written=false
- retrieval_enabled=false
- feishu_called=false
- student_data_read=false
- formal_export_created=false
- deploy_performed=false

## Next

recommended_next_stage=0997O_TEACHING_PLANNING_BROWSER_RUNTIME_VISUAL_SMOKE_AND_SEAL

next_stage_requires_explicit_decision=false
