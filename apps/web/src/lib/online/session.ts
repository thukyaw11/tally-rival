import { randomAvatar } from '@tally/game';

// The online room this browser is in, so a reload or the home screen can rejoin it.
// ended: the game is over, so the home screen stops offering "Back to room".
export type Session = { code: string; playerId: string; token: string; ended?: boolean };

const KEY = 'tally:online';
const NAME_KEY = 'tally:name';

export function loadSession(): Session | null {
	try {
		const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
		return s?.code && s?.token ? s : null;
	} catch {
		return null;
	}
}

export function saveSession(s: Session) {
	try {
		localStorage.setItem(KEY, JSON.stringify(s));
	} catch {
		// Blocked storage: the room still works until the page is closed.
	}
}

// Marks the saved room as finished (only if it's still the saved one).
export function markSessionEnded(code: string) {
	const s = loadSession();
	if (s?.code === code && !s.ended) saveSession({ ...s, ended: true });
}

export function clearSession() {
	try {
		localStorage.removeItem(KEY);
	} catch {
		// ignore
	}
}

const AVATAR_KEY = 'tally:avatar';

// Last avatar picked; a random one on the first visit.
export function loadAvatar(): number {
	try {
		const a = Number(localStorage.getItem(AVATAR_KEY));
		if (localStorage.getItem(AVATAR_KEY) !== null && Number.isInteger(a)) return a;
	} catch {
		// ignore
	}
	return randomAvatar();
}

export function saveAvatar(avatar: number) {
	try {
		localStorage.setItem(AVATAR_KEY, String(avatar));
	} catch {
		// ignore
	}
}

// Last name typed, to fill in next time.
export function loadName(): string {
	try {
		return localStorage.getItem(NAME_KEY) ?? '';
	} catch {
		return '';
	}
}

export function saveName(name: string) {
	try {
		localStorage.setItem(NAME_KEY, name);
	} catch {
		// ignore
	}
}
