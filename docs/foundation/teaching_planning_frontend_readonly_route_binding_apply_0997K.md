# 0997K Teaching Planning Frontend Readonly Route Binding Apply

## Stage

- `stage_id`: `0997K_TEACHING_PLANNING_FRONTEND_READONLY_ROUTE_BINDING_APPLY`
- `line`: `0997_FRONTEND_BINDING_LINE`
- `previous_stage`: `0997J_TEACHING_PLANNING_FRONTEND_READONLY_ROUTE_BINDING_GATE`
- `previous_status`: `HOLD_FRONTEND_ROUTE_BINDING_NEEDS_RUNTIME_SYNC`
- `final_status`: `READONLY_ROUTE_BINDING_APPLY_PRE_FLIGHT_PASS`
- `next_stage`: `0997L_TEACHING_PLANNING_FRONTEND_READONLY_ROUTE_BINDING_SMOKE_AND_SEAL`
- `next_stage_requires_explicit_decision`: `true`

## 目的

本阶段在不改前端运行时、不改后端、不发起真实 Provider/数据库/记忆动作的前提下，完成**教学规划前端路由绑定只读候选计划**与**绑定前预检清单**，用于后续 `0997L` 的运行时前端接入。

## 输入依据

- `0997J_TEACHING_PLANNING_FRONTEND_READONLY_ROUTE_BINDING_GATE`
- `0997GHI_TEACHING_PLANNING_BACKEND_READONLY_ROUTE_APPLY_SMOKE_SEAL`
- sealed 后端只读路由定义（`backend/xiaobei_ai/teaching_planning_readonly_routes_0997H.py`）

## 只读候选输出

本阶段会生成两类只读证据：

- `outputs/teaching_planning_frontend_0997K/readonly_frontend_route_binding_candidate_plan_0997K.json`
- `outputs/teaching_planning_frontend_0997K/frontend_route_binding_preflight_readiness_0997K.json`

前者定义绑定候选（包含 API 套件、调用顺序、候选注入位置、失败回退策略）；后者定义前置同步/回归前提（服务器端同步、Flask 路由可达性、环境依赖）与回退动作。

## 本阶段边界（必须为 false）

- `frontend_route_binding_performed=false`
- `readonly_frontend_route_binding_apply_performed=false`
- `frontend_modified=false`
- `frontend_runtime_modified=false`
- `frontend_workbench_index_modified=false`
- `index_html_modified=false`
- `backend_modified=false`
- `backend_runtime_modified=false`
- `route_created=false`
- `endpoint_created=false`
- `import_created=false`
- `runtime_connected=false`
- `server_synced=false`
- `runtime_adapter_created=false`
- `runtime_adapter_registered=false`
- `provider_called=false`
- `provider_context_injection=false`
- `feishu_api_called=false`
- `feishu_token_read=false`
- `student_data_read=false`
- `env_secret_read=false`
- `database_written=false`
- `registry_store_written=false`
- `memory_store_written=false`
- `retrieval_enabled=false`
- `active_teaching_plan_written=false`
- `active_timetable_written=false`
- `formal_export_created=false`
- `deploy_performed=false`
- `candidate_actions_made_executable=false`
- `inactive_actions_made_executable=false`

## 关键结论

- `readonly_frontend_route_binding_candidate_plan_created = true`
- `frontend_route_binding_preflight_ready = true`
- `readonly_route_binding_apply_performed = false`
- `apply_allowed_next = false`（仍保守，等待 0997L 运行时验真）
- `next_stage_requires_explicit_decision = true`

## 下一步

- `0997L_TEACHING_PLANNING_FRONTEND_READONLY_ROUTE_BINDING_SMOKE_AND_SEAL`
- 运行时确认：当后端 Flask 路由同步可验证后，再进入 `0997L` 的真实 smoke/封装。
