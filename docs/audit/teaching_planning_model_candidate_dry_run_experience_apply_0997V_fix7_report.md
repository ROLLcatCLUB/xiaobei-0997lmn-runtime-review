# 0997V fix7 Teaching Planning Model Candidate Dry-run Experience Apply Report

## Status

- stage_code: `0997V_fix7`
- stage_id: `0997V_TEACHING_PLANNING_MODEL_CANDIDATE_DRY_RUN_EXPERIENCE_APPLY`
- final_status: `MODEL_CANDIDATE_DRY_RUN_SMOKE_PASS`
- smoke_marker: `ALL_0997V_TEACHING_PLANNING_MODEL_CANDIDATE_DRY_RUN_SMOKE_OK`
- local_frontend: `http://127.0.0.1:5177/frontend/workbench/index.html?teaching_planning_session=tp_session_syn_001&structured_patch=0997T&teaching_planning_model_api_base=http%3A%2F%2F127.0.0.1%3A8083%2Fapi%2Fworkbench&v=0997V_fix7`
- local_model_api: `http://127.0.0.1:8083/api/workbench`

## What Changed

0997V fix7 makes the teacher-facing teaching-planning experience usable while keeping the runtime read-only:

- opens the teaching planning card with empty teacher fields instead of fixture-prefilled content;
- lets the teacher provide semester, grade/subject, weekly lessons, and activity weeks in one sentence;
- avoids repetitive one-by-one confirmation when multiple fields are present;
- routes `生成教学工作计划预览` to the real model-candidate dry-run path;
- synchronizes generated model candidate text into the right-side `教学工作计划` preview;
- preserves the renderer switch row: `教学工作计划`, `课务日程表`, `单元课时分配`, `学期周历表`, `课表`;
- prevents legacy mock router, 0995L preview fixture, 0996D visual fixture, 0993D external bundle, and 0997N runtime adapter from overriding live teacher input or generated preview content on the 0997V model URL.

## Verified Smoke Evidence

The browser smoke test executed the following path:

1. `我要做教学规划`
2. `三年级美术，第二学期，每周一节，活动周是创艺节`
3. `请根据右侧基础信息生成教学工作计划预览`

Key assertions from `outputs/teaching_planning_frontend_0997V/model_candidate_dry_run_smoke_0997V.json`:

- initial fields empty: true
- model bridge accepted: true
- model candidate called: true
- model connected: true
- model candidate dry-run POST count: 1
- generated preview synced: true
- right-side fields match teacher input: true
- legacy mock router reply absent: true
- no unit-name follow-up: true
- renderer switch tabs visible: true
- forbidden write request count: 0
- database written: false
- memory store written: false
- review event written: false
- formal export created: false

## Boundary

This is still a read-only model-candidate dry-run experience:

- no database write;
- no memory-store write;
- no Feishu write;
- no review-event write;
- no formal export;
- no classroom app connection;
- no student-submit connection;
- teacher review remains required before any formal result.

## Notes For Review

This is an experience apply/smoke package, not a seal package. It builds on 0997N runtime readonly apply and verifies that teachers can now actually experience a model-backed dry-run conversation and right-side preview synchronization.
