"""Wires the demonstration seed to the adapters of every context. Called by the command only.

`demo` has no domain and no application layer of its own, and never will: it is a composition of
other people's use cases, the way `config/` is for the API. A test holds it to that shape.
"""

from datetime import timedelta

from django.conf import settings

from brazcar.accounts.adapters.credentials import DjangoCredentials
from brazcar.accounts.adapters.repository import DjangoAccountRepository
from brazcar.accounts.application import AddCar
from brazcar.importing.adapters.bridges import RidesBridge
from brazcar.importing.adapters.repository import (
    DjangoBlockedSenders,
    DjangoCandidates,
    DjangoSourceMessages,
)
from brazcar.importing.application import BlockSender, IngestMessages
from brazcar.places.adapters.repository import DjangoCatalogRepository
from brazcar.rides.adapters.composition import ride_search
from brazcar.rides.adapters.directories import AccountDriverDirectory, CatalogPlaceDirectory
from brazcar.rides.adapters.repository import DjangoContactRequests, DjangoRideRepository
from brazcar.rides.application import (
    CancelRide,
    ChangeSeats,
    EditRide,
    ForgetRides,
    ImportRide,
    PublishRide,
    RepeatRide,
    RequestContact,
    RideRules,
)
from brazcar.shared.adapters.clock import SystemClock
from brazcar.shared.adapters.rate_limit import DjangoRateLimiter

from . import dataset as data
from .seeding import DemoWiring


def demo_wiring() -> DemoWiring:
    accounts = DjangoAccountRepository()
    rides = DjangoRideRepository()
    drivers = AccountDriverDirectory(accounts)
    places = CatalogPlaceDirectory(DjangoCatalogRepository())
    search = ride_search()
    clock = SystemClock()
    messages = DjangoSourceMessages()
    candidates = DjangoCandidates()
    blocked = DjangoBlockedSenders()
    rules = RideRules(
        departure_tolerance=timedelta(minutes=settings.RIDE_DEPARTURE_TOLERANCE_MINUTES),
        contact_limit=settings.RIDE_CONTACT_LIMIT,
        contact_window=timedelta(hours=settings.RIDE_CONTACT_WINDOW_HOURS),
    )
    import_ride = ImportRide(rides, drivers, places, search, clock)
    bridge = RidesBridge(import_ride, ForgetRides(rides, search), rides)
    return DemoWiring(
        accounts=accounts,
        credentials=DjangoCredentials(),
        add_car=AddCar(accounts),
        publish=PublishRide(rides, drivers, places, search, clock),
        edit=EditRide(rides, places, search, clock),
        change_seats=ChangeSeats(rides, clock),
        cancel=CancelRide(rides, clock),
        repeat=RepeatRide(rides, drivers, search, clock),
        import_ride=import_ride,
        contact=RequestContact(rides, drivers, DjangoContactRequests(), DjangoRateLimiter(), clock, rules),
        messages=messages,
        ingest=IngestMessages(messages, candidates, blocked, data.GROUPS),
        candidates=candidates,
        block=BlockSender(blocked, messages, candidates, bridge),
        contact_limit=rules.contact_limit,
        departure_tolerance=rules.departure_tolerance,
    )
