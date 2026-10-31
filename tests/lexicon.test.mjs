// Validates the lexicon with the reference @atproto/lexicon implementation, and checks that
// good records pass and bad ones fail. usage: (cd tests && npm ci && node lexicon.test.mjs)
import { readFile } from "node:fs/promises";
import { Lexicons } from "@atproto/lexicon";

const NSID = "digital.currentgames.prototato.game";
const doc = JSON.parse(await readFile(new URL("../lexicons/digital/currentgames/prototato/game.json", import.meta.url)));
const lex = new Lexicons();
lex.add(doc);

const good = {
  $type: NSID,
  url: "https://flap-fight.example.com/",
  title: "Flap Fight",
  specVersion: "0.1",
  players: { min: 1, max: 4 },
  inputs: ["gamepad", "phone", "keyboard"],
  phoneLayout: "dpad-ab",
  controls: [{ button: "A", action: "Flap" }],
  builtWith: "attie",
  createdAt: "2026-10-31T12:00:00.000Z",
};
const bad = {
  "missing url": { ...good, url: undefined },
  "9 players": { ...good, players: { min: 1, max: 9 } },
  "0 players": { ...good, players: { min: 0, max: 2 } },
  "long title": { ...good, title: "x".repeat(65) },
  "17 controls": { ...good, controls: Array(17).fill({ button: "A", action: "x" }) },
  "bad date": { ...good, createdAt: "yesterday" },
  "bad url": { ...good, url: "not a url" },
};

let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) failed++; };
const check = (rec) => { try { lex.assertValidRecord(NSID, JSON.parse(JSON.stringify(rec))); return true; } catch { return false; } };

ok(check(good), "SPEC.md section 6 example record validates");
// The SPEC's own example must stay in sync with this test's good record.
const spec = await readFile(new URL("../SPEC.md", import.meta.url), "utf8");
const specRecord = JSON.parse(spec.split("## 6.")[1].split("```json\n")[1].split("```")[0]);
ok(check(specRecord), "the record printed in SPEC.md validates");
for (const [name, rec] of Object.entries(bad)) ok(!check(rec), `rejects ${name}`);
ok(check({ ...good, phoneLayout: "future-layout", inputs: ["gamepad", "voice"] }), "knownValues stay open for future layouts and inputs");

for (const ex of ["flap", "pong"]) {
  const page = await readFile(new URL(`../examples/${ex}/index.html`, import.meta.url), "utf8");
  const m = JSON.parse(page.split('id="prototato-manifest">')[1].split("</script>")[0]);
  delete m.thumbnail; // a path in the page, a blob in the record
  ok(check({ $type: NSID, ...m, url: `https://prototato.currentgames.digital/examples/${ex}/`, createdAt: "2026-10-31T12:00:00.000Z" }),
    `${ex}: manifest + url + createdAt is a valid record`);
}
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
