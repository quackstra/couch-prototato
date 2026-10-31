// Plays both examples in headless Chromium the way a couch would: scripted standard-mapping
// gamepads (join, play, pause, unplug, replug), keyboard-only play, the shell's
// ?prototato=1&players=N fast path, and a check that nothing leaves the page's origin.
// usage: NODE_PATH=<dir with playwright> node tests/examples.e2e.mjs
import http from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".md": "text/markdown" };

const server = http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, path.normalize(p));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fake pads: fresh snapshot objects every getGamepads() call, like the real API.
function fakePads() {
  const pads = [];
  const snap = (p) => p && { id: p.id, index: p.index, connected: true, mapping: "standard", timestamp: performance.now(),
    axes: [...p.axes], buttons: p.buttons.map((v) => ({ pressed: v > 0.5, touched: v > 0, value: v })) };
  navigator.getGamepads = () => pads.map(snap);
  const fire = (type, p) => { const e = new Event(type); e.gamepad = snap(p); dispatchEvent(e); };
  window.__pad = {
    connect(i) { pads[i] = { id: `fake ${i}`, index: i, axes: [0, 0, 0, 0], buttons: Array(17).fill(0) }; fire("gamepadconnected", pads[i]); },
    disconnect(i) { const p = pads[i]; pads[i] = null; fire("gamepaddisconnected", p); },
    set(i, b, v) { pads[i].buttons[b] = v; },
    axis(i, a, v) { pads[i].axes[a] = v; },
    async tap(i, b) { this.set(i, b, 1); await new Promise((r) => setTimeout(r, 70)); this.set(i, b, 0); await new Promise((r) => setTimeout(r, 70)); },
  };
}

const browser = await chromium.launch();

async function open(example, query = "") {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  const foreign = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => { if (!r.url().startsWith(base) && !r.url().startsWith("data:")) foreign.push(r.url()); });
  await page.addInitScript(fakePads);
  await page.goto(`${base}/examples/${example}/${query}`);
  await page.waitForFunction(() => window.__prototato);
  return { page, errors, foreign };
}

const state = (page, expr) => page.evaluate(expr);
const press = async (page, k) => { await page.keyboard.press(k); await sleep(80); };
const mode = (page) => state(page, () => window.__prototato.mode);

for (const example of ["flap", "pong"]) {
  // 1. Three pads: join, start, play, pause, unplug, replug.
  {
    const { page, errors, foreign } = await open(example);
    const manifest = await page.evaluate(() => JSON.parse(document.getElementById("prototato-manifest").textContent));
    ok(manifest.specVersion === "0.1", `${example}: manifest parses`);
    await page.evaluate(() => { for (const i of [0, 1, 2]) window.__pad.connect(i); });
    for (const i of [2, 0, 1]) await page.evaluate((i) => window.__pad.tap(i, 0), i);
    const devs = await state(page, () => window.__prototato.players.map((p) => p.dev));
    ok(JSON.stringify(devs) === '["pad2","pad0","pad1"]', `${example}: players join in A-press order (${devs})`);
    await page.evaluate(() => window.__pad.tap(0, 9));
    ok((await mode(page)) === "play", `${example}: Start begins play`);

    if (example === "flap") {
      await sleep(600); // settle on the ground
      const y0 = await state(page, () => window.__prototato.players[0].y);
      await page.evaluate(() => window.__pad.tap(2, 0));
      await sleep(60);
      const y1 = await state(page, () => window.__prototato.players[0].y);
      ok(y1 < y0 - 10, `${example}: A flaps player 1 upward (${y0.toFixed(0)} → ${y1.toFixed(0)})`);
      const x0 = await state(page, () => window.__prototato.players[1].x);
      await page.evaluate(() => window.__pad.set(0, 15, 1));
      await sleep(400);
      await page.evaluate(() => window.__pad.set(0, 15, 0));
      const x1 = await state(page, () => window.__prototato.players[1].x);
      ok(x1 > x0 + 40 || x1 < x0 - 400, `${example}: D-pad right steers player 2 (${x0.toFixed(0)} → ${x1.toFixed(0)})`);
    } else {
      const p0 = await state(page, () => window.__prototato.players[0].pos);
      await page.evaluate(() => window.__pad.axis(2, 1, 0.9));
      await sleep(300);
      await page.evaluate(() => window.__pad.axis(2, 1, 0.1)); // inside the dead zone: must not move
      const p1 = await state(page, () => window.__prototato.players[0].pos);
      await sleep(300);
      const p2 = await state(page, () => window.__prototato.players[0].pos);
      ok(p1 > p0 + 100, `${example}: left stick moves player 1's paddle (${p0} → ${p1.toFixed(0)})`);
      ok(p2 === p1, `${example}: stick under 0.15 is ignored`);
      let moved = false;
      for (let i = 0; i < 10 && !moved; i++) {
        await sleep(200);
        const b = await state(page, () => window.__prototato.ball);
        moved = b && (b.x !== 960 || b.y !== 540);
      }
      ok(moved, `${example}: ball is served and moving`);
    }

    await page.evaluate(() => window.__pad.tap(1, 9));
    ok((await mode(page)) === "pause", `${example}: Start pauses`);
    await page.evaluate(() => window.__pad.tap(1, 1));
    ok((await mode(page)) === "play", `${example}: B resumes`);
    await page.evaluate(() => window.__pad.disconnect(1));
    await sleep(50);
    ok((await mode(page)) === "lost", `${example}: unplugging a joined pad pauses`);
    await page.evaluate(() => window.__pad.connect(1));
    await page.evaluate(() => window.__pad.tap(1, 0));
    ok((await mode(page)) === "pause", `${example}: replug + A takes the seat back`);
    await page.evaluate(() => window.__pad.tap(1, 0)); // "Resume" is selected
    ok((await mode(page)) === "play", `${example}: Resume from the menu`);
    await page.evaluate(() => window.__pad.set(0, 16, 1));
    await sleep(100);
    ok((await mode(page)) === "play", `${example}: button 16 is ignored`);
    ok(errors.length === 0, `${example}: no page errors ${errors.join("; ")}`);
    ok(foreign.length === 0, `${example}: no requests to other origins ${foreign.join(" ")}`);
    await page.close();
  }

  // 2. Keyboard only.
  {
    const { page, errors } = await open(example);
    await press(page, "Space");
    ok((await state(page, () => window.__prototato.players.length)) === 1, `${example}: Space joins from the keyboard`);
    await press(page, "p");
    ok((await mode(page)) === "play", `${example}: P starts`);
    if (example === "flap") {
      await sleep(600);
      const y0 = await state(page, () => window.__prototato.players[0].y);
      await press(page, "Space");
      await sleep(60);
      ok((await state(page, () => window.__prototato.players[0].y)) < y0 - 10, `${example}: Space flaps`);
    } else {
      ok((await state(page, () => window.__prototato.players.length)) === 2, `${example}: lone player gets a CPU rival`);
      const p0 = await state(page, () => window.__prototato.players[0].pos);
      await page.keyboard.down("ArrowUp"); await sleep(250); await page.keyboard.up("ArrowUp");
      ok((await state(page, () => window.__prototato.players[0].pos)) < p0 - 80, `${example}: arrow keys move the paddle`);
    }
    await press(page, "p");
    ok((await mode(page)) === "pause", `${example}: P pauses`);
    await press(page, "Escape");
    ok((await mode(page)) === "play", `${example}: Escape resumes`);
    ok(errors.length === 0, `${example}: keyboard run has no page errors`);
    await page.close();
  }

  // 3. In the shell: ?prototato=1&players=3, pads arriving just after load.
  {
    const { page, errors } = await open(example, "?prototato=1&players=3");
    ok((await mode(page)) === "wait", `${example}: players=3 waits for controllers`);
    await page.evaluate(() => { window.__pad.connect(0); window.__pad.connect(1); });
    await sleep(100);
    ok((await mode(page)) === "wait", `${example}: still waiting with 2 of 3`);
    await page.evaluate(() => window.__pad.connect(2));
    await sleep(100);
    const devs = await state(page, () => window.__prototato.players.map((p) => p.dev));
    ok((await mode(page)) === "play" && JSON.stringify(devs) === '["pad0","pad1","pad2"]', `${example}: skips the join screen with 3 seated (${devs})`);
    ok(await state(page, () => window.__prototato.IN_SHELL), `${example}: sees prototato=1`);
    ok(errors.length === 0, `${example}: shell run has no page errors`);
    await page.close();
  }
}

await browser.close();
server.close();
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
