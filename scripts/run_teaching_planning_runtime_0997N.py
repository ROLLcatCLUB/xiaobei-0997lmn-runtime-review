from __future__ import annotations

import sys
from pathlib import Path

from flask import Flask

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.xiaobei_ai import routes


def create_app() -> Flask:
    routes._workbench_routes_registered = False
    app = Flask(__name__)
    app.register_blueprint(routes.create_blueprint())
    return app


def main() -> int:
    app = create_app()
    app.run(host="127.0.0.1", port=8082, debug=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
