# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tally — Scrabble for 2–4 players (full 15×15 board). Today it is a browser-only score tracker: no backend, one game saved in localStorage (`tally:game`). It also has a full online mode (Go server on Railway + Postgres, Pusher for realtime). The home screen `/` lets players pick **Score tracker** (`/tracker`) or **Play online** (`/online`).

## Repo layout

Bun workspaces monorepo (root `package.json` → `apps/*`, `packages/*`; one `bun.lock` at the root):

- `apps/web` (`@tally/web`) — the SvelteKit app. All paths below are relative to it unless they start with the repo root. On Vercel, the project's Root Directory must be `apps/web`.
- `packages/game` (`@tally/game`) — shared pure TS logic, imported as `@tally/game` (raw TS, no build step): `rules.ts`, `constants.ts`, `bag.ts` (100-tile bag, `drawTiles`, `takeFromRack`, `swapTiles`; racks use `?` for a blank) and `online.ts` (JSON shapes of the online API: `RoomState`, `PlayerView`, `MoveRequest`). Tests use `bun test` (`bun:test`), type check is `tsc --noEmit`.
- `apps/server` (Go module `github.com/thukyaw11/tally/apps/server`, Go 1.24) — online API. Its `package.json` only maps the root bun scripts to `go vet` / `gofmt` / `go test` / `go run`. Keep dependencies on versions that build with Go 1.24 (`GOTOOLCHAIN=local`).
  - `internal/game` is a Go copy of the TS rules and bag. Both are tested against `packages/game/fixtures/rules.json` and `constants.json`: after changing a rule in TS, run `bun run fixtures` in `packages/game`, then port the change to Go until `go test ./internal/game` passes.
  - `internal/rooms` holds the game logic. Postgres tables `rooms`, `players`, `moves` (`internal/db/schema.sql`, applied at startup). Players are anonymous: create/join returns `{code, playerId, token}`; the token is sent as `Authorization: Bearer` and stored hashed. The server deals and validates every move (turn, rack, `ValidatePlacement`), refills racks, and ends the game when someone goes out with an empty bag or after 6 scoreless turns. Turn timer: a server-side `time.AfterFunc` passes for the player after the limit + 15 s grace; timers are restored on startup.
  - `internal/httpapi` routes: `POST /rooms`, `POST /rooms/{code}/join`, `GET /rooms/{code}`, `POST /rooms/{code}/start`, `POST /rooms/{code}/move`, `POST /pusher/auth`, `GET /health`. Every authed route replies with the caller's view (public state + own rack).
  - Realtime: after each change the server triggers a small `updated` event on `presence-room-{CODE}`; clients then re-fetch `GET /rooms/{code}`. Racks never go through Pusher (and Pusher's 10 KB limit doesn't matter). Without Pusher env vars realtime is off.
  - Tests in `internal/httpapi` need Postgres: `docker compose up -d` at the repo root (Postgres 17 with `tally` and `tally_test` databases, user/password `tally`). They skip if it isn't running. Env vars: see `apps/server/.env.example`.
- Prettier base config is the root `prettier.config.js`; `apps/web/prettier.config.js` adds the Svelte and Tailwind plugins.

## Architecture (apps/web)

Routes: `/` (mode choice), `/tracker` (the score tracker), `/online` (create / join a room), `/online/[code]` (join form for shared links, lobby, then the game). All set `ssr = false`; all but `/online/[code]` are prerendered so the service worker can cache them.

Online (`src/lib/online/`): `api.ts` calls the Go server; `session.ts` keeps `{code, playerId, token}` in localStorage (`tally:online`) to rejoin; `room.svelte.ts` (`OnlineRoom`) keeps a `Game` (`new Game(false, true)`) in sync with the server's `PlayerView`, so `Board`, `Scoreboard`, `History`, `TurnTimer` and `ActionBar` are reused. It sets `game.remote` (submit/pass go to the server), `game.rack` (placing is limited to rack letters, a missing letter falls back to a blank) and `game.canPlay` (only on your turn). It listens on Pusher, or polls every 3 s when `PUSHER_KEY` is empty. `Rack.svelte` shows the tiles (also the swap picker) and `Lobby.svelte` the waiting room. Public env vars `API_URL`, `PUSHER_KEY`, `PUSHER_CLUSTER` are defined in `src/env.ts` (SvelteKit 3 `defineEnvVars`, static, read from `$app/env/public`); they are built into the bundle, so set them in Vercel before building.

- `packages/game/src/rules.ts` (repo root) — pure rules: `validatePlacement`, `scoreMove` (main + cross words, premiums only on new tiles, blanks = 0, +50 bingo), `endGameAdjust`. Premium map and tile values are in `constants.ts`.
- `src/lib/scrabble/game.svelte.ts` — `Game` class with runes. The saved state is only `players`, `moves`, `end`; board, history and scores are `$derived` by replaying `moves`. Undo = drop last move. The in-progress word (`draft`, `cursor`, `direction`) is not saved. `new Game(false)` skips localStorage (use in tests).
- `src/lib/scrabble/words.ts` — loads `static/words/enable.txt` (ENABLE list, public domain, from github.com/dolph/dictionary) once and checks words. Unknown words only show a warning; they never block a move. ENABLE is older, so newer words like QI and ZA are missing.
- PWA: `static/manifest.webmanifest` + `static/icons/` (PNGs made from `icon.svg`), head tags in `src/app.html`, service worker in `src/service-worker/index.ts` (SvelteKit 3: `$app/manifest` + `version` from `$app/env`; `$service-worker` is removed). It caches build files, static files (incl. the word list) and the prerendered `/` shell for offline use. The service worker has its own `tsconfig.json` (WebWorker types) and is excluded from the root one; `bun run check` type-checks both. It only runs in a build (`bun run build && bun run preview`), not in `dev`.
- `src/lib/components/` — UI pieces that all take the `game` object as a prop. No on-screen keyboard: `Board.svelte` focuses a hidden input on square tap to open the device keyboard (it always holds one filler char, so shorter = backspace). Buttons that must keep the keyboard open use `onmousedown` preventDefault. The pages also handle physical keys via `game.handleKey` when that input isn't focused.
- Start flow: `Setup` → `TurnOrder` (random order via `shuffle`, shown after a 3 s shuffle animation that starts from setup order and is skipped for reduced motion; "Shuffle again" uses `reshuffle` so it always changes) → `game.start(names, colors)`.
- Turn timer: optional, set with `TimerOption.svelte` (in `Setup` and the online create form) and saved as `Game.turnMinutes` (null = off). `TurnTimer.svelte` runs the clock (restarts on each new turn; not saved, so a reload restarts it) and sends the time left to `Scoreboard` via `ontick`, which shows it in the active card's badge and as a ring around its avatar. When time runs out, a `<dialog>` makes the player pick Pass (default, also on Escape) or Swap.
- Sounds: `src/lib/sound.svelte.ts` makes every sound with the Web Audio API (no files). `sound.play(name)` is silent until the first tap/key (browser rule) and while muted; mute is saved in localStorage `tally:muted` and toggled by `SoundToggle.svelte`. `GameSounds.svelte` (renders nothing) picks sounds from game changes via the pure `soundForChange(prev, next)`, plus the your-turn ping and refused moves (`Game.rejects`, online server errors). `TurnTimer` plays the last-10-s ticks and buzzer; `Lobby` plays a pop when someone joins.
- `Menu.svelte` holds Pass / Swap / End game / New game. `EndGame.svelte` is a `<dialog>` with the leftover-tile form and tie option (`EndState.breakTie`: equal final scores are decided by score before leftovers; see `Game.winners`), and fires `canvas-confetti` on finish.

## Stack

- SvelteKit 3 + Svelte 5 (runes mode forced for all project files in `vite.config.ts`), TypeScript (strict)
- Tailwind CSS 4 via `@tailwindcss/vite`, with the typography plugin. No `tailwind.config` file — config lives in `src/routes/layout.css`
- Deployed on Vercel with `@sveltejs/adapter-vercel` (build output in `.vercel/output`). Keep it as a real devDependency: with `adapter-auto`, Vercel installs it during the build and `@vercel/nft` picks up the wrong `estree-walker` (v3), which breaks the build.
- Package manager: **bun** (`bun.lock` at the root). `.npmrc` has `engine-strict=true`. The `.gitignore` lives at the root (`apps/web/eslint.config.js` points to it); Prettier only reads `apps/web/.prettierignore`, so generated folders are listed there too.

## Commands

From the repo root (`check`, `lint`, `format`, `test` run in every workspace; `dev`, `build` run the web app):

```sh
bun install
bun run dev            # web dev server
bun run build          # web production build
bun run check          # type check
bun run lint           # prettier --check + eslint
bun run format         # prettier --write
bun run test           # all tests, single run
```

Inside `apps/web` (or `bun run --filter @tally/web <script>` from the root):

```sh
bun run preview        # preview build
bun run test:unit      # vitest in watch mode
```

Single test file / test name (inside `apps/web`):

```sh
bun run test:unit -- --run src/lib/foo.spec.ts
bun run test:unit -- --run -t "test name"
bun run test:unit -- --run --project server   # or --project client
```

## Testing setup

Vitest has two projects (see `vite.config.ts`):

- **client** — `src/**/*.svelte.{test,spec}.{js,ts}`, runs in real Chromium via Playwright (`vitest-browser-svelte`). Use for component tests.
- **server** — all other `src/**/*.{test,spec}.{js,ts}`, runs in Node.

`expect.requireAssertions` is on, so every test must make at least one assertion. Client tests need Playwright browsers installed (`bunx playwright install chromium`).

## Conventions

- Import from `src/lib` with the `#lib` / `#lib/*` alias (Node subpath imports in `package.json`). Include the file extension: `#lib/scrabble/rules.ts`, `#lib/components/Board.svelte`.
- Prettier: tabs, single quotes, no trailing commas, width 100; Tailwind classes are auto-sorted.
- Game-style theme: tokens and shared styles live in `src/routes/layout.css` — use the `panel` (cream card), `btn-3d` (+ `btn-green` / `btn-amber` / `btn-red`, and `btn-white` on top of a panel) and `tile` (wooden letter) utilities instead of one-off styles. Font is Fredoka (`@fontsource-variable/fredoka`, bundled so it works offline). Player colors come from `src/lib/players.ts`; use `game.color(i)`, not `PLAYER_COLORS[i]` — players are stored in shuffled turn order and keep their setup color via `Game.colors`. Icons: `@lucide/svelte`, imported one per file (`@lucide/svelte/icons/<name>`).
