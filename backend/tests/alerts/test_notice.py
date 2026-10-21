from datetime import UTC, datetime
from uuid import uuid4

from brazcar.alerts.domain import NOTICE_TITLE, Notice, ride_found

from .fakes import NOW, ZONE

STOPS = ("Rodoviária do Plano", "Setor Tradicional", "Brazlândia")


def _notice(departure_at: datetime) -> Notice:
    return ride_found(uuid4(), ride_id=uuid4(), stops=STOPS, departure_at=departure_at, now=NOW, zone=ZONE)


def test_the_body_says_today_in_the_exact_format() -> None:
    departure = datetime(2026, 10, 21, 17, 30, tzinfo=UTC)  # 14:30 local, same day as NOW

    assert _notice(departure).body == "Rodoviária do Plano → Brazlândia, hoje às 14:30"


def test_the_body_says_tomorrow() -> None:
    departure = datetime(2026, 10, 22, 17, 30, tzinfo=UTC)

    assert _notice(departure).body == "Rodoviária do Plano → Brazlândia, amanhã às 14:30"


def test_the_body_says_the_date_after_tomorrow() -> None:
    departure = datetime(2026, 10, 24, 17, 30, tzinfo=UTC)

    assert _notice(departure).body == "Rodoviária do Plano → Brazlândia, 24/10 às 14:30"


def test_the_time_is_the_boards_not_utc() -> None:
    departure = datetime(2026, 10, 22, 2, 30, tzinfo=UTC)  # 21/10, 23:30 local: still "hoje"

    assert _notice(departure).body.endswith("hoje às 23:30")


def test_title_tag_and_url() -> None:
    alert_id, ride_id = uuid4(), uuid4()

    notice = ride_found(
        alert_id,
        ride_id=ride_id,
        stops=STOPS,
        departure_at=datetime(2026, 10, 21, 17, 30, tzinfo=UTC),
        now=NOW,
        zone=ZONE,
    )

    assert notice.title == NOTICE_TITLE == "Apareceu carona"
    assert notice.tag == str(alert_id)
    assert notice.url == f"/caronas/{ride_id}"


def test_the_notice_has_no_field_that_could_carry_a_person() -> None:
    """A new field must change this test on purpose: the payload never names anyone (D-171, D-178)."""
    assert set(Notice.model_fields) == {"title", "body", "tag", "url"}
