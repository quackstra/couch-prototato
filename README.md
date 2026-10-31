# Couch Prototato

An open spec for vibe-coded browser games that play on a TV with game controllers or phones.

Build a game in Attie or any other AI builder. Point the tool at the spec, and the result runs on
couch-jotato, the couch TV console, with pads, with
phones acting as pads, or with a keyboard in any browser.

**Spec:** https://quackstra.github.io/couch-prototato/SPEC.md (future home: `prototato.currentgames.digital`). Give this URL to your AI tool, or paste
the file in (it's under 2,000 words).

## What's here

| Path | What |
| --- | --- |
| `SPEC.md` | The author spec: input, manifest, players, TV layout, publishing |
| `index.html` | SPEC.md rendered for people (`python3 tools/build.py`) |
| `lexicons/digital/currentgames/prototato/game.json` | The `digital.currentgames.prototato.game` record lexicon |
| `examples/flap/` | Flap Fight: 1–4 player butterfly joust, `dpad-ab` phone layout |
| `examples/pong/` | Pong Party: 1–4 player four-sided pong (CPU rival when alone), `stick-ab` phone layout |

The examples are single HTML files with no dependencies. View their source: each one carries
the SPEC's input helper verbatim.

## Tests

```sh
python3 tests/check.py                         # spec length, index.html fresh, examples follow the spec
(cd tests && npm ci && node lexicon.test.mjs)  # lexicon checked with @atproto/lexicon
NODE_PATH=<dir with playwright> node tests/examples.e2e.mjs   # both examples, pads + keyboard
```

## License

Code (examples, tools, tests): MIT. `SPEC.md`: CC BY 4.0. See `LICENSE`.

Works with Attie and any AI builder. Couch Prototato is an independent project. It is not
affiliated with or endorsed by Bluesky or Attie.
