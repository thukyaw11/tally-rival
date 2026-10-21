import { describe, expect, it } from 'vitest';
import { Game } from './game.svelte';
import { isWord } from './words';

describe('isWord', () => {
	it('ignores case, so blanks match too', () => {
		const words = new Set(['CAT']);
		expect(isWord(words, 'CAT')).toBe(true);
		expect(isWord(words, 'cAT')).toBe(true);
		expect(isWord(words, 'CXT')).toBe(false);
	});
});

describe('Game.unknownWords', () => {
	function typeAtCenter(game: Game, letters: string) {
		game.tapCell(7, 6);
		for (const l of letters) game.placeLetter(l);
	}

	it('lists draft words missing from the list', () => {
		const game = new Game(false);
		game.start(['Ann', 'Bo']);
		game.words = new Set(['CAT']);
		typeAtCenter(game, 'CXT');
		expect(game.unknownWords).toEqual(['CXT']);
		game.clearDraft();
		typeAtCenter(game, 'CAT');
		expect(game.unknownWords).toEqual([]);
	});

	it('warns about nothing until the list is loaded', () => {
		const game = new Game(false);
		game.start(['Ann', 'Bo']);
		typeAtCenter(game, 'CXT');
		expect(game.unknownWords).toEqual([]);
	});
});
