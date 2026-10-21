// The online room this browser is in, so a reload or the home screen can rejoin it.
export type Session = { code: string; playerId: string; token: string };

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

export function clearSession() {
	try {
		localStorage.removeItem(KEY);
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
