import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
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
});
