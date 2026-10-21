import { describe, expect, it } from 'vitest';
import { Game } from '#lib/scrabble/game.svelte.ts';
import { snapshot, soundForChange, type Snapshot } from './sound.svelte.ts';

const base: Snapshot = { moves: 0, last: null, draft: '', draftCount: 0, ended: false };
const at = (over: Partial<Snapshot>): Snapshot => ({ ...base, ...over });

describe('soundForChange', () => {
	it('stays quiet on the first snapshot and when nothing changed', () => {
		expect(soundForChange(null, at({ moves: 3 }))).toBeNull();
		expect(soundForChange(base, base)).toBeNull();
	});

	it('clicks when a tile is placed or replaced, softer when removed', () => {
		expect(soundForChange(base, at({ draft: 'a', draftCount: 1 }))).toBe('place');
		expect(
			soundForChange(at({ draft: 'a', draftCount: 1 }), at({ draft: 'b', draftCount: 1 }))
		).toBe('place');
		expect(soundForChange(at({ draft: 'a', draftCount: 1 }), base)).toBe('remove');
	});

	it('picks the move sound, not remove, when a word is submitted', () => {
		const drafting = at({ draft: 'a|b', draftCount: 2 });
		expect(soundForChange(drafting, at({ moves: 1, last: { kind: 'play', bingo: false } }))).toBe(
			'score'
		);
		expect(soundForChange(drafting, at({ moves: 1, last: { kind: 'play', bingo: true } }))).toBe(
			'bingo'
		);
		expect(soundForChange(base, at({ moves: 1, last: { kind: 'pass', bingo: false } }))).toBe(
			'pass'
		);
		expect(soundForChange(base, at({ moves: 1, last: { kind: 'swap', bingo: false } }))).toBe(
			'swap'
		);
	});

	it('plays remove on undo and the jingle when the game ends', () => {
		expect(soundForChange(at({ moves: 2 }), at({ moves: 1 }))).toBe('remove');
		expect(soundForChange(base, at({ ended: true }))).toBe('win');
		// The last online move and the end arrive together: the jingle wins.
		expect(
			soundForChange(base, at({ moves: 1, last: { kind: 'play', bingo: false }, ended: true }))
		).toBe('win');
	});

	it('reads a real game', () => {
		const game = new Game(false);
		game.start(['Ann', 'Bo']);
		const before = snapshot(game);
		game.tapCell(7, 7);
		game.placeLetter('H');
		expect(soundForChange(before, snapshot(game))).toBe('place');
		game.placeLetter('I');
		const drafting = snapshot(game);
		game.submit();
		expect(soundForChange(drafting, snapshot(game))).toBe('score');
	});
});
