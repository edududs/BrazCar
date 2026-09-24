"""What counts as personal data inside free text (D-128, D-129). Offers as the groups write them."""

import pytest

from brazcar.shared.domain.personal_data import has_personal_data, redact_personal_data

OFFER = (
    "*04 Vagas as 17:00*\n🚘 SCS (Americanas)\n🚘 Estrutural\n🚘 33/34, Vila, Veredas\n"
    "💵 *7,00* Dinheiro ou PIX"
)


@pytest.mark.parametrize(
    "text",
    [
        "Pix 61 99999-1234",
        "chave pix (61) 9 9999-1234",
        "+55 61 999991234",
        "61999991234",
        "pix: motorista.zé@gmail.com",
        "placa ABC1234",
        "placa ABC-1234 gol prata",
        "placa abc1d23",
        "cpf 123.456.789-00",
    ],
)
def test_phones_emails_plates_and_cpf_are_personal_data(text: str) -> None:
    assert has_personal_data(text)
    assert not has_personal_data(redact_personal_data(text))


@pytest.mark.parametrize(
    "text",
    [
        OFFER,
        "2 vagas amanhã as 6;20 Brazlandia Estrutural Eixo Rodoviária Esplanada Pix 7.00",
        "saída 05:45, chegada 07:15, R$ 10,00 a Vendinha",
        "dia 24/09/2026 as 19h, 216 Sul, quadra 33, L2 607 Sul",
        "0️⃣5️⃣:4️⃣5️⃣ 3 vagas, 7 reais",
        "SEM FOTO sem carona; chamar PV",
    ],
)
def test_times_prices_dates_and_addresses_are_not(text: str) -> None:
    assert not has_personal_data(text)
    assert redact_personal_data(text) == text


def test_redaction_keeps_everything_else_in_place() -> None:
    text = "3 vagas 19:30 Esplanada, pix 61 98888-7777 ou pix@x.com, placa XYZ9A88, 7,00"

    assert redact_personal_data(text) == "3 vagas 19:30 Esplanada, pix […] ou […], placa […], 7,00"
