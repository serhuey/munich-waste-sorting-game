# Releasing

Every build that reaches players carries a release number. It is written in
`VERSION` at the root of the repository, shown on the title screen as `v1.0.0`,
tagged in git as `v1.0.0` and described in [`CHANGELOG.md`](../CHANGELOG.md).
Numbering starts at **1.0.0** — the build of 24 October 2026, the first one on
the internal test at `sergei-grieg.de/muell/`. Nothing before it has a number.

## Two numbers, two jobs

| | Where | Who changes it | What for |
|---|---|---|---|
| Release number, `1.0.0` | `VERSION`, `content.release`, title screen | a person, when releasing | saying which game someone played |
| Build fingerprint, `b638477588` | `content.version`, `?v=` on every address, the offline cache's name | the build, on any changed file | keeping browsers from mixing old and new files |

A player who reports a wrong answer names the release number; the fingerprint
exists for caches and is never shown.

## What moves which part

`MAJOR.MINOR.PATCH`. The highest part that applies is raised, the ones after it
return to zero.

- **MAJOR** — points from the new version cannot be compared with the old
  ones. Scoring, fall timing, round composition, the clear threshold, the order
  of the ladder: anything that would make a shared "1240 points" mean something
  else. A shared card is the game's public face; a major number is the honest
  way to say the scale changed.
- **MINOR** — the game gains something and the points keep their meaning: new
  objects, a new place, a new language, a new finale route, a new feature such
  as the share card or the installable app.
- **PATCH** — nothing is gained, something is set right: an answer re-verified
  after AWM changed it, an explanation reworded, a picture redrawn, a bug fixed,
  a legal page updated.

What is **not** a release: the switch on 1 January 2027. The rules for both sides
of that date are already in the data, and the same build changes its answers
when the day comes. A release is a change in what was built, never in the date
it is played on.

A test build made with `--fixtures` shows `v1.0.0-dev`: it may contain unsigned
drafts, so it must never be mistaken for the release of the same number.

## One number, one build

`tools/publish.py` compares the build in `dist/` with the copy on the site and
refuses:

- a different build under the number already live — raise `VERSION`;
- a number lower than the live one (numbers compare as numbers: `1.10.0` is
  above `1.9.0`).

Publishing the same build again is allowed. The build itself refuses a
`VERSION` that is missing or not of the form `MAJOR.MINOR.PATCH`.

## Steps

```bash
# 1. the number and what changed
echo 1.1.0 > VERSION
#    a section at the top of CHANGELOG.md: ## 1.1.0 — <date>, then what a player notices

# 2. build and test the release
python3 tools/build_data.py
python3 tools/render_legal.py      # Impressum and Datenschutz with the operator's details
node game/test/run.mjs && python3 tools/test_build_data.py

# 3. record it here
git commit -am "release: v1.1.0"
git tag v1.1.0

# 4. publish (DEPLOY.md): copy, then commit and push in the site repository
python3 tools/publish.py

# 5. the public repository and its release page
git push origin main v1.1.0
awk '/^## 1\.1\.0 /{f=1; next} /^## /{f=0} f' CHANGELOG.md > /tmp/notes.md
gh release create v1.1.0 --title "v1.1.0" --notes-file /tmp/notes.md
```

Tag only what was published: a tag says "this is what players had".
