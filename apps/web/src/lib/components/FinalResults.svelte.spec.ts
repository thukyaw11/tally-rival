import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FinalResults from './FinalResults.svelte';
import Scoreboard from './Scoreboard.svelte';
import { Game } from '#lib/scrabble/game.svelte.ts';

function endedGame() {
	const game = new Game(false);
	game.start(['Ann', 'Bo', 'Cy']);
	game.tapCell(7, 6);
	for (const l of 'CAT') game.placeLetter(l);
	game.submit(); // Ann 10
	game.pass();
	game.pass();
	// Bo went out; Ann holds Q, E and a blank (11), Cy holds A and B (4).
	game.end = { wentOut: 1, leftovers: ['QE?', '', 'AB'], breakTie: false };
	return game;
}

describe('FinalResults.svelte', () => {
	it('lists everyone by final score with their leftover tiles', async () => {
		render(FinalResults, { game: endedGame(), me: 0 });
		const rows = page.getByRole('listitem');

		await expect.element(page.getByText('wins!')).toHaveTextContent('Bo wins!');
		await expect.element(rows.nth(0)).toHaveTextContent(/Bo.*15.*Went out.*\+15/);
		await expect
			.element(rows.nth(1))
			.toHaveTextContent(/Ann\s\(you\).*-1.*3 tiles · −11.*10 before leftovers/);
		await expect.element(rows.nth(2)).toHaveTextContent(/Cy.*-4.*2 tiles · −4/);
		// Q, E and an empty blank tile.
		expect(rows.nth(1).element().querySelectorAll('.tile')).toHaveLength(3);
	});
});

describe('Scoreboard tiles left', () => {
	it("shows each player's tile count only when given", async () => {
		const game = new Game(false);
		game.start(['Ann', 'Bo']);
		const { rerender } = render(Scoreboard, { game, tilesLeft: [3, 1] });
		await expect.element(page.getByLabelText('3 tiles left')).toBeInTheDocument();
		await expect.element(page.getByLabelText('1 tile left')).toBeInTheDocument();
		await rerender({ game, tilesLeft: null });
		await expect.element(page.getByLabelText('3 tiles left')).not.toBeInTheDocument();
	});
});
