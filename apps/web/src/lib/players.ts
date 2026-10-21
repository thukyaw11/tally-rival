// One color per seat, used for avatars, the turn card and history dots.
export const PLAYER_COLORS = [
	{ bg: '#ef4444', edge: '#b91c1c' },
	{ bg: '#3b82f6', edge: '#1d4ed8' },
	{ bg: '#f59e0b', edge: '#b45309' },
	{ bg: '#a855f7', edge: '#7e22ce' }
];

export const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?';

export type Seat = { name: string; color: number; avatar: number | null };

// Fisher-Yates shuffle; the result is the turn order.
export function shuffle<T>(items: T[], random = Math.random): T[] {
	const out = items.slice();
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

// Shuffles again, making sure the order actually changes when it can.
export function reshuffle<T>(items: T[], random = Math.random): T[] {
	if (items.length < 2) return items.slice();
	let out: T[];
	do out = shuffle(items, random);
	while (out.every((item, i) => item === items[i]));
	return out;
}
