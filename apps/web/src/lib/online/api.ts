import { API_URL } from '$app/env/public';
import type { ChatMessage, MoveRequest, PlayerView, WordList } from '@tally/game';
import type { Session } from './session.ts';

export class ApiError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
	}
}

async function request<T>(
	method: string,
	path: string,
	token?: string,
	body?: unknown
): Promise<T> {
	let res: Response;
	try {
		res = await fetch(API_URL + path, {
			method,
			headers: {
				...(body !== undefined && { 'Content-Type': 'application/json' }),
				...(token && { Authorization: `Bearer ${token}` })
			},
			body: body === undefined ? undefined : JSON.stringify(body)
		});
	} catch {
		throw new ApiError(0, "Can't reach the game server. Check your connection.");
	}
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new ApiError(res.status, data.error ?? `Server error (${res.status})`);
	return data as T;
}

export const api = {
	create: (name: string, turnMinutes: number | null, wordList: WordList, avatar: number) =>
		request<Session>('POST', '/rooms', undefined, { name, turnMinutes, wordList, avatar }),
	join: (code: string, name: string, avatar: number) =>
		request<Session>('POST', `/rooms/${code}/join`, undefined, { name, avatar }),
	view: (s: Session) => request<PlayerView>('GET', `/rooms/${s.code}`, s.token),
	start: (s: Session) => request<PlayerView>('POST', `/rooms/${s.code}/start`, s.token),
	end: (s: Session) => request<PlayerView>('POST', `/rooms/${s.code}/end`, s.token),
	move: (s: Session, move: MoveRequest) =>
		request<PlayerView>('POST', `/rooms/${s.code}/move`, s.token, move),
	chat: async (s: Session, after = 0) =>
		(
			await request<{ messages: ChatMessage[] }>(
				'GET',
				`/rooms/${s.code}/chat?after=${after}`,
				s.token
			)
		).messages,
	say: (s: Session, text: string) =>
		request<ChatMessage>('POST', `/rooms/${s.code}/chat`, s.token, { text })
};

export const authEndpoint = `${API_URL}/pusher/auth`;
