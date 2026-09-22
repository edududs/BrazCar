"""A license plate in the old (`ABC1234`) or Mercosul (`ABC1D23`) format, upper-case, no hyphen."""

import re
from typing import Annotated

from pydantic import AfterValidator

_PLATE = re.compile(r"^[A-Z]{3}\d[A-Z0-9]\d{2}$")


def normalize_license_plate(raw: str) -> str:
    plate = re.sub(r"[\s-]", "", raw).upper()
    if not _PLATE.match(plate):
        message = "expected a plate like ABC1234 or ABC1D23"
        raise ValueError(message)
    return plate


type LicensePlate = Annotated[str, AfterValidator(normalize_license_plate)]
