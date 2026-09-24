"""`RideParser` over a local Ollama (ADR-0016): the schema of `ParserOutput` constrains the answer.

Only this module knows HTTP and Ollama. Another server, another client library or another model
is another adapter, or this one edited; the application never notices (D-115).
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Final

import httpx
from pydantic import BaseModel, ValidationError

from brazcar.importing.application import ParserOutput

PROMPT_PATH: Final = Path(__file__).with_name("parser_prompt.md")
DEFAULT_TIMEOUT_SECONDS: Final = 120.0  # the first call after idle loads the model into the GPU


class ParserAnswerError(ValueError):
    """The server answered, but not with what the schema allows. The sweep retries later (D-112)."""


class OllamaRideParser:
    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        prompt_path: Path = PROMPT_PATH,
    ) -> None:
        self._client = httpx.AsyncClient(base_url=base_url, timeout=timeout)
        self._model = model
        self._system = prompt_path.read_text(encoding="utf-8")
        self._schema = ParserOutput.model_json_schema()

    async def parse(self, text: str, *, sent_at: datetime, group_label: str) -> ParserOutput:
        response = await self._client.post(
            "/api/chat",
            json={
                "model": self._model,
                "stream": False,
                "think": False,  # a thinking model would spend a minute reasoning; the schema is the answer
                "format": self._schema,
                "options": {"temperature": 0, "num_ctx": 4096},
                "messages": [
                    {"role": "system", "content": self._system},
                    {"role": "user", "content": _user_message(text, sent_at, group_label)},
                ],
            },
        )
        response.raise_for_status()
        content = _content(response.json())
        try:
            return ParserOutput.model_validate_json(content)
        except ValidationError as error:
            raise ParserAnswerError(str(error)[:200]) from error

    async def aclose(self) -> None:
        await self._client.aclose()


def _user_message(text: str, sent_at: datetime, group_label: str) -> str:
    when = sent_at.strftime("%A %d/%m/%Y %H:%M")
    return f"Grupo: {group_label}\nEnviada em: {when}\nMensagem:\n{text}"


class _Message(BaseModel):
    content: str


class _ChatAnswer(BaseModel):
    """The part of Ollama's answer this adapter reads."""

    message: _Message


def _content(payload: object) -> str:
    try:
        content = _ChatAnswer.model_validate(payload).message.content
    except ValidationError as error:
        message = f"unexpected answer shape: {str(error)[:120]}"
        raise ParserAnswerError(message) from error
    if not content.strip():
        message = "empty answer"
        raise ParserAnswerError(message)
    try:
        json.loads(content)
    except json.JSONDecodeError as error:
        message = f"answer is not JSON: {content[:80]!r}"
        raise ParserAnswerError(message) from error
    return content
