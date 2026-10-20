export const SIZE = 15;
export const CENTER = 7;
export const BINGO_BONUS = 50;

export const LETTER_VALUES: Record<string, number> = {
	A: 1,
	B: 3,
	C: 3,
	D: 2,
	E: 1,
	F: 4,
	G: 2,
	H: 4,
	I: 1,
	J: 8,
	K: 5,
	L: 1,
	M: 3,
	N: 1,
	O: 1,
	P: 3,
	Q: 10,
	R: 1,
	S: 1,
	T: 1,
	U: 1,
	V: 4,
	W: 4,
	X: 8,
	Y: 4,
	Z: 10
};

export const TILE_COUNTS: Record<string, number> = {
	A: 9,
	B: 2,
	C: 2,
	D: 4,
	E: 12,
	F: 2,
	G: 3,
	H: 2,
	I: 9,
	J: 1,
	K: 1,
	L: 4,
	M: 2,
	N: 6,
	O: 8,
	P: 2,
	Q: 1,
	R: 6,
	S: 4,
	T: 6,
	U: 4,
	V: 2,
	W: 2,
	X: 1,
	Y: 2,
	Z: 1
};
export const BLANK_COUNT = 2;

export type Premium = 'TW' | 'DW' | 'TL' | 'DL';

// One quarter of the board (rows/cols 0..7); the rest is mirrored.
const QUARTER: [number, number, Premium][] = [
	[0, 0, 'TW'],
	[0, 7, 'TW'],
	[7, 0, 'TW'],
	[1, 1, 'DW'],
	[2, 2, 'DW'],
	[3, 3, 'DW'],
	[4, 4, 'DW'],
	[7, 7, 'DW'],
	[1, 5, 'TL'],
	[5, 1, 'TL'],
	[5, 5, 'TL'],
	[0, 3, 'DL'],
	[3, 0, 'DL'],
	[2, 6, 'DL'],
	[6, 2, 'DL'],
	[3, 7, 'DL'],
	[7, 3, 'DL'],
	[6, 6, 'DL']
];

function buildPremiums(): (Premium | null)[][] {
	const grid: (Premium | null)[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
	const last = SIZE - 1;
	for (const [r, c, p] of QUARTER) {
		for (const [rr, cc] of [
			[r, c],
			[last - r, c],
			[r, last - c],
			[last - r, last - c]
		]) {
			grid[rr][cc] = p;
		}
	}
	return grid;
}

export const PREMIUMS = buildPremiums();
