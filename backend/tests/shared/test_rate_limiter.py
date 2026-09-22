import pytest

from brazcar.shared.adapters.rate_limit import DjangoRateLimiter
from brazcar.shared.application.ports import RateLimiter
from tests.accounts.fakes import FixedClock
from tests.contracts.rate_limiter import RateLimiterContract
from tests.shared.fakes import InMemoryRateLimiter


class TestInMemoryRateLimiter(RateLimiterContract):
    def make_limiter(self) -> RateLimiter:
        return InMemoryRateLimiter(FixedClock())


@pytest.mark.contract
@pytest.mark.django_db(transaction=True)
@pytest.mark.usefixtures("worker_thread_connections_closed")
class TestDjangoRateLimiter(RateLimiterContract):
    def make_limiter(self) -> RateLimiter:
        return DjangoRateLimiter()
