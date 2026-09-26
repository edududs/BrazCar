"""Every route that changes state goes through the write gate (D-168), unless it is listed below
with its reason. Read from the mounted API itself, the way the architecture test reads the source:
a new write route is held by default, or this test fails until someone says why it is not."""

from collections.abc import Iterator

import pytest
from ninja.operation import Operation

from brazcar.config.api import api
from brazcar.shared.adapters.session_auth import SessionAuth

WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})

UNGATED: dict[str, str] = {
    "give_invite_email": "public: the invite's own link is the credential, before any account exists",
    "register_account": "public: the e-mail link finishes an account that is born confirmed",
    "log_in": "entering is how a held account reaches the way out of the hold",
    "log_out": "ending the session is always allowed, and changes nothing of the account",
    "request_password_reset": "public, and a held account may still recover its password",
    "confirm_password_reset": "public: the e-mailed token is the credential",
    "request_email_change": "the way out of the hold: asking for the confirmation link",
    "confirm_email": "the way out of the hold: opening the confirmation link",
    "delete_account": "leaving is always allowed, held or not",
    "request_removal": "public by design: the request of someone who never had an account (D-172)",
}
"""Write operations that deliberately skip the gate, by `operation_id`, each with its reason."""


def operations() -> Iterator[Operation]:
    for _, router in api._routers:  # noqa: SLF001  # pyright: ignore[reportPrivateUsage] - ninja exposes the mounted routers only here
        for view in router.path_operations.values():
            yield from view.operations


def write_operations() -> dict[str, Operation]:
    found: dict[str, Operation] = {}
    for operation in operations():
        if WRITE_METHODS.isdisjoint(operation.methods):
            continue
        assert operation.operation_id, f"a write route without operation_id: {operation.methods}"
        found[operation.operation_id] = operation
    return found


def gated(operation: Operation) -> bool:
    """Every way in is the session with the gate: an alternative without it would bypass the hold."""
    callbacks: list[object] = [*operation.auth_callbacks]  # pyright: ignore[reportUnknownMemberType] - ninja types them as bare callables
    return bool(callbacks) and all(isinstance(auth, SessionAuth) and auth.gated for auth in callbacks)


WRITES = write_operations()


@pytest.mark.parametrize("operation_id", sorted(set(WRITES) - set(UNGATED)))
def test_every_write_route_is_gated(operation_id: str) -> None:
    assert gated(WRITES[operation_id]), (
        f"{operation_id} changes state without the write gate: use writer_auth(), or list it in UNGATED"
    )


@pytest.mark.parametrize("operation_id", sorted(UNGATED))
def test_every_listed_exception_still_exists_and_is_ungated(operation_id: str) -> None:
    assert operation_id in WRITES, f"{operation_id} is no longer a write route: take it off UNGATED"
    assert not gated(WRITES[operation_id]), f"{operation_id} is gated now: take it off UNGATED"


def test_the_guard_sees_the_write_routes() -> None:
    """Guards against a vacuous pass: the gated routes of rides, accounts and feedback are all here."""
    assert {"publish_ride", "request_contact", "add_car", "update_profile", "send_feedback"} <= set(WRITES)
