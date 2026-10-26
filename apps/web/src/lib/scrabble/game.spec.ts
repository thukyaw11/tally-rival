import { describe, expect, it, vi } from 'vitest';
import { arrangeRack, Game } from './game.svelte';

function play(game: Game, row: number, col: number, letters: string, down = false) {
	game.tapCell(row, col);
	if (down) game.toggleDirection();
	for (const l of letters) game.placeLetter(l);
	return game.submit();
}

describe('Game', () => {
	it('tracks turns and scores', () => {
		const game = new Game(false);
		game.start(['Ann', 'Bo']);
		expect(play(game, 7, 6, 'CAT')).toBe(true);
		expect(game.current).toBe(1);
		// Typing skips the A already on the board.
		expect(play(game, 6, 7, 'OX', true)).toBe(true);
		expect(game.board[8][7]?.letter).toBe('X');
		expect(game.scores).toEqual([10, 10]);
	});

	it('keeps the turn timer setting until a new game', () => {
		const game = new Game(false);
		game.start(['Ann', 'Bo']);
		expect(game.turnMinutes).toBeNull();
		game.start(['Ann', 'Bo'], undefined, 2);
		expect(game.turnMinutes).toBe(2);
		game.newGame();
		expect(game.turnMinutes).toBeNull();
	});

	it('keeps the word list, and old saves use the tournament one', () => {
		const store = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => store.set(k, v),
			removeItem: (k: string) => store.delete(k)
		});
		try {
			const game = new Game(true, false);
			expect(game.wordList).toBe('common');
			game.start(['Ann', 'Bo'], undefined, null, [], 'tournament');
			expect(new Game(true, false).wordList).toBe('tournament');
			game.start(['Ann', 'Bo']);
			expect(new Game(true, false).wordList).toBe('common');
			store.set(
				'tally:game',
				JSON.stringify({ version: 1, players: ['Ann'], moves: [], end: null })
			);
			expect(new Game(true, false).wordList).toBe('tournament');
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('clears the loaded words when the list changes', () => {
		const game = new Game(false);
		game.start(['Ann', 'Bo']);
		game.words = new Set(['CAT']);
		game.useWordList('common');
		expect(game.words).not.toBeNull();
		game.useWordList('tournament');
		expect(game.wordList).toBe('tournament');
		expect(game.words).toBeNull();
	});

	it("keeps each player's avatar", () => {
		const game = new Game(false);
		game.start(['Ann', 'Bo'], [1, 0], null, [5, null]);
		expect(game.avatar(0)).toBe(5);
		expect(game.avatar(1)).toBeNull();
		expect(game.avatar(3)).toBeNull();
		game.newGame();
		expect(game.avatars).toEqual([]);
	});

	it('remembers the last word played', () => {
		const game = new Game(false);
		game.start(['Ann', 'Bo']);
		expect(game.lastPlay).toBeNull();
		play(game, 7, 6, 'CAT');
		play(game, 7, 9, 'S');
		expect(game.lastPlay).toMatchObject({ seq: 1, player: 1, total: 6 });
		expect(game.lastPlay?.cells).toHaveLength(4);
		game.pass();
		expect(game.lastPlay?.seq).toBe(1);
		game.undo();
		game.undo();
		game.undo();
		expect(game.lastPlay).toBeNull();
	});

	it('rejects a bad move and keeps the turn', () => {
		const game = new Game(false);
		game.start(['Ann', 'Bo']);
		expect(play(game, 0, 0, 'CAT')).toBe(false);
		expect(game.draftError).toMatch(/center/);
		expect(game.current).toBe(0);
	});

	it('undoes and edits the last move', () => {
		const game = new Game(false);
		game.start(['Ann', 'Bo', 'Cy']);
		play(game, 7, 6, 'CAT');
		game.pass();
		expect(game.current).toBe(2);
		game.undo();
		expect(game.current).toBe(1);
		game.editLast();
		expect(game.moves).toHaveLength(0);
		expect(game.draft.map((t) => t.letter).join('')).toBe('CAT');
		game.backspace();
		game.placeLetter('R');
		expect(game.submit()).toBe(true);
		expect(game.scores[0]).toBe(10);
		expect(game.board[7][8]?.letter).toBe('R');
	});

	it('uses blanks and applies end-game leftovers', () => {
		const game = new Game(false);
		game.start(['Ann', 'Bo']);
		game.tapCell(7, 6);
		game.toggleBlank();
		for (const l of 'CAT') game.placeLetter(l);
		game.submit();
		expect(game.scores[0]).toBe(4);
		game.finish({ wentOut: 0, leftovers: ['', 'Q'] });
		expect(game.scores).toEqual([14, -10]);
		game.undo();
		expect(game.ended).toBe(false);
	});

	it('records swaps as zero-point turns', () => {
		const game = new Game(false);
		game.start(['Ann', 'Bo']);
		game.pass('swap');
		expect(game.history[0].kind).toBe('swap');
		expect(game.current).toBe(1);
	});

	describe('winners', () => {
		// Ann scores 10 with CAT, Bo scores 10 with OX through the A.
		function tiedGame(end: { leftovers: string[]; breakTie: boolean }) {
			const game = new Game(false);
			game.start(['Ann', 'Bo']);
			play(game, 7, 6, 'CAT');
			play(game, 6, 7, 'OX', true);
			game.finish({ wentOut: null, ...end });
			return game;
		}

		it('keeps a tie when asked', () => {
			expect(tiedGame({ leftovers: ['', ''], breakTie: false }).winners).toEqual([0, 1]);
		});

		it('stays a tie when scores before leftovers are equal too', () => {
			expect(tiedGame({ leftovers: ['', ''], breakTie: true }).winners).toEqual([0, 1]);
		});

		it('breaks a tie by score before leftovers', () => {
			const game = new Game(false);
			game.start(['Ann', 'Bo']);
			play(game, 7, 6, 'CAT'); // Ann 10
			play(game, 6, 7, 'OX', true); // Bo 10
			play(game, 7, 9, 'S'); // Ann 16 (CATS)
			// Ann 16 - 6 (K, A) = 10, Bo 10 - 0 = 10.
			game.finish({ wentOut: null, leftovers: ['KA', ''], breakTie: true });
			expect(game.scores).toEqual([10, 10]);
			expect(game.winners).toEqual([0]);
		});

		it('picks the single top score', () => {
			expect(tiedGame({ leftovers: ['Q', ''], breakTie: false }).winners).toEqual([1]);
		});
	});

	describe('online', () => {
		function online(rack: string[]) {
			const game = new Game(false);
			game.start(['Ann', 'Bo']);
			game.rack = rack;
			const sent: unknown[] = [];
			game.remote = { play: (tiles) => sent.push(tiles), pass: (kind) => sent.push(kind) };
			return { game, sent };
		}

		it('only places letters on the rack, using a blank for missing ones', () => {
			const { game } = online(['C', 'A', '?']);
			game.tapCell(7, 6);
			for (const l of 'CAT') game.placeLetter(l);
			expect(game.draft.map((t) => [t.letter, t.blank])).toEqual([
				['C', false],
				['A', false],
				['T', true]
			]);
			game.placeLetter('S');
			expect(game.draft).toHaveLength(3);
			expect(game.rackLeft).toEqual([]);
		});

		it('sends moves to the server instead of saving them', () => {
			const { game, sent } = online(['H', 'I']);
			game.tapCell(7, 7);
			game.handleKey('h');
			game.handleKey('i');
			expect(game.handleKey('Enter')).toBe(true);
			expect(game.moves).toHaveLength(0);
			expect(sent).toEqual([[expect.objectContaining({ letter: 'H' }), expect.anything()]]);
			game.pass('swap');
			expect(sent.at(-1)).toBe('swap');
			expect(game.handleKey('F1')).toBe(false);
		});

		it('counts refused submits', () => {
			const { game } = online(['C', 'A', 'T']);
			game.tapCell(0, 0);
			for (const l of 'CAT') game.placeLetter(l);
			expect(game.submit()).toBe(false);
			expect(game.rejects).toBe(1);
			game.clearDraft();
			game.tapCell(7, 6);
			for (const l of 'CAT') game.placeLetter(l);
			expect(game.submit()).toBe(true);
			expect(game.rejects).toBe(1);
		});

		it('does nothing when it is not your turn', () => {
			const { game, sent } = online(['H', 'I']);
			game.canPlay = false;
			game.tapCell(7, 7);
			game.placeLetter('H');
			game.pass();
			expect(game.draft).toHaveLength(0);
			expect(sent).toHaveLength(0);
		});
	});

	describe('drag and drop', () => {
		function online(rack: string[]) {
			const game = new Game(false);
			game.start(['Ann', 'Bo']);
			game.rack = rack;
			return game;
		}
		const letters = (game: Game) => game.rackLeft?.map((t) => t.letter).join('');

		it("keeps the player's rack order through refills", () => {
			expect(arrangeRack(['T', 'A', 'C'], ['C', 'A', 'T'])).toEqual(['T', 'A', 'C']);
			expect(arrangeRack(['T', 'A', 'C'], ['A', 'Q', 'C', 'E'])).toEqual(['A', 'C', 'Q', 'E']);
			expect(arrangeRack(['A', 'A'], ['A', 'B', 'A'])).toEqual(['A', 'A', 'B']);
		});

		it('places rack tiles on chosen squares, replacing a draft tile there', () => {
			const game = online(['C', 'A', 'T', '?']);
			expect(game.placeAt(7, 7, 'C')).toBe(true);
			expect(game.placeAt(7, 8, 'A')).toBe(true);
			expect(letters(game)).toBe('T?');
			// Not on the rack: the blank stands in.
			expect(game.placeAt(7, 9, 'S')).toBe(true);
			expect(game.draftAt(7, 9)).toMatchObject({ letter: 'S', blank: true });
			expect(game.placeAt(7, 10, 'Q')).toBe(false);
			// Dropping T on the A sends the A back.
			expect(game.placeAt(7, 8, 'T')).toBe(true);
			expect(letters(game)).toBe('A');
		});

		it('moves, swaps and takes back draft tiles, never onto played squares', () => {
			const game = online(['C', 'A', 'T']);
			game.placeAt(7, 7, 'C');
			game.placeAt(7, 8, 'A');
			expect(game.moveDraft({ row: 7, col: 8 }, { row: 8, col: 7 })).toBe(true);
			expect(game.draftAt(8, 7)?.letter).toBe('A');
			expect(game.moveDraft({ row: 8, col: 7 }, { row: 7, col: 7 })).toBe(true);
			expect([game.draftAt(7, 7)?.letter, game.draftAt(8, 7)?.letter]).toEqual(['A', 'C']);
			game.removeDraftAt(8, 7);
			expect(letters(game)).toBe('CT');

			game.rack = null;
			game.placeAt(7, 6, 'C');
			game.placeAt(7, 8, 'T');
			game.submit();
			game.rack = ['S', 'E'];
			game.placeAt(6, 7, 'S');
			expect(game.moveDraft({ row: 6, col: 7 }, { row: 7, col: 7 })).toBe(false);
			expect(game.placeAt(7, 6, 'E')).toBe(false);
		});

		it('reorders and shuffles the rack without losing tiles', () => {
			const game = online(['C', 'A', 'T', 'S']);
			game.moveRackTile(3, 0);
			expect(game.arrangedRack).toEqual(['S', 'C', 'A', 'T']);
			game.shuffleRack(() => 0);
			expect([...game.arrangedRack].sort()).toEqual(['A', 'C', 'S', 'T']);
			// Placing a tile hides it from the rack but keeps the others' slots.
			game.placeAt(7, 7, 'A');
			expect(game.rackLeft?.map((t) => t.letter).sort()).toEqual(['C', 'S', 'T']);
		});

		it('does nothing when it is not your turn', () => {
			const game = online(['C', 'A']);
			game.placeAt(7, 7, 'C');
			game.canPlay = false;
			expect(game.placeAt(7, 8, 'A')).toBe(false);
			expect(game.moveDraft({ row: 7, col: 7 }, { row: 8, col: 7 })).toBe(false);
			game.removeDraftAt(7, 7);
			expect(game.draft).toHaveLength(1);
		});
	});
});
