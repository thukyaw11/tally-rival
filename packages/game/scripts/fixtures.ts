// Writes fixtures/rules.json (rule cases) and fixtures/constants.json with the TS results, checked by the Go server's tests too.
// Run after changing the rules: bun run fixtures
import { BLANK_COUNT, LETTER_VALUES, TILE_COUNTS } from '../src/constants';
import { emptyBoard, scoreMove, validatePlacement, withTiles, type PlacedTile } from '../src/rules';

// '_' skips a square, lowercase = blank.
function word(text: string, row: number, col: number, down = false): PlacedTile[] {
	const tiles: PlacedTile[] = [];
	[...text].forEach((ch, i) => {
		if (ch === '_') return;
		const r = down ? row + i : row;
		const c = down ? col : col + i;
		tiles.push({ row: r, col: c, letter: ch.toUpperCase(), blank: ch !== ch.toUpperCase() });
	});
	return tiles;
}

const cat = word('CAT', 7, 6);
const cases: { name: string; board: PlacedTile[][]; tiles: PlacedTile[] }[] = [
	{ name: 'first word on the star', board: [], tiles: cat },
	{ name: 'first word off the star', board: [], tiles: word('CAT', 0, 0) },
	{ name: 'first word of one letter', board: [], tiles: word('A', 7, 7) },
	{ name: 'first word with a blank', board: [], tiles: word('cAT', 7, 6) },
	{ name: 'seven-tile bingo', board: [], tiles: word('RETAINS', 7, 1) },
	{ name: 'down first word', board: [], tiles: word('ZOO', 5, 7, true) },
	{ name: 'hook an S', board: [cat], tiles: word('S', 7, 9) },
	{ name: 'cross through a tile', board: [cat], tiles: word('O_X', 6, 7, true) },
	{ name: 'parallel play', board: [cat], tiles: word('AN', 8, 7) },
	{ name: 'single tile both ways', board: [cat, word('O_X', 6, 7, true)], tiles: word('E', 8, 6) },
	{ name: 'triple word hook', board: [word('QUARTER', 7, 7)], tiles: word('S', 7, 14) },
	{ name: 'double letters', board: [cat], tiles: word('J_B', 6, 6, true) },
	{ name: 'gap', board: [cat], tiles: [...word('A', 8, 6), ...word('E', 8, 9)] },
	{ name: 'not touching', board: [cat], tiles: word('DOG', 0, 0) },
	{ name: 'square taken', board: [cat], tiles: word('A', 7, 7) },
	{ name: 'same square twice', board: [cat], tiles: [...word('A', 8, 7), ...word('B', 8, 7)] },
	{ name: 'not in a line', board: [cat], tiles: [...word('A', 8, 6), ...word('B', 9, 7)] },
	{ name: 'off the board', board: [cat], tiles: [{ row: 15, col: 7, letter: 'A', blank: false }] },
	{ name: 'no tiles', board: [cat], tiles: [] }
];

const out = cases.map((c) => {
	const board = c.board.reduce(withTiles, emptyBoard());
	const error = validatePlacement(board, c.tiles);
	return { ...c, error, score: error ? null : scoreMove(board, c.tiles) };
});
await Bun.write(
	new URL('../fixtures/rules.json', import.meta.url),
	JSON.stringify(out, null, '\t') + '\n'
);
await Bun.write(
	new URL('../fixtures/constants.json', import.meta.url),
	JSON.stringify(
		{ letterValues: LETTER_VALUES, tileCounts: TILE_COUNTS, blankCount: BLANK_COUNT },
		null,
		'\t'
	) + '\n'
);
console.log(`Wrote ${out.length} cases`);
