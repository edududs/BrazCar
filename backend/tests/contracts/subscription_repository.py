from datetime import timedelta
from uuid import UUID, uuid4

from brazcar.push.application import SubscriptionRepository
from tests.push.fakes import FCM, NOW, make_subscription


def endpoint() -> str:
    return f"{FCM}{uuid4().hex}"


class SubscriptionRepositoryContract:
    """Subclass as `TestMySubscriptionRepository`; implement `make_subscriptions` and, for a DB, `owner`."""

    def make_subscriptions(self) -> SubscriptionRepository:
        raise NotImplementedError

    async def owner(self) -> UUID:
        """An account that may own devices. The fake takes any identifier; the adapter needs a row."""
        return uuid4()

    async def test_a_kept_subscription_comes_back_whole(self) -> None:
        repository = self.make_subscriptions()
        device = make_subscription(endpoint(), await self.owner())

        await repository.save(device)

        assert await repository.get(device.endpoint) == device

    async def test_an_unknown_endpoint_is_none(self) -> None:
        assert await self.make_subscriptions().get(endpoint()) is None

    async def test_saving_the_same_endpoint_replaces_it_and_passes_it_to_the_new_owner(self) -> None:
        repository = self.make_subscriptions()
        first, second = await self.owner(), await self.owner()
        address = endpoint()
        await repository.save(make_subscription(address, first))
        moved = make_subscription(address, second, last_used_at=NOW + timedelta(hours=1))

        await repository.save(moved)

        assert await repository.get(address) == moved
        assert await repository.of_owner(first) == ()
        assert await repository.of_owner(second) == (moved,)

    async def test_remove_deletes_the_subscription_and_an_unknown_one_is_fine(self) -> None:
        repository = self.make_subscriptions()
        device = make_subscription(endpoint(), await self.owner())
        await repository.save(device)

        await repository.remove(device.endpoint)
        await repository.remove(device.endpoint)

        assert await repository.get(device.endpoint) is None

    async def test_of_owner_lists_only_the_account_from_the_most_recently_used(self) -> None:
        repository = self.make_subscriptions()
        mine, other = await self.owner(), await self.owner()
        oldest = make_subscription(endpoint(), mine, last_used_at=NOW)
        newest = make_subscription(endpoint(), mine, last_used_at=NOW + timedelta(hours=2))
        middle = make_subscription(endpoint(), mine, last_used_at=NOW + timedelta(hours=1))
        theirs = make_subscription(endpoint(), other)
        for device in (oldest, newest, middle, theirs):
            await repository.save(device)

        assert await repository.of_owner(mine) == (newest, middle, oldest)

    async def test_touch_changes_only_the_last_use(self) -> None:
        repository = self.make_subscriptions()
        device = make_subscription(endpoint(), await self.owner())
        await repository.save(device)
        later = NOW + timedelta(days=1)

        await repository.touch(device.endpoint, at=later)
        await repository.touch(endpoint(), at=later)

        assert await repository.get(device.endpoint) == device.model_copy(update={"last_used_at": later})

    async def test_forget_owner_drops_that_account_and_leaves_the_others(self) -> None:
        repository = self.make_subscriptions()
        mine, other = await self.owner(), await self.owner()
        gone = make_subscription(endpoint(), mine)
        kept = make_subscription(endpoint(), other)
        await repository.save(gone)
        await repository.save(kept)

        await repository.forget_owner(mine)

        assert await repository.get(gone.endpoint) is None
        assert await repository.of_owner(other) == (kept,)
