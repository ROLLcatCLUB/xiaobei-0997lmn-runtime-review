from flask import Blueprint, jsonify, request

from . import service
from . import workbench_dry_run_routes
from . import workbench_preview_viewmodel_routes_071C
from . import prototype_backend_experience_spike_0952A
from . import kb_evidence_service
from . import term_review_routes_0950E
from . import assignment_slot_routes_0951B
from . import permission_source_readonly_0987KLM
from . import teaching_planning_readonly_routes_0997H
import os


bp = Blueprint("xiaobei_ai", __name__)
_workbench_routes_registered = False
MEMORY_READONLY_SIDECAR_REGISTRATION_0944MMP7 = {
    "sidecar_id": "xiaobei_memory_mainline_minimal_readonly_sidecar",
    "stage": "0944MMP7_RETRY",
    "enabled": False,
    "readonly": True,
    "registration_only": True,
    "route_registered": False,
    "actual_mainline_mount": False,
    "runtime_connected": False,
    "workbench_runtime_connected": False,
    "endpoint_provider_streaming_connected": False,
    "memory_store_operation": False,
    "planner_retrieval": False,
    "generation_context": False,
    "prompt_supplement": False,
    "real_data_read": False,
    "rendering_0945_mixing": False,
}


def get_memory_readonly_sidecar_registration_0944MMP7():
    return dict(MEMORY_READONLY_SIDECAR_REGISTRATION_0944MMP7)


def _allowed_origin():
    configured = os.environ.get("SMARTEDU_ALLOWED_ORIGIN", "").strip() or os.environ.get("XIAOBEI_ALLOWED_ORIGIN", "").strip()
    request_origin = request.headers.get("Origin", "").strip()
    local_origins = {
        "null",
        "http://127.0.0.1:18082",
        "http://127.0.0.1:8082",
        "http://127.0.0.1:5177",
        "http://localhost:18082",
        "http://localhost:8082",
        "http://localhost:5177",
    }
    if configured:
        return configured
    if request_origin in local_origins:
        return request_origin
    return "http://127.0.0.1:18082"


def _cors_preflight():
    response = jsonify({"success": True})
    response.headers["Access-Control-Allow-Origin"] = _allowed_origin()
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response, 204


@bp.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = _allowed_origin()
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


@bp.route("/api/xiaobei/ai/generate_patch", methods=["POST"])
def generate_patch_route():
    payload = request.get_json(silent=True)
    response, status_code = service.generate_patch(payload)
    return jsonify(response), status_code


@bp.route("/api/xiaobei/ai/runs/<ai_run_id>", methods=["GET"])
def get_run_route(ai_run_id):
    response, status_code = service.get_run(ai_run_id)
    return jsonify(response), status_code


@bp.route("/api/xiaobei/ai/preview_patch", methods=["POST"])
def preview_patch_route():
    payload = request.get_json(silent=True)
    response, status_code = service.preview_patch(payload)
    return jsonify(response), status_code


@bp.route("/api/xiaobei/ai/save_quick_draft", methods=["POST"])
def save_quick_draft_route():
    payload = request.get_json(silent=True)
    response, status_code = service.save_quick_draft(payload)
    return jsonify(response), status_code


@bp.route("/api/xiaobei/ai/drafts/<draft_id>", methods=["GET"])
def get_draft_route(draft_id):
    response, status_code = service.get_draft(draft_id)
    return jsonify(response), status_code


@bp.route("/api/xiaobei/ai/drafts", methods=["GET"])
def list_drafts_route():
    response, status_code = service.list_drafts(request.args)
    return jsonify(response), status_code


@bp.route("/api/xiaobei/ai/drafts/<draft_id>/review", methods=["POST"])
def review_draft_route(draft_id):
    payload = request.get_json(silent=True)
    response, status_code = service.review_draft(draft_id, payload)
    return jsonify(response), status_code


@bp.route("/api/xiaobei/ai/internal_ui_status", methods=["GET"])
def internal_ui_status_route():
    configured = os.environ.get("XIAOBEI_AI_INTERNAL_UI_ENABLED", "").strip().lower()
    local_request = request.remote_addr in {"127.0.0.1", "::1", "localhost"}
    enabled = configured in {"1", "true", "yes", "on"} or local_request
    return jsonify({
        "success": True,
        "enabled": enabled,
        "configured": configured in {"1", "true", "yes", "on"},
        "local_request": local_request,
    }), 200


@bp.route("/api/xiaobei/kb/status", methods=["GET", "OPTIONS"])
def kb_status_route():
    if request.method == "OPTIONS":
        return _cors_preflight()
    response, status_code = kb_evidence_service.status()
    return jsonify(response), status_code


@bp.route("/api/xiaobei/kb/search_evidence", methods=["POST", "OPTIONS"])
def kb_search_evidence_route():
    if request.method == "OPTIONS":
        return _cors_preflight()
    payload = request.get_json(silent=True)
    response, status_code = kb_evidence_service.search_evidence(payload)
    return jsonify(response), status_code


@bp.route("/api/xiaobei/kb/get_chunk", methods=["POST", "OPTIONS"])
def kb_get_chunk_route():
    if request.method == "OPTIONS":
        return _cors_preflight()
    payload = request.get_json(silent=True)
    response, status_code = kb_evidence_service.get_chunk(payload)
    return jsonify(response), status_code


@bp.route("/api/xiaobei/kb/lesson_resources", methods=["POST", "OPTIONS"])
def kb_lesson_resources_route():
    if request.method == "OPTIONS":
        return _cors_preflight()
    payload = request.get_json(silent=True)
    response, status_code = kb_evidence_service.lesson_resources(payload)
    return jsonify(response), status_code


def create_blueprint():
    global _workbench_routes_registered
    if not _workbench_routes_registered:
        workbench_dry_run_routes.register_routes(bp, _cors_preflight)
        workbench_preview_viewmodel_routes_071C.register_routes(bp, _cors_preflight)
        prototype_backend_experience_spike_0952A.register_routes(bp, _cors_preflight)
        term_review_routes_0950E.register_routes(bp, _cors_preflight)
        assignment_slot_routes_0951B.register_routes(bp, _cors_preflight)
        permission_source_readonly_0987KLM.register_routes(bp, _cors_preflight)
        teaching_planning_readonly_routes_0997H.register_routes(bp, _cors_preflight)
        _workbench_routes_registered = True
    return bp
