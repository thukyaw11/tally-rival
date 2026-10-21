import { describe, expect, it } from 'bun:test';
import {
	emptyBoard,
	endGameAdjust,
	scoreMove,
	validatePlacement,
	withTiles,
	type PlacedTile
} from './rules';

// Builds tiles from a word starting at (row, col); '_' skips a square, lowercase = blank.
function word(text: string, row: number, col: number, down = false): PlacedTile[] {
	const tiles: PlacedTile[] = [];
	[...text].forEach((ch, i) => {
		if (ch === '_') return;
		tiles.push({
			row: down ? row + i : row,
			col: down ? col : col + i,
			letter: ch.toUpperCase(),
			blank: ch !== ch.toUpperCase()
		});
	});
	return tiles;
}

const withCat = () => withTiles(emptyBoard(), word('CAT', 7, 6));

describe('scoreMove', () => {
	it('doubles the first word on the center star', () => {
		expect(scoreMove(emptyBoard(), word('CAT', 7, 6)).total).toBe(10);
	});

	it('does not reuse premiums under old tiles', () => {
		const s = scoreMove(withCat(), word('S', 7, 9));
		expect(s.words).toEqual([{ text: 'CATS', score: 6 }]);
	});

	it('scores a single tile that makes a word down', () => {
		expect(scoreMove(withCat(), word('O', 6, 7)).words).toEqual([{ text: 'OA', score: 2 }]);
	});

	it('adds cross words and letter premiums', () => {
		const s = scoreMove(withCat(), word('AX', 8, 7));
		expect(s.words).toEqual([
			{ text: 'AX', score: 17 },
			{ text: 'AA', score: 2 },
			{ text: 'TX', score: 17 }
		]);
		expect(s.total).toBe(36);
	});

	it('triples on a TW square', () => {
		const board = withTiles(emptyBoard(), word('A', 0, 1));
		expect(scoreMove(board, word('C_T', 0, 0)).total).toBe(15);
	});

	it('scores blanks as zero', () => {
		const s = scoreMove(emptyBoard(), word('cAT', 7, 6));
		expect(s.total).toBe(4);
		expect(s.words[0].text).toBe('cAT');
	});

	it('adds 50 for using all 7 tiles', () => {
		const s = scoreMove(emptyBoard(), word('RETAINS', 7, 1));
		expect(s.bingo).toBe(true);
		expect(s.total).toBe(66);
	});
});

describe('validatePlacement', () => {
	it('accepts a good first move', () => {
		expect(validatePlacement(emptyBoard(), word('CAT', 7, 6))).toBeNull();
	});

	it('rejects first move off the center', () => {
		expect(validatePlacement(emptyBoard(), word('CAT', 0, 0))).toMatch(/center/);
	});

	it('rejects a one-letter first move', () => {
		expect(validatePlacement(emptyBoard(), word('A', 7, 7))).toMatch(/2 letters/);
	});

	it('rejects tiles not in one line', () => {
		const tiles = [...word('C', 7, 7), ...word('A', 8, 8)];
		expect(validatePlacement(emptyBoard(), tiles)).toMatch(/one row/);
	});

	it('rejects gaps but allows old tiles to fill them', () => {
		expect(validatePlacement(emptyBoard(), word('C_T', 7, 6))).toMatch(/gap/);
		expect(validatePlacement(withCat(), word('S___', 7, 5))).toBeNull();
		expect(validatePlacement(withCat(), word('A____S', 7, 5))).toMatch(/gap/);
	});

	it('rejects words that do not connect', () => {
		expect(validatePlacement(withCat(), word('DOG', 0, 0))).toMatch(/connect/);
	});

	it('rejects a square that is taken', () => {
		expect(validatePlacement(withCat(), word('X', 7, 7))).toMatch(/already/);
	});
});

describe('endGameAdjust', () => {
	it('moves leftover points to the player who went out', () => {
		expect(endGameAdjust(['', 'QZ', 'A?'], 0)).toEqual([21, -20, -1]);
	});

	it('only subtracts when nobody went out', () => {
		expect(endGameAdjust(['E', 'K'], null)).toEqual([-1, -5]);
	});
});
