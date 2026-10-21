from cryptography.hazmat.primitives.asymmetric.ec import EllipticCurvePublicKey

class Vapid01:
    @classmethod
    def from_raw(cls, private_raw: bytes | str) -> Vapid01: ...
    @property
    def public_key(self) -> EllipticCurvePublicKey: ...

class Vapid02(Vapid01):
    @classmethod
    def from_raw(cls, private_raw: bytes | str) -> Vapid02: ...
