import pytest
from hypothesis import given
from pydantic import TypeAdapter, ValidationError

from brazcar.shared.domain.personal_data import has_personal_data
from brazcar.shared.domain.phone import (
    BRAZIL,
    AreaCode,
    CountryCode,
    InvalidPhoneNumberError,
    PhoneNumber,
    SubscriberNumber,
)

from .phone_strategies import brazilian_mobiles, legacy_jid_users

HOME = "+5561999990001"


@pytest.mark.parametrize(
    "raw",
    [
        "+55 (61) 9 9999-0001",
        "+55 61 99999-0001",
        "(61) 99999-0001",
        "61 9 9999 0001",
        "61999990001",
        "5561999990001",
        "061 99999-0001",
        "61.99999.0001",
        HOME,
    ],
)
def test_reads_what_people_type_with_or_without_country(raw: str) -> None:
    assert PhoneNumber.parse(raw).e164() == HOME


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "abc",
        "61 9",  # too short
        "99999-0001",  # no area code
        "20 99999-0001",  # area code that does not exist
        "+55 61 9999-0001",  # a mobile without the ninth digit, typed by a person
        "61 99999-00011",  # too long
    ],
)
def test_refuses_what_is_not_a_number(raw: str) -> None:
    with pytest.raises(InvalidPhoneNumberError):
        PhoneNumber.parse(raw)


def test_splits_into_parts_that_know_what_they_are() -> None:
    phone = PhoneNumber.parse(HOME)

    assert phone.country == BRAZIL
    assert phone.area == AreaCode(value="61")
    assert phone.subscriber == SubscriberNumber(value="999990001")
    assert (phone.country.display(), AreaCode(value="61").display(), phone.subscriber.display()) == (
        "+55",
        "(61)",
        "99999-0001",
    )


def test_every_format_the_platform_needs() -> None:
    phone = PhoneNumber.parse(HOME)

    assert phone.e164() == HOME
    assert phone.jid_user() == "5561999990001"
    assert phone.display() == "(61) 99999-0001"
    assert phone.international() == "+55 61 99999-0001"
    assert phone.region() == "Distrito Federal"
    assert phone.is_mobile


def test_a_landline_is_a_number_but_not_a_mobile() -> None:
    landline = PhoneNumber.parse("(61) 3333-4444")

    assert landline.display() == "(61) 3333-4444"
    assert not landline.is_mobile


def test_a_number_from_abroad_keeps_its_country_on_display() -> None:
    phone = PhoneNumber.parse("+1 415 555 2671")

    assert phone.country == CountryCode(value=1)
    assert phone.display() == phone.international() == "+1 415-555-2671"
    assert phone.region() == "San Francisco, CA"


def test_parts_that_do_not_make_a_valid_number_are_refused() -> None:
    with pytest.raises(ValidationError):
        PhoneNumber(country=BRAZIL, area=AreaCode(value="20"), subscriber=SubscriberNumber(value="999990001"))
    with pytest.raises(ValidationError):  # the right digits, split in the wrong place
        PhoneNumber(country=BRAZIL, area=AreaCode(value="619"), subscriber=SubscriberNumber(value="99990001"))


def test_is_written_and_read_as_e164_by_pydantic() -> None:
    adapter = TypeAdapter(PhoneNumber)
    phone = adapter.validate_python(HOME)

    assert phone == PhoneNumber.parse(HOME)
    assert adapter.dump_python(phone) == HOME
    assert adapter.validate_json(adapter.dump_json(phone)) == phone
    with pytest.raises(ValidationError):
        adapter.validate_python("61 9")


def test_a_jid_user_is_read_with_its_country() -> None:
    assert PhoneNumber.from_jid_user("5561999990001").e164() == HOME
    assert PhoneNumber.from_jid_user("14155552671").display() == "+1 415-555-2671"
    assert PhoneNumber.from_jid_user("556133334444").display() == "(61) 3333-4444"  # a landline stays


@pytest.mark.parametrize("user", ["", "+5561999990001", "5561999990001@s.whatsapp.net", "55"])
def test_a_jid_user_is_digits_only(user: str) -> None:
    with pytest.raises(InvalidPhoneNumberError):
        PhoneNumber.from_jid_user(user)


def test_an_old_whatsapp_address_gets_the_ninth_digit_back() -> None:
    """WhatsApp keeps `556199990001` for an account from before the ninth digit (D-138)."""
    assert PhoneNumber.from_jid_user("556199990001") == PhoneNumber.parse("(61) 99999-0001")


@given(brazilian_mobiles)
def test_every_representation_reads_back_as_the_same_number(phone: PhoneNumber) -> None:
    for text in (phone.e164(), phone.display(), phone.international()):
        assert PhoneNumber.parse(text) == phone
    assert PhoneNumber.from_jid_user(phone.jid_user()) == phone
    assert phone.area is not None
    assert phone.display() == f"{phone.area.display()} {phone.subscriber.display()}"
    assert phone.is_mobile


@given(legacy_jid_users)
def test_old_and_new_whatsapp_addresses_are_one_person(user: str) -> None:
    old = PhoneNumber.from_jid_user(user)
    new = PhoneNumber.from_jid_user(old.jid_user())

    assert old == new
    assert len(new.jid_user()) == len(user) + 1


@given(brazilian_mobiles)
def test_the_personal_data_detector_spots_every_form_of_a_phone(phone: PhoneNumber) -> None:
    """The free-text detector keeps its own looser pattern (D-128); it must never miss a number
    this value object would accept, in any of the forms the platform writes it."""
    for text in (phone.e164(), phone.display(), phone.international(), phone.jid_user()):
        assert has_personal_data(f"chama no {text} que eu passo"), text
