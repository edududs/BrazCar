from django.urls import path

from brazcar.config.api import api

urlpatterns = [
    path("api/", api.urls),
]
