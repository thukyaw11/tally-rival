import { PLAYER_COLORS, shuffle } from '../players';
import {
	SIZE,
	emptyBoard,
	mainWordCells,
	endGameAdjust,
	overusedLetters,
	rackLetter,
	takeFromRack,
	scoreMove,
	validatePlacement,
	withTiles,
	type Board,
	type MoveScore,
	type PlacedTile,
	type WordList
} from '@tally/game';
import * as storage from './storage';
import { isWord, loadWords } from './words';
import type { EndState, Move, SaveData } from './storage';

export type Direction = 'across' | 'down';
export type HistoryEntry = { player: number; kind: Move['kind']; score: MoveScore | null };
// The most recent word played: seq is its move index, cells its main word's squares.
export type LastPlay = {
	seq: number;
	player: number;
	cells: { row: number; col: number }[];
	placed: PlacedTile[];
	total: number;
};
// A rack tile shown to the player; slot is its place in the player's arrangement.
export type RackTile = { letter: string; slot: number };

// Keeps the player's order for letters still on the rack and adds new ones at the end.
export function arrangeRack(order: string[], rack: string[]): string[] {
	const left = [...rack];
	const kept: string[] = [];
	for (const letter of order) {
		const i = left.indexOf(letter);
		if (i < 0) continue;
		kept.push(letter);
		left.splice(i, 1);
	}
	return [...kept, ...left];
}

// Online play: the server owns the moves, so submit and pass are sent to it instead.
export type Remote = { play(tiles: PlacedTile[]): void; pass(kind: 'pass' | 'swap'): void };

export class Game {
	// Players in turn order.
	players = $state<string[]>([]);
	colors = $state<number[]>([]);
	avatars = $state<(number | null)[]>([]);
	// Minutes per turn, or null for no timer.
	turnMinutes = $state<number | null>(null);
	wordList = $state<WordList>('common');
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
	// The player's own order for their rack (never sent to the server).
	rackOrder = $state<string[]>([]);
	canPlay = $state(true);
	// Online: words missing from the list block the move (the tracker only warns).
	strictWords = $state(false);
	// Goes up each time a submit is refused, so the page can react (e.g. a sound).
	rejects = $state(0);

	private persist: boolean;
	private checkWords: boolean;

	constructor(persist = true, checkWords = persist) {
		this.persist = persist;
		this.checkWords = checkWords;
		const saved = persist ? storage.load() : null;
		if (saved) {
			this.players = saved.players;
			this.colors = saved.colors ?? saved.players.map((_, i) => i);
			this.avatars = saved.avatars ?? [];
			this.turnMinutes = saved.turnMinutes ?? null;
			this.moves = saved.moves;
			this.end = saved.end;
		}
		this.useWordList(saved ? (saved.wordList ?? 'tournament') : 'common');
	}

	// Switches the list moves are checked against and loads it.
	useWordList(list: WordList) {
		if (list === this.wordList && this.words) return;
		this.wordList = list;
		this.words = null;
		if (!this.checkWords) return;
		loadWords(list).then((w) => {
			if (this.wordList === list) this.words = w;
		});
	}

	// Replays every move to rebuild the board and each turn's score.
	replay = $derived.by(() => {
		let board = emptyBoard();
		const history: HistoryEntry[] = [];
		let lastPlay: LastPlay | null = null;
		for (const [seq, m] of this.moves.entries()) {
			const score = m.kind === 'play' ? scoreMove(board, m.tiles) : null;
			if (m.kind === 'play') {
				const cells = mainWordCells(board, m.tiles);
				lastPlay = { seq, player: m.player, cells, placed: m.tiles, total: score!.total };
				board = withTiles(board, m.tiles);
			}
			history.push({ player: m.player, kind: m.kind, score });
		}
		return { board, history, lastPlay };
	});

	board: Board = $derived(this.replay.board);
	history: HistoryEntry[] = $derived(this.replay.history);
	lastPlay: LastPlay | null = $derived(this.replay.lastPlay);

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
	canSubmit: boolean = $derived(
		!!this.draftScore && !(this.strictWords && this.unknownWords.length)
	);

	overused: string[] = $derived(overusedLetters(withTiles(this.board, this.draft)));

	// Rack tiles not yet in the draft.
	arrangedRack: string[] = $derived(arrangeRack(this.rackOrder, this.rack ?? []));
	rackLeft: RackTile[] | null = $derived.by(() => {
		if (!this.rack) return null;
		const used = this.draft.map(rackLetter);
		const left: RackTile[] = [];
		this.arrangedRack.forEach((letter, slot) => {
			const i = used.indexOf(letter);
			if (i >= 0) used.splice(i, 1);
			else left.push({ letter, slot });
		});
		return left;
	});

	unknownIn(score: MoveScore | null): string[] {
		const words = this.words;
		if (!words || !score) return [];
		return score.words.map((w) => w.text).filter((t) => !isWord(words, t));
	}

	// Names must already be in turn order; colors default to seat order.
	start(
		names: string[],
		colors = names.map((_, i) => i),
		turnMinutes: number | null = null,
		avatars: (number | null)[] = [],
		wordList: WordList = 'common'
	) {
		this.players = names;
		this.colors = colors;
		this.avatars = avatars;
		this.turnMinutes = turnMinutes;
		this.useWordList(wordList);
		this.moves = [];
		this.end = null;
		this.resetDraft();
		this.save();
	}

	newGame() {
		this.players = [];
		this.colors = [];
		this.avatars = [];
		this.turnMinutes = null;
		this.moves = [];
		this.end = null;
		this.resetDraft();
		if (this.persist) storage.clear();
	}

	color(player: number) {
		return PLAYER_COLORS[this.colors[player] ?? player];
	}

	avatar(player: number): number | null {
		return this.avatars[player] ?? null;
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

		if (!this.putTile(row, col, letter, this.blankNext)) return;
		this.blankNext = false;

		const next = this.step(row, col);
		this.cursor = next.row < SIZE && next.col < SIZE ? next : { row, col };
	}

	// Puts a draft tile on a square, replacing any draft tile there. Online, only rack letters
	// are allowed, falling back to a blank when the letter is missing.
	private putTile(row: number, col: number, letter: string, blank: boolean): boolean {
		const rest = this.draft.filter((t) => t.row !== row || t.col !== col);
		const tile = { row, col, letter: letter.toUpperCase(), blank };
		if (this.rack) {
			const left = takeFromRack(this.rack, rest.map(rackLetter)) ?? [];
			if (!left.includes(rackLetter(tile))) {
				if (tile.blank || !left.includes('?')) return false;
				tile.blank = true;
			}
		}
		this.draft = [...rest, tile];
		return true;
	}

	// Drag and drop (online): place, move and take back draft tiles.
	placeAt(row: number, col: number, letter: string, blank = false): boolean {
		if (this.ended || !this.canPlay || this.board[row]?.[col] !== null) return false;
		return this.putTile(row, col, letter, blank);
	}

	moveDraft(from: { row: number; col: number }, to: { row: number; col: number }): boolean {
		if (this.ended || !this.canPlay || this.board[to.row]?.[to.col] !== null) return false;
		const moving = this.draftAt(from.row, from.col);
		if (!moving) return false;
		const other = this.draftAt(to.row, to.col);
		// Dropping onto another draft tile swaps the two.
		this.draft = this.draft.map((t) =>
			t === moving ? { ...t, ...to } : t === other ? { ...t, ...from } : t
		);
		return true;
	}

	removeDraftAt(row: number, col: number) {
		if (this.ended || !this.canPlay) return;
		this.draft = this.draft.filter((t) => t.row !== row || t.col !== col);
	}

	// from and to are slots in arrangedRack.
	moveRackTile(from: number, to: number) {
		const order = [...this.arrangedRack];
		const [tile] = order.splice(from, 1);
		if (tile === undefined) return;
		order.splice(to, 0, tile);
		this.rackOrder = order;
	}

	shuffleRack(random = Math.random) {
		this.rackOrder = shuffle(this.arrangedRack, random);
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
		if (this.draftError || !this.canPlay || !this.canSubmit) {
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
			avatars: $state.snapshot(this.avatars),
			turnMinutes: this.turnMinutes,
			wordList: this.wordList,
			moves: $state.snapshot(this.moves),
			end: $state.snapshot(this.end)
		};
		storage.save(data);
	}
}
