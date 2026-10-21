import { PUSHER_CLUSTER, PUSHER_KEY } from '$app/env/public';
import type { MoveRequest, PlayerView } from '@tally/game';
import Pusher, { type Members } from 'pusher-js';
import { Game } from '#lib/scrabble/game.svelte.ts';
import { api, ApiError, authEndpoint } from './api.ts';
import type { Session } from './session.ts';

// Without Pusher keys (local dev), ask the server for changes this often.
const POLL_MS = 3000;

// One online room as seen by this player. `game` mirrors the server so the tracker's
// Board, Scoreboard and History work unchanged; submit and pass are sent to the server.
export class OnlineRoom {
	readonly session: Session;
	readonly game = new Game(false, true);
	view = $state.raw<PlayerView | null>(null);
	error = $state<string | null>(null);
	// The room is gone or this browser is no longer in it.
	lost = $state(false);
	busy = $state(false);
	// Player ids with the room open right now (needs Pusher).
	here = $state<string[]>([]);

	me = $derived(this.view ? this.view.players.findIndex((p) => p.id === this.view!.you) : -1);
	myTurn = $derived(this.view?.status === 'playing' && this.game.current === this.me);
	isHost = $derived(!!this.view && this.view.hostId === this.view.you);

	constructor(session: Session) {
		this.session = session;
		this.game.remote = {
			play: (tiles) => this.send({ kind: 'play', tiles }),
			pass: (kind) =>
				this.send(kind === 'pass' ? { kind } : { kind: 'swap', letters: this.view?.rack ?? [] })
		};
	}

	private apply(v: PlayerView) {
		// Moves only grow, so an older reply that arrives late is ignored.
		if (this.view && v.moves.length < this.view.moves.length) return;
		const g = this.game;
		const changed = v.moves.length !== g.moves.length || v.status !== this.view?.status;
		this.view = v;
		g.players = v.players.map((p) => p.name);
		g.colors = v.players.map((p) => p.color);
		g.turnMinutes = v.turnMinutes;
		g.rack = v.rack;
		g.end = v.end && { ...v.end, breakTie: false };
		if (changed) {
			g.moves = v.moves.map(({ player, kind, tiles }) => ({ player, kind, tiles }));
			g.resetDraft();
		}
		g.canPlay = this.myTurn;
	}

	private async run(call: () => Promise<PlayerView>) {
		try {
			this.apply(await call());
			this.error = null;
		} catch (e) {
			if (e instanceof ApiError && (e.status === 401 || e.status === 404)) this.lost = true;
			this.error = e instanceof Error ? e.message : String(e);
		}
	}

	refresh = () => this.run(() => api.view(this.session));

	async send(move: MoveRequest) {
		if (this.busy) return;
		this.busy = true;
		await this.run(() => api.move(this.session, move));
		this.busy = false;
	}

	swap(letters: string[]) {
		return this.send({ kind: 'swap', letters });
	}

	async start() {
		this.busy = true;
		await this.run(() => api.start(this.session));
		this.busy = false;
	}

	// Listens for changes; returns a function that stops listening.
	connect(): () => void {
		this.refresh();
		const onVisible = () => document.visibilityState === 'visible' && this.refresh();
		document.addEventListener('visibilitychange', onVisible);

		if (!PUSHER_KEY) {
			const id = setInterval(this.refresh, POLL_MS);
			return () => {
				clearInterval(id);
				document.removeEventListener('visibilitychange', onVisible);
			};
		}

		const pusher = new Pusher(PUSHER_KEY, {
			cluster: PUSHER_CLUSTER,
			channelAuthorization: {
				endpoint: authEndpoint,
				transport: 'ajax',
				headers: { Authorization: `Bearer ${this.session.token}` }
			}
		});
		const channel = pusher.subscribe(`presence-room-${this.session.code}`);
		channel.bind('updated', this.refresh);
		channel.bind('pusher:subscription_succeeded', (members: Members) => {
			const ids: string[] = [];
			members.each((m: { id: string }) => ids.push(m.id));
			this.here = ids;
			this.refresh();
		});
		channel.bind('pusher:member_added', (m: { id: string }) => (this.here = [...this.here, m.id]));
		channel.bind(
			'pusher:member_removed',
			(m: { id: string }) => (this.here = this.here.filter((id) => id !== m.id))
		);
		// Catch up on anything missed while disconnected.
		pusher.connection.bind('connected', this.refresh);

		return () => {
			pusher.disconnect();
			document.removeEventListener('visibilitychange', onVisible);
		};
	}
}
