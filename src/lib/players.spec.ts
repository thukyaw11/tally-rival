import { describe, expect, it } from 'vitest';
import { reshuffle, shuffle } from './players';
import { Game } from './scrabble/game.svelte';

// Repeats the given numbers as the "random" source.
const fixed = (...values: number[]) => {
	let i = 0;
	return () => values[i++ % values.length];
};

describe('shuffle', () => {
	it('keeps every player exactly once', () => {
		const out = shuffle(['A', 'B', 'C', 'D']);
		expect([...out].sort()).toEqual(['A', 'B', 'C', 'D']);
	});

	it('uses the random source for the order', () => {
		expect(shuffle(['A', 'B', 'C'], fixed(0))).toEqual(['B', 'C', 'A']);
		expect(shuffle(['A', 'B', 'C'], fixed(0.99))).toEqual(['A', 'B', 'C']);
	});

	it('gives every player a fair chance to start', () => {
		const starts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
		for (let i = 0; i < 4000; i++) starts[shuffle(['A', 'B', 'C', 'D'])[0]]++;
		for (const n of Object.values(starts)) expect(n).toBeGreaterThan(800);
	});
});

describe('reshuffle', () => {
	it('always changes the order', () => {
		for (let i = 0; i < 50; i++) expect(reshuffle(['A', 'B'])).toEqual(['B', 'A']);
	});

	it('leaves a single player alone', () => {
		expect(reshuffle(['A'])).toEqual(['A']);
	});
});

describe('Game colors', () => {
	it('keeps each player their setup color after shuffling', () => {
		const game = new Game(false);
		game.start(['Cy', 'Ann', 'Bo'], [2, 0, 1]);
		expect(game.players[game.current]).toBe('Cy');
		expect(game.color(0).bg).toBe('#f59e0b');
		expect(game.color(1).bg).toBe('#ef4444');
	});

	it('falls back to seat order when no colors are given', () => {
		const game = new Game(false);
		game.start(['Ann', 'Bo']);
		expect(game.color(1).bg).toBe('#3b82f6');
	});
});
