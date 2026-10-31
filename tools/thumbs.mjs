// Renders examples/*/thumb.png (640x360) from real gameplay: 4 scripted pads, a few seconds in.
// usage: NODE_PATH=<dir with playwright> node tools/thumbs.mjs
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const browser = await chromium.launch();
for (const example of ["flap", "pong"]) {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  await page.addInitScript(() => {
    const pads = [0, 1, 2, 3].map((i) => ({ i, t: 0 }));
    navigator.getGamepads = () => pads.map(({ i, t }) => {
      const now = performance.now() / 1000;
      const flap = Math.sin(now * (5 + i) + i * 2) > 0.6;
      return { id: `bot ${i}`, index: i, connected: true, mapping: "standard", timestamp: now,
        axes: [Math.sin(now * 0.7 + i * 1.7), Math.sin(now * 1.3 + i), 0, 0],
        buttons: Array.from({ length: 17 }, (_, b) => ({ pressed: b === 0 && flap, touched: false, value: b === 0 && flap ? 1 : 0 })) };
    });
  });
  const url = pathToFileURL(path.join(root, "examples", example, "index.html"));
  await page.goto(`${url}?prototato=1&players=4`);
  await page.waitForTimeout(example === "flap" ? 3500 : 1700);
  await page.screenshot({ path: path.join(root, "examples", example, "thumb.png") });
  await page.close();
}
await browser.close();
