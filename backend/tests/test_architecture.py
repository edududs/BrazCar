"""The core of each context may import only the stdlib, pydantic and the layers beneath it; a pure
computation library enters through one named module (D-136)."""

import ast
import sys
from importlib.util import resolve_name
from pathlib import Path

import pytest

ROOT = "brazcar"
PACKAGE = Path(__file__).resolve().parents[1] / "src" / ROOT
SHARED = "shared"
CONTEXTS = ("rides", "accounts", "places", "search", "importing", "feedback", "alerts", "push", SHARED)
LAYERS = {
    "domain": ("domain",),
    "application": ("domain", "application"),
}
CORE = [(context, layer) for context in CONTEXTS for layer in LAYERS]
LIBRARY_DOORS = {f"{ROOT}.shared.domain.phone.codec": {"phonenumbers"}}
"""Pure-computation libraries the core may use, each through one module and nowhere else (D-136)."""


def allowed(context: str, layer: str, module: str) -> set[str]:
    """Own layers beneath, plus the same layers of the shared kernel. Never another context."""
    return (
        {"pydantic"}
        | LIBRARY_DOORS.get(module, set())
        | {f"{ROOT}.{owner}.{beneath}" for owner in (context, SHARED) for beneath in LAYERS[layer]}
    )


def violations(source: str, module: str, context: str, layer: str) -> list[str]:
    package = module.rsplit(".", 1)[0]
    imported: list[str] = []
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            imported.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            name = "." * node.level + (node.module or "")
            imported.append(resolve_name(name, package) if node.level else name)
    permitted = allowed(context, layer, module)
    return [
        name
        for name in imported
        if name.split(".")[0] not in sys.stdlib_module_names
        and not any(name == prefix or name.startswith(f"{prefix}.") for prefix in permitted)
    ]


@pytest.mark.parametrize(("context", "layer"), CORE)
def test_core_layers_import_only_what_they_may(context: str, layer: str) -> None:
    directory = PACKAGE / context / layer
    assert directory.is_dir(), f"{directory} is missing: the guard would pass vacuously"
    for path in directory.rglob("*.py"):
        module = ".".join((ROOT, *path.relative_to(PACKAGE).with_suffix("").parts))
        assert not violations(path.read_text(encoding="utf-8"), module, context, layer), path


@pytest.mark.parametrize("context", CONTEXTS)
def test_every_context_has_an_adapters_layer(context: str) -> None:
    assert (PACKAGE / context / "adapters").is_dir()


def test_demo_is_composition_only() -> None:
    """`demo` is not a context: it has no vocabulary and no rule, only the seed that drives the
    other contexts' use cases (D-133). Growing a core there would mean it had become one."""
    packages = {
        child.name for child in (PACKAGE / "demo").iterdir() if child.is_dir() and child.name != "__pycache__"
    }
    assert packages == {"adapters"}


def test_guard_detects_deliberate_violations() -> None:
    assert violations("import django", f"{ROOT}.rides.domain.ride", "rides", "domain")
    assert violations(
        "from django.db import models", f"{ROOT}.rides.application.publish", "rides", "application"
    )
    assert violations("import ninja", f"{ROOT}.places.application.catalog", "places", "application")
    assert violations("import resend", f"{ROOT}.accounts.application.recover", "accounts", "application")
    assert violations("import httpx", f"{ROOT}.importing.application.ports", "importing", "application")
    assert violations("import ollama", f"{ROOT}.importing.domain.judgement", "importing", "domain")
    assert violations(f"from {ROOT}.rides import adapters", f"{ROOT}.rides.domain.ride", "rides", "domain")
    assert violations("from ..application import ports", f"{ROOT}.rides.domain.ride", "rides", "domain")
    assert violations(
        f"from {ROOT}.rides.adapters import x", f"{ROOT}.rides.application.bus", "rides", "application"
    )
    assert violations(
        f"from {ROOT}.places.domain import Place", f"{ROOT}.rides.domain.ride", "rides", "domain"
    )
    assert violations(f"from {ROOT}.config import settings", f"{ROOT}.shared.domain.clock", SHARED, "domain")
    assert violations("import phonenumbers", f"{ROOT}.rides.domain.driver", "rides", "domain")
    assert violations(
        "from phonenumbers import geocoder", f"{ROOT}.shared.domain.phone.phone_number", SHARED, "domain"
    )


def test_guard_accepts_the_allowed_imports() -> None:
    domain = "import asyncio\nfrom pydantic import BaseModel\nfrom .base import FrozenModel\n"
    assert not violations(domain, f"{ROOT}.rides.domain.ride", "rides", "domain")
    application = (
        f"from ..domain import Ride\nfrom {ROOT}.shared.application import ports\n"
        "from . import ports as own\n"
    )
    assert not violations(application, f"{ROOT}.rides.application.publish", "rides", "application")
    codec = "import phonenumbers\nfrom phonenumbers import geocoder\n"
    assert not violations(codec, f"{ROOT}.shared.domain.phone.codec", SHARED, "domain")


PUSH_SDK = ("pywebpush", "py_vapid", "http_ece", "cryptography")
PUSH_DOOR = f"{ROOT}.push.adapters.web_push"
"""The Web Push libraries enter through one module and nowhere else (D-182)."""


def push_sdk_imports(source: str) -> list[str]:
    imported: list[str] = []
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            imported.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and not node.level:
            imported.append(node.module or "")
    return [name for name in imported if name.split(".")[0] in PUSH_SDK]


def test_only_the_web_push_adapter_imports_the_push_sdk() -> None:
    offenders: list[str] = []
    for path in PACKAGE.rglob("*.py"):
        module = ".".join((ROOT, *path.relative_to(PACKAGE).with_suffix("").parts))
        if module != PUSH_DOOR and push_sdk_imports(path.read_text(encoding="utf-8")):
            offenders.append(module)
    assert not offenders


def test_push_sdk_guard_detects_deliberate_violations() -> None:
    assert push_sdk_imports("import pywebpush")
    assert push_sdk_imports("from py_vapid import Vapid02")
    assert push_sdk_imports("import http_ece")
    assert push_sdk_imports("from cryptography.hazmat.primitives import serialization")
    assert not push_sdk_imports("import asyncio, pydantic")
