// Emoji avatars. Players store an index into this list (the server only checks the range),
// so only add to the end, and update AvatarCount in apps/server/internal/rooms (fixtures check it).
export const AVATARS = [
	'🦊',
	'🐸',
	'🐼',
	'🐨',
	'🐯',
	'🦁',
	'🐮',
	'🐷',
	'🐵',
	'🐔',
	'🐧',
	'🐙',
	'🦄',
	'🐝',
	'🐢',
	'🐳',
	'🦖',
	'👽',
	'🤖',
	'👻',
	'🎃',
	'🌵',
	'🍄',
	'🍕'
];

// A random avatar index, avoiding taken ones while any are left.
export function randomAvatar(taken: number[] = [], random = Math.random): number {
	const free = AVATARS.map((_, i) => i).filter((i) => !taken.includes(i));
	const pool = free.length ? free : AVATARS.map((_, i) => i);
	return pool[Math.floor(random() * pool.length)];
}
