import { describe, expect, it } from 'bun:test';
import { AVATARS, randomAvatar } from './avatars';

describe('avatars', () => {
	it('has no repeats', () => {
		expect(new Set(AVATARS).size).toBe(AVATARS.length);
	});

	it('picks a free avatar while there is one', () => {
		const taken = AVATARS.map((_, i) => i).filter((i) => i !== 5);
		expect(randomAvatar(taken)).toBe(5);
		expect(
			randomAvatar(
				AVATARS.map((_, i) => i),
				() => 0
			)
		).toBe(0);
		for (let i = 0; i < 50; i++) expect(randomAvatar([0, 1])).toBeGreaterThan(1);
	});
});
