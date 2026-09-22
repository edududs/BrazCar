from django.apps import AppConfig


class SharedConfig(AppConfig):
    """The rows that belong to no context: the board revision and the request-limit hits."""

    name = "brazcar.shared.adapters"
    label = "shared"
