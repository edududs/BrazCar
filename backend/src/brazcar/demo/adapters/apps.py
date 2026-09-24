from django.apps import AppConfig


class DemoConfig(AppConfig):
    """Only reason to be an app: Django finds management commands in installed apps."""

    name = "brazcar.demo.adapters"
    label = "demo"
