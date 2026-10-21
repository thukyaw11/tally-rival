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
		await expect.element(page.getByText("Time's up, Ann!")).not.toBeVisible();
		await vi.advanceTimersByTimeAsync(1_000);
		await expect.element(page.getByText("Time's up, Ann!")).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Pass turn' })).toHaveFocus();

		await page.getByRole('button', { name: 'Swap tiles' }).click();
		expect(game.moves.at(-1)).toMatchObject({ player: 0, kind: 'swap' });
		await expect.element(page.getByText("Time's up, Bo!")).not.toBeVisible();
	});
});
