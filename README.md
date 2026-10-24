# Munich Waste Sorting Game

A casual mobile-web game that teaches people arriving in Munich where household waste actually goes.

**Status: internal test, release 1.0.0.** The game is playable end to end at [sergei-grieg.de/muell](https://sergei-grieg.de/muell/): five tiers, 106 objects, the Christmas-tree finale, German and English, pixel art for every object and container, a picture card to share the result, and an installable app that plays offline. Every object, the places, the finale and the 2027 notice are signed by a person. The Impressum and Datenschutz are in place; there are no statistics. What remains before the public launch is the subdomain `muell.sergei-grieg.de` and the launch posts. What changed in each release: [`CHANGELOG.md`](CHANGELOG.md).

## Why

Ask someone who has lived in Munich for ten years where a laminated tea sachet goes. Watch them hesitate.

Munich is the exception in Germany. There is no Gelber Sack and no yellow bin: packaging is carried to one of roughly a thousand public Wertstoffinseln. Someone whose previous city collected everything from the building arrives with a working mental model that is simply wrong here — and gets it wrong not at the level of *which bin*, but at the level of *where do I carry this at all*.

Six places, in fact:

| Place | What goes there |
|---|---|
| Home | Restmüll, Papier, Bio — only the first is charged |
| The shop | Anything labelled Pfand, batteries, old lamps, small electronics |
| Wertstoffinsel | Glass by colour, textiles, plastic and metal packaging (until 2027) |
| Wertstoffhof | Electronics, batteries, bulky waste |
| Hazardous drop-off | Problemabfall, medicines |
| Seasonal collection sites | Christmas trees — fully stripped, on set dates |

Four bins are learnable in an evening. Six places are not, and nobody explains them coherently: the official Abfalllexikon is organised per item, while a newcomer needs it per place.

The shop is the one people miss. German law obliges any retailer selling batteries to take them back, and any shop above a size threshold to accept old lamps and small electronics under 25 cm — no purchase required. Which means the charger you were going to drive across town to a Wertstoffhof could have gone in a box by the till while you were buying milk.

Then there are the traps, and they come in two kinds.

Some are written on the object. A bottle marked `Pfand` goes back to a machine; a visually identical one marked `Pfandfrei` does not — and the word contains "Pfand", which is exactly how people get caught. The wrapper around a tea bag is sometimes plain paper and sometimes foil-lined, and only looking tells you which. These have to be examined, not recognised.

Others hide inside a category you think you know. A supermarket receipt feels like paper and is not: thermal paper belongs in Restmüll, and the reason is that nobody can tell a phenol-free receipt from the rest, so all of them are treated as the worst case. A pizza box is not one answer but two — clean cardboard to Papier, food residue to Bio. A tea bag is a small assembly: wrapper, the bag itself, string and staple, paper tag, and whether the bag may go into Bio at all depends on whether it is cellulose or synthetic.

And most of what people believe about fines is wrong. A household sorting mistake in Bavaria is worth around €20, and in practice the bin is simply emptied as Restmüll and billed. The real fine is for illegal dumping — which is why the game ends with a Christmas tree, the one everyday item where getting it wrong actually costs money.

## Why now

On **1 January 2027** Munich introduces the Gelbe Tonne. Bins are distributed from November 2026, and the containers for plastic and metal packaging leave the Wertstoffinseln. The whole city has to relearn the answer — not just newcomers.

This project is built to be correct on both sides of that date. Sorting rules live as data, so the switch is a data change rather than a rewrite.

## What it is

Waste falls from the top of the screen. A belt of containers sits at the bottom — the containers of one place. You pick the place from a tab row, then swipe the right container under the falling item. Places unlock one at a time, in the order you meet them in real life.

Some items fall slowly because they deserve thought. Some have to be tapped and examined, because the answer is printed on them in small type. Some have to be taken apart. Every answer is followed by an explanation, including when you were right and there were other correct answers you did not know about.

If you already know the answer you can drop early and score more — and a wrong fast drop costs more than a wrong slow one. The score ends up measuring not what you remember but what you actually know.

## Accuracy

City-specific correctness is the whole point, so it is enforced rather than assumed:

- Every item traces to an entry in AWM's Abfalllexikon or a specific AWM page, with the date a human read it.
- Nothing enters the build on the strength of someone being fairly sure. That rule is `R15` in the spec, and it exists because the fastest way to make this project worthless is one confidently invented sorting rule.
- `tools/awm_lexikon.py` takes a snapshot of the source and diffs it against the previous one, so a changed rule surfaces as a reverification task instead of quietly rotting.

This project is not affiliated with or endorsed by AWM or the city of Munich. It uses their published information as a source and links back to it. If AWM would rather it did not, that is their call and this repository will comply.

## Repository

```
docs/SPEC.md          the requirements: what the product must do and why
docs/HOW-IT-WORKS.md  how the system works, end to end
docs/DEPLOY.md        how a build reaches the site
docs/RELEASING.md     release numbers: what moves which part, the steps of a release
docs/plans/           dated working history of the specification, RU and EN
data/                 places, items, drafts, interface strings, the finale, the 2027 notice
game/                 the engine: plain ES modules, every picture a PNG in game/art/, the app manifest and icons
VERSION               the release number, shown on the title screen
CHANGELOG.md          what each release changed for a player
prototype/            playable spike of the first two places, open the HTML in a browser
tools/                Abfalllexikon snapshot and diff, the build gate, the verification form
```

Start with `docs/SPEC.md` for what the product must do and why, and [`docs/HOW-IT-WORKS.md`](docs/HOW-IT-WORKS.md) for how the system does it: the data, the build gate, the engine, the art pipeline and the verification loop.

## Running it locally

```bash
python3 tools/build_data.py --fixtures     # build dist/ from drafts, for development
python3 tools/serve.py                     # http://127.0.0.1:8799, --lan to reach it from a phone
```

`tools/serve.py` serves `dist/` with caching switched off. The stock
`python3 -m http.server` lets the browser keep old copies of the engine's
modules, so after a rebuild a page can run a new `main.js` against an old
`fall.js` and fail as if the code were broken.

`--fixtures` includes items nobody has verified yet, marks every one of them
`unverified`, stamps the build as a stand and makes `tools/publish.py` refuse to
copy it anywhere. The same goes for the finale and the 2027 notice, whose sources
are unsigned too. Without the flag the build contains only signed content, which
is what ships; the game then ends after the last playable tier instead of
showing dates nobody has checked.

Drafts marked `"_drafted_by": "claude"` were written by machine from the AWM
lexicon snapshot, AWM's pages and the federal norms they cite. Each names its
source; none carries a signature. They go through the same loop as any draft —
see `docs/VERIFYING.md`.

Two development handles on the URL, and the first is also how the 2027 switch is
demonstrated:

- `?date=2027-01-15` reads the rules against another day. The yellow bin appears
  at home and both packaging containers leave the island, with no other change.
- `?tier=3` starts further up the ladder.

Engine tests are a page, because the engine is a page, and the same tests run
from a terminal together with a check that every object and container in the
data has a drawing:

```bash
python3 -m http.server 8081
open http://127.0.0.1:8081/game/test/belt.test.html
open http://127.0.0.1:8081/game/test/sprites.html    # all pixel art on one sheet
node game/test/run.mjs
```

## Versions

The release number lives in `VERSION` and appears on the title screen as
`v1.0.0`. It follows `MAJOR.MINOR.PATCH`: major when points stop being
comparable with earlier versions, minor when the game gains something (objects,
places, languages, features), patch when something is corrected. Numbering
starts at 1.0.0, the build of 24 October 2026. Each published release is a git
tag and a GitHub release; `tools/publish.py` refuses a changed build under a
number already live. Details in [`docs/RELEASING.md`](docs/RELEASING.md).

## The app

The game installs to a home screen ("Add to Home Screen" on iOS, "Install app"
in Chrome) with its own icon, and the installed app plays without a network.
Only the installed app keeps an offline copy of the game's files; in a browser
tab the game writes nothing to the device. The icons are drawn from the game's
paper bin:

```bash
node tools/icons.mjs    # writes game/icons/
```

## Drawing by hand

Every picture is a PNG in `game/art/<kind>/` — the only source the game reads.
Open one in Pixelorama, draw, save it in place (at 100 %), rebuild:

```bash
python3 tools/build_data.py --fixtures
```

Keep the size: objects 32×32, containers and routes 48×48; decorations, the
tree (64×88) and the skyline (320×96) as they are. A part is named with a double
dash, `pizzakarton--reste.png`, a variant with a dot, `glasflasche.gruen.png`;
a variant or a part without its own file shows the object's picture.

A new object gets a first draft painted in code:

```bash
node tools/sketch_art.mjs    # a PNG for anything with a sketch and no file; rebuilds art/palette.gpl
```

It never overwrites a file, and names every object in data that has neither a
file nor a sketch in `tools/sketches.mjs`. `node game/test/run.mjs` refuses a
release where something in data has no picture, a file whose name matches
nothing in data, and a file of the wrong size. `game/test/sprites.html` shows
every picture on one sheet. Import `art/palette.gpl` into Pixelorama to draw with
the colours already in use.

Further handles: `?finale=1` goes straight to the tree, `?lang=en` picks a
language, `?slow=4` stretches every fall.

Data and tool tests:

```bash
python3 tools/test_build_data.py
```

## Contributing

The most valuable contribution here is not code. It is a verified item: a waste item that newcomers get wrong, with a link to its AWM entry and the date you read it. Corrections to existing items are just as welcome, especially with a source link.

If you have lived in Munich and remember what confused you in your first month, that memory is the raw material this game is made of.

## Licence

MIT. See [LICENSE](LICENSE).
