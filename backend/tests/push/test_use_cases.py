import logging
from datetime import timedelta
from uuid import UUID, uuid4

import pytest

from brazcar.push.application import (
    Delivery,
    ForgetDevices,
    PushToAccount,
    SubscribeDevice,
    UnsubscribeDevice,
)
from brazcar.push.domain import DEVICE_LIMIT, PushMessage

from .fakes import (
    FCM,
    NOW,
    FixedClock,
    InMemorySubscriptionRepository,
    ScriptedTransport,
    make_subscription,
    new_auth,
    new_p256dh,
)

LATER = NOW + timedelta(hours=1)
MESSAGE = PushMessage(title="Carona", body="Há uma carona", tag="ride-1", url="/caronas/1")


def endpoint(name: str) -> str:
    return FCM + name


async def subscribe(
    repository: InMemorySubscriptionRepository, owner_id: UUID, name: str, clock: FixedClock | None = None
) -> None:
    await SubscribeDevice(repository, clock or FixedClock())(
        owner_id, endpoint=endpoint(name), p256dh=new_p256dh(), auth=new_auth()
    )


async def test_a_new_subscription_is_stored() -> None:
    repository = InMemorySubscriptionRepository()
    owner = uuid4()

    saved = await SubscribeDevice(repository, FixedClock())(
        owner, endpoint=endpoint("a"), p256dh=new_p256dh(), auth=new_auth()
    )

    assert repository.rows[endpoint("a")] == saved
    assert (saved.owner_id, saved.created_at, saved.last_used_at) == (owner, NOW, NOW)


async def test_subscribing_again_keeps_the_birth_and_renews_use_and_keys() -> None:
    repository = InMemorySubscriptionRepository()
    owner = uuid4()
    await subscribe(repository, owner, "a")
    old = repository.rows[endpoint("a")]

    again = await SubscribeDevice(repository, FixedClock(LATER))(
        owner, endpoint=endpoint("a"), p256dh=new_p256dh(), auth=new_auth()
    )

    assert again.created_at == NOW
    assert again.last_used_at == LATER
    assert (again.p256dh, again.auth) != (old.p256dh, old.auth)
    assert len(repository.rows) == 1


async def test_the_same_endpoint_from_another_account_changes_hands() -> None:
    repository = InMemorySubscriptionRepository()
    first, second = uuid4(), uuid4()
    await subscribe(repository, first, "a")

    moved = await SubscribeDevice(repository, FixedClock(LATER))(
        second, endpoint=endpoint("a"), p256dh=new_p256dh(), auth=new_auth()
    )

    assert moved.owner_id == second
    assert moved.created_at == LATER
    assert await repository.of_owner(first) == ()
    assert await repository.of_owner(second) == (moved,)


async def test_the_sixth_device_pushes_out_the_least_recently_used() -> None:
    repository = InMemorySubscriptionRepository()
    owner = uuid4()
    for index in range(DEVICE_LIMIT):
        await subscribe(repository, owner, f"d{index}", FixedClock(NOW + timedelta(minutes=index)))

    await subscribe(repository, owner, "new", FixedClock(NOW + timedelta(hours=1)))

    assert endpoint("d0") not in repository.rows
    assert {s.endpoint for s in await repository.of_owner(owner)} == {
        endpoint(name) for name in ("d1", "d2", "d3", "d4", "new")
    }


async def test_the_newly_saved_device_never_leaves_even_with_the_oldest_use() -> None:
    repository = InMemorySubscriptionRepository()
    owner = uuid4()
    for index in range(DEVICE_LIMIT):
        await subscribe(repository, owner, f"d{index}", FixedClock(NOW + timedelta(minutes=index)))

    await subscribe(repository, owner, "new", FixedClock(NOW - timedelta(days=1)))

    assert endpoint("new") in repository.rows
    assert len(await repository.of_owner(owner)) == DEVICE_LIMIT


async def test_other_accounts_devices_do_not_count_toward_the_limit() -> None:
    repository = InMemorySubscriptionRepository()
    owner, other = uuid4(), uuid4()
    for index in range(DEVICE_LIMIT):
        await subscribe(repository, other, f"o{index}")

    await subscribe(repository, owner, "mine")

    assert len(repository.rows) == DEVICE_LIMIT + 1


async def test_unsubscribing_removes_ones_own_device() -> None:
    repository = InMemorySubscriptionRepository()
    owner = uuid4()
    await subscribe(repository, owner, "a")

    await UnsubscribeDevice(repository)(owner, endpoint("a"))

    assert repository.rows == {}


async def test_unsubscribing_a_device_of_someone_else_does_nothing() -> None:
    repository = InMemorySubscriptionRepository()
    await subscribe(repository, uuid4(), "a")

    await UnsubscribeDevice(repository)(uuid4(), endpoint("a"))

    assert endpoint("a") in repository.rows


async def test_unsubscribing_an_unknown_device_does_not_break() -> None:
    await UnsubscribeDevice(InMemorySubscriptionRepository())(uuid4(), endpoint("nope"))


async def test_push_reaches_every_device_and_renews_their_use() -> None:
    repository = InMemorySubscriptionRepository()
    owner = uuid4()
    await subscribe(repository, owner, "a")
    await subscribe(repository, owner, "b")
    transport = ScriptedTransport()

    await PushToAccount(repository, transport, FixedClock(LATER))(owner, MESSAGE)

    assert {e for e, _ in transport.delivered} == {endpoint("a"), endpoint("b")}
    assert all(m == MESSAGE for _, m in transport.delivered)
    assert {s.last_used_at for s in repository.rows.values()} == {LATER}


async def test_a_gone_device_is_deleted_and_only_that_one() -> None:
    repository = InMemorySubscriptionRepository()
    owner = uuid4()
    await subscribe(repository, owner, "a")
    await subscribe(repository, owner, "b")
    transport = ScriptedTransport({endpoint("a"): Delivery.GONE})

    await PushToAccount(repository, transport, FixedClock(LATER))(owner, MESSAGE)

    assert set(repository.rows) == {endpoint("b")}
    assert repository.rows[endpoint("b")].last_used_at == LATER


async def test_one_failing_device_does_not_stop_the_others_nor_leak_its_endpoint(
    caplog: pytest.LogCaptureFixture,
) -> None:
    repository = InMemorySubscriptionRepository()
    owner = uuid4()
    await subscribe(repository, owner, "broken-secret")
    await subscribe(repository, owner, "fine")
    transport = ScriptedTransport({endpoint("broken-secret"): RuntimeError("boom")})

    with caplog.at_level(logging.ERROR):
        await PushToAccount(repository, transport, FixedClock(LATER))(owner, MESSAGE)

    assert repository.rows[endpoint("fine")].last_used_at == LATER
    assert repository.rows[endpoint("broken-secret")].last_used_at == NOW
    assert str(owner) in caplog.text
    assert "fcm.googleapis.com" in caplog.text
    assert "broken-secret" not in caplog.text.replace("broken-secret\n", "x")  # traceback aside
    assert all("broken-secret" not in record.getMessage() for record in caplog.records)


async def test_an_account_without_devices_never_calls_the_transport() -> None:
    transport = ScriptedTransport()

    await PushToAccount(InMemorySubscriptionRepository(), transport, FixedClock())(uuid4(), MESSAGE)

    assert transport.delivered == []


async def test_a_repository_failure_while_listing_rises() -> None:
    class Broken(InMemorySubscriptionRepository):
        async def of_owner(self, owner_id: UUID) -> tuple[()]:
            message = f"database down for {owner_id}"
            raise ConnectionError(message)

    with pytest.raises(ConnectionError):
        await PushToAccount(Broken(), ScriptedTransport(), FixedClock())(uuid4(), MESSAGE)


async def test_forgetting_removes_the_accounts_devices_and_only_those() -> None:
    repository = InMemorySubscriptionRepository()
    owner, other = uuid4(), uuid4()
    repository.rows[endpoint("a")] = make_subscription(endpoint("a"), owner)
    repository.rows[endpoint("b")] = make_subscription(endpoint("b"), other)

    await ForgetDevices(repository)(owner)

    assert set(repository.rows) == {endpoint("b")}
