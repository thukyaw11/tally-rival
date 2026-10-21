import type { ChatMessage } from '@tally/game';
import { sound } from '#lib/sound.svelte.ts';
import { api } from './api.ts';
import type { Session } from './session.ts';

// Adds messages by id (no duplicates), oldest first.
export function mergeMessages(list: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
	const fresh = incoming.filter(
		(m, i) => !list.some((l) => l.id === m.id) && incoming.findIndex((x) => x.id === m.id) === i
	);
	if (!fresh.length) return list;
	return [...list, ...fresh].sort((a, b) => a.id - b.id);
}

// The room's chat: saved on the server, new messages arrive by Pusher or polling.
export class RoomChat {
	messages = $state.raw<ChatMessage[]>([]);
	error = $state<string | null>(null);
	// The phone panel is open / the wide-screen panel is on screen.
	open = $state(false);
	wide = $state(false);
	// Last message id the player has had on screen.
	seen = $state(0);
	// Newest message from someone else while chat was hidden, for the pop-up bubble.
	latest = $state.raw<ChatMessage | null>(null);

	private readonly session: Session;
	private loaded = false;

	constructor(session: Session) {
		this.session = session;
	}

	get unread() {
		return this.messages.filter((m) => m.id > this.seen && m.playerId !== this.session.playerId)
			.length;
	}

	get visible() {
		return this.open || this.wide;
	}

	isMine(m: ChatMessage) {
		return m.playerId === this.session.playerId;
	}

	merge(incoming: ChatMessage[]) {
		const lastId = this.messages.at(-1)?.id ?? 0;
		this.messages = mergeMessages(this.messages, incoming);
		const fresh = incoming.filter((m) => m.id > lastId && !this.isMine(m));
		// Old messages from the first load don't count as new.
		if (!this.loaded) {
			this.loaded = true;
			this.markRead();
		} else if (fresh.length) {
			sound.play('message');
			if (!this.visible) this.latest = fresh.at(-1)!;
		}
		if (this.visible) this.markRead();
	}

	markRead() {
		this.seen = this.messages.at(-1)?.id ?? this.seen;
	}

	setOpen(open: boolean) {
		this.open = open;
		if (open) {
			this.latest = null;
			this.markRead();
		}
	}

	setWide(wide: boolean) {
		this.wide = wide;
		if (wide) this.markRead();
	}

	load = async () => {
		try {
			this.merge(await api.chat(this.session, this.messages.at(-1)?.id ?? 0));
		} catch {
			// The room view shows connection problems; chat just tries again next time.
		}
	};

	// Returns whether the message went out, so the input can be cleared.
	async send(text: string): Promise<boolean> {
		try {
			this.merge([await api.say(this.session, text)]);
			this.error = null;
			return true;
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
			return false;
		}
	}
}
