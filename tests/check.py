"""Static checks for the spec repo: run with `python3 tests/check.py`.

- index.html matches SPEC.md (tools/build.py --check)
- SPEC.md stays under 2,000 words so it fits in a paste
- every example carries the SPEC's input helper verbatim and a manifest that follows section 2
"""

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LAYOUTS = {"dpad-ab", "stick-ab", "twin-stick", "abxy", "one-button"}
INPUTS = {"gamepad", "phone", "keyboard"}
BUTTONS = {"A", "B", "X", "Y", "LB", "RB", "LT", "RT", "Back", "Start", "D-pad", "Left stick", "Right stick"}
MANIFEST_RE = re.compile(
    r'<script type="application/prototato\+json" id="prototato-manifest">(.*?)</script>', re.S
)

failures: list[str] = []


def check(ok: bool, msg: str) -> None:
    if not ok:
        failures.append(msg)


def spec_helper(spec: str) -> str:
    block = spec.split("### Input helper (paste as-is)", 1)[1]
    return block.split("```js\n", 1)[1].split("```", 1)[0].strip()


def check_manifest(name: str, page: str) -> None:
    found = MANIFEST_RE.findall(page)
    check(len(found) == 1, f"{name}: expected exactly one manifest tag, found {len(found)}")
    if not found:
        return
    head = page.split("</head>", 1)[0]
    check(found[0] in head, f"{name}: manifest must be inside <head>")
    m = json.loads(found[0])
    check(m.get("specVersion") == "0.1", f"{name}: specVersion")
    check(isinstance(m.get("title"), str) and 0 < len(m["title"]) <= 64, f"{name}: title")
    check(len(m.get("description", "")) <= 300, f"{name}: description too long")
    p = m.get("players", {})
    check(isinstance(p.get("min"), int) and isinstance(p.get("max"), int), f"{name}: players")
    check(1 <= p.get("min", 0) <= p.get("max", 0) <= 8, f"{name}: players range")
    check(set(m.get("inputs", [])) <= INPUTS and m.get("inputs"), f"{name}: inputs")
    if "phone" in m.get("inputs", []):
        check(m.get("phoneLayout") in LAYOUTS, f"{name}: phoneLayout")
    controls = m.get("controls", [])
    check(len(controls) <= 16, f"{name}: too many controls")
    for c in controls:
        check(c.get("button") in BUTTONS, f"{name}: unknown control button {c.get('button')!r}")
        check(0 < len(c.get("action", "")) <= 64, f"{name}: control action")
    thumb = m.get("thumbnail")
    if thumb:
        path = ROOT / "examples" / name / thumb
        check(path.exists(), f"{name}: thumbnail {thumb} missing")
        if path.exists():
            check(path.stat().st_size < 1_000_000, f"{name}: thumbnail over 1 MB")


def main() -> int:
    spec = (ROOT / "SPEC.md").read_text(encoding="utf-8")
    words = len(spec.split())
    check(words < 2000, f"SPEC.md is {words} words; keep it under 2,000")
    helper = spec_helper(spec)
    build = subprocess.run([sys.executable, str(ROOT / "tools/build.py"), "--check"])
    check(build.returncode == 0, "index.html is stale")
    check((ROOT / "CNAME").read_text().strip() == "prototato.currentgames.digital", "CNAME")
    lex = json.loads((ROOT / "lexicons/digital/currentgames/prototato/game.json").read_text())
    check(lex.get("id") == "digital.currentgames.prototato.game", "lexicon id")

    examples = sorted(p for p in (ROOT / "examples").iterdir() if p.is_dir())
    check(len(examples) >= 2, "need two examples")
    for ex in examples:
        page = (ex / "index.html").read_text(encoding="utf-8")
        check(helper in page, f"{ex.name}: input helper differs from SPEC.md")
        check_manifest(ex.name, page)
        check("getGamepads()" in page, f"{ex.name}: no Gamepad API polling")
        check(not re.search(r"buttons\[16\]|\bb\(16\)", page), f"{ex.name}: uses button 16")
        ext = re.findall(r"""(?:src|href)=["'](https?:)?//""", page)
        check(not ext, f"{ex.name}: references another origin")

    for f in failures:
        print("FAIL:", f)
    print(f"check.py: {len(examples)} examples, SPEC {words} words, {len(failures)} failures")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
