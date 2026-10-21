import {
	BINGO_BONUS,
	BLANK_COUNT,
	CENTER,
	LETTER_VALUES,
	PREMIUMS,
	SIZE,
	TILE_COUNTS
} from './constants';

export type Tile = { letter: string; blank: boolean };
export type PlacedTile = Tile & { row: number; col: number };
export type Board = (Tile | null)[][];
export type WordScore = { text: string; score: number };
export type MoveScore = { words: WordScore[]; bingo: boolean; total: number };

export function emptyBoard(): Board {
	return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

export function boardIsEmpty(board: Board): boolean {
	return board.every((row) => row.every((t) => t === null));
}

export function tileValue(tile: Tile): number {
	return tile.blank ? 0 : (LETTER_VALUES[tile.letter] ?? 0);
}

const inBounds = (r: number, c: number) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

// Returns an error message, or null when the placement is legal.
export function validatePlacement(board: Board, tiles: PlacedTile[]): string | null {
	if (tiles.length === 0) return 'Place at least one tile.';

	const seen = new Set<string>();
	for (const t of tiles) {
		if (!inBounds(t.row, t.col)) return 'Tile is off the board.';
		if (board[t.row][t.col]) return 'A tile is already on that square.';
		const key = `${t.row},${t.col}`;
		if (seen.has(key)) return 'Two tiles on the same square.';
		seen.add(key);
	}

	const sameRow = tiles.every((t) => t.row === tiles[0].row);
	const sameCol = tiles.every((t) => t.col === tiles[0].col);
	if (!sameRow && !sameCol) return 'Tiles must be in one row or one column.';

	// Every square between the first and last new tile must be filled.
	const filled = withTiles(board, tiles);
	if (sameRow) {
		const cols = tiles.map((t) => t.col);
		for (let c = Math.min(...cols); c <= Math.max(...cols); c++) {
			if (!filled[tiles[0].row][c]) return 'Word has a gap.';
		}
	} else {
		const rows = tiles.map((t) => t.row);
		for (let r = Math.min(...rows); r <= Math.max(...rows); r++) {
			if (!filled[r][tiles[0].col]) return 'Word has a gap.';
		}
	}

	if (boardIsEmpty(board)) {
		if (!tiles.some((t) => t.row === CENTER && t.col === CENTER))
			return 'First word must cover the center star.';
		if (tiles.length < 2) return 'First word needs at least 2 letters.';
		return null;
	}

	const touches = tiles.some((t) =>
		[
			[t.row - 1, t.col],
			[t.row + 1, t.col],
			[t.row, t.col - 1],
			[t.row, t.col + 1]
		].some(([r, c]) => inBounds(r, c) && board[r][c])
	);
	if (!touches) return 'Word must connect to tiles already on the board.';
	return null;
}

export function withTiles(board: Board, tiles: PlacedTile[]): Board {
	const next = board.map((row) => row.slice());
	for (const t of tiles) next[t.row][t.col] = { letter: t.letter, blank: t.blank };
	return next;
}

// Scores the full word running through (row, col) in the given direction.
function scoreLine(
	filled: Board,
	isNew: (r: number, c: number) => boolean,
	row: number,
	col: number,
	dr: number,
	dc: number
): WordScore | null {
	let r = row;
	let c = col;
	while (inBounds(r - dr, c - dc) && filled[r - dr][c - dc]) {
		r -= dr;
		c -= dc;
	}
	let text = '';
	let sum = 0;
	let wordMult = 1;
	while (inBounds(r, c) && filled[r][c]) {
		const tile = filled[r][c]!;
		let value = tileValue(tile);
		if (isNew(r, c)) {
			const p = PREMIUMS[r][c];
			if (p === 'DL') value *= 2;
			if (p === 'TL') value *= 3;
			if (p === 'DW') wordMult *= 2;
			if (p === 'TW') wordMult *= 3;
		}
		text += tile.blank ? tile.letter.toLowerCase() : tile.letter;
		sum += value;
		r += dr;
		c += dc;
	}
	if (text.length < 2) return null;
	return { text, score: sum * wordMult };
}

export function scoreMove(board: Board, tiles: PlacedTile[]): MoveScore {
	const filled = withTiles(board, tiles);
	const newKeys = new Set(tiles.map((t) => `${t.row},${t.col}`));
	const isNew = (r: number, c: number) => newKeys.has(`${r},${c}`);

	// A single tile may form words both ways; pick across as the main line.
	const across = tiles.length > 1 ? tiles.every((t) => t.row === tiles[0].row) : true;
	const [dr, dc] = across ? [0, 1] : [1, 0];
	const words: WordScore[] = [];

	const main = scoreLine(filled, isNew, tiles[0].row, tiles[0].col, dr, dc);
	if (main) words.push(main);
	for (const t of tiles) {
		const cross = scoreLine(filled, isNew, t.row, t.col, dc, dr);
		if (cross) words.push(cross);
	}

	const bingo = tiles.length === 7;
	const total = words.reduce((s, w) => s + w.score, 0) + (bingo ? BINGO_BONUS : 0);
	return { words, bingo, total };
}

// Letters used more often than the bag holds (blanks count separately).
export function overusedLetters(board: Board): string[] {
	const used: Record<string, number> = {};
	let blanks = 0;
	for (const row of board)
		for (const t of row) {
			if (!t) continue;
			if (t.blank) blanks++;
			else used[t.letter] = (used[t.letter] ?? 0) + 1;
		}
	const over = Object.keys(used).filter((l) => used[l] > (TILE_COUNTS[l] ?? 0));
	if (blanks > BLANK_COUNT) over.push('blank');
	return over;
}

// Leftover letters use '?' for a blank. Returns the change to each player's score.
export function endGameAdjust(leftovers: string[], wentOut: number | null): number[] {
	const values = leftovers.map((s) =>
		[...s.toUpperCase()].reduce((sum, ch) => sum + (LETTER_VALUES[ch] ?? 0), 0)
	);
	const adjust = values.map((v) => -v);
	if (wentOut !== null) {
		adjust[wentOut] = values.reduce((s, v, i) => (i === wentOut ? s : s + v), 0);
	}
	return adjust;
}
