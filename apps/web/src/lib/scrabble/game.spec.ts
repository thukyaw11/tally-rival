import { describe, expect, it } from 'vitest';
import { Game } from './game.svelte';

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
});
