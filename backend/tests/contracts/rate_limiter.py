from datetime import timedelta
from uuid import uuid4

from brazcar.shared.application.ports import RateLimiter


class RateLimiterContract:
    """Subclass as `TestMyLimiter` and implement `make_limiter`. Keys are fresh, so nothing collides."""

    def make_limiter(self) -> RateLimiter:
        raise NotImplementedError

    async def test_the_limit_counts_hits_per_key_within_the_window(self) -> None:
        limiter = self.make_limiter()
        key, other = f"contract:{uuid4()}", f"contract:{uuid4()}"
        window = timedelta(hours=1)

        answers = [await limiter.acquire(key, limit=2, window=window) for _ in range(4)]

        assert answers == [True, True, False, False]
        assert await limiter.acquire(other, limit=2, window=window)  # another key, another count

    async def test_a_refused_hit_is_not_counted(self) -> None:
        limiter = self.make_limiter()
        key = f"contract:{uuid4()}"

        for _ in range(3):
            await limiter.acquire(key, limit=1, window=timedelta(hours=1))

        assert await limiter.acquire(key, limit=2, window=timedelta(hours=1))  # one hit stored, not three

    async def test_the_window_forgets(self) -> None:
        limiter = self.make_limiter()
        key = f"contract:{uuid4()}"

        assert await limiter.acquire(key, limit=1, window=timedelta(0))
        assert await limiter.acquire(key, limit=1, window=timedelta(0))  # a zero window keeps nothing
