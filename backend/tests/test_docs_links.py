"""Every relative link in the versioned Markdown must point at a file that exists."""

import re
import subprocess
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
LINK = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")
EXTERNAL = ("http://", "https://", "mailto:", "#")


def versioned_markdown() -> list[Path]:
    listing = subprocess.run(
        ["git", "ls-files", "*.md"],  # noqa: S607 - git comes from PATH, as everywhere else in the tooling
        cwd=REPO,
        check=True,
        capture_output=True,
        text=True,
    )
    return [REPO / line for line in listing.stdout.splitlines()]


def broken_links(document: Path) -> list[str]:
    targets = (match.group(1).split("#")[0] for match in LINK.finditer(document.read_text(encoding="utf-8")))
    return [
        target
        for target in targets
        if target and not target.startswith(EXTERNAL) and not (document.parent / target).exists()
    ]


@pytest.mark.parametrize("document", versioned_markdown(), ids=lambda path: path.relative_to(REPO).as_posix())
def test_relative_links_resolve(document: Path) -> None:
    assert not broken_links(document)


def test_guard_detects_a_broken_link(tmp_path: Path) -> None:
    document = tmp_path / "page.md"
    document.write_text("[ok](page.md) [site](https://example.org) [gone](missing.md#part)", encoding="utf-8")

    assert broken_links(document) == ["missing.md"]
