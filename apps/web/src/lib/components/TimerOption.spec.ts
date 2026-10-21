import { describe, expect, it } from 'vitest';
import { formatMinutes, turnMinutes } from './TimerOption.svelte';

describe('turn timer option', () => {
	it('shows minutes as m:ss', () => {
		expect(formatMinutes(1.5)).toBe('1:30');
		expect(formatMinutes(2)).toBe('2:00');
		expect(formatMinutes(10)).toBe('10:00');
	});

	it('keeps the time within 1:30–10:00 in half minutes, or null when off', () => {
		expect(turnMinutes(true, 2.5)).toBe(2.5);
		expect(turnMinutes(true, 1)).toBe(1.5);
		expect(turnMinutes(true, 2.4)).toBe(2.5);
		expect(turnMinutes(true, 12)).toBe(10);
		expect(turnMinutes(false, 3)).toBeNull();
	});
});
