from datetime import UTC, datetime
from uuid import uuid4

from hypothesis import strategies as st

from brazcar.accounts.domain import Account, Car

phones = st.integers(11, 99).flatmap(
    lambda area: st.integers(900_000_000, 999_999_999).map(lambda n: f"+55{area}{n}")
)
plates = st.from_regex(r"[A-Z]{3}[0-9][A-Z0-9][0-9]{2}", fullmatch=True)
short_texts = st.text("abcdefghijklmnopqrstuvwxyzáéíóúãõç ", min_size=1, max_size=20).filter(str.strip)
emails = st.from_regex(r"[a-z]{1,8}@[a-z]{1,8}\.com", fullmatch=True)


@st.composite
def cars(draw: st.DrawFn) -> Car:
    return Car(id=uuid4(), model=draw(short_texts), color=draw(short_texts), plate=draw(plates))


@st.composite
def accounts(draw: st.DrawFn) -> Account:
    own_cars = draw(st.lists(cars(), max_size=3, unique_by=lambda car: car.plate))
    return Account(
        id=uuid4(),
        phone=draw(phones),
        display_name=draw(short_texts),
        email=draw(st.none() | emails),
        terms_accepted_at=datetime(2026, 9, 22, tzinfo=UTC),
        cars=tuple(own_cars),
    )
