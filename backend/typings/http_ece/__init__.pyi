from cryptography.hazmat.primitives.asymmetric.ec import EllipticCurvePrivateKey

def decrypt(
    content: bytes,
    salt: bytes | None = None,
    key: bytes | None = None,
    private_key: EllipticCurvePrivateKey | None = None,
    dh: bytes | None = None,
    auth_secret: bytes | None = None,
    keyid: str | None = None,
    keylabel: str = "P-256",
    rs: int = 4096,
    version: str = "aes128gcm",
) -> bytes: ...
