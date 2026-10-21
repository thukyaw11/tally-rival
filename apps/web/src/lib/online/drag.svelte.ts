import type { Game } from '#lib/scrabble/game.svelte.ts';

type Square = { row: number; col: number };
// Where a drag started: a rack slot or a draft tile on the board.
export type DragFrom = { slot: number } | Square;
// What is under the pointer: a board square, a rack slot, the rack itself, or nothing.
export type DropTarget = { cell: Square } | { slot: number } | { rack: true } | null;

type Drag = { letter: string; blank: boolean; from: DragFrom; x: number; y: number };

// Moves before a press turns into a drag, so a tap stays a tap.
const THRESHOLD = 6;

export function targetAt(x: number, y: number): DropTarget {
	const el = document
		.elementFromPoint(x, y)
		?.closest<HTMLElement>('[data-cell], [data-rack-slot], [data-rack]');
	if (!el) return null;
	if (el.dataset.cell !== undefined)
		return { cell: { row: Number(el.dataset.row), col: Number(el.dataset.col) } };
	if (el.dataset.rackSlot !== undefined) return { slot: Number(el.dataset.rackSlot) };
	return { rack: true };
}

// Pointer-event drag and drop (works for mouse and touch) for the online rack and board.
export class TileDrag {
	drag = $state<Drag | null>(null);
	over = $state<DropTarget>(null);

	private readonly game: Game;
	// Asks which letter a dropped blank stands for; null cancels.
	private readonly askBlank: () => Promise<string | null>;
	private swallowClick = false;

	constructor(game: Game, askBlank: () => Promise<string | null>) {
		this.game = game;
		this.askBlank = askBlank;
	}

	// The square under a drag, for highlighting.
	isOver(row: number, col: number) {
		const o = this.over;
		return !!this.drag && !!o && 'cell' in o && o.cell.row === row && o.cell.col === col;
	}

	isDragging(from: DragFrom) {
		const f = this.drag?.from;
		if (!f) return false;
		return 'slot' in f && 'slot' in from
			? f.slot === from.slot
			: 'row' in f && 'row' in from && f.row === from.row && f.col === from.col;
	}

	// Call from onpointerdown on a rack tile or draft tile.
	start(e: PointerEvent, letter: string, blank: boolean, from: DragFrom) {
		if (!this.game.canPlay || e.button !== 0) return;
		const el = e.currentTarget as HTMLElement;
		const startX = e.clientX;
		const startY = e.clientY;
		let moved = false;

		const move = (ev: PointerEvent) => {
			if (!moved) {
				if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < THRESHOLD) return;
				moved = true;
				el.setPointerCapture?.(ev.pointerId);
			}
			this.drag = { letter, blank, from, x: ev.clientX, y: ev.clientY };
			this.over = targetAt(ev.clientX, ev.clientY);
		};
		const end = (ev: PointerEvent) => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', end);
			window.removeEventListener('pointercancel', cancel);
			if (!moved) return;
			// The click that follows a drag must not also act as a tap.
			this.swallowClick = true;
			setTimeout(() => (this.swallowClick = false), 0);
			const target = targetAt(ev.clientX, ev.clientY);
			this.drag = null;
			this.over = null;
			this.drop(letter, blank, from, target);
		};
		const cancel = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', end);
			window.removeEventListener('pointercancel', cancel);
			this.drag = null;
			this.over = null;
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', end);
		window.addEventListener('pointercancel', cancel);
	}

	// Use as onclickcapture on tiles: true means "ignore this click, it ended a drag".
	consumeClick(e: MouseEvent) {
		if (!this.swallowClick) return false;
		e.stopPropagation();
		e.preventDefault();
		return true;
	}

	async drop(letter: string, blank: boolean, from: DragFrom, target: DropTarget) {
		const g = this.game;
		if ('slot' in from) {
			if (target && 'cell' in target) {
				const { row, col } = target.cell;
				if (blank) {
					const chosen = await this.askBlank();
					if (chosen) g.placeAt(row, col, chosen, true);
				} else {
					g.placeAt(row, col, letter, false);
				}
			} else if (target && 'slot' in target) {
				g.moveRackTile(from.slot, target.slot);
			}
			return;
		}
		if (target && 'cell' in target) g.moveDraft(from, target.cell);
		// Dropped on the rack or off the board: take it back.
		else g.removeDraftAt(from.row, from.col);
	}
}
