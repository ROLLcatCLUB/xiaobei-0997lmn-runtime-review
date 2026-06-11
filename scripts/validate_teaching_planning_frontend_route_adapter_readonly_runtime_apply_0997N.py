from __future__ import annotations

import argparse
import json
import py_compile
import subprocess
import sys
import zipfile
from pathlib import Path


STAGE_ID = "0997N_TEACHING_PLANNING_FRONTEND_ROUTE_ADAPTER_READONLY_RUNTIME_APPLY"
SLUG = "teaching_planning_frontend_route_adapter_readonly_runtime_apply_0997N"
MARKER = "ALL_0997N_TEACHING_PLANNING_FRONTEND_ROUTE_ADAPTER_READONLY_RUNTIME_APPLY_CHECKS_OK"
FINAL_STATUS = "RUNTIME_READONLY_APPLY_PASS"
NEXT_STAGE = "0997O_TEACHING_PLANNING_BROWSER_RUNTIME_VISUAL_SMOKE_AND_SEAL"


FALSE_FLAGS = [
    "database_written",
    "provider_called",
    "provider_context_injection",
    "memory_store_written",
    "retrieval_enabled",
    "registry_store_written",
    "feishu_called",
    "feishu_token_read",
    "student_data_read",
    "env_secret_read",
    "active_teaching_plan_written",
    "active_timetable_written",
    "formal_export_created",
    "deploy_performed",
]


def fail(message: str) -> None:
    print(f"0997N_VALIDATION_FAIL: {message}", file=sys.stderr)
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


def run_command(root: Path, command: list[str], expected: str | None = None) -> str:
    completed = subprocess.run(command, cwd=str(root), text=True, capture_output=True, check=False)
    output = (completed.stdout or "") + (completed.stderr or "")
    if completed.returncode != 0:
        fail(f"command failed {' '.join(command)}: {output}")
    if expected and expected not in output:
        fail(f"expected marker missing from {' '.join(command)}: {expected}")
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    args = parser.parse_args()
    root = Path(args.root).resolve()

    required = [
        f"docs/foundation/{SLUG}.md",
        f"docs/foundation/{SLUG}.json",
        "outputs/teaching_planning_frontend_0997N/runtime_http_smoke_0997N.json",
        f"docs/audit/{SLUG}_report.md",
        f"docs/audit/{SLUG}_result.json",
        f"docs/audit/{SLUG}_checklist.json",
        f"scripts/validate_{SLUG}.py",
        "scripts/smoke_teaching_planning_frontend_route_adapter_0997N.js",
        "scripts/run_teaching_planning_runtime_0997N.py",
        "frontend/workbench/workbench_teaching_planning_route_adapter_0997N.js",
        "frontend/workbench/index.html",
        "backend/xiaobei_ai/routes.py",
        f"docs/audit_packages/{SLUG}_manifest.json",
        f"docs/audit_packages/{SLUG}.zip",
    ]
    for rel in required:
        if not (root / rel).exists():
            fail(f"missing required file: {rel}")

    py_compile.compile(str(root / f"scripts/validate_{SLUG}.py"), doraise=True)
    py_compile.compile(str(root / "scripts/run_teaching_planning_runtime_0997N.py"), doraise=True)
    run_command(root, ["node", "--check", "frontend/workbench/workbench_teaching_planning_route_adapter_0997N.js"])
    run_command(root, ["node", "--check", "scripts/smoke_teaching_planning_frontend_route_adapter_0997N.js"])
    run_command(root, [sys.executable, "scripts/smoke_teaching_planning_backend_readonly_route_0997I.py"], "SMOKE_MODE=FLASK_TEST_CLIENT_PASS")
    run_command(root, ["node", "scripts/smoke_teaching_planning_frontend_route_adapter_0997N.js"], "ALL_0997N_TEACHING_PLANNING_FRONTEND_ROUTE_ADAPTER_RUNTIME_SMOKE_OK")

    contract = load_json(root, f"docs/foundation/{SLUG}.json")
    result = load_json(root, f"docs/audit/{SLUG}_result.json")
    smoke = load_json(root, "outputs/teaching_planning_frontend_0997N/runtime_http_smoke_0997N.json")
    checklist = load_json(root, f"docs/audit/{SLUG}_checklist.json")
    manifest = load_json(root, f"docs/audit_packages/{SLUG}_manifest.json")

    if contract.get("stage_id") != STAGE_ID or result.get("stage_id") != STAGE_ID or smoke.get("stage_id") != STAGE_ID:
        fail("stage_id mismatch")
    if contract.get("final_status") != FINAL_STATUS or result.get("final_status") != FINAL_STATUS:
        fail("final_status mismatch")
    if smoke.get("final_status") != "RUNTIME_HTTP_SMOKE_PASS":
        fail("runtime smoke result mismatch")
    for payload in [contract.get("boundary_flags", {}), result, smoke]:
        assert_false_flags(payload, "boundary")
    if contract.get("boundary_flags", {}).get("readonly") is not True or result.get("readonly") is not True:
        fail("readonly must be true")

    for key in [
        "flask_test_client_smoke",
        "real_http_status_endpoint",
        "real_http_session_endpoint",
        "real_http_renderer_payload_endpoint",
        "cors_5177",
    ]:
        if result.get(key) not in {"PASS", True}:
            fail(f"result {key} must be PASS")
    if result.get("static_index_includes_adapter") is not True or smoke.get("static_index_includes_adapter") is not True:
        fail("index adapter inclusion must be true")
    if result.get("static_adapter_served") is not True or smoke.get("static_adapter_served") is not True:
        fail("adapter served must be true")

    index = read_text(root, "frontend/workbench/index.html")
    adapter = read_text(root, "frontend/workbench/workbench_teaching_planning_route_adapter_0997N.js")
    routes = read_text(root, "backend/xiaobei_ai/routes.py")
    if "workbench_teaching_planning_route_adapter_0997N.js" not in index:
        fail("index missing 0997N adapter")
    if STAGE_ID not in adapter:
        fail("adapter missing stage id")
    if "http://127.0.0.1:5177" not in routes or "http://localhost:5177" not in routes:
        fail("routes.py missing 5177 CORS origins")

    for key, value in checklist.get("checks", {}).items():
        if value is not True:
            fail(f"checklist item not true: {key}")
    if result.get("next_stage") != NEXT_STAGE or contract.get("next_stage") != NEXT_STAGE:
        fail("next_stage mismatch")

    text = read_text(root, f"docs/audit/{SLUG}_report.md") + read_text(root, f"docs/foundation/{SLUG}.md")
    for phrase in [
        "0997N=RUNTIME_READONLY_APPLY_PASS",
        "real_http_status_endpoint=PASS",
        "static_index_includes_adapter=true",
        "cors_5177=PASS",
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
