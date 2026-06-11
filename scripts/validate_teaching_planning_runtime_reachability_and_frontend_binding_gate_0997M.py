from __future__ import annotations

import argparse
import json
import py_compile
import subprocess
import sys
import zipfile
from pathlib import Path


STAGE_ID = "0997M_TEACHING_PLANNING_RUNTIME_REACHABILITY_AND_FRONTEND_BINDING_GATE"
SLUG = "teaching_planning_runtime_reachability_and_frontend_binding_gate_0997M"
MARKER = "ALL_0997M_TEACHING_PLANNING_RUNTIME_REACHABILITY_AND_FRONTEND_BINDING_GATE_CHECKS_OK"
FINAL_STATUS = "HOLD_RUNTIME_REACHABILITY_NEEDS_FLASK_ENV"
PREVIOUS_STAGE = "0997L_TEACHING_PLANNING_FRONTEND_READONLY_ROUTE_BINDING_SMOKE_AND_SEAL"
NEXT_STAGE = "0997N_TEACHING_PLANNING_FRONTEND_ROUTE_ADAPTER_READONLY_APPLY_CONTRACT"

FALSE_FLAGS = [
    "frontend_adapter_apply_allowed_now",
    "runtime_binding_allowed_now",
    "route_adapter_creation_allowed_now",
    "browser_smoke_allowed_now",
    "apply_allowed_next",
    "runtime_reachability_confirmed",
    "frontend_route_binding_performed",
    "frontend_adapter_created",
    "readonly_frontend_route_binding_apply_performed",
    "runtime_binding_performed",
    "runtime_adapter_created",
    "runtime_adapter_registered",
    "frontend_modified",
    "frontend_runtime_modified",
    "frontend_workbench_index_modified",
    "index_html_modified",
    "backend_modified",
    "backend_runtime_modified",
    "route_created",
    "endpoint_created",
    "import_created",
    "server_synced",
    "provider_called",
    "provider_context_injection",
    "feishu_api_called",
    "feishu_token_read",
    "student_data_read",
    "env_secret_read",
    "database_written",
    "registry_store_written",
    "memory_store_written",
    "retrieval_enabled",
    "active_teaching_plan_written",
    "active_timetable_written",
    "formal_export_created",
    "deploy_performed",
    "candidate_actions_made_executable",
]


def fail(message: str) -> None:
    print(f"0997M_VALIDATION_FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_json(root: Path, rel: str) -> dict:
    path = root / rel
    if not path.exists():
        fail(f"missing json: {rel}")
    return json.loads(path.read_text(encoding="utf-8-sig"))


def read_text(root: Path, rel: str) -> str:
    path = root / rel
    if not path.exists():
        fail(f"missing text: {rel}")
    return path.read_text(encoding="utf-8-sig")


def assert_clean(entries: list[str]) -> None:
    for entry in entries:
        if "\\" in entry or entry.startswith("/") or ".." in Path(entry).parts:
            fail(f"unclean zip entry: {entry}")


def assert_false_flags(payload: dict, label: str) -> None:
    bad = [key for key in FALSE_FLAGS if payload.get(key) is not False]
    if bad:
        fail(f"{label} flags must be false: {bad}")


def run_smoke(root: Path) -> str:
    script = root / "scripts/smoke_teaching_planning_backend_readonly_route_0997I.py"
    if not script.exists():
        fail("missing backend smoke script")
    completed = subprocess.run([sys.executable, str(script)], cwd=str(root), text=True, capture_output=True, check=False)
    if completed.returncode != 0:
        fail(f"backend smoke failed: {completed.stdout} {completed.stderr}")
    if "ALL_0997I_TEACHING_PLANNING_BACKEND_READONLY_ROUTE_HTTP_SMOKE_OK" not in completed.stdout:
        fail("backend smoke marker missing")
    return completed.stdout


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    args = parser.parse_args()
    root = Path(args.root).resolve()

    required = [
        f"docs/foundation/{SLUG}.md",
        f"docs/foundation/{SLUG}.json",
        "outputs/teaching_planning_frontend_0997M/runtime_reachability_gate_result_0997M.json",
        f"docs/audit/{SLUG}_report.md",
        f"docs/audit/{SLUG}_result.json",
        f"docs/audit/{SLUG}_checklist.json",
        f"scripts/validate_{SLUG}.py",
        f"docs/audit_packages/{SLUG}_manifest.json",
        f"docs/audit_packages/{SLUG}.zip",
        "docs/foundation/teaching_planning_frontend_readonly_route_binding_smoke_and_seal_0997L.json",
        "docs/audit/teaching_planning_frontend_readonly_route_binding_smoke_and_seal_0997L_result.json",
        "docs/audit/teaching_planning_frontend_readonly_route_binding_apply_0997K_result.json",
        "docs/audit/teaching_planning_backend_readonly_route_apply_smoke_seal_0997GHI_result.json",
        "backend/xiaobei_ai/teaching_planning_readonly_routes_0997H.py",
        "scripts/smoke_teaching_planning_backend_readonly_route_0997I.py",
        "outputs/teaching_planning_backend_0997D/readonly_backend_states_0997D.json",
        "outputs/teaching_planning_backend_0997D/renderer_payload_previews_0997D.json",
    ]
    for rel in required:
        if not (root / rel).exists():
            fail(f"missing required file: {rel}")

    py_compile.compile(str(root / f"scripts/validate_{SLUG}.py"), doraise=True)
    smoke_output = run_smoke(root)

    contract = load_json(root, f"docs/foundation/{SLUG}.json")
    result = load_json(root, f"docs/audit/{SLUG}_result.json")
    reachability = load_json(root, "outputs/teaching_planning_frontend_0997M/runtime_reachability_gate_result_0997M.json")
    checklist = load_json(root, f"docs/audit/{SLUG}_checklist.json")
    manifest = load_json(root, f"docs/audit_packages/{SLUG}_manifest.json")
    source_l = load_json(root, "docs/audit/teaching_planning_frontend_readonly_route_binding_smoke_and_seal_0997L_result.json")
    source_k = load_json(root, "docs/audit/teaching_planning_frontend_readonly_route_binding_apply_0997K_result.json")
    source_ghi = load_json(root, "docs/audit/teaching_planning_backend_readonly_route_apply_smoke_seal_0997GHI_result.json")

    for name, payload in [("contract", contract), ("result", result), ("reachability", reachability)]:
        if payload.get("stage_id") != STAGE_ID:
            fail(f"{name} stage_id mismatch")
    if contract.get("final_status") != FINAL_STATUS or result.get("final_status") != FINAL_STATUS:
        fail("final status mismatch")
    if source_l.get("final_status") != "SEALED_WITH_UPSTREAM_EVIDENCE_CAVEAT":
        fail("0997L source status mismatch")
    if source_k.get("final_status") != "READONLY_ROUTE_BINDING_APPLY_PRE_FLIGHT_PASS":
        fail("0997K source status mismatch")
    if source_ghi.get("final_status") != "SEALED_WITH_FLASK_ENV_CAVEAT":
        fail("0997GHI source status mismatch")

    live_smoke_is_expected = (
        "DIRECT_ROUTE_HANDLER_SMOKE_PASS_WITH_FLASK_MISSING_CAVEAT" in smoke_output
        or "SMOKE_MODE=FLASK_TEST_CLIENT_PASS" in smoke_output
    )
    if not live_smoke_is_expected:
        fail("expected direct smoke caveat or upgraded Flask smoke pass missing from smoke output")
    for payload in [result, reachability]:
        if payload.get("direct_route_handler_smoke") != "PASS":
            fail("direct route smoke must pass")
        if payload.get("flask_test_client_smoke") != "NOT_RUN_ENV_FLASK_MISSING":
            fail("Flask caveat must be preserved")
        if payload.get("browser_frontend_to_backend_smoke") != "NOT_RUN":
            fail("browser smoke must not run")
        if payload.get("route_count") != 7:
            fail("route_count must be 7")

    assert_false_flags(result, "result")
    assert_false_flags(reachability, "reachability")
    assert_false_flags(contract.get("boundary_flags", {}), "contract boundary")
    decision = contract.get("gate_decision", {})
    for key in [
        "frontend_adapter_apply_allowed_now",
        "runtime_binding_allowed_now",
        "route_adapter_creation_allowed_now",
        "browser_smoke_allowed_now",
        "apply_allowed_next",
    ]:
        if decision.get(key) is not False:
            fail(f"gate decision {key} must be false")
    if decision.get("apply_allowed_next_requires_user_confirmation") is not True:
        fail("apply_allowed_next_requires_user_confirmation must be true")

    for path in [
        "frontend/workbench/workbench_teaching_planning_route_adapter_0997K.js",
        "frontend/workbench/workbench_teaching_planning_route_adapter_0997K.css",
        "frontend/workbench/workbench_teaching_planning_route_adapter_0997K.init.js",
    ]:
        if (root / path).exists():
            fail(f"frontend adapter must not exist yet: {path}")

    for key, value in checklist.get("checks", {}).items():
        if value is not True:
            fail(f"checklist item not true: {key}")
    if result.get("next_stage") != NEXT_STAGE or contract.get("next_stage") != NEXT_STAGE:
        fail("next_stage mismatch")
    if result.get("next_stage_requires_explicit_decision") is not True or contract.get("next_stage_requires_explicit_decision") is not True:
        fail("next stage must require explicit decision")

    text = read_text(root, f"docs/audit/{SLUG}_report.md") + read_text(root, f"docs/foundation/{SLUG}.md")
    for phrase in [
        "0997M=HOLD_RUNTIME_REACHABILITY_NEEDS_FLASK_ENV",
        "direct_route_handler_smoke=PASS",
        "flask_test_client_smoke=NOT_RUN_ENV_FLASK_MISSING",
        "runtime_reachability_confirmed=false",
        "frontend_adapter_apply_allowed_now=false",
        NEXT_STAGE,
    ]:
        if phrase not in text:
            fail(f"missing report phrase: {phrase}")

    entries = manifest.get("zip_entries", [])
    if manifest.get("stage") != STAGE_ID or manifest.get("final_status") != FINAL_STATUS:
        fail("manifest metadata mismatch")
    if manifest.get("zip_entry_count") != len(entries):
        fail("zip_entry_count mismatch")
    assert_clean(entries)
    with zipfile.ZipFile(root / f"docs/audit_packages/{SLUG}.zip", "r") as archive:
        names = archive.namelist()
    if sorted(names) != sorted(entries):
        fail("manifest/zip entries mismatch")
    assert_clean(names)
    if manifest.get("manifest_minus_zip") != [] or manifest.get("zip_minus_manifest") != []:
        fail("manifest zip diff fields must be empty")

    print(MARKER)


if __name__ == "__main__":
    main()
