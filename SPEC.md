# Couch Prototato Spec v0.1

Build a browser game that plays on a TV with game controllers or phones.

This file is written for you and for the AI tool building the game (Attie, or any other). Follow every **MUST**. Do the **SHOULD**s unless you have a reason not to. Nothing else is required: couch-jotato, the TV console, takes care of phones, pairing and the Home button.

Stable URL: `https://prototato.currentgames.digital/SPEC.md`

## 1. Checklist

A Prototato game:

1. **MUST** include the manifest tag (section 2) in `<head>`.
2. **MUST** read input from the standard Gamepad API every frame, with a keyboard fallback (section 3).
3. **MUST** be fully playable with a D-pad and the A and B buttons: no mouse, no touch, no hover.
4. **MUST** run without sign-in, and request nothing outside its own origin except public ATProto endpoints.
5. **MUST** read the `prototato` and `players` query parameters (section 4).
6. **SHOULD** follow the TV layout rules (section 5).
7. **MAY** publish a record so that couch-jotato can list it under its creator (section 6).

## 2. Manifest

Put exactly one manifest tag in `<head>`. It must be valid JSON: double quotes, no comments, no trailing commas.

```html
<script type="application/prototato+json" id="prototato-manifest">
{
  "specVersion": "0.1",
  "title": "Flap Fight",
  "description": "Two butterflies, one sky.",
  "players": { "min": 1, "max": 4 },
  "inputs": ["gamepad", "phone", "keyboard"],
  "phoneLayout": "dpad-ab",
  "controls": [
    { "button": "A", "action": "Flap" },
    { "button": "Start", "action": "Pause" }
  ],
  "thumbnail": "thumb.png"
}
</script>
```

| Field | Required | Value |
| --- | --- | --- |
| `specVersion` | yes | `"0.1"` |
| `title` | yes | Up to 64 characters |
| `description` | no | Up to 300 characters, one or two sentences |
| `players` | yes | `{ "min": 1–8, "max": 1–8 }`, with `min` ≤ `max` |
| `inputs` | yes | Any of `"gamepad"`, `"phone"`, `"keyboard"`. List `"phone"` if the game works with the phone layout you picked. |
| `phoneLayout` | if `inputs` has `"phone"` | One of the layouts below |
| `controls` | no | Up to 16 `{ "button", "action" }` pairs, shown before the game starts. `button` is a name from the table in section 3: `A`, `B`, `X`, `Y`, `LB`, `RB`, `LT`, `RT`, `Back`, `Start`, `D-pad`, `Left stick`, `Right stick`. |
| `thumbnail` | no | A path relative to the page: PNG, JPEG or WebP, 16:9, ideally 640×360, under 1 MB |
| `record` | no | An `at://` URI of this game's record (section 6) |

The `phoneLayout` value decides what a phone draws. The phone acts as a normal gamepad, so pick the smallest layout that covers your controls:

| `phoneLayout` | Phone shows | Gamepad parts used |
| --- | --- | --- |
| `one-button` | One big A button | button 0 |
| `dpad-ab` | D-pad, A, B | buttons 0, 1, 12–15 |
| `stick-ab` | Left stick, A, B | axes 0–1, buttons 0, 1 |
| `abxy` | D-pad, A, B, X, Y | buttons 0–3, 12–15 |
| `twin-stick` | Two sticks, plus LT and RT | axes 0–3, buttons 6, 7 |

Every phone layout also has Start (9), Back (8) and a Home button. The shell handles Home itself.

## 3. Input

### Rules

- **MUST** call `navigator.getGamepads()` once per `requestAnimationFrame`. Never keep a gamepad object from one frame to the next, because it will go stale.
- **MUST** use only the standard mapping below. Read the button and axis indexes; don't look at the `id` string.
- **MUST NOT** use button 16 (Home) for anything: it belongs to the shell.
- **MUST** treat stick values between −0.15 and 0.15 as 0.
- **MUST** support the keyboard: arrows or WASD move, Space or Enter is A, Escape is B, and P is Start.
- **MUST** listen for `gamepaddisconnected` and pause the game when a joined player's pad disappears. When it comes back with `gamepadconnected`, let that player press A to resume.
- **MUST NOT** require touch or the mouse. You may support them as extras.
- Analog triggers (6, 7) report `value` from 0 to 1. Every other button only needs `pressed`.

### Standard mapping

| Index | Button | Index | Button |
| --- | --- | --- | --- |
| 0 | A (confirm) | 8 | Back / Select |
| 1 | B (back) | 9 | Start (pause) |
| 2 | X | 10 / 11 | L3 / R3 (stick clicks) |
| 3 | Y | 12 / 13 | D-pad up / down |
| 4 / 5 | LB / RB | 14 / 15 | D-pad left / right |
| 6 / 7 | LT / RT (analog) | 16 | Home: reserved, never use |

Axes: 0 is left stick X, 1 is left stick Y, 2 is right stick X and 3 is right stick Y. Each runs from −1 to 1. Negative values mean left and up.

### Input helper (paste as-is)

This code covers every rule in this section. Each pad becomes its own device, and the keyboard is one more device.

```js
// Prototato input helper v0.1. Call readInputs() once per animation frame.
const DEAD = 0.15;
const KEYS = { up: ["ArrowUp", "KeyW"], down: ["ArrowDown", "KeyS"], left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"], A: ["Space", "Enter"], B: ["Escape"], Start: ["KeyP"] };
const GAME_KEYS = new Set(Object.values(KEYS).flat());
const held = new Set();
const hit = new Set(); // keys pressed since the last read, so quick taps still count
const last = {};
addEventListener("keydown", (e) => { if (GAME_KEYS.has(e.code)) { held.add(e.code); hit.add(e.code); e.preventDefault(); } });
addEventListener("keyup", (e) => held.delete(e.code));
addEventListener("blur", () => held.clear());
const dz = (v) => (Math.abs(v || 0) < DEAD ? 0 : v);
const key = (name) => KEYS[name].some((c) => held.has(c) || hit.has(c));

function device(id, s) {
  s.up = s.moveY < -0.5; s.down = s.moveY > 0.5; s.left = s.moveX < -0.5; s.right = s.moveX > 0.5;
  const was = last[id] || {};
  last[id] = { ...s };
  s.id = id;
  s.pressed = (name) => !!s[name] && !was[name]; // true only on the first frame it is down
  return s;
}

function readInputs() {
  const list = [];
  for (const p of navigator.getGamepads()) {
    if (!p || !p.connected) continue;
    const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
    list.push(device("pad" + p.index, {
      moveX: (b(15) - b(14)) || dz(p.axes[0]), moveY: (b(13) - b(12)) || dz(p.axes[1]),
      aimX: dz(p.axes[2]), aimY: dz(p.axes[3]),
      A: b(0), B: b(1), X: b(2), Y: b(3), LB: b(4), RB: b(5),
      LT: p.buttons[6] ? p.buttons[6].value : 0, RT: p.buttons[7] ? p.buttons[7].value : 0,
      Back: b(8), Start: b(9),
    }));
  }
  list.push(device("keys", {
    moveX: key("right") - key("left"), moveY: key("down") - key("up"), aimX: 0, aimY: 0,
    A: key("A"), B: key("B"), X: false, Y: false, LB: false, RB: false, LT: 0, RT: 0,
    Back: false, Start: key("Start"),
  }));
  hit.clear();
  return list;
}
```

Use it like this: `for (const d of readInputs()) { if (d.pressed("A")) join(d.id); }`. Then give each joined `d.id` its own player. `pressed()` takes any button name, or `up`, `down`, `left` or `right`, which suits menus.

## 4. Players and joining

- Players join in the order they press A. Player 1 is whoever pressed A first, not necessarily pad 0.
- With no query parameters, open on a **join screen**. It shows "Press A to join", one slot per joined player, and "Press Start to play" once `players.min` have joined.
- `?prototato=1` means the game is running inside couch-jotato. Don't show fullscreen buttons, "open in new tab" links or any other browser chrome. Every phone and pad is already a gamepad.
- `?players=N` means the shell has already joined N devices. Assign the first N connected gamepads to players 1…N, in the order `getGamepads()` lists them (pads can show up a moment after the page loads). Then skip the join screen. If fewer than N are connected, wait on a "Waiting for controllers" screen.
- Show each player's color and number near their character. Players should never have to ask "which one am I?"
- Start pauses the game. The pause menu needs Resume and Restart, chosen with the D-pad and A. B also resumes.
- When the game ends, show the result and "A: play again · B: back to join screen".

## 5. TV layout

- Design for a 1920×1080 screen, and scale with the window. Use `canvas` sized to `innerWidth × innerHeight × devicePixelRatio`, or CSS `vw` and `vh` units.
- All text is at least 28 px at 1080p (about `2.6vh`).
- Keep everything that matters inside a 5% margin on every side. TVs crop their edges.
- Menus are lists or grids. The selected item is obvious from position, color and size, never from hover. D-pad moves, A picks, B goes back.
- Put your controls on screen, briefly, before play starts.
- Don't depend on audio, and don't autoplay sound before the first button press. Browsers block it.
- Hold 60 frames per second on a Raspberry Pi 5. Prefer Canvas 2D or plain WebGL, keep particle counts small, and avoid huge images.

## 6. Publishing a record (optional)

couch-jotato finds games by creator. If you publish a record to your ATProto repo (your Bluesky account's PDS), your games show up under your handle with nothing else to set up. Without a record, the shell scans your recent posts for links to pages that have a manifest. Posting your game's link works too, just more slowly.

- Collection (NSID): `digital.currentgames.prototato.game`
- Lexicon: `https://prototato.currentgames.digital/lexicons/digital/currentgames/prototato/game.json`
- Record key: a short slug for the game, such as `flap-fight`. Publishing again under the same key updates the record.
- Fields: the same as the manifest, plus `url` (the game's address) and `createdAt` (an ISO 8601 datetime). Leave out `record`. `thumbnail` here is an uploaded blob, not a path. Optional `builtWith` names the tool you used, such as `"attie"`.

```json
{
  "$type": "digital.currentgames.prototato.game",
  "url": "https://flap-fight.example.com/",
  "title": "Flap Fight",
  "specVersion": "0.1",
  "players": { "min": 1, "max": 4 },
  "inputs": ["gamepad", "phone", "keyboard"],
  "phoneLayout": "dpad-ab",
  "controls": [{ "button": "A", "action": "Flap" }],
  "builtWith": "attie",
  "createdAt": "2026-10-31T12:00:00.000Z"
}
```

Write it with `com.atproto.repo.putRecord` (`repo` = your DID, `collection` = the NSID above, `rkey` = your slug), signed in with an app password. If the record and the page manifest disagree, the page manifest wins.

## 7. Before you ship

Test with a gamepad plugged into desktop Chrome, and again with only the keyboard:

1. The manifest parses: `JSON.parse(document.getElementById("prototato-manifest").textContent)` in the console.
2. You can join, play, pause, resume and restart with only the D-pad, A, B and Start.
3. Unplugging a joined pad pauses the game, and plugging it back in lets you resume.
4. `?prototato=1&players=2` with two pads skips the join screen.
5. The browser's Network tab shows no requests to other sites.
6. All text is readable from across a room.

## Reference

- Example games: `https://prototato.currentgames.digital/examples/flap/` and `/examples/pong/`. View their source.
- Spec and examples: `https://github.com/quackstra/couch-prototato` (spec under CC BY 4.0, code under MIT)
- Couch Prototato is not affiliated with Bluesky or Attie.
