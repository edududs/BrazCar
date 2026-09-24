from hypothesis import strategies as st

from brazcar.shared.domain.phone import PhoneNumber

AREA_CODES = (
    *range(11, 20),
    21, 22, 24, 27, 28,
    31, 32, 33, 34, 35, 37, 38,
    41, 42, 43, 44, 45, 46, 47, 48, 49,
    51, 53, 54, 55,
    61, 62, 63, 64, 65, 66, 67, 68, 69,
    71, 73, 74, 75, 77, 79,
    *range(81, 90),
    *range(91, 100),
)  # fmt: skip
"""The 67 area codes (DDD) in use in Brazil: 20, 23, 25, 26, 29, 30... do not exist."""


def _mobile(area: int, rest: int) -> PhoneNumber:
    return PhoneNumber.parse(f"+55{area}9{rest:08d}")


def _legacy(area: int, rest: int) -> str:
    return f"55{area}{rest}"


brazilian_mobiles = st.builds(_mobile, st.sampled_from(AREA_CODES), st.integers(0, 99_999_999))

legacy_jid_users = st.builds(_legacy, st.sampled_from(AREA_CODES), st.integers(60_000_000, 99_999_999))
"""How WhatsApp still addresses a mobile registered before the ninth digit: 12 digits."""
