from brazcar.shared.adapters.phone_input import phone_refusal

GENERAL = "telefone inválido: o celular tem 9 dígitos depois do DDD, como (61) 99999-9999"


def test_it_says_how_many_digits_a_mobile_has() -> None:
    assert phone_refusal("123") == GENERAL


def test_it_suggests_the_number_when_only_the_ninth_digit_is_missing() -> None:
    assert (
        phone_refusal("(61) 9908-4038") == "telefone inválido: faltou o nono dígito; seria (61) 99908-4038?"
    )


def test_it_falls_back_to_the_general_words_when_nothing_can_be_suggested() -> None:
    assert phone_refusal("not-a-phone") == GENERAL
