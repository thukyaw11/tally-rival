import { page, userEvent } from 'vitest/browser';
import { flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Board from './Board.svelte';
import { Game } from '#lib/scrabble/game.svelte.ts';

describe('Board.svelte', () => {
	it('places typed letters from the tapped square', async () => {
		const game = new Game(false);
		game.start(['Ann', 'Bo']);
		render(Board, { game });

		await page.getByRole('button', { name: 'Row 8 column 7', exact: true }).click();
		game.placeLetter('H');
		game.placeLetter('I');

		await expect
			.element(page.getByRole('button', { name: 'Row 8 column 7 H' }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Row 8 column 8 I' }))
			.toBeInTheDocument();
		expect(game.draftScore?.total).toBe(10);
	});

	it('takes letters from the device keyboard', async () => {
		const game = new Game(false);
		game.start(['Ann', 'Bo']);
		render(Board, { game });

		await page.getByRole('button', { name: 'Row 8 column 7', exact: true }).click();
		await userEvent.keyboard('cxt');
		expect(game.draft.map((t) => t.letter).join('')).toBe('CXT');

		await userEvent.keyboard('{Backspace}a');
		expect(game.draft.map((t) => t.letter).join('')).toBe('CXA');

		await userEvent.keyboard('{Enter}');
		expect(game.moves).toHaveLength(1);
		expect(game.cursor).toBeNull();
	});

	describe('last word highlight', () => {
		afterEach(() => vi.useRealTimers());
		const lit = () => document.querySelectorAll('.last-word, .last-word-new').length;
		function play(game: Game, row: number, col: number, letters: string) {
			game.tapCell(row, col);
			for (const l of letters) game.placeLetter(l);
			game.submit();
			flushSync();
		}

		it('lights up the whole word for 4 s, even if the next player passes', async () => {
			vi.useFakeTimers();
			const game = new Game(false);
			game.start(['Ann', 'Bo']);
			play(game, 7, 6, 'CAT');
			render(Board, { game });
			flushSync();
			// A word already on the board when the page opens isn't highlighted.
			expect(lit()).toBe(0);

			play(game, 7, 9, 'S');
			expect(lit()).toBe(4);
			expect(document.querySelectorAll('.last-word-new')).toHaveLength(1);
			await expect.element(page.getByText('+6')).toBeInTheDocument();

			game.pass();
			flushSync();
			await vi.advanceTimersByTimeAsync(3000);
			expect(lit()).toBe(4);
			await vi.advanceTimersByTimeAsync(1100);
			expect(lit()).toBe(0);
		});

		it('drops the highlight when the word is undone', () => {
			const game = new Game(false);
			game.start(['Ann', 'Bo']);
			render(Board, { game });
			play(game, 7, 6, 'CAT');
			expect(lit()).toBe(3);
			game.undo();
			flushSync();
			expect(lit()).toBe(0);
		});
	});
});
