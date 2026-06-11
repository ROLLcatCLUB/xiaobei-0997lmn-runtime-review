from __future__ import annotations

import sys
import types
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def assert_boundary(payload: dict) -> None:
    boundary = payload.get("runtime_boundary") or {}
    for key in [
        "database_written",
        "feishu_called",
        "provider_called",
        "memory_store_written",
        "frontend_modified",
        "official_export_created",
        "visible_ui_button_layer_created",
    ]:
        if boundary.get(key) is not False:
            raise AssertionError(f"{key} must be false")


def run_flask_smoke() -> str:
    from flask import Flask
    from backend.xiaobei_ai import routes

    routes._workbench_routes_registered = False
    app = Flask(__name__)
    app.register_blueprint(routes.create_blueprint())
    client = app.test_client()

    session_id = "tp_session_syn_001"
    checks = [
        ("GET", "/api/workbench/teaching-planning/status", None, 200),
        ("GET", f"/api/workbench/teaching-planning/session/{session_id}", None, 200),
        ("POST", "/api/workbench/teaching-planning/session/dry-run", {"session_id": session_id}, 200),
        ("POST", "/api/workbench/teaching-planning/agent-action/dry-run", {"utterance": "这个学期周历表可以采用"}, 200),
        ("POST", "/api/workbench/teaching-planning/review-event/dry-run", {"candidate_id": "cand_semester_week_calendar_syn_001", "action_id": "accept_candidate"}, 200),
        ("GET", f"/api/workbench/teaching-planning/renderer-payload/{session_id}", None, 200),
        ("GET", f"/api/workbench/teaching-planning/conflicts/{session_id}", None, 200),
    ]
    for method, path, body, expected in checks:
        response = client.get(path) if method == "GET" else client.post(path, json=body)
        if response.status_code != expected:
            raise AssertionError(f"{method} {path} expected {expected}, got {response.status_code}")
        payload = response.get_json()
        if payload.get("success") is not True:
            raise AssertionError(f"{method} {path} success mismatch")
        if payload.get("stage_id") != "0997H_TEACHING_PLANNING_BACKEND_READONLY_ROUTE_APPLY":
            raise AssertionError(f"{method} {path} stage mismatch")
        assert_boundary(payload)

    missing = client.get("/api/workbench/teaching-planning/session/not_found")
    if missing.status_code != 404:
        raise AssertionError("missing session must return 404")
    assert_boundary(missing.get_json())
    return "FLASK_TEST_CLIENT_PASS"


class FakeRequest:
    method = "GET"
    payload: dict | None = None

    def get_json(self, silent: bool = True):
        return self.payload


class FakeBlueprint:
    def __init__(self):
        self.routes = []

    def route(self, path, methods):
        def decorator(handler):
            self.routes.append({"path": path, "methods": methods, "handler": handler})
            return handler

        return decorator


def run_direct_route_smoke() -> str:
    fake_request = FakeRequest()
    flask_stub = types.ModuleType("flask")
    flask_stub.request = fake_request
    flask_stub.jsonify = lambda payload=None, **kwargs: payload if payload is not None else kwargs
    sys.modules["flask"] = flask_stub

    from backend.xiaobei_ai import teaching_planning_readonly_routes_0997H as route_module

    bp = FakeBlueprint()

    def cors_preflight():
        return {"success": True}, 204

    route_module.register_routes(bp, cors_preflight)
    route_map = {item["path"]: item["handler"] for item in bp.routes}
    for expected in [
        "/api/workbench/teaching-planning/status",
        "/api/workbench/teaching-planning/session/<session_id>",
        "/api/workbench/teaching-planning/session/dry-run",
        "/api/workbench/teaching-planning/agent-action/dry-run",
        "/api/workbench/teaching-planning/review-event/dry-run",
        "/api/workbench/teaching-planning/renderer-payload/<session_id>",
        "/api/workbench/teaching-planning/conflicts/<session_id>",
    ]:
        if expected not in route_map:
            raise AssertionError(f"missing registered route {expected}")

    fake_request.method = "GET"
    response, status = route_map["/api/workbench/teaching-planning/status"]()
    if status != 200:
        raise AssertionError("status route failed")
    assert_boundary(response)

    response, status = route_map["/api/workbench/teaching-planning/session/<session_id>"]("tp_session_syn_001")
    if status != 200 or response.get("payload", {}).get("state", {}).get("session", {}).get("session_id") != "tp_session_syn_001":
        raise AssertionError("session route failed")
    assert_boundary(response)

    fake_request.method = "POST"
    fake_request.payload = {"utterance": "这个学期周历表可以采用"}
    response, status = route_map["/api/workbench/teaching-planning/agent-action/dry-run"]()
    if status != 200 or response.get("payload", {}).get("agent_action_command", {}).get("action_id") != "accept_candidate":
        raise AssertionError("agent action route failed")
    assert_boundary(response)

    response, status = route_map["/api/workbench/teaching-planning/session/<session_id>"]("not_found")
    if status != 404:
        raise AssertionError("missing session must return 404")
    assert_boundary(response)
    return "DIRECT_ROUTE_HANDLER_SMOKE_PASS_WITH_FLASK_MISSING_CAVEAT"


def main() -> int:
    try:
        mode = run_flask_smoke()
    except ModuleNotFoundError as exc:
        if exc.name != "flask":
            raise
        mode = run_direct_route_smoke()
    print("SMOKE_MODE=" + mode)
    print("ALL_0997I_TEACHING_PLANNING_BACKEND_READONLY_ROUTE_HTTP_SMOKE_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
