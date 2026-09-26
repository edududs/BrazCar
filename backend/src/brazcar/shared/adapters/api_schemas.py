"""Response bodies more than one context answers with, so the contract names each shape once."""

from ninja import Schema


# No docstring: it would become the schema's description in the contract.
class Done(Schema):
    ok: bool = True
