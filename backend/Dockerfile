# syntax=docker/dockerfile:1
# API image. Build context is backend/. Published to GHCR on tag (D-067); nothing is built on the host.

FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim AS build
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
# The extractor is a git dependency (ADR-0009): uv needs the git binary to fetch it. Build stage only.
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Dependencies first: this layer only changes with the lock file.
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-dev --no-install-project
COPY pyproject.toml uv.lock ./
COPY src ./src
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-editable

FROM python:3.14-slim-bookworm
ENV PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH" \
    DJANGO_SETTINGS_MODULE=brazcar.config.settings
# libmagic: the WhatsApp client behind the extractor loads it at import time (ADR-0009).
RUN apt-get update && apt-get install -y --no-install-recommends libmagic1 && rm -rf /var/lib/apt/lists/*     && useradd --system --uid 10001 --no-create-home brazcar
WORKDIR /app
COPY --from=build /app/.venv ./.venv
COPY manage.py docker-entrypoint.sh scripts/container_healthcheck.py ./
USER brazcar
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
    CMD ["python", "container_healthcheck.py"]
ENTRYPOINT ["./docker-entrypoint.sh"]
# uvicorn, not granian: it is already the development server and the one the JSON logging is wired to,
# and idle SSE connections are plain asyncio tasks, where a Rust I/O loop buys nothing measurable here.
# One process on purpose: the board signal is a single task per web process (ADR-0010).
# `--timeout-graceful-shutdown` exists because open SSE streams would otherwise hold a restart forever.
CMD ["uvicorn", "brazcar.config.asgi:application", "--host", "0.0.0.0", "--port", "8000", \
     "--proxy-headers", "--no-server-header", "--timeout-graceful-shutdown", "10"]
