from brazcar.search.domain import SearchDocument, fold, matches, terms


def test_fold_drops_accents_case_and_extra_spaces() -> None:
    assert fold("  Brazlândia   Rodoviária ") == "brazlandia rodoviaria"


def test_every_term_must_be_contained_somewhere() -> None:
    text = SearchDocument(id="1", texts=("Brazlândia", "Incra 8, portão")).folded

    assert matches("incra braz", text)
    assert matches("PORTÃO", text)
    assert not matches("incra 9", text)
    assert matches("", text)
    assert terms("  Incra   8 ") == ("incra", "8")
