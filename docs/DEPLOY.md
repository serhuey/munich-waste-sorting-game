# Deployment

The game is published at `muell.sergei-grieg.de`. This repository is the source; the
files that get served live in the separate `portfolio-site` repository, which netcup
deploys by pulling `main`.

## The shape of it

```text
AWM (this repo)              portfolio-site repo            netcup
data/ + game/  --build-->  dist/  --publish.py-->  muell/  --git pull-->  muell.sergei-grieg.de
```

Two properties of the target decide everything else:

- **There is no build step on the server.** A webhook runs a bare `git pull`. Whatever
  is committed is what is served, so the built copy is committed — in the *site*
  repository, which is private. `dist/` is git-ignored here, because it holds the legal
  pages with the operator's address substituted in and this repository is public.
- **A push to `main` publishes to the live domain.** There is no staging, no CI, no
  review. `tools/publish.py` deliberately stops before committing.

## Routine release

```bash
python3 tools/build_data.py          # validate the authored layer, write dist/
python3 tools/publish.py --dry-run   # see what would change in the site repo
python3 tools/publish.py             # copy dist/ into portfolio-site/muell/
```

Then, in `portfolio-site`, by hand:

```bash
git add muell/ && git commit -m "muell: <what changed>"
git push origin main
```

Propagation takes 30–120 seconds. The site repository's pre-commit hook checks that
Eleventy output is current; it does not know about `muell/`, which is not an Eleventy
page — that is intentional, the game is a static folder beside the generated site.

If `PORTFOLIO_SITE` is not `~/portfolio-site`, pass `--site` or set the variable.

## One-time setup (author's actions, not scriptable)

1. **Subdomain.** In the netcup panel, point `muell.sergei-grieg.de` at the `muell/`
   folder of the deploy directory — the same arrangement `cinema.sergei-grieg.de`
   already uses for `ci_nema/`.
2. **Certificate.** Issue a Let's Encrypt certificate for the new subdomain in the
   panel. The game is served over HTTPS only.
3. **`muell.s-grieg.eu` needs nothing.** The site's `.htaccess` already redirects every
   `*.s-grieg.eu` host to the matching `*.sergei-grieg.de` one.
4. **`server/count.php`.** Copy it into `muell/` with the rest of `dist/`; it runs under
   the same PHP as the other apps on the host. It writes aggregate counters only — no
   IP, no cookie, no identifier — so it needs no configuration file and no secret.

## The case page

The portfolio case for this project is written at launch, not before: prose in
`src/projects/muell.njk`, metadata in `src/_data/projects.json`, and `npm run build`
before committing, because the server has no build step and the site repository
requires the built HTML to be committed alongside its source.

## Rollback

The previous state is the previous commit in `portfolio-site`. Reverting that commit
and pushing restores the site within the same 30–120 seconds. Nothing in the game
stores state on the player's device, so there is no migration to undo.
