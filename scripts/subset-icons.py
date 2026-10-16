"""Builds the self-hosted icon font from the icons the app uses.

The full Material Symbols Rounded font is over 5 MB: far too much for a PWA
to download and cache. This pins the weight, grade and optical size the app
uses (400, 0, 24), keeps the FILL axis (outlined vs filled icons), and keeps
only the glyphs listed in src/assets/fonts/icons.json (see scripts/icons.mjs),
along with the letters their ligatures are spelled with.

Usage (from the repo root, with `pip install fonttools brotli`):
    python scripts/subset-icons.py
or simply `npm run icons`, which refreshes the list first.
"""

import io
import json
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "node_modules/material-symbols/material-symbols-rounded.woff2"
LIST = ROOT / "src/assets/fonts/icons.json"
OUT = ROOT / "src/assets/fonts/material-symbols-rounded.woff2"


def ligature_targets(font: TTFont) -> dict[str, str]:
    """Icon name -> glyph, read from the font's ligature substitutions.

    Glyph names usually equal icon names, but aliases (e.g. `emoji_events`)
    point at a differently named glyph, so the ligature table is the truth.
    """
    char_of = {glyph: chr(code) for code, glyph in font.getBestCmap().items()}
    targets: dict[str, str] = {}
    for lookup in font["GSUB"].table.LookupList.Lookup:
        for table in lookup.SubTable:
            if table.LookupType == 7:  # extension: unwrap
                table = table.ExtSubTable
            if getattr(table, "LookupType", None) != 4:
                continue
            for first, ligs in table.ligatures.items():
                for lig in ligs:
                    chars = [char_of.get(g) for g in [first, *lig.Component]]
                    if None not in chars:
                        targets.setdefault("".join(chars), lig.LigGlyph)
    return targets


def main() -> None:
    names = json.loads(LIST.read_text())
    font = TTFont(SOURCE, lazy=False)
    font = instancer.instantiateVariableFont(font, {"wght": 400, "GRAD": 0, "opsz": 24})
    # Round-trip so the subsetter sees fully decompiled tables.
    buffer = io.BytesIO()
    font.flavor = None
    font.save(buffer)
    buffer.seek(0)
    font = TTFont(buffer, lazy=False)

    available = set(font.getGlyphOrder())
    ligatures = ligature_targets(font)
    resolved = {n: ligatures.get(n) for n in names}
    missing = [n for n, g in resolved.items() if g is None]
    if missing:
        raise SystemExit(f"Not in Material Symbols: {', '.join(missing)}")
    glyphs = [g for base in resolved.values() for g in (base, f"{base}.fill") if g in available]

    options = subset.Options()
    options.layout_features = ["*"]
    # Without closure, ligatures that spell icons we did not keep are dropped
    # instead of pulling every icon back in.
    options.layout_closure = False
    options.notdef_outline = True
    options.flavor = "woff2"
    subsetter = subset.Subsetter(options)
    subsetter.populate(glyphs=glyphs, text="abcdefghijklmnopqrstuvwxyz0123456789_")
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(OUT)
    print(f"{OUT.relative_to(ROOT)}: {len(names)} icons, {OUT.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
