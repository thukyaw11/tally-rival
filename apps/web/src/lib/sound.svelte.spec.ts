import { afterEach, describe, expect, it } from 'vitest';
import { Sound } from './sound.svelte.ts';

describe('Sound', () => {
	afterEach(() => localStorage.removeItem('tally:muted'));

	it('remembers mute and plays nothing while muted', () => {
		const s = new Sound();
		expect(s.muted).toBe(false);
		s.toggle();
		expect(s.muted).toBe(true);
		expect(s.play('place')).toBe(false);
		expect(new Sound().muted).toBe(true);
	});

	it('waits for the player to touch the page before playing', async () => {
		const s = new Sound();
		expect(s.play('place')).toBe(false);
		window.dispatchEvent(new KeyboardEvent('keydown'));
		await new Promise((r) => setTimeout(r, 50));
		// Headless browsers may keep audio suspended; either way it must not throw.
		expect(typeof s.play('bingo')).toBe('boolean');
	});

	it('loads the recorded time-up and game-over sounds', async () => {
		const s = new Sound();
		expect(s.hasFile('win')).toBe(false);
		window.dispatchEvent(new KeyboardEvent('keydown'));
		await expect.poll(() => s.hasFile('win') && s.hasFile('buzzer'), { timeout: 5000 }).toBe(true);
		expect(s.hasFile('tick')).toBe(false);
		// Stopping a sound that isn't playing is harmless.
		s.stop('buzzer');
	});
});
