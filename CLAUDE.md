# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tally — browser-only Scrabble score tracker (2–4 players, full 15×15 board). No backend; one game is saved in localStorage (`tally:game`). `src/routes/+page.ts` sets `ssr = false` for this reason, plus `prerender = true` so `/` is an HTML shell the service worker can cache.

## Architecture

- `src/lib/scrabble/rules.ts` — pure rules: `validatePlacement`, `scoreMove` (main + cross words, premiums only on new tiles, blanks = 0, +50 bingo), `endGameAdjust`. Premium map and tile values are in `constants.ts`.
- `src/lib/scrabble/game.svelte.ts` — `Game` class with runes. The saved state is only `players`, `moves`, `end`; board, history and scores are `$derived` by replaying `moves`. Undo = drop last move. The in-progress word (`draft`, `cursor`, `direction`) is not saved. `new Game(false)` skips localStorage (use in tests).
- `src/lib/scrabble/words.ts` — loads `static/words/enable.txt` (ENABLE list, public domain, from github.com/dolph/dictionary) once and checks words. Unknown words only show a warning; they never block a move. ENABLE is older, so newer words like QI and ZA are missing.
- PWA: `static/manifest.webmanifest` + `static/icons/` (PNGs made from `icon.svg`), head tags in `src/app.html`, service worker in `src/service-worker/index.ts` (SvelteKit 3: `$app/manifest` + `version` from `$app/env`; `$service-worker` is removed). It caches build files, static files (incl. the word list) and the prerendered `/` shell for offline use. The service worker has its own `tsconfig.json` (WebWorker types) and is excluded from the root one; `bun run check` type-checks both. It only runs in a build (`bun run build && bun run preview`), not in `dev`.
- `src/lib/components/` — UI pieces that all take the `game` object as a prop. Desktop keys are handled in `src/routes/+page.svelte`.

## Stack

- SvelteKit 3 + Svelte 5 (runes mode forced for all project files in `vite.config.ts`), TypeScript (strict)
- Tailwind CSS 4 via `@tailwindcss/vite`, with the typography plugin. No `tailwind.config` file — config lives in `src/routes/layout.css`
- Deployed on Vercel with `@sveltejs/adapter-vercel` (build output in `.vercel/output`). Keep it as a real devDependency: with `adapter-auto`, Vercel installs it during the build and `@vercel/nft` picks up the wrong `estree-walker` (v3), which breaks the build.
- Package manager: **bun** (`bun.lock`). `.npmrc` has `engine-strict=true`

## Commands

```sh
bun install
bun run dev            # dev server
bun run build          # production build
bun run preview        # preview build
bun run check          # svelte-kit sync + svelte-check (type check)
bun run lint           # prettier --check + eslint
bun run format         # prettier --write
bun run test           # all vitest tests, single run
bun run test:unit      # vitest in watch mode
```

Single test file / test name:

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
