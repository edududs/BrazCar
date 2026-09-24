"""Removing what an earlier run of the seed left behind (D-132).

The one place in the project that writes to tables by hand, and on purpose: no use case says
"forget every demonstration account with its rides and its history", and inventing one would put a
delete-everything lever inside the domain, reachable from the API. The reach is fenced by the
demonstration data itself — the phones of `dataset.py` and the paired account of its worker — so
this can only ever hit what the seed wrote.

Order matters: contact requests and rides point at users with `PROTECT`.
"""

from dataclasses import dataclass

from asgiref.sync import sync_to_async
from django.db import transaction
from django.db.models import Q

from brazcar.accounts.adapters.models import CarModel, User
from brazcar.importing.adapters.models import BlockedSenderModel, CandidateModel, SourceMessageModel
from brazcar.rides.adapters.models import ContactRequestModel, RideModel
from brazcar.rides.adapters.search import NAMESPACE
from brazcar.search.adapters.models import SearchEntryModel
from brazcar.shared.adapters.models import RateLimitHitModel

from . import dataset as data


@dataclass(frozen=True, slots=True)
class Removed:
    accounts: int
    rides: int
    candidates: int
    messages: int

    @property
    def anything(self) -> bool:
        return bool(self.accounts or self.rides or self.candidates or self.messages)


async def forget_demo() -> Removed:
    return await sync_to_async(_forget)()


@transaction.atomic
def _forget() -> Removed:
    phones = [person.phone for person in data.PEOPLE] + list(data.SUITE_PHONES)
    senders = [sender.phone for sender in data.SENDERS]
    users = User.objects.filter(phone__in=phones)
    account_ids = list(users.values_list("id", flat=True))

    rides = RideModel.objects.filter(Q(driver_id__in=account_ids) | Q(driver_phone__in=senders))
    ride_ids = [str(ride_id) for ride_id in rides.values_list("id", flat=True)]
    ContactRequestModel.objects.filter(Q(ride_id__in=ride_ids) | Q(requester_id__in=account_ids)).delete()
    SearchEntryModel.objects.filter(namespace=NAMESPACE, document_id__in=ride_ids).delete()
    rides.delete()  # the stops and the history go with each row

    candidates = CandidateModel.objects.filter(sender_phone__in=senders)
    messages = SourceMessageModel.objects.filter(account=data.WORKER_ACCOUNT)
    removed_candidates, removed_messages = candidates.count(), messages.count()
    candidates.delete()  # takes the messages it had already absorbed
    messages.delete()
    BlockedSenderModel.objects.filter(phone__in=senders).delete()

    keys = [f"contact:{account_id}" for account_id in account_ids]
    keys += [f"login:{phone}" for phone in phones]
    keys += [f"password-reset:{phone}" for phone in phones]
    RateLimitHitModel.objects.filter(key__in=keys).delete()

    CarModel.objects.filter(owner_id__in=account_ids).delete()
    users.delete()
    return Removed(
        accounts=len(account_ids),
        rides=len(ride_ids),
        candidates=removed_candidates,
        messages=removed_messages,
    )
