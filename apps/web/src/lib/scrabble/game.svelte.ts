import { PLAYER_COLORS } from '../players';
import {
	SIZE,
	emptyBoard,
	endGameAdjust,
	overusedLetters,
	rackLetter,
	takeFromRack,
	scoreMove,
	validatePlacement,
	withTiles,
	type Board,
	type MoveScore,
	type PlacedTile
} from '@tally/game';
import * as storage from './storage';
import { isWord, loadWords } from './words';
import type { EndState, Move, SaveData } from './storage';

export type Direction = 'across' | 'down';
export type HistoryEntry = { player: number; kind: Move['kind']; score: MoveScore | null };
// Online play: the server owns the moves, so submit and pass are sent to it instead.
export type Remote = { play(tiles: PlacedTile[]): void; pass(kind: 'pass' | 'swap'): void };

export class Game {
	// Players in turn order.
	players = $state<string[]>([]);
	colors = $state<number[]>([]);
	// Minutes per turn, or null for no timer.
	turnMinutes = $state<number | null>(null);
	moves = $state<Move[]>([]);
	end = $state<EndState | null>(null);

	draft = $state<PlacedTile[]>([]);
	cursor = $state<{ row: number; col: number } | null>(null);
	direction = $state<Direction>('across');
	blankNext = $state(false);

	// null until the word list loads (or if it fails), which turns checking off.
	words = $state.raw<Set<string> | null>(null);

	remote: Remote | null = null;
	// Online only: the player's tiles ('?' = blank), and whether they may place tiles now.
	rack = $state<string[] | null>(null);
	canPlay = $state(true);
	// Goes up each time a submit is refused, so the page can react (e.g. a sound).
	rejects = $state(0);

	private persist: boolean;

	constructor(persist = true, checkWords = persist) {
		this.persist = persist;
		const saved = persist ? storage.load() : null;
		if (saved) {
			this.players = saved.players;
			this.colors = saved.colors ?? saved.players.map((_, i) => i);
			this.turnMinutes = saved.turnMinutes ?? null;
			this.moves = saved.moves;
			this.end = saved.end;
		}
		if (checkWords) loadWords().then((w) => (this.words = w));
	}

	// Replays every move to rebuild the board and each turn's score.
	replay = $derived.by(() => {
		let board = emptyBoard();
		const history: HistoryEntry[] = [];
		for (const m of this.moves) {
			const score = m.kind === 'play' ? scoreMove(board, m.tiles) : null;
			if (m.kind === 'play') board = withTiles(board, m.tiles);
			history.push({ player: m.player, kind: m.kind, score });
		}
		return { board, history };
	});

	board: Board = $derived(this.replay.board);
	history: HistoryEntry[] = $derived(this.replay.history);

	adjust: number[] = $derived(
		this.end ? endGameAdjust(this.end.leftovers, this.end.wentOut) : this.players.map(() => 0)
	);

	playScores: number[] = $derived(
		this.players.map((_, i) =>
			this.history.reduce((s, h) => (h.player === i ? s + (h.score?.total ?? 0) : s), 0)
		)
	);

	scores: number[] = $derived(this.playScores.map((s, i) => s + (this.adjust[i] ?? 0)));

	// Indexes of the winners once the game has ended; more than one means a tie.
	winners: number[] = $derived.by(() => {
		if (!this.end) return [];
		const top = (ids: number[], by: number[]) => {
			const best = Math.max(...ids.map((i) => by[i]));
			return ids.filter((i) => by[i] === best);
		};
		const tied = top(
			this.players.map((_, i) => i),
			this.scores
		);
		return this.end.breakTie && tied.length > 1 ? top(tied, this.playScores) : tied;
	});

	started = $derived(this.players.length > 0);
	ended = $derived(this.end !== null);
	current = $derived(this.players.length ? this.moves.length % this.players.length : 0);

	draftError: string | null = $derived(
		this.draft.length ? validatePlacement(this.board, this.draft) : null
	);
	draftScore: MoveScore | null = $derived(
		this.draft.length && !this.draftError ? scoreMove(this.board, this.draft) : null
	);
	unknownWords: string[] = $derived(this.unknownIn(this.draftScore));

	overused: string[] = $derived(overusedLetters(withTiles(this.board, this.draft)));

	// Rack tiles not yet in the draft.
	rackLeft: string[] | null = $derived(
		this.rack && (takeFromRack(this.rack, this.draft.map(rackLetter)) ?? [])
	);

	unknownIn(score: MoveScore | null): string[] {
		const words = this.words;
		if (!words || !score) return [];
		return score.words.map((w) => w.text).filter((t) => !isWord(words, t));
	}

	// Names must already be in turn order; colors default to seat order.
	start(names: string[], colors = names.map((_, i) => i), turnMinutes: number | null = null) {
		this.players = names;
		this.colors = colors;
		this.turnMinutes = turnMinutes;
		this.moves = [];
		this.end = null;
		this.resetDraft();
		this.save();
	}

	newGame() {
		this.players = [];
		this.colors = [];
		this.turnMinutes = null;
		this.moves = [];
		this.end = null;
		this.resetDraft();
		if (this.persist) storage.clear();
	}

	color(player: number) {
		return PLAYER_COLORS[this.colors[player] ?? player];
	}

	// Physical keyboard shortcuts; returns false for keys it doesn't use.
	handleKey(key: string): boolean {
		if (/^[a-zA-Z]$/.test(key)) this.placeLetter(key);
		else if (key === 'Backspace') this.backspace();
		else if (key === 'Enter') this.submit();
		else if (key === ' ') this.toggleDirection();
		else if (key === '?' || key === '*') this.toggleBlank();
		else if (key === 'Escape') this.clearDraft();
		else return false;
		return true;
	}

	draftAt(row: number, col: number): PlacedTile | undefined {
		return this.draft.find((t) => t.row === row && t.col === col);
	}

	tapCell(row: number, col: number) {
		if (this.ended) return;
		if (this.cursor?.row === row && this.cursor?.col === col) {
			this.toggleDirection();
		} else {
			this.cursor = { row, col };
		}
	}

	toggleDirection() {
		this.direction = this.direction === 'across' ? 'down' : 'across';
	}

	private step(row: number, col: number) {
		return this.direction === 'across' ? { row, col: col + 1 } : { row: row + 1, col };
	}

	placeLetter(letter: string) {
		if (!this.cursor || this.ended || !this.canPlay) return;
		let { row, col } = this.cursor;
		// Skip squares that already hold a played tile.
		while (row < SIZE && col < SIZE && this.board[row][col]) ({ row, col } = this.step(row, col));
		if (row >= SIZE || col >= SIZE) return;

		const rest = this.draft.filter((t) => t.row !== row || t.col !== col);
		const tile = { row, col, letter: letter.toUpperCase(), blank: this.blankNext };
		if (this.rack) {
			// Online: only letters on the rack; fall back to a blank when the letter is missing.
			const left = takeFromRack(this.rack, rest.map(rackLetter)) ?? [];
			if (!left.includes(rackLetter(tile))) {
				if (tile.blank || !left.includes('?')) return;
				tile.blank = true;
			}
		}
		this.draft = [...rest, tile];
		this.blankNext = false;

		const next = this.step(row, col);
		this.cursor = next.row < SIZE && next.col < SIZE ? next : { row, col };
	}

	backspace() {
		const last = this.draft.at(-1);
		if (!last) return;
		this.draft = this.draft.slice(0, -1);
		this.cursor = { row: last.row, col: last.col };
	}

	toggleBlank() {
		this.blankNext = !this.blankNext;
	}

	clearDraft() {
		const first = this.draft[0];
		this.draft = [];
		if (first) this.cursor = { row: first.row, col: first.col };
	}

	submit(): boolean {
		if (!this.draft.length || this.ended) return false;
		if (this.draftError || !this.canPlay) {
			this.rejects++;
			return false;
		}
		if (this.remote) {
			this.remote.play($state.snapshot(this.draft));
			return true;
		}
		this.moves = [...this.moves, { player: this.current, kind: 'play', tiles: this.draft }];
		this.resetDraft();
		this.save();
		return true;
	}

	// Pass or swap: the turn ends with no points.
	pass(kind: 'pass' | 'swap' = 'pass') {
		if (this.ended || !this.canPlay) return;
		if (this.remote) return this.remote.pass(kind);
		this.moves = [...this.moves, { player: this.current, kind, tiles: [] }];
		this.resetDraft();
		this.save();
	}

	undo() {
		if (this.end) {
			this.end = null;
		} else {
			this.moves = this.moves.slice(0, -1);
		}
		this.resetDraft();
		this.save();
	}

	// Takes back the last move and puts its tiles in the draft to fix.
	editLast() {
		const last = this.moves.at(-1);
		if (!last || this.ended) return;
		this.moves = this.moves.slice(0, -1);
		this.resetDraft();
		this.draft = last.tiles;
		const first = last.tiles[0];
		if (first) this.cursor = { row: first.row, col: first.col };
		this.save();
	}

	finish(end: EndState) {
		this.end = end;
		this.resetDraft();
		this.save();
	}

	resetDraft() {
		this.draft = [];
		this.cursor = null;
		this.blankNext = false;
	}

	private save() {
		if (!this.persist) return;
		const data: SaveData = {
			version: 1,
			players: $state.snapshot(this.players),
			colors: $state.snapshot(this.colors),
			turnMinutes: this.turnMinutes,
			moves: $state.snapshot(this.moves),
			end: $state.snapshot(this.end)
		};
		storage.save(data);
	}
}
