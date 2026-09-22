import pytest
from pydantic import Field, ValidationError

from brazcar.shared.domain.model import FrozenModel


class Seats(FrozenModel):
    free: int = Field(ge=0)


def test_state_cannot_be_changed_in_place() -> None:
    seats = Seats(free=3)

    with pytest.raises(ValidationError):
        seats.free = 2  # pyright: ignore[reportAttributeAccessIssue] - proving the runtime guard


def test_evolve_returns_a_changed_copy_and_keeps_the_original() -> None:
    seats = Seats(free=3)

    assert seats.evolve(free=2) == Seats(free=2)
    assert seats == Seats(free=3)


def test_evolve_validates_where_model_copy_would_not() -> None:
    seats = Seats(free=3)

    assert seats.model_copy(update={"free": -1}).free == -1
    with pytest.raises(ValidationError):
        seats.evolve(free=-1)


def test_evolve_rejects_a_field_that_does_not_exist() -> None:
    with pytest.raises(ValidationError):
        Seats(free=3).evolve(fre=2)
