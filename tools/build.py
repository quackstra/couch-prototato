"""Render SPEC.md into index.html for GitHub Pages.

Pages serves the repo as static files (.nojekyll), so SPEC.md stays fetchable raw at
/SPEC.md for AI tools, and index.html is the same text for people. Run after editing
SPEC.md; tests/check.py fails if index.html is stale.

usage: python3 tools/build.py [--check]
"""

import html
import sys
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent.parent

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="An open spec for vibe-coded browser games that play on a TV with gamepads or phones.">
<link rel="alternate" type="text/markdown" href="SPEC.md">
<style>
  :root {{ color-scheme: light dark; --fg: #1d2033; --bg: #fffdf7; --muted: #5d6280; --accent: #d9480f; --code: #f3efe4; }}
  @media (prefers-color-scheme: dark) {{ :root {{ --fg: #e8e9f3; --bg: #141625; --muted: #a2a6c2; --accent: #ff8a4c; --code: #20243a; }} }}
  body {{ margin: 0; background: var(--bg); color: var(--fg); font: 17px/1.6 system-ui, sans-serif; }}
  main {{ max-width: 860px; margin: 0 auto; padding: 32px 20px 80px; }}
  .bar {{ display: flex; flex-wrap: wrap; gap: 8px 20px; padding: 12px 16px; border-radius: 10px; background: var(--code); font-size: 15px; }}
  a {{ color: var(--accent); }}
  h1 {{ font-size: 2.2em; margin-bottom: 0.2em; }}
  h2 {{ margin-top: 2em; border-bottom: 1px solid color-mix(in srgb, var(--fg) 15%, transparent); padding-bottom: 4px; }}
  code {{ background: var(--code); padding: 1px 5px; border-radius: 4px; font-size: 0.92em; }}
  pre {{ background: var(--code); padding: 14px 16px; border-radius: 8px; overflow-x: auto; line-height: 1.45; }}
  pre code {{ background: none; padding: 0; }}
  table {{ border-collapse: collapse; width: 100%; font-size: 15px; }}
  th, td {{ border: 1px solid color-mix(in srgb, var(--fg) 18%, transparent); padding: 6px 10px; text-align: left; vertical-align: top; }}
  footer {{ margin-top: 48px; color: var(--muted); font-size: 14px; }}
</style>
</head>
<body>
<main>
<nav class="bar">
  <a href="SPEC.md">SPEC.md (raw, for AI tools)</a>
  <a href="lexicons/digital/currentgames/prototato/game.json">Lexicon</a>
  <a href="examples/flap/">Example: Flap Fight</a>
  <a href="examples/pong/">Example: Pong Party</a>
  <a href="https://github.com/quackstra/couch-prototato">Source</a>
</nav>
{body}
<footer>
  Spec text under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>; code under MIT.
  Works with Attie and any AI builder. Not affiliated with Bluesky or Attie.
  Generated from SPEC.md by tools/build.py.
</footer>
</main>
</body>
</html>
"""


def render() -> str:
    src = (ROOT / "SPEC.md").read_text(encoding="utf-8")
    title = src.splitlines()[0].lstrip("# ").strip()
    body = markdown.markdown(src, extensions=["tables", "fenced_code"], output_format="html")
    return PAGE.format(title=html.escape(title), body=body)


def main() -> int:
    out = ROOT / "index.html"
    page = render()
    if "--check" in sys.argv:
        if not out.exists() or out.read_text(encoding="utf-8") != page:
            print("index.html is stale: run python3 tools/build.py", file=sys.stderr)
            return 1
        return 0
    out.write_text(page, encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
