import type { PlacedTile } from './rules';

export type Move = { player: number; kind: 'play' | 'pass'; tiles: PlacedTile[] };
export type EndState = { wentOut: number | null; leftovers: string[] };
export type SaveData = { version: 1; players: string[]; moves: Move[]; end: EndState | null };

const KEY = 'tally:game';

export function load(): SaveData | null {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return null;
		const data = JSON.parse(raw) as SaveData;
		return data.version === 1 && Array.isArray(data.players) ? data : null;
	} catch {
		return null;
	}
}

export function save(data: SaveData): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(data));
	} catch {
		// Storage full or blocked; the game still works for this session.
	}
}

export function clear(): void {
	try {
		localStorage.removeItem(KEY);
	} catch {
		// ignore
	}
}
