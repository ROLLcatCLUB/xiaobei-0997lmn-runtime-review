from __future__ import annotations

import argparse
import json
import py_compile
import sys
import zipfile
from pathlib import Path


STAGE_ID = "0997K_TEACHING_PLANNING_FRONTEND_READONLY_ROUTE_BINDING_APPLY"
SLUG = "teaching_planning_frontend_readonly_route_binding_apply_0997K"
MARKER = "ALL_0997K_TEACHING_FRONTEND_READONLY_ROUTE_BINDING_APPLY_CHECKS_OK"
NEXT_STAGE = "0997L_TEACHING_PLANNING_FRONTEND_READONLY_ROUTE_BINDING_SMOKE_AND_SEAL"
SOURCE_GATE = "0997J_TEACHING_PLANNING_FRONTEND_READONLY_ROUTE_BINDING_GATE"
SOURCE_BACKEND_RESULT = "0997GHI_TEACHING_PLANNING_BACKEND_READONLY_ROUTE_APPLY_SMOKE_SEAL"
EXPECTED_FINAL_STATUS = "READONLY_ROUTE_BINDING_APPLY_PRE_FLIGHT_PASS"

FALSE_FLAGS = [
    "apply_performed",
    "readonly_frontend_route_binding_apply_performed",
    "frontend_route_binding_performed",
    "runtime_binding_performed",
    "backend_modified",
    "backend_route_file_modified",
    "backend_runtime_modified",
    "frontend_modified",
    "frontend_runtime_modified",
    "frontend_workbench_index_modified",
    "index_html_modified",
    "route_created",
    "endpoint_created",
    "import_created",
    "runtime_connected",
    "runtime_adapter_created",
    "runtime_adapter_registered",
    "server_synced",
    "provider_called",
    "provider_context_injection",
    "feishu_api_called",
    "feishu_token_read",
    "student_data_read",
    "env_secret_read",
    "memory_store_written",
    "registry_store_written",
    "database_written",
    "retrieval_enabled",
    "active_teaching_plan_written",
    "active_timetable_written",
    "formal_export_created",
    "deploy_performed",
    "candidate_actions_made_executable",
    "inactive_actions_made_executable",
]


def fail(message: str) -> None:
    print(f"0997K_VALIDATION_FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_json(path: Path) -> dict:
    if not path.exists():
        fail(f"missing required file: {path}")
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as exc:
        fail(f"invalid json in {path}: {exc}")


def read_text(path: Path) -> str:
    if not path.exists():
        fail(f"missing required text file: {path}")
    return path.read_text(encoding="utf-8-sig")


def assert_clean_entries(entries: list[str]) -> None:
    for entry in entries:
        if "\\" in entry or entry.startswith("/") or ".." in Path(entry).parts:
            fail(f"unclean zip entry: {entry}")


def assert_false_flags(payload: dict, keys: list[str], label: str) -> None:
    for key in keys:
        if payload.get(key) is not False:
            fail(f"{label} field {key} must be false")


def read_path_exists(path: Path) -> bool:
    return path.exists()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".", help="repo root or extracted review tree")
    args = parser.parse_args()
    root = Path(args.root).resolve()

    paths = {
        "contract_md": root / f"docs/foundation/{SLUG}.md",
        "contract": root / f"docs/foundation/{SLUG}.json",
        "candidate_plan": root / "outputs/teaching_planning_frontend_0997K/readonly_frontend_route_binding_candidate_plan_0997K.json",
        "preflight": root / "outputs/teaching_planning_frontend_0997K/frontend_route_binding_preflight_readiness_0997K.json",
        "report": root / f"docs/audit/{SLUG}_report.md",
        "result": root / f"docs/audit/{SLUG}_result.json",
        "checklist": root / f"docs/audit/{SLUG}_checklist.json",
        "validator": root / f"scripts/validate_{SLUG}.py",
        "manifest": root / f"docs/audit_packages/{SLUG}_manifest.json",
        "zip": root / f"docs/audit_packages/{SLUG}.zip",
        "source_gate_contract": root / "docs/foundation/teaching_planning_frontend_readonly_route_binding_gate_0997J.json",
        "source_gate_result": root / "docs/audit/teaching_planning_frontend_readonly_route_binding_gate_0997J_result.json",
        "source_backend_result": root / "docs/audit/teaching_planning_backend_readonly_route_apply_smoke_seal_0997GHI_result.json",
    }
    for path in paths.values():
        if not path.exists():
            fail(f"required path missing: {path}")

    # Syntax check for this validator.
    try:
        py_compile.compile(str(paths["validator"]))
    except Exception as exc:  # pragma: no cover
        fail(f"py_compile failed: {exc}")

    contract = load_json(paths["contract"])
    result = load_json(paths["result"])
    candidate_plan = load_json(paths["candidate_plan"])
    preflight = load_json(paths["preflight"])
    checklist = load_json(paths["checklist"])
    manifest = load_json(paths["manifest"])
    source_gate_contract = load_json(paths["source_gate_contract"])
    source_gate_result = load_json(paths["source_gate_result"])
    source_backend = load_json(paths["source_backend_result"])

    report_text = read_text(paths["report"])
    contract_text = read_text(paths["contract_md"])

    for payload_name, payload in [
        ("contract", contract),
        ("result", result),
        ("candidate_plan", candidate_plan),
        ("preflight", preflight),
    ]:
        if payload.get("stage_id") != STAGE_ID:
            fail(f"{payload_name} stage_id mismatch")

    if contract.get("final_status") != EXPECTED_FINAL_STATUS:
        fail("contract final_status mismatch")
    if result.get("final_status") != EXPECTED_FINAL_STATUS:
        fail("result final_status mismatch")
    if contract.get("previous_stage") != SOURCE_GATE:
        fail("contract previous_stage mismatch")
    if contract.get("next_stage") != NEXT_STAGE or result.get("next_stage") != NEXT_STAGE:
        fail("next_stage mismatch")
    if result.get("next_stage_requires_explicit_decision") is not True:
        fail("result next_stage_requires_explicit_decision must be true")

    if source_gate_contract.get("stage_id") != SOURCE_GATE:
        fail("source gate contract stage mismatch")
    if source_gate_result.get("final_status") != "HOLD_FRONTEND_ROUTE_BINDING_NEEDS_RUNTIME_SYNC":
        fail("source gate final_status mismatch")
    if source_gate_result.get("apply_allowed_next") is not False:
        fail("source gate apply_allowed_next should be false")

    if source_backend.get("stage") != SOURCE_BACKEND_RESULT:
        fail("source backend result stage mismatch")
    if source_backend.get("final_status") != "SEALED_WITH_FLASK_ENV_CAVEAT":
        fail("source backend final_status mismatch")
    if source_backend.get("flask_test_client_smoke") != "NOT_RUN_ENV_FLASK_MISSING":
        fail("runtime caveat mismatch")
    if source_backend.get("route_count") != 7:
        fail("backend route count mismatch")

    if candidate_plan.get("final_status") != "READONLY_ROUTE_BINDING_CANDIDATE_PLAN_READY":
        fail("candidate plan status mismatch")
    if preflight.get("final_status") != "READONLY_ROUTE_BINDING_PRE_FLIGHT_PASS":
        fail("preflight status mismatch")

    if preflight.get("runtime_smoke_available", False) is not False:
        fail("runtime_smoke_available should be false in readonly preflight stage")
    if preflight.get("front_readiness", {}).get("route_binding_real") is not False:
        fail("route_binding_real should remain false")
    if preflight.get("front_readiness", {}).get("runtime_adapter_added") is not False:
        fail("runtime_adapter_added should remain false")
    if preflight.get("front_readiness", {}).get("index_html_touched") is not False:
        fail("index_html_touched should remain false")

    if result.get("runtime_sync_required") is not True:
        fail("runtime_sync_required should be true")
    if result.get("apply_allowed_next") is not False:
        fail("apply_allowed_next should be false in preflight")
    if result.get("apply_allowed_next_requires_user_confirmation") is not True:
        fail("apply_allowed_next_requires_user_confirmation should be true")
    if result.get("recommend_next_stage") not in (None, result.get("recommended_next_stage")):
        pass

    assert_false_flags(result, FALSE_FLAGS, "result")
    assert_false_flags(contract.get("boundary_flags", {}), FALSE_FLAGS, "contract.boundary_flags")

    checks = checklist.get("checks", {})
    required_checks = [
        "source_gate_sealed_with_runtime_caveat",
        "source_backend_routes_count_is_7",
        "frontend_readonly_candidate_plan_generated",
        "frontend_preflight_readiness_generated",
        "frontend_route_binding_not_performed",
        "frontent_runtime_not_connected",
        "index_html_not_modified",
        "frontend_not_modified",
        "backend_not_modified",
        "provider_and_data_actions_forbidden",
        "memory_db_provider_retrieval_disabled",
        "active_content_not_written",
        "apply_allowed_next_false",
        "apply_allowed_next_requires_user_confirmation",
    ]
    for item in required_checks:
        if checks.get(item) is not True:
            fail(f"checklist item false: {item}")

    required_terms = [
        "0997K=READONLY_ROUTE_BINDING_APPLY_PRE_FLIGHT_PASS",
        "route_count=7",
        "apply_allowed_next=false",
        "apply_allowed_next_requires_user_confirmation=true",
        "next_stage=0997L_TEACHING_PLANNING_FRONTEND_READONLY_ROUTE_BINDING_SMOKE_AND_SEAL",
        "frontend_modified=false",
        "runtime_bound_not_performed",
    ]
    for term in required_terms:
        if term not in (report_text + contract_text):
            fail(f"contract/report missing required term: {term}")

    candidate_adapter = root / "frontend/workbench/workbench_teaching_planning_route_adapter_0997K.js"
    candidate_adapter_css = root / "frontend/workbench/workbench_teaching_planning_route_adapter_0997K.css"
    candidate_init = root / "frontend/workbench/workbench_teaching_planning_route_adapter_0997K.init.js"
    for candidate in [candidate_adapter, candidate_adapter_css, candidate_init]:
        if candidate.exists():
            fail(f"runtime binding candidate file should not exist in 0997K preflight: {candidate}")

    entries = manifest.get("zip_entries", [])
    if manifest.get("zip_entry_count") != len(entries):
        fail("manifest zip_entry_count mismatch")
    if manifest.get("stage") != STAGE_ID or manifest.get("final_status") != EXPECTED_FINAL_STATUS:
        fail("manifest metadata mismatch")
    if manifest.get("next_stage") != NEXT_STAGE:
        fail("manifest next_stage mismatch")
    if manifest.get("next_stage_requires_explicit_decision") is not True:
        fail("manifest next_stage_requires_explicit_decision must be true")
    assert_clean_entries(entries)

    for entry in entries:
        if not (root / entry).exists():
            fail(f"manifest item missing on disk: {entry}")

    with zipfile.ZipFile(paths["zip"], "r") as zf:
        names = zf.namelist()

    if sorted(names) != sorted(entries):
        fail("zip and manifest entries mismatch")
    assert_clean_entries(names)

    manifest_minus_zip = sorted(set(entries) - set(names))
    zip_minus_manifest = sorted(set(names) - set(entries))
    if manifest_minus_zip or zip_minus_manifest:
        fail(f"manifest/zip mismatch: manifest_minus_zip={manifest_minus_zip}, zip_minus_manifest={zip_minus_manifest}")

    print(MARKER)


if __name__ == "__main__":
    main()
