from datetime import UTC, datetime
from uuid import uuid4

import pytest
from hypothesis import given
from hypothesis import strategies as st
from pydantic import ValidationError

from brazcar.accounts.domain import (
    Account,
    CarNotFoundError,
    ForeignPhoneNumberError,
    NotAMobilePhoneError,
    PlateAlreadyOnAccountError,
    account_phone,
    normalize_license_plate,
)
from brazcar.shared.domain.phone import InvalidPhoneNumberError

ACCEPTED_AT = datetime(2026, 9, 22, 12, 0, tzinfo=UTC)


def register(**overrides: str | None) -> Account:
    fields: dict[str, str | None] = {"phone": "61 99999-0001", "display_name": "Ana", "email": None}
    return Account.register(**{**fields, **overrides}, accepted_terms_at=ACCEPTED_AT)  # pyright: ignore[reportArgumentType]


@pytest.mark.parametrize(
    "raw",
    [
        "61999990001",
        "(61) 99999-0001",
        "+55 61 9 9999-0001",
        "5561999990001",
        "61 9.9999.0001",
        "061 99999-0001",  # the long-distance zero some people still type
    ],
)
def test_phone_is_stored_as_e164_whatever_the_typing(raw: str) -> None:
    assert account_phone(raw).e164() == "+5561999990001"


@pytest.mark.parametrize("raw", ["", "99999-0001", "61 9", "20 99999-0001", "abc"])
def test_phone_must_be_a_number_with_area_code(raw: str) -> None:
    with pytest.raises(InvalidPhoneNumberError):
        account_phone(raw)


def test_phone_of_another_country_is_refused_for_now() -> None:
    with pytest.raises(ForeignPhoneNumberError):
        account_phone("+1 415 555 2671")


def test_a_landline_cannot_own_an_account() -> None:
    with pytest.raises(NotAMobilePhoneError):
        account_phone("(61) 3333-4444")


def test_the_account_itself_refuses_a_landline_built_by_hand() -> None:
    with pytest.raises(ValidationError):
        Account(id=uuid4(), phone="+556133334444", display_name="Ana", terms_accepted_at=ACCEPTED_AT)  # pyright: ignore[reportArgumentType]


@pytest.mark.parametrize(
    ("raw", "plate"), [("abc-1234", "ABC1234"), ("abc 1d23", "ABC1D23"), ("JKL0A99", "JKL0A99")]
)
def test_plate_accepts_old_and_mercosul_formats(raw: str, plate: str) -> None:
    assert normalize_license_plate(raw) == plate


@pytest.mark.parametrize("raw", ["", "AB1234", "ABCD123", "ABC12345", "1BC1234"])
def test_plate_rejects_other_shapes(raw: str) -> None:
    with pytest.raises(ValueError, match="plate"):
        normalize_license_plate(raw)


def test_register_normalizes_and_keeps_no_verification() -> None:
    account = register(phone="(61) 99999-0001", display_name="  Ana ", email="")

    assert account.phone.e164() == "+5561999990001"
    assert account.display_name == "Ana"
    assert account.email is None
    assert account.phone_verified_at is None
    assert account.terms_accepted_at == ACCEPTED_AT
    assert account.can_drive is False


def test_email_when_given_must_be_an_email() -> None:
    with pytest.raises(ValidationError):
        register(email="not-an-email")


def test_display_name_is_required() -> None:
    with pytest.raises(ValidationError):
        register(display_name="   ")


def test_adding_a_car_returns_a_copy_that_can_drive() -> None:
    account = register()

    driving = account.add_car(model="Gol prata", color="prata", plate="abc-1234")

    assert account.cars == ()
    assert driving.can_drive is True
    assert driving.cars[0].plate == "ABC1234"


def test_the_same_plate_cannot_be_added_twice() -> None:
    account = register().add_car(model="Gol", color="prata", plate="ABC1234")

    with pytest.raises(PlateAlreadyOnAccountError):
        account.add_car(model="Outro", color="azul", plate="abc 1234")


def test_removing_a_car_needs_it_to_exist() -> None:
    account = register().add_car(model="Gol", color="prata", plate="ABC1234")
    car = account.cars[0]

    assert account.remove_car(car.id).cars == ()
    with pytest.raises(CarNotFoundError):
        account.remove_car(car.id).remove_car(car.id)


@given(
    st.lists(
        st.from_regex(r"[A-Z]{3}[0-9][A-Z0-9][0-9]{2}", fullmatch=True), min_size=1, max_size=5, unique=True
    )
)
def test_cars_can_be_added_and_removed_in_any_order(plates: list[str]) -> None:
    account = register()
    for plate in plates:
        account = account.add_car(model="m", color="c", plate=plate)
    assert [car.plate for car in account.cars] == plates
    for car in reversed(account.cars):
        account = account.remove_car(car.id)
    assert account.cars == ()
