import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TurnTimer from './TurnTimer.svelte';
import { Game } from '#lib/scrabble/game.svelte.ts';

describe('TurnTimer.svelte', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('asks to pass or swap when time runs out', async () => {
		vi.useFakeTimers();
		const game = new Game(false);
		game.start(['Ann', 'Bo'], undefined, 1);
		render(TurnTimer, { game });

		await vi.advanceTimersByTimeAsync(59_000);
		// Not open yet (the name is only filled in when it opens).
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		await vi.advanceTimersByTimeAsync(1_000);
		await expect.element(page.getByText("Time's up, Ann!")).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Pass turn' })).toHaveFocus();

		await page.getByRole('button', { name: 'Swap tiles' }).click();
		expect(game.moves.at(-1)).toMatchObject({ player: 0, kind: 'swap' });
		// Closed, and it never shows the next player's name.
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		expect(document.body.textContent).not.toContain("Time's up, Bo");
	});

	// Online the clock comes from the server, so after Pass it stays at 0 until the reply arrives.
	function onlineGame() {
		const game = new Game(false);
		game.start(['Ann', 'Bo'], undefined, 1.5);
		const sent: string[] = [];
		game.remote = { play: () => {}, pass: (kind) => sent.push(kind) };
		return { game, sent };
	}

	it('does not reopen while the pass is on its way, or show the next name', async () => {
		vi.useFakeTimers();
		const { game, sent } = onlineGame();
		const start = Date.now();
		const { rerender } = render(TurnTimer, { game, startedAt: start, canAct: true });

		await vi.advanceTimersByTimeAsync(91_000);
		await expect.element(page.getByText("Time's up, Ann!")).toBeVisible();
		await page.getByRole('button', { name: 'Pass turn' }).click();
		expect(sent).toEqual(['pass']);
		// Still Ann's turn and still 0:00 locally: the dialog must stay closed.
		await vi.advanceTimersByTimeAsync(2_000);
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();

		// The server's reply: Bo's turn with a fresh clock.
		game.moves = [{ player: 0, kind: 'pass', tiles: [] }];
		await rerender({ game, startedAt: Date.now(), canAct: false });
		await vi.advanceTimersByTimeAsync(1_000);
		await expect.element(page.getByText("Time's up, Bo!")).not.toBeInTheDocument();
		expect(sent).toEqual(['pass']);
	});

	it('closes by itself when the turn moves on without an answer', async () => {
		vi.useFakeTimers();
		const { game, sent } = onlineGame();
		const { rerender } = render(TurnTimer, { game, startedAt: Date.now(), canAct: true });
		await vi.advanceTimersByTimeAsync(91_000);
		await expect.element(page.getByText("Time's up, Ann!")).toBeVisible();

		// The server passed for Ann after the grace time.
		game.moves = [{ player: 0, kind: 'pass', tiles: [] }];
		await rerender({ game, startedAt: Date.now(), canAct: false });
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		expect(sent).toEqual([]);
	});
});
