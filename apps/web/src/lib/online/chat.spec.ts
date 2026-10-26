import type { ChatMessage } from '@tally/game';
import { describe, expect, it, vi } from 'vitest';
import { BUBBLE_MS, mergeMessages, RoomChat } from './chat.svelte.ts';

const msg = (id: number, playerId = 'bo', text = `m${id}`): ChatMessage => ({
	id,
	playerId,
	text,
	at: '2026-10-21T00:00:00Z'
});
const session = { code: 'ABCDE', playerId: 'ann', token: 't' };

describe('mergeMessages', () => {
	it('adds new messages in id order without duplicates', () => {
		const list = [msg(1), msg(3)];
		expect(mergeMessages(list, [msg(3), msg(2), msg(4), msg(4)]).map((m) => m.id)).toEqual([
			1, 2, 3, 4
		]);
		expect(mergeMessages(list, [msg(1)])).toBe(list);
	});
});

describe('RoomChat', () => {
	it('counts only new messages from others as unread', () => {
		const chat = new RoomChat(session);
		chat.merge([msg(1), msg(2)]);
		// History from the first load is already read.
		expect(chat.unread).toBe(0);
		chat.merge([msg(3), msg(4, 'ann')]);
		expect(chat.unread).toBe(1);
	});

	it('clears unread when opened, and stays read while visible', () => {
		const chat = new RoomChat(session);
		chat.merge([]);
		chat.merge([msg(1), msg(2)]);
		expect(chat.unread).toBe(2);
		chat.setOpen(true);
		expect(chat.unread).toBe(0);
		chat.merge([msg(3)]);
		expect(chat.unread).toBe(0);
		chat.setOpen(false);
		chat.setWide(true);
		chat.merge([msg(4)]);
		expect(chat.unread).toBe(0);
	});

	it('shows each new message as a bubble for a few seconds, your own too', () => {
		vi.useFakeTimers();
		try {
			const chat = new RoomChat(session);
			chat.merge([msg(1)]);
			// History from the first load never pops up.
			expect(chat.bubbles).toEqual({});
			chat.merge([msg(2), msg(3, 'ann')]);
			expect(chat.bubbles.bo?.id).toBe(2);
			expect(chat.bubbles.ann?.id).toBe(3);
			// The same message coming back (e.g. by Pusher) doesn't pop up again.
			vi.advanceTimersByTime(BUBBLE_MS);
			chat.merge([msg(3, 'ann')]);
			expect(chat.bubbles).toEqual({});
			// A newer message replaces the old one and restarts the clock.
			chat.merge([msg(4)]);
			vi.advanceTimersByTime(BUBBLE_MS - 500);
			chat.merge([msg(5)]);
			vi.advanceTimersByTime(BUBBLE_MS - 500);
			expect(chat.bubbles.bo?.id).toBe(5);
			vi.advanceTimersByTime(500);
			expect(chat.bubbles.bo).toBeUndefined();
		} finally {
			vi.useRealTimers();
		}
	});
});
