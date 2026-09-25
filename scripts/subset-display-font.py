# /// script
# requires-python = ">=3.12"
# dependencies = ["fonttools>=4.56", "brotli>=1.1"]
# ///
"""Builds the display font the front ships: one weight, Latin only, woff2.

    uv run scripts/subset-display-font.py

Bricolage Grotesque (SIL Open Font License 1.1) is downloaded from the Google Fonts repository
as its variable TTF, pinned to one weight and optical size, cut down to the Latin ranges that
Brazilian Portuguese needs, and written to `web/public/fonts/` next to its licence. The front
loads only that file; nothing comes from a third-party font service.

The result is committed: it only changes when this script or the source font does. The size
budget is checked by a test in `web/` (30 KiB); above it the design falls back to the system
display face, as the design boards foresee.
"""

from __future__ import annotations

import io
import sys
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

REPO = "https://github.com/google/fonts/raw/main/ofl/bricolagegrotesque/"
SOURCE = REPO + "BricolageGrotesque%5Bopsz%2Cwdth%2Cwght%5D.ttf"
LICENCE = REPO + "OFL.txt"

# The design boards use the face for times, titles and the wordmark: one weight, largest optical
# size, normal width.
AXES = {"wght": 700, "opsz": 96, "wdth": 100}

# Basic Latin, then only what Brazilian Portuguese adds: the accented letters, the ordinal
# indicators, the degree sign and the middle dot, the dashes, the curly quotes and the ellipsis.
# The whole Latin-1 Supplement would cost 10 KiB more for letters no title here will use.
UNICODES = ",".join(
    [
        "U+0020-007E",
        "U+00A0,U+00AA,U+00B0,U+00B7,U+00BA",
        "U+00C0-00C3,U+00C7,U+00C9-00CA,U+00CD,U+00D3-00D5,U+00DA,U+00DC",
        "U+00E0-00E3,U+00E7,U+00E9-00EA,U+00ED,U+00F3-00F5,U+00FA,U+00FC",
        "U+2013-2014,U+2018-201D,U+2026",
    ]
)

# Tabular figures keep the times aligned in the list; kerning is half the file and is what makes
# a title and the wordmark read as set type. Everything else is dropped.
FEATURES = ["kern", "tnum"]

OUT_DIR = Path(__file__).resolve().parent.parent / "web" / "public" / "fonts"
OUT_FILE = OUT_DIR / "bricolage-grotesque-700-latin.woff2"


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=60) as response:  # noqa: S310 - fixed https URL
        return response.read()


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    font = TTFont(io.BytesIO(fetch(SOURCE)))
    static = instancer.instantiateVariableFont(font, AXES, inplace=False)

    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = FEATURES
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6]  # copyright, family, style, ids, version, ps name
    options.notdef_outline = True
    options.hinting = False
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=subset.parse_unicodes(UNICODES))
    subsetter.subset(static)

    with OUT_FILE.open("wb") as handle:
        static.save(handle)
    (OUT_DIR / "OFL.txt").write_bytes(fetch(LICENCE))

    size = OUT_FILE.stat().st_size
    sys.stdout.write(f"{OUT_FILE.relative_to(Path.cwd())}: {size} bytes\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
