import { BLANK_COUNT, TILE_COUNTS } from './constants';
import type { PlacedTile } from './rules';

// Racks and the bag hold letters A–Z and '?' for a blank.
export const RACK_SIZE = 7;

export function fullBag(): string[] {
	const bag = Object.entries(TILE_COUNTS).flatMap(([letter, n]) => Array(n).fill(letter));
	return [...bag, ...Array(BLANK_COUNT).fill('?')];
}

// Takes up to n random tiles; returns the drawn tiles and what is left in the bag.
export function drawTiles(bag: string[], n: number, random = Math.random) {
	const left = [...bag];
	const drawn: string[] = [];
	while (drawn.length < n && left.length) {
		drawn.push(left.splice(Math.floor(random() * left.length), 1)[0]);
	}
	return { drawn, bag: left };
}

// The rack letter a placed tile came from.
export const rackLetter = (t: PlacedTile) => (t.blank ? '?' : t.letter);

// Removes letters from the rack; null if the rack doesn't hold them all.
export function takeFromRack(rack: string[], letters: string[]): string[] | null {
	const left = [...rack];
	for (const l of letters) {
		const i = left.indexOf(l);
		if (i < 0) return null;
		left.splice(i, 1);
	}
	return left;
}

export type SwapResult = { error: string } | { error?: undefined; rack: string[]; bag: string[] };

// Puts letters back and draws the same number; only allowed with a full rack's worth in the bag.
export function swapTiles(
	rack: string[],
	bag: string[],
	letters: string[],
	random = Math.random
): SwapResult {
	if (!letters.length) return { error: 'Pick tiles to swap' };
	if (bag.length < RACK_SIZE) return { error: 'Not enough tiles in the bag to swap' };
	const kept = takeFromRack(rack, letters);
	if (!kept) return { error: 'Those tiles are not on your rack' };
	const draw = drawTiles(bag, letters.length, random);
	return { rack: [...kept, ...draw.drawn], bag: [...draw.bag, ...letters] };
}
