import { describe, expect, it } from 'bun:test';
import cases from '../fixtures/rules.json';
import { emptyBoard, scoreMove, validatePlacement, withTiles, type PlacedTile } from './rules';

// The Go server runs the same cases; regenerate with `bun run fixtures` after changing the rules.
describe('rule fixtures', () => {
	for (const c of cases) {
		it(c.name, () => {
			const board = (c.board as PlacedTile[][]).reduce(withTiles, emptyBoard());
			expect(validatePlacement(board, c.tiles)).toBe(c.error);
			if (!c.error) expect(scoreMove(board, c.tiles)).toEqual(c.score!);
		});
	}
});
