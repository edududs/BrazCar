"""Port contracts: what every implementation of a port must hold (D-039).

The mould, one module per port:

- a `<Port>Contract` class whose tests use only the port and a `make_<port>` factory it leaves
  abstract; properties are stated so that they hold whatever was stored before, because a
  Hypothesis example does not get a clean database;
- one `Test<Implementation>(<Port>Contract)` per implementation, next to the context's tests:
  the in-memory fake the use-case tests rely on, and the Django adapter, marked `contract`.

The database is picked the way production picks it, by `DATABASE_URL`. `poe test` runs the
`contract` tests on SQLite; `poe test-postgres` runs them again on the compose Postgres.
"""

from hypothesis import HealthCheck, settings

# Each example crosses a thread and a transaction: no deadline, and fewer but real examples.
# The same property runs once per implementation, which `differing_executors` would flag.
contract_settings = settings(
    deadline=None,
    max_examples=20,
    suppress_health_check=[
        HealthCheck.too_slow,
        HealthCheck.differing_executors,
        HealthCheck.function_scoped_fixture,
    ],
)
