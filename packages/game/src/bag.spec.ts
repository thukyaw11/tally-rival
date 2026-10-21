import { describe, expect, it } from 'bun:test';
import { drawTiles, fullBag, rackLetter, swapTiles, takeFromRack } from './bag';

describe('bag', () => {
	it('holds 100 tiles with two blanks', () => {
		const bag = fullBag();
		expect(bag).toHaveLength(100);
		expect(bag.filter((l) => l === '?')).toHaveLength(2);
		expect(bag.filter((l) => l === 'E')).toHaveLength(12);
	});

	it('draws without losing tiles', () => {
		const { drawn, bag } = drawTiles(fullBag(), 7);
		expect(drawn).toHaveLength(7);
		expect(bag).toHaveLength(93);
		expect([...drawn, ...bag].sort()).toEqual(fullBag().sort());
	});

	it('draws only what is left', () => {
		expect(drawTiles(['A', 'B'], 7)).toEqual({ drawn: expect.any(Array), bag: [] });
		expect(drawTiles(['A', 'B'], 7).drawn.sort()).toEqual(['A', 'B']);
	});

	it('takes letters from the rack, counting repeats', () => {
		expect(takeFromRack(['A', 'B', 'A', '?'], ['A', '?'])).toEqual(['B', 'A']);
		expect(takeFromRack(['A', 'B'], ['A', 'A'])).toBeNull();
		expect(rackLetter({ row: 0, col: 0, letter: 'Q', blank: true })).toBe('?');
	});

	it('swaps and keeps the tile count', () => {
		const rack = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
		const result = swapTiles(rack, fullBag(), ['A', 'B']);
		if (result.error !== undefined) throw new Error(result.error);
		expect(result.rack).toHaveLength(7);
		expect(result.rack).toContain('C');
		expect(result.bag).toHaveLength(100);
	});

	it('refuses a swap with fewer than 7 tiles in the bag', () => {
		expect(swapTiles(['A'], ['B', 'C'], ['A'])).toEqual({
			error: 'Not enough tiles in the bag to swap'
		});
	});
});
