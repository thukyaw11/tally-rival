import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import History from './History.svelte';
import { Game } from '#lib/scrabble/game.svelte.ts';

describe('History.svelte', () => {
	it('folds and unfolds the move list', async () => {
		const game = new Game(false);
		game.start(['Ann', 'Bo']);
		game.pass();
		render(History, { game });

		const header = page.getByRole('button', { name: 'Moves (1)' });
		await expect.element(header).toHaveAttribute('aria-expanded', 'true');
		await expect.element(page.getByText('passed')).toBeInTheDocument();
		await header.click();
		await expect.element(header).toHaveAttribute('aria-expanded', 'false');
		await expect.element(page.getByText('passed')).not.toBeInTheDocument();
	});
});
