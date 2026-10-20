import { PLAYER_COLORS } from '../players';
import { SIZE } from './constants';
import {
	emptyBoard,
	endGameAdjust,
	overusedLetters,
	scoreMove,
	validatePlacement,
	withTiles,
	type Board,
	type MoveScore,
	type PlacedTile
} from './rules';
import * as storage from './storage';
import { isWord, loadWords } from './words';
import type { EndState, Move, SaveData } from './storage';

export type Direction = 'across' | 'down';
export type HistoryEntry = { player: number; kind: Move['kind']; score: MoveScore | null };

export class Game {
	// Players in turn order.
	players = $state<string[]>([]);
	colors = $state<number[]>([]);
	moves = $state<Move[]>([]);
	end = $state<EndState | null>(null);

	draft = $state<PlacedTile[]>([]);
	cursor = $state<{ row: number; col: number } | null>(null);
	direction = $state<Direction>('across');
	blankNext = $state(false);

	// null until the word list loads (or if it fails), which turns checking off.
	words = $state.raw<Set<string> | null>(null);

	private persist: boolean;

	constructor(persist = true) {
		this.persist = persist;
		const saved = persist ? storage.load() : null;
		if (saved) {
			this.players = saved.players;
			this.colors = saved.colors ?? saved.players.map((_, i) => i);
			this.moves = saved.moves;
			this.end = saved.end;
		}
		if (persist) loadWords().then((w) => (this.words = w));
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

	unknownIn(score: MoveScore | null): string[] {
		const words = this.words;
		if (!words || !score) return [];
		return score.words.map((w) => w.text).filter((t) => !isWord(words, t));
	}

	// Names must already be in turn order; colors default to seat order.
	start(names: string[], colors = names.map((_, i) => i)) {
		this.players = names;
		this.colors = colors;
		this.moves = [];
		this.end = null;
		this.resetDraft();
		this.save();
	}

	newGame() {
		this.players = [];
		this.colors = [];
		this.moves = [];
		this.end = null;
		this.resetDraft();
		if (this.persist) storage.clear();
	}

	color(player: number) {
		return PLAYER_COLORS[this.colors[player] ?? player];
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
		if (!this.cursor || this.ended) return;
		let { row, col } = this.cursor;
		// Skip squares that already hold a played tile.
		while (row < SIZE && col < SIZE && this.board[row][col]) ({ row, col } = this.step(row, col));
		if (row >= SIZE || col >= SIZE) return;

		const tile = { row, col, letter: letter.toUpperCase(), blank: this.blankNext };
		this.draft = [...this.draft.filter((t) => t.row !== row || t.col !== col), tile];
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
		if (!this.draft.length || this.draftError || this.ended) return false;
		this.moves = [...this.moves, { player: this.current, kind: 'play', tiles: this.draft }];
		this.resetDraft();
		this.save();
		return true;
	}

	// Pass or swap: the turn ends with no points.
	pass(kind: 'pass' | 'swap' = 'pass') {
		if (this.ended) return;
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

	private resetDraft() {
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
			moves: $state.snapshot(this.moves),
			end: $state.snapshot(this.end)
		};
		storage.save(data);
	}
}
