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
  - `internal/rooms` holds the game logic. Postgres tables `rooms` (incl. `turn_minutes`, `word_list`), `players`, `moves` (`internal/db/schema.sql`, applied at startup). Players are anonymous: create/join returns `{code, playerId, token}`; the token is sent as `Authorization: Bearer` and stored hashed. The server deals and validates every move (turn, rack, `ValidatePlacement`), refills racks, and ends the game when someone goes out with an empty bag or after 6 scoreless turns. Turn timer: a server-side `time.AfterFunc` passes for the player after the limit + 15 s grace; timers are restored on startup.
  - `internal/httpapi` routes: `POST /rooms`, `POST /rooms/{code}/join`, `GET /rooms/{code}`, `POST /rooms/{code}/start`, `POST /rooms/{code}/move`, `GET|POST /rooms/{code}/chat`, `POST /rooms/{code}/end` (host only: ends a running game with `wentOut: null`, everyone's rack as leftovers and `end.endedBy`; shown to the host as "End game for everyone" in the menu, and `FinalResults` notes who ended it), `POST /pusher/auth`, `GET /health`. The game routes reply with the caller's view (public state + own rack); chat routes reply with messages.
  - Chat (`internal/rooms/chat.go`): `messages` table, works in any room status, 1–200 characters, at most 5 messages per player per 5 s (in memory, 429). `GET ?after=ID` returns newer messages (default: the last 100). Each new message is also sent as a Pusher `chat` event with the message itself.
  - Realtime: after each change the server triggers a small `updated` event on `presence-room-{CODE}`; clients then re-fetch `GET /rooms/{code}`. Racks never go through Pusher (and Pusher's 10 KB limit doesn't matter). Without Pusher env vars realtime is off.
  - Tests in `internal/httpapi` need Postgres: `docker compose up -d` at the repo root (Postgres 17 with `tally` and `tally_test` databases, user/password `tally`). They skip if it isn't running. Env vars: see `apps/server/.env.example`.
- Prettier base config is the root `prettier.config.js`; `apps/web/prettier.config.js` adds the Svelte and Tailwind plugins.

## Architecture (apps/web)

Routes: `/` (mode choice), `/tracker` (the score tracker), `/online` (create / join a room), `/online/[code]` (join form for shared links, lobby, then the game). All set `ssr = false`; all but `/online/[code]` are prerendered so the service worker can cache them.

Online (`src/lib/online/`): `api.ts` calls the Go server; `session.ts` keeps `{code, playerId, token, ended?}` in localStorage (`tally:online`) to rejoin; `OnlineRoom` marks it `ended` when the game is over, and the home page only shows "Back to room" for a room that isn't ended (it also checks the room in the background and hides the button if it ended or is gone); `room.svelte.ts` (`OnlineRoom`) keeps a `Game` (`new Game(false, true)`) in sync with the server's `PlayerView`, so `Board`, `Scoreboard`, `History`, `TurnTimer` and `ActionBar` are reused. It sets `game.remote` (submit/pass go to the server), `game.rack` (placing is limited to rack letters, a missing letter falls back to a blank) and `game.canPlay` (only on your turn). It listens on Pusher, or polls every 3 s when `PUSHER_KEY` is empty. `room.chat` (`RoomChat` in `chat.svelte.ts`) holds the chat: loaded on connect/poll/reconnect, Pusher `chat` events merged in by id, unread = messages from others since chat was last on screen (first-load history counts as read). UI: `Chat.svelte` (list, quick reactions, input), `ChatButton` + `ChatSheet` (phone slide-up panel), speech bubbles in `Scoreboard` (every new message after the first load, your own too, sits under the sender's card for 3 s; `room.chat.bubbles` keeps the newest per player, a newer one replaces it); on wide screens (`chat.wide`, 1024px+) `Chat` sits in the side column instead.
Local testing: the Pusher keys are production keys, so run local servers with them blanked (`PUSHER_APP_ID= PUSHER_KEY= PUSHER_SECRET= PUSHER_CLUSTER= go run ./cmd/server`, `PUSHER_KEY= PUSHER_CLUSTER= vite dev`); blank env vars win over `.env`, and both apps then fall back to polling. `Rack.svelte` shows the tiles (also the swap picker) and `Lobby.svelte` the waiting room. Public env vars `API_URL`, `PUSHER_KEY`, `PUSHER_CLUSTER` are defined in `src/env.ts` (SvelteKit 3 `defineEnvVars`, static, read from `$app/env/public`); they are built into the bundle, so set them in Vercel before building.

- `packages/game/src/rules.ts` (repo root) — pure rules: `validatePlacement`, `scoreMove` (main + cross words, premiums only on new tiles, blanks = 0, +50 bingo), `endGameAdjust`. Premium map and tile values are in `constants.ts`.
- `src/lib/scrabble/game.svelte.ts` — `Game` class with runes. The saved state is only `players`, `moves`, `end`; board, history and scores are `$derived` by replaying `moves`. Undo = drop last move. The in-progress word (`draft`, `cursor`, `direction`) is not saved. `new Game(false)` skips localStorage (use in tests).
- `src/lib/scrabble/words.ts` — loads a word list once per list and checks words. Two lists (`WordList` in `packages/game/src/online.ts`), picked with `WordListOption.svelte` in `Setup` and the online create form: **tournament** = `static/words/words.txt` (SOWPODS, 267,751 words, from github.com/yusuf-musleh/scrabble-wordscore-api `acceptable_words.txt`, CRLF stripped; includes QI, ZA) and **common** ("Everyday", the default for new games) = `static/words/common.txt` (SCOWL 2020.12.07 `english/american/british-words` up to size 50, lowercase a–z only, kept only if in `words.txt`, minus the abbreviations AD, ADS, ID, IDS; credit in `LICENSE-SCOWL.txt`). Saved as `Game.wordList` (old saves without it = tournament); `game.useWordList(list)` switches and loads. **Tracker:** unknown words only warn (amber). **Online:** the room's list is `rooms.word_list` (old rooms = tournament, a create without it = common), sent as `RoomState.wordList` and shown in the lobby; `game.strictWords` (set by `OnlineRoom`) makes every word a move forms (main + cross words) required: Submit is disabled (`game.canSubmit`) and the draft panel shows "Not in the word list". The Go server embeds the same files (`internal/game/words.txt` and `common.txt`, `go:embed`) and refuses such moves with 400; `TestWordListMatchesWeb` fails if a copy differs, so update both together.
- PWA: `static/manifest.webmanifest` + `static/icons/` (PNGs made from `icon.svg`), head tags in `src/app.html`, service worker in `src/service-worker/index.ts` (SvelteKit 3: `$app/manifest` + `version` from `$app/env`; `$service-worker` is removed). It caches build files, static files (incl. the word list) and the prerendered `/` shell for offline use. The service worker has its own `tsconfig.json` (WebWorker types) and is excluded from the root one; `bun run check` type-checks both. It only runs in a build (`bun run build && bun run preview`), not in `dev`.
- `src/lib/components/` — UI pieces that all take the `game` object as a prop. No on-screen keyboard: `Board.svelte` focuses a hidden input on square tap to open the device keyboard (it always holds one filler char, so shorter = backspace). Buttons that must keep the keyboard open use `onmousedown` preventDefault. The pages also handle physical keys via `game.handleKey` when that input isn't focused.
- Start flow: `Setup` → `TurnOrder` (random order via `shuffle`, shown after a 3 s shuffle animation that starts from setup order and is skipped for reduced motion; "Shuffle again" uses `reshuffle` so it always changes) → `game.start(names, colors)`.
- Turn timer: optional, set with `TimerOption.svelte` (in `Setup` and the online create form) and saved as `Game.turnMinutes` (null = off). It ranges from 1:30 to 10:00 in half-minute steps, so `turnMinutes` can be fractional (1.5, 2.5); `formatMinutes` shows it as m:ss. The server checks the same range, and `rooms.turn_minutes` is `real` (`schema.sql` converts old `int` columns on startup). `TurnTimer.svelte` runs the clock (restarts on each new turn; not saved, so a reload restarts it) and sends the time left to `Scoreboard` via `ontick`, which shows it in the active card's badge and as a ring around its avatar. When time runs out, a `<dialog>` makes the player pick Pass (default, also on Escape) or Swap. It opens once per turn (keyed by the turn's `startedAt`, which online only changes when the server replies, so it can't reopen during the round trip), freezes the player's name when it opens, ignores a second answer, and closes by itself when the turn moves on without an answer (e.g. the server's auto-pass).
- Drag and drop (online only): `src/lib/online/drag.svelte.ts` (`TileDrag`) uses pointer events, so mouse and touch share one path (draggables have `touch-none`). A press becomes a drag after 6 px, so taps still work, and the click after a drag is swallowed (`consumeClick` as `onclickcapture`). Drop targets are found with `elementFromPoint` via `data-cell` (+`data-row`/`data-col`) squares, `data-rack-slot` tiles and the `data-rack` panel. Rack → square calls `game.placeAt` (a blank asks for its letter via `BlankPicker`), square → square calls `moveDraft` (swaps with another draft tile), square → rack/off-board calls `removeDraftAt`, slot → slot calls `moveRackTile`. `DragGhost` follows the pointer. The rack's display order is `game.arrangedRack` = `arrangeRack(rackOrder, rack)`: the player's own order (`rackOrder`, local only, also set by `shuffleRack`) applied to the real rack, so it survives refills. Swap selections are slots in `arrangedRack`. `Board`/`Rack` only enable drag when given a `drag` prop, so the tracker is unaffected.
- Desktop layout (`lg:`, both game pages): a running game is exactly one screen tall (`lg:h-dvh` on `<main>`), the board is capped by the window height, and the side column fills the rest. `History` (a toggleable panel with a `class` prop, not `<details>`, so it can flex) and online `Chat` share the leftover height and scroll inside; the side column has a little padding so the turn badge isn't clipped by its scroll box. Phones keep the normal scrolling page.
- Online end of game: `FinalResults.svelte` (used instead of `EndGame` on `/online/[code]`) ranks players by final score and shows each one's leftover tiles (from `game.end.leftovers`, `?` = blank) as mini tiles with the count and penalty, or "Went out" with the bonus. Once the bag is empty, `Scoreboard`'s `tilesLeft` prop (fed `view.rackCounts`) shows how many tiles each player still holds. The tracker keeps `EndGame`'s simple list.
- Avatars: emoji in `AVATARS` (`packages/game/src/avatars.ts`); a player stores an **index** into it (only append to the list; its length is checked against Go `game.AvatarCount` via `fixtures/constants.json`). `Avatar.svelte` draws the player-colour circle with the emoji (initial letter when null), `AvatarPicker.svelte` is the grid + Random. Tracker: picked per player in `Setup` (dialog), carried in `Seat.avatar`, saved as `Game.avatars` / `game.avatar(i)`. Online: `YouCard.svelte` on the create/join forms, remembered in localStorage `tally:avatar`, sent on create/join, stored in `players.avatar` (nullable int); `OnlineRoom` copies it into `game.avatars`. Fixed once you join (no change endpoint).
- Last word highlight: `Game.lastPlay` (from the `replay` derived) holds the latest play's main-word squares (`mainWordCells` in `packages/game/src/rules.ts`, same direction rule as `scoreMove`), new tiles and score. `Board.svelte` outlines that word in the player's colour with a "+N" badge for 4 s when a new play arrives (not on page load; passes don't cut it short; undo clears it). Styles: `last-word`, `last-word-new`, `last-score` in `layout.css`.
- Sounds: `src/lib/sound.svelte.ts` makes most sounds with the Web Audio API. The time-up buzzer and game-over sound are recorded files, `static/sounds/timeup.mp3` and `complete.mp3` (mono 96 kbps MP3s converted from the original WAVs with `lame`; listed in `FILES`). They are decoded on the first tap; until then, or if loading fails, the generated recipe plays. `sound.stop('buzzer')` cuts the 4 s time-up sound when the turn moves on. `sound.play(name)` is silent until the first tap/key (browser rule) and while muted; mute is saved in localStorage `tally:muted` and toggled by `SoundToggle.svelte`. `GameSounds.svelte` (renders nothing) picks sounds from game changes via the pure `soundForChange(prev, next)`, plus the your-turn ping and refused moves (`Game.rejects`, online server errors). `TurnTimer` plays the last-10-s ticks and buzzer; `Lobby` plays a pop when someone joins.
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
