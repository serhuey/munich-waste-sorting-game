# How it works

This is a walk through the whole system: where the rules come from, how they
get into the game, how the game plays them, and what holds it together when a
browser does something unexpected. It is written for anyone who wants to change
the game, check its content or just understand it. The *why* of the product
lives in [`SPEC.md`](SPEC.md); the dated history of decisions in
[`plans/`](plans/). This file describes the system as it stands.

The project has three layers and no runtime dependencies:

```
  data/            what is true about Munich — JSON, signed by a person
    │
    ▼
  tools/build_data.py   the gate — refuses anything unsigned, inconsistent or stale
    │
    ▼
  dist/            what is shipped — content.json + the engine, version-stamped
    │
    ▼
  game/js/         the engine — plain ES modules, no framework, no build step
```

Python tools use only the standard library; the engine uses only the browser.
Nothing is installed to run either.

---

## 1. The rule this project lives by

**No sorting rule is invented.** Every answer in the game traces to an entry in
AWM's Abfalllexikon, a specific AWM or city page, or a federal norm — and to
the name of the person who read it and the date they did. The build refuses
anything that lacks this. A confidently invented rule is the one failure that
would make the game worse than useless, so the machinery below is mostly about
making that impossible rather than unlikely.

Content can be *drafted* by anyone, including a machine, but only a person can
*sign* it. An unsigned draft can be played on a local test build and never
ships.

---

## 2. Repository map

| Path | What it is |
|---|---|
| `data/places.json` | The five places, the tier each opens at, their containers and validity windows |
| `data/items/*.json` | Signed objects — what ships |
| `data/drafts/*.json` | Unsigned objects waiting for a person to verify them |
| `data/verified/lexikon-*.json` | Dated snapshots of AWM's Abfalllexikon |
| `data/finale/christbaum.json` | The Christmas-tree finale: routes, dates, decorations |
| `data/notices.json` | The intro text and the 1 January 2027 transition notice, each with a window |
| `data/i18n/<lang>.json` | Interface strings, one file per language |
| `game/` | The engine: `index.html`, `css/game.css`, `js/*.js`, hand-drawn `art/` |
| `game/test/` | Engine tests (browser page and terminal runner), the sprite sheet |
| `tools/` | The build gate, the verification form, lexicon snapshots, art tools, a dev server |
| `art/` | Exported sprites to draw over (`originals/`, not committed) and the palette |
| `legal/` | Impressum and privacy templates, filled at build time from a git-ignored file |
| `docs/` | The spec, verification guide, deployment notes, this file, dated plans |

---

## 3. The data

### Places — `data/places.json`

Five places, one per tier, in the order a newcomer meets them: home, the shop,
the recycling island, the recycling centre, the hazardous drop-off. Each has
containers with an id, labels in German and English, and optional `from` /
`until` dates. `until` is exclusive.

The **1 January 2027 switch** is nothing but dates in this file: the yellow bin
at home has `from: 2027-01-01`; the island's plastic and metal containers have
`until: 2027-01-01`. No code knows the date. Change the clock (`?date=` in the
URL) and the game is in 2027.

The build refuses two places on one tier or a gap between tiers: the tier number
is shown to the player, and a ladder with a missing rung would look like a bug.

### Objects — `data/items/` and `data/drafts/`

One file per object. The parts that matter:

```json
{
  "id": "joghurtbecher",
  "tier": 3,
  "attrs": ["separable"],
  "labels": { "de": "Joghurtbecher", "en": "Yoghurt pot" },
  "source": { "authority": "awm", "key": "joghurtbecher", "url": "…",
              "destinations_at_verification": ["wertstoffinsel"],
              "verified_by": "…", "verified_on": "2026-…" },
  "sources": [ { "authority": "page", "reference": "Wertstoffinseln: …", … } ],
  "variants": [ { "id": "standard", "kind": "composite", "parts": [
      { "id": "becher", "labels": …, "destinations": [
          { "id": "kunststoff", "until": "2027-01-01" },
          { "id": "gelbe_tonne", "from": "2027-01-01" } ] },
      { "id": "deckel", "labels": …, "destinations": [ … ] } ] } ],
  "explanation": { "de": "…", "en": "…" }
}
```

- **tier** — where the object first appears. All of its answers must be on the
  belt by then; the build checks.
- **attrs** — `examine`: the answer is printed on the object, and the player
  must tap to read it (the deposit can, the receipt). `separable`: it has to be
  taken apart first (the pizza box). `borderline`: the answer goes against
  intuition; the object falls a little slower. Nothing on screen says so.
- **source** and **sources** — where each claim comes from. `awm` is a lexicon
  entry, checked against the snapshot; `page` is an AWM or city page; `law` is
  a federal norm. Every one carries its own signature.
- **variants** — the versions of an object that look alike but answer
  differently. `simple` has destinations; `composite` has parts, each with its
  own. A destination is a container id, optionally with a window — that is how
  one object answers differently before and after the 2027 switch.
- **explanation** — why. It can sit at three levels — the item, a variant, a
  part — and the game shows whichever exist, most specific first.

**Drafts** are the same shape in `data/drafts/`. A draft written by machine
says so (`_drafted_by: "claude"`). A signed item changed after signing records
what changed in `_changed_after_signature`. Keys starting with `_` are notes for
people and never reach the game.

### The finale — `data/finale/christbaum.json`

The one object whose answer is not a container. Each route has exactly one of:
`year_round: true`, `windows: [{from, until}]`, or `illegal: true`. Two scene
dates are played — one inside the collection window, one after it. Every route
open on the scene's date is a right answer. Illegal dumping is named only for a
place outside every route, and no fine amount is given, because no official
source states one.

### Notices — `data/notices.json`

`intro` has editions with complementary windows; the build refuses any date
covered by none or by two, so the description of the system cannot outlive the
rules it describes. `notices` open on every session start inside their window
(1 January – 31 March 2027) and nothing records that they were seen.

### Interface strings — `data/i18n/`

One file per language, German as the reference. A third language is one more
file and no code. The build refuses a bundle where any key or `{placeholder}`
differs from German.

---

## 4. The build — `tools/build_data.py`

```bash
python3 tools/build_data.py              # release: signed content only
python3 tools/build_data.py --fixtures   # test build: drafts included, marked unverified
python3 tools/build_data.py --date 2027-01-15   # build as of another day
```

What it refuses, item by item, with the reason printed:

- no signature, a signature dated in the future, a source whose lexicon key has
  disappeared, or **destinations that changed in the lexicon since signing** —
  the snapshot diff is how a changed rule becomes a re-verification task;
- a destination that does not exist, or that is not yet on the belt at the
  object's tier;
- a composite variant without `separable`, several variants without `examine`,
  nested parts, missing languages.

Fatal for the whole build: no places, a broken ladder, no snapshot, a language
file out of step with German.

`--fixtures` relaxes exactly one thing — signatures — and marks everything it
let through as `unverified`. A signed item that later gained an unsigned source
stays on the test build with a warning that it will not ship.
`tools/publish.py` refuses to copy a test build anywhere.

The build writes `dist/content.json` and copies the engine next to it. On the
way it computes a hash of the engine and the art and stamps it on every module
import, the script and style links, and every hand-drawn picture's address. A
browser can therefore never mix yesterday's `fall.js` with today's `main.js`.

---

## 5. The engine — `game/js/`

| Module | Job |
|---|---|
| `main.js` | Wiring and screens: title, tier intro, play, explanations, finale, result |
| `rules.js` | Pure functions over data and a date: what stands where today, round composition, fall timing |
| `progress.js` | The ladder: which tier comes next, run totals, skipped tiers |
| `score.js` | Points and the clear threshold |
| `explain.js` | What to say after an answer |
| `fall.js` | The falling object: clock, holds, release, the flight into the bin |
| `belt.js` | The conveyor of containers and the place tabs |
| `finale.js` | Routes, windows and verdicts for the tree |
| `i18n.js` | Language choice and string lookup |
| `share.js` | The result to forward, stripped of anything identifying |
| `sprites.js` | Every picture, painted in code |
| `pixel.js` | Turns sprites into images, prefers hand-drawn files, sets pixel type |

`rules`, `progress`, `score`, `explain`, `finale`, `i18n` and `share` have no
DOM and no clock of their own; they are tested as plain functions.

### A run, step by step

1. **Title.** Language from `?lang=`, then the browser, then German. The intro
   text in force today. Inside the 2027 transition window, the notice.
2. **Tier intro.** The new place's containers, drawn as they will stand. After
   "Los" the belt glides to them.
3. **The round** (`rules.roundFor`). Tier one: ten of its own objects, the first
   three asking for neither a closer look nor taking apart. Later tiers: 24 —
   six of the new place first, then a shuffled mix of eight more of its own and
   ten from earlier tiers. Objects already met in the run come last, so nothing
   repeats while the pools last.
4. **The fall.** Duration is `5200 ms + 250 ms per tier`, ×1.35 if borderline,
   ×1.25 if the answer is not at the place the belt shows. Tap the object to
   examine it (costs 15 % of the fall) or take it apart; tap elsewhere to drop
   it at once.
5. **Taking apart.** The object breaks, the parts spread out with their names,
   the first falls on from the same height, the others follow from the top.
6. **Release.** The answer is fixed the instant the object is let go — the
   container under the frame and the time left. The flight into the bin that
   follows is only for the eye.
7. **Points.** Right: 100, up to 150 for an early drop. Wrong: −50, down to −75
   for an early one. A composite object never scores below sending it whole.
8. **Explanation.** Always, after every object: where it went, what else would
   have been right, why — with destinations not yet on the belt left unnamed.
9. **Tier end.** Cleared at 70 % right, never on a clean run; failing costs a
   retry, not progress. The next tier with content opens the next place.
10. **Finale.** Strip the tree, choose a route on two dates shown on a tear-off
    calendar: open route +150, a legal one closed that day −50, illegal −100.
11. **Result.** Points, share button (the share sheet or the clipboard), the
    bare address with any `?src=` removed.

Nothing is written to the device at any point: no cookies, no localStorage, no
IndexedDB.

### When the browser does not cooperate

The game makes no assumption that a browser draws frames, keeps a tab visible
or delivers one click per press. Each of these was a real failure before it was
a rule:

- **The fall is timed by the clock, and held when the page is hidden.**
  Otherwise a tab left for ten seconds returns to an object that "landed" long
  ago in whatever bin was under the frame. Examining and a hidden page are
  separate holds: returning to the tab does not end an examination.
- **Every animation has a timer behind it.** The flight into the bin and the
  belt's glide finish by timer if no frame finishes them. Without that, a phone
  saving power left an object hanging over the bin with its answer never
  counted.
- **One press, one action.** Dialog buttons act once. Key repeats never close a
  dialog or drop an object. For 350 ms after a dialog closes, the field ignores
  input, so the second tap of a double tap does not drop the next object.
- **No stale code.** Version stamps on every address (see the build).
- **Headings never size themselves against a zero-width window.** A page opened
  in a background tab used to keep one-pixel headings for the whole session.
- **Reduced motion** skips the break-apart, the flight and the calendar tear.

### Accessibility

Colour never carries meaning alone. Every container has its own drawing and its
name in words. Green and brown glass, whose greys are within ten levels of each
other, also carry a texture: stripes and dots. Explanations, labels and names
are set in the system font at 14 px or more; the pixel alphabet is used only
for headings and buttons. The whole game plays from the keyboard: ← → move the
belt, Tab or 1–5 jump to a place, ↑ looks, Space drops.

---

## 6. The art

Every picture is painted in `game/js/sprites.js` by a small rasteriser: shapes
(rectangles, ellipses, polygons) with a one-pixel ink outline, light from the
top left, and a cylinder ramp for bottles and cans. Objects are 32×32,
containers and routes 48×48, the tree 64×88, the skyline 320×96.

Any of them can be replaced by a PNG drawn by hand:

```bash
node tools/export_art.mjs     # every sprite as a 1× PNG in art/originals/, palette in art/palette.gpl
#   … redraw files in art/originals/ in any pixel editor, save in place …
node tools/collect_art.mjs    # copies what changed into game/art/
python3 tools/build_data.py --fixtures
```

`collect_art` compares pixels, not bytes, because an editor re-encodes whatever
it saves. `export_art` never overwrites a file someone has drawn on. A hand-drawn
file wins over the code; a variant (`glasflasche.gruen.png`) or a part
(`pizzakarton--reste.png`) can be drawn even where the code has no drawing. The
terminal tests refuse a file whose name matches nothing or whose size is wrong.
`game/test/sprites.html` shows every sprite, hand-drawn ones outlined in yellow,
with a greyscale switch.

---

## 7. Verifying content

```bash
python3 tools/verify_ui.py                       # the form, http://127.0.0.1:8765
python3 tools/drafts.py new <lexicon-key> --tier 3 --id <id>
python3 tools/drafts.py list
python3 tools/awm_lexikon.py fetch --details     # a fresh snapshot (needs HTTPS: use Homebrew's python3 on a Mac)
python3 tools/awm_lexikon.py diff --latest       # what changed since the last one
```

The form lists drafts on the left. Each shows the source link, destinations as
checkboxes built from `places.json` — a container that does not exist cannot be
chosen — explanations in both languages, and a signature. Under **Прочее** are
the signatures that are not drafts: the composition of places, items in the
game that gained an unsigned source, the finale and the notices. The full
procedure is in [`VERIFYING.md`](VERIFYING.md).

---

## 8. Running and testing

```bash
python3 tools/build_data.py --fixtures && python3 tools/serve.py    # http://127.0.0.1:8799
node game/test/run.mjs                 # engine tests + art coverage + hand-drawn file checks
python3 tools/test_build_data.py       # the build gate
```

`tools/serve.py` serves `dist/` with caching off; `--lan` lets a phone on the
same network reach it. The engine tests also run as a page,
`game/test/belt.test.html`.

URL handles for development — none of them changes a rule:

| Handle | Effect |
|---|---|
| `?date=2027-01-15` | Read the rules as of that day |
| `?tier=3` | Start at a tier |
| `?finale=1` | Go straight to the tree |
| `?slow=4` | Every fall four times slower |
| `?lang=en` | Choose the language |

With any handle present, the engine's parts are reachable from the console as
`window.__game`.

---

## 9. Shipping

`tools/publish.py` copies a release build (never a test build) into the
portfolio site's repository; committing and pushing it is a person's job. Still
open before the game can go public: an aggregate counter that stores no
identifiers, the Impressum and privacy pages (they need the operator's postal
address), the deployment itself, and signatures on the content. See
[`DEPLOY.md`](DEPLOY.md) and the plan's U12–U15.
