"""The cast of the demonstration (D-133): people, cars, words and group messages, all invented.

Plain data, no Django and no clock. Nothing here came from a real group: the phones are the
reserved demonstration block `+55 61 90000-00NN`, the plates start with `DEM` and the e-mails use
`example.org`. `seeding.py` turns this into rows by calling the use cases of each context.
"""

from dataclasses import dataclass
from decimal import Decimal

PASSWORD = "carona-de-demonstracao"  # noqa: S105 - the demonstration password, printed in the runbook
"""Every demonstration account has this one. It is written down on purpose; nothing real uses it."""

GROUP_LABEL = "Caronas Brazlândia (demonstração)"
GROUP_JID = "120363000000000001@g.us"
GROUP_LABEL_SECOND = "Brazlândia x Plano (demonstração)"
GROUP_JID_SECOND = "120363000000000002@g.us"
GROUPS: dict[str, str] = {GROUP_JID: GROUP_LABEL, GROUP_JID_SECOND: GROUP_LABEL_SECOND}
"""Label by group JID, as the worker receives it from the environment (D-109)."""

WORKER_ACCOUNT = "5561900000099"
"""The paired phone the extractor would be running as (D-111); no real number is ever seeded."""


@dataclass(frozen=True, slots=True)
class DemoCar:
    model: str
    color: str
    plate: str


@dataclass(frozen=True, slots=True)
class DemoPerson:
    """One account of the demonstration. `slug` is how the manifest and the suites name it."""

    slug: str
    phone: str
    display_name: str
    email: str | None = None
    cars: tuple[DemoCar, ...] = ()


DRIVER_ONE_CAR = DemoPerson(
    slug="driver_one_car",
    phone="+5561900000001",
    display_name="Ana Paula Ribeiro",
    email="ana.demo@example.org",
    cars=(DemoCar(model="Gol", color="prata", plate="DEM1A23"),),
)
DRIVER_TWO_CARS = DemoPerson(
    slug="driver_two_cars",
    phone="+5561900000002",
    display_name="Carlos Eduardo Nunes",
    email="carlos.demo@example.org",
    cars=(
        DemoCar(model="Onix", color="branco", plate="DEM2B34"),
        DemoCar(model="Saveiro", color="cinza", plate="DEM5678"),
    ),
)
DRIVER_NO_CAR = DemoPerson(
    slug="driver_no_car",
    phone="+5561900000003",
    display_name="Fernanda Lopes",
)
"""No e-mail, on purpose: the beta cast's one account from before the invite, retained until it
confirms one (D-168). The end to end suite signs in as her, but only to read; never to write, so
the hold never gets in its way. Kept without an e-mail so the screens catalogue has a legacy
account's own page to show (`legacy_person` in the manifest, D-166)."""
PASSENGER = DemoPerson(
    slug="passenger",
    phone="+5561900000004",
    display_name="João Vitor Alves",
    email="joao.demo@example.org",
)
LONG_NAME = DemoPerson(
    slug="long_name",
    phone="+5561900000005",
    display_name="Maria das Graças de Albuquerque Cavalcanti Fonseca",
    email="maria.demo@example.org",
    cars=(DemoCar(model="Kwid", color="vermelho", plate="DEM9C87"),),
)
FRESH = DemoPerson(
    slug="fresh",
    phone="+5561900000006",
    display_name="Novo Usuário",
    email="novo.demo@example.org",
)
IMPORTED_OWNER = DemoPerson(
    slug="imported_owner",
    phone="+5561900000007",
    display_name="Roberto Silva Matos",
    email="roberto.demo@example.org",
)
"""The account whose phone a group message carries: its imported ride is hers (D-127)."""

SUITE_JOURNEYS = 5  # sign-up, deleting it, changing its password, editing it, a wrong password first
SUITE_PROJECTS = 3  # `mobile`, `mobile-dark` and `desktop`
SUITE_ATTEMPTS = 2  # the first run of a test and the one retry the CI allows
SUITE_PHONES: tuple[str, ...] = tuple(
    f"+55619000000{10 + index}" for index in range(SUITE_JOURNEYS * SUITE_PROJECTS * SUITE_ATTEMPTS)
)
"""Reserved for the accounts the end to end suite creates itself. The seed never writes them; the
teardown forgets them, so a suite that signs up starts from an empty phone every run. One per
journey, per attempt and per project, because `mobile`, `desktop` and `mobile-dark` share the one
database of a run (`workers: 1`), and a retried test must not find the account its failed attempt
already created: the phone is at `(journey * attempts + retry) * projects + project`. A seeded
account never has its password or e-mail changed by a test, so the second project to touch it in
the same run still finds what the manifest promised."""

PEOPLE: tuple[DemoPerson, ...] = (
    DRIVER_ONE_CAR,
    DRIVER_TWO_CARS,
    DRIVER_NO_CAR,
    PASSENGER,
    LONG_NAME,
    FRESH,
    IMPORTED_OWNER,
)

LEGACY_PERSON = DRIVER_NO_CAR.slug
"""Which of `PEOPLE` is the one left without an e-mail (see `DRIVER_NO_CAR`); the manifest hands
this slug out as `legacy_person`, so the screens catalogue knows whose page shows the account from
before the invite."""

# --- what the drivers write -------------------------------------------------------------------

SHORT_NOTES = "Levo mala pequena. Aviso no grupo se atrasar."

LONG_NOTES = (
    "Saio pontualmente do ponto combinado e espero no máximo cinco minutos, porque o trânsito da "
    "Estrutural não perdoa quem sai tarde. Prefiro quem já vai com o troco separado, mas aceito PIX "
    "na hora do embarque sem problema nenhum. O porta-malas comporta uma mala de mão por pessoa; "
    "mala grande só combinando antes, porque nem sempre dá. Não levo animal solto, apenas em caixa "
    "de transporte. Se precisar descer num ponto diferente, só me avisar quando entrar no carro. "
    "Obrigado, e que a gente chegue bem."
)
"""Exactly `NOTES_LIMIT` characters: the longest note the domain takes (D-129), so the counter of
the form is photographed at 500/500. A test holds the length."""

# --- what the groups say ----------------------------------------------------------------------

MESSAGE_EXTERNAL = (
    "Bom dia! 3 vagas saindo do Setor Tradicional às 6h30 para a Esplanada, R$ 7,00. "
    "Chama no 61 98888-0001 que eu confirmo."
)
"""Accepted, external driver. The phone inside is redacted before the ride keeps it (D-128)."""

MESSAGE_WITH_FARES = (
    "Saindo da Vila São José 7h para o Plano. R$ 7 Estrutural, R$ 9 SIA, R$ 12 Esplanada. Dinheiro ou pix."
)
MESSAGE_FROM_ACCOUNT = "Tenho 2 vagas saindo do Rodeador 17h30 para a Rodoviária do Plano, R$ 7."
MESSAGE_PENDING = "Alguém saindo do Veredas amanhã cedo pro Plano? Tenho 4 vagas, R$ 7."
MESSAGE_NOT_AN_OFFER = "Alguém tem vaga pra Ceilândia agora de tarde? Pago o de sempre."
MESSAGE_NO_TIME = "Vou pro Plano hoje, R$ 7, chama no privado quem quiser."
MESSAGE_NO_SEATS = "Lotou pessoal, obrigado! Amanhã tem de novo."
MESSAGE_FEW_STOPS = "Saindo 19h, R$ 7, dinheiro ou pix."
MESSAGE_LOW_CONFIDENCE = "9h 7 2 esplanada braz ok"
MESSAGE_UNKNOWN_PLACE = "Saio da Vila do Boa 8h para o Jardim Botânico das Pedras, R$ 7, 3 vagas."
MESSAGE_FAILED = "Carona 6h, R$ 7, saindo da Vendinha pro SIA. 2 vagas."


@dataclass(frozen=True, slots=True)
class DemoSender:
    phone: str  # digits as WhatsApp addresses them, no `+` (D-111)
    display_name: str


SENDER_EXTERNAL = DemoSender(phone="5561988880001", display_name="Marcos das Caronas")
SENDER_FARES = DemoSender(phone="5561988880002", display_name="Denise Moreira")
SENDER_WITH_ACCOUNT = DemoSender(phone="5561900000007", display_name="Roberto")
SENDER_NOISE = DemoSender(phone="5561988880003", display_name="Grupo Vizinho")
SENDER_BLOCKED = DemoSender(phone="5561988880009", display_name="Quem pediu para sair")

SENDERS: tuple[DemoSender, ...] = (
    SENDER_EXTERNAL,
    SENDER_FARES,
    SENDER_WITH_ACCOUNT,
    SENDER_NOISE,
    SENDER_BLOCKED,
)

# --- routes -------------------------------------------------------------------------------------

MANY_STOPS: tuple[str, ...] = (
    "brazlandia",
    "rodoviaria-de-brazlandia",
    "veredas",
    "vila-sao-jose",
    "rodeador",
    "incra-8",
    "vendinha",
    "estrutural",
    "sia",
    "cidade-do-automovel",
    "setor-policial",
    "esplanada",
    "setor-comercial-sul",
    "rodoviaria-do-plano",
    "aeroporto",
)
"""Fifteen stops: the most the importing keeps (D-130). The domain sets no ceiling of its own."""

FARE_ROUTE: tuple[tuple[str, Decimal | None], ...] = (
    ("brazlandia", None),
    ("estrutural", Decimal("7.00")),
    ("sia", Decimal("9.00")),
    ("esplanada", Decimal("12.00")),
    ("aeroporto", Decimal("15.00")),
)

FREE_TEXT_STOP = "Quadra 33/34, em frente à escola"
