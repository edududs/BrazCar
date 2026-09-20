"""The versioned contract must match what the code serves. Regenerate with `uv run poe openapi`."""

import json
from pathlib import Path

from ninja.responses import NinjaJSONEncoder

from brazcar.config.api import api

CONTRACT = Path(__file__).resolve().parents[2] / "contract" / "openapi.json"


def test_contract_file_matches_the_api() -> None:
    served: object = json.loads(json.dumps(api.get_openapi_schema(), cls=NinjaJSONEncoder))
    versioned: object = json.loads(CONTRACT.read_text(encoding="utf-8"))

    assert served == versioned, "contract/openapi.json is stale: run `uv run poe openapi` and `yarn gen:api`"
