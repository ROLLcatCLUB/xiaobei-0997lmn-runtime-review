from __future__ import annotations

import argparse
import json
import py_compile
import subprocess
import sys
import zipfile
from pathlib import Path


STAGE_ID = "0997L_TEACHING_PLANNING_FRONTEND_READONLY_ROUTE_BINDING_SMOKE_AND_SEAL"
SLUG = "teaching_planning_frontend_readonly_route_binding_smoke_and_seal_0997L"
MARKER = "ALL_0997L_TEACHING_PLANNING_FRONTEND_READONLY_ROUTE_BINDING_SMOKE_AND_SEAL_CHECKS_OK"
FINAL_STATUS = "SEALED_WITH_UPSTREAM_EVIDENCE_CAVEAT"
NEXT_STAGE = "0997M_TEACHING_PLANNING_RUNTIME_REACHABILITY_AND_FRONTEND_BINDING_GATE"

FALSE_FLAGS = [
    "frontend_route_binding_performed",
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
    print(f"0997L_VALIDATION_FAIL: {message}", file=sys.stderr)
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


def run_0997k_validator(root: Path) -> None:
    script = root / "scripts/validate_teaching_planning_frontend_readonly_route_binding_apply_0997K.py"
    if not script.exists():
        fail("missing 0997K validator")
    for args in ([], ["--root", str(root)]):
        completed = subprocess.run([sys.executable, str(script), *args], cwd=str(root), text=True, capture_output=True, check=False)
        if completed.returncode != 0:
            fail(f"0997K validator failed: {completed.stdout} {completed.stderr}")
        if "ALL_0997K_TEACHING_FRONTEND_READONLY_ROUTE_BINDING_APPLY_CHECKS_OK" not in completed.stdout:
            fail("0997K marker missing")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    args = parser.parse_args()
    root = Path(args.root).resolve()

    required = [
        f"docs/foundation/{SLUG}.md",
        f"docs/foundation/{SLUG}.json",
        f"docs/audit/{SLUG}_report.md",
        f"docs/audit/{SLUG}_result.json",
        f"docs/audit/{SLUG}_checklist.json",
        f"scripts/validate_{SLUG}.py",
        f"docs/audit_packages/{SLUG}_manifest.json",
        f"docs/audit_packages/{SLUG}.zip",
        "docs/foundation/teaching_planning_frontend_readonly_route_binding_apply_0997K.json",
        "docs/audit/teaching_planning_frontend_readonly_route_binding_apply_0997K_result.json",
        "docs/audit_packages/teaching_planning_frontend_readonly_route_binding_apply_0997K_manifest.json",
        "docs/audit/teaching_planning_frontend_readonly_route_binding_gate_0997J_result.json",
        "docs/audit/teaching_planning_backend_readonly_route_apply_smoke_seal_0997GHI_result.json",
    ]
    for rel in required:
        if not (root / rel).exists():
            fail(f"missing required file: {rel}")

    py_compile.compile(str(root / f"scripts/validate_{SLUG}.py"), doraise=True)
    run_0997k_validator(root)

    contract = load_json(root, f"docs/foundation/{SLUG}.json")
    result = load_json(root, f"docs/audit/{SLUG}_result.json")
    checklist = load_json(root, f"docs/audit/{SLUG}_checklist.json")
    manifest = load_json(root, f"docs/audit_packages/{SLUG}_manifest.json")
    source_k = load_json(root, "docs/audit/teaching_planning_frontend_readonly_route_binding_apply_0997K_result.json")
    source_j = load_json(root, "docs/audit/teaching_planning_frontend_readonly_route_binding_gate_0997J_result.json")
    source_ghi = load_json(root, "docs/audit/teaching_planning_backend_readonly_route_apply_smoke_seal_0997GHI_result.json")

    if contract.get("stage_id") != STAGE_ID or result.get("stage_id") != STAGE_ID:
        fail("stage_id mismatch")
    if contract.get("final_status") != FINAL_STATUS or result.get("final_status") != FINAL_STATUS:
        fail("final_status mismatch")
    if source_k.get("final_status") != "READONLY_ROUTE_BINDING_APPLY_PRE_FLIGHT_PASS":
        fail("0997K source status mismatch")
    if source_j.get("final_status") != "HOLD_FRONTEND_ROUTE_BINDING_NEEDS_RUNTIME_SYNC":
        fail("0997J source status mismatch")
    if source_ghi.get("final_status") != "SEALED_WITH_FLASK_ENV_CAVEAT":
        fail("0997GHI source status mismatch")
    if source_ghi.get("flask_test_client_smoke") != "NOT_RUN_ENV_FLASK_MISSING":
        fail("0997GHI Flask caveat must be preserved")
    if source_k.get("runtime_binding_performed") is not False:
        fail("0997K runtime binding must be false")

    assert_false_flags(result, "result")
    assert_false_flags(contract.get("boundary_flags", {}), "contract boundary")
    if result.get("upstream_evidence_caveat_preserved") is not True:
        fail("upstream evidence caveat must be true")
    if contract.get("sealed_findings", {}).get("runtime_adapter_files_absent") is not True:
        fail("runtime adapter absence must be sealed")
    for path in [
        "frontend/workbench/workbench_teaching_planning_route_adapter_0997K.js",
        "frontend/workbench/workbench_teaching_planning_route_adapter_0997K.css",
        "frontend/workbench/workbench_teaching_planning_route_adapter_0997K.init.js",
    ]:
        if (root / path).exists():
            fail(f"forbidden runtime candidate file exists: {path}")

    for key, value in checklist.get("checks", {}).items():
        if value is not True:
            fail(f"checklist item not true: {key}")
    if result.get("next_stage") != NEXT_STAGE or contract.get("next_stage") != NEXT_STAGE:
        fail("next_stage mismatch")
    if result.get("next_stage_requires_explicit_decision") is not True or contract.get("next_stage_requires_explicit_decision") is not True:
        fail("next_stage_requires_explicit_decision must be true")

    text = read_text(root, f"docs/audit/{SLUG}_report.md") + read_text(root, f"docs/foundation/{SLUG}.md")
    for phrase in [
        "0997L=SEALED_WITH_UPSTREAM_EVIDENCE_CAVEAT",
        "0997K` ZIP_ENTRY_COUNT=9",
        "upstream_evidence_caveat_preserved=true",
        "runtime_binding_performed=false",
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
