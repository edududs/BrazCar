"""The words every form shows when the phone typed is not a number, so the field reads the same everywhere."""

from brazcar.shared.domain.phone import missing_ninth_digit

_GENERAL = "telefone inválido: o celular tem 9 dígitos depois do DDD, como (61) 99999-9999"


def phone_refusal(raw: str) -> str:
    """Say what a mobile needs; when only the ninth digit is missing, say the number it would be."""
    suggestion = missing_ninth_digit(raw)
    if suggestion is None:
        return _GENERAL
    return f"telefone inválido: faltou o nono dígito; seria {suggestion.display()}?"
