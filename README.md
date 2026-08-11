# hollywoodplex

a 3d video rental store for your plex library. walk the aisles of a
90s-style video shop rendered in three.js, browse your own films and
shows as cases on the shelves, and play them without leaving the store.

the backend is a small express server that proxies all plex api calls,
so your plex token never reaches the browser. the frontend is plain
html, css and javascript es modules with no build step.

## features

the store lays out your full library as wall shelving and sloped aisle
gondolas, with genre sections sized to your collection, featured racks
(new releases, just in, top rated, staff picks, continue watching),
themed sections such as classics and westerns, search that teleports
you to a title's shelf spot, in-store playback with resume and watch
state synced back to plex, tv season and episode browsing, trailers,
a poster picker and a fix-match tool for files plex never identified.

with an anthropic api key configured it also stocks llm-curated
shelves (recommendations, a seasonal shelf, date night picks and a
cult classics aisle), refreshed every few days and cached on disk.

## requirements

1. node.js 20 or newer
2. a reachable plex media server and its token
3. a browser with webgl (a 2d grid fallback exists without it)

## install

```bash
git clone <this repo>
cd hollywodplex
npm install
cp .env.example .env
```

then edit `.env`:

```
PLEX_SERVER_URL=http://YOUR_PLEX_SERVER_IP:32400
PLEX_TOKEN=your-plex-token-here
PORT=3478

# optional: enables the llm-curated shelves and match judging
ANTHROPIC_API_KEY=your-anthropic-api-key
```

`.env` is gitignored — keep your token and keys there and nowhere else.

## getting your plex token

1. sign in to plex web (app.plex.tv or your server's local web ui)
2. open any film or episode in your library
3. click the three-dot menu and choose "get info", then "view xml"
4. a new tab opens; look at its url — the value after `X-Plex-Token=`
   is your token

plex documents this at
https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/

treat the token like a password: it grants full access to your plex
server. it lives only in `.env` and is stripped from anything this app
sends to the browser.

## run

```bash
npm test-plex   # optional: verify the server and token work
npm start
```

open http://localhost:3478 and click to enter the store.

## controls

walk with wasd (shift to walk slowly, space to run), look with the
mouse, click a case to open its details, press e for the search
terminal, m to mute the ambience, and escape to release the mouse.

## fixing unmatched files

files plex's agent could not identify show their filename as the
title with no artwork. open such a film in the store and use the
"fix match" button to search the agent and apply the right match.

for bulk cleanup there is a three-stage pipeline (requires the
anthropic key, since a model judges each candidate list):

```bash
node tools/fix-unmatched/scan.js    # gather match candidates
node tools/fix-unmatched/judge.js   # pick or abstain per file
node tools/fix-unmatched/apply.js   # apply and write a report
```

each stage checkpoints to `data/fix-unmatched.json` and is safe to
re-run; matches can be reversed from plex with "unmatch".

## security notes

this app is designed for your local network only, and even there it
is deliberately open: there is no authentication, so anyone on your
lan can open the store, browse your whole library and stream your
media. the config endpoint also reveals your plex server's lan
address and machine identifier to any client, because the "open in
plex" deep links need them. if your lan has untrusted devices or
guests, keep that in mind before running it.

do not expose the app to the internet — port forwarding or a public
reverse proxy would hand your entire library to anyone who finds it.
if you want remote access, put it behind a vpn (wireguard, tailscale)
instead. the image and stream proxies only accept plex-relative
paths, so the plex token itself cannot be redirected to other hosts
and never reaches the browser.
