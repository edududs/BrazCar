"""Wires the rides use cases to their adapters. Called once, by `config/api.py`."""

from datetime import timedelta

from django.conf import settings
from ninja import Router

from brazcar.accounts.adapters.composition import writer_auth
from brazcar.accounts.adapters.repository import DjangoAccountRepository
from brazcar.places.adapters.repository import DjangoCatalogRepository
from brazcar.rides.application import (
    CancelRide,
    ChangeSeats,
    EditRide,
    ListBoard,
    MyRides,
    PublishRide,
    RepeatRide,
    RequestContact,
    RideRules,
    ShowRide,
)
from brazcar.search.adapters.index import DjangoSearchIndex
from brazcar.shared.adapters.board_revision import DjangoBoardRevision
from brazcar.shared.adapters.board_signal import PollingBoardSignal
from brazcar.shared.adapters.clock import SystemClock
from brazcar.shared.adapters.rate_limit import DjangoRateLimiter

from .directories import AccountDriverDirectory, CatalogPlaceDirectory
from .repository import DjangoContactRequests, DjangoRideRepository
from .routes import RideUseCases, build_router
from .search import NAMESPACE, IndexedRideSearch


def ride_search() -> IndexedRideSearch:
    """Also used by `manage.py index_rides`, which rebuilds the index from the stored rides."""
    return IndexedRideSearch(DjangoSearchIndex(NAMESPACE), DjangoCatalogRepository())


def rides_router() -> Router:
    rides = DjangoRideRepository()
    drivers = AccountDriverDirectory(DjangoAccountRepository())
    places = CatalogPlaceDirectory(DjangoCatalogRepository())
    search = ride_search()
    revision = DjangoBoardRevision()
    clock = SystemClock()
    rules = RideRules(
        departure_tolerance=timedelta(minutes=settings.RIDE_DEPARTURE_TOLERANCE_MINUTES),
        contact_limit=settings.RIDE_CONTACT_LIMIT,
        contact_window=timedelta(hours=settings.RIDE_CONTACT_WINDOW_HOURS),
    )
    use_cases = RideUseCases(
        board=ListBoard(rides, drivers, places, search, clock, rules),
        mine=MyRides(rides, drivers, places, clock, rules),
        show=ShowRide(rides, drivers, places, clock, rules),
        publish=PublishRide(rides, drivers, places, search, clock),
        edit=EditRide(rides, places, search, clock),
        change_seats=ChangeSeats(rides, clock),
        cancel=CancelRide(rides, clock),
        repeat=RepeatRide(rides, drivers, search, clock),
        contact=RequestContact(rides, drivers, DjangoContactRequests(), DjangoRateLimiter(), clock, rules),
        revision=revision,
        signal=PollingBoardSignal(revision),
    )
    return build_router(use_cases, writer_auth())
