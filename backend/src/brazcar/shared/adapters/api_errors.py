"""The error shapes every route's refusal actually takes, so `contract/openapi.json` says so.

Ninja turns a raised `HttpError(status, message)` into `{"detail": "<message>"}` and a
`pydantic.ValidationError` (a malformed body, query or path value) into
`{"detail": [{"type", "loc", "msg"}, ...]}`, on any operation, whether or not that operation's own
`response=` ever mentioned the status. Schemathesis found this (D-065, D-156): every status a route
can genuinely reach belongs in its `response=`, via `with_errors`, or the contract keeps describing
less than the code does.
"""

from http import HTTPStatus

from ninja import Schema

Response = dict[object, type | None]


class ErrorOut(Schema):
    """What `HttpError(status, message)` renders as: a fixed, human-readable refusal."""

    detail: str


class ValidationErrorItem(Schema):
    type: str
    loc: list[str | int]
    msg: str


class ValidationErrorOut(Schema):
    """A `pydantic.ValidationError` ninja catches renders the field-by-field list; a route that
    reuses 422 for its own refusal (`HttpError(422, "...")`, most of `rides`) renders the same
    single message `ErrorOut` does. Both are real, so `detail` is either shape."""

    detail: list[ValidationErrorItem] | str


def with_errors(  # noqa: PLR0913 - one flag per status a route can reach, all optional
    response: Response | type,
    *,
    bad_request: bool = False,
    unauthorized: bool = False,
    forbidden: bool = False,
    not_found: bool = False,
    conflict: bool = False,
    gone: bool = False,
    too_many_requests: bool = False,
    validation: bool = False,
) -> Response:
    """`response`, plus the error status(es) this exact route can reach. Order matches how a
    request is refused: the request itself, authentication, authorization, "not found", a conflict
    with the resource's own state, a resource that existed and no longer serves ("gone"), a rate
    limit, then input validation."""
    merged: Response = dict(response) if isinstance(response, dict) else {HTTPStatus.OK: response}
    if bad_request:
        merged[HTTPStatus.BAD_REQUEST] = ErrorOut
    if unauthorized:
        merged[HTTPStatus.UNAUTHORIZED] = ErrorOut
    if forbidden:
        merged[HTTPStatus.FORBIDDEN] = ErrorOut
    if not_found:
        merged[HTTPStatus.NOT_FOUND] = ErrorOut
    if conflict:
        merged[HTTPStatus.CONFLICT] = ErrorOut
    if gone:
        merged[HTTPStatus.GONE] = ErrorOut
    if too_many_requests:
        merged[HTTPStatus.TOO_MANY_REQUESTS] = ErrorOut
    if validation:
        # Body that never parses as JSON at all never reaches pydantic: ninja answers 400 with its
        # own plain message (`{"detail": "Cannot parse request body"}`) before 422 is even possible,
        # on every route that reads a body (D-156, Schemathesis's malformed-JSON case found it).
        merged[HTTPStatus.BAD_REQUEST] = ErrorOut
        merged[HTTPStatus.UNPROCESSABLE_CONTENT] = ValidationErrorOut
    return merged
