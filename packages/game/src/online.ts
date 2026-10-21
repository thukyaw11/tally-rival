import type { PlacedTile } from './rules';

// Shapes shared by the online server and web client.
export type RoomStatus = 'lobby' | 'playing' | 'ended';
export type MoveKind = 'play' | 'pass' | 'swap';

// seat is the turn order, set when the game starts (null in the lobby).
export type OnlinePlayer = { id: string; name: string; color: number; seat: number | null };
// player is a seat index.
export type OnlineMove = { player: number; kind: MoveKind; tiles: PlacedTile[]; score: number };
// Same shape as the tracker's EndState; leftovers use '?' for a blank.
export type OnlineEnd = { wentOut: number | null; leftovers: string[] };

// What everyone in the room may see. players are in seat order once the game starts.
export type RoomState = {
	code: string;
	status: RoomStatus;
	hostId: string;
	turnMinutes: number | null;
	players: OnlinePlayer[];
	moves: OnlineMove[];
	bagCount: number;
	rackCounts: number[];
	turnStartedAt: string | null;
	end: OnlineEnd | null;
};

// One player's view: the public state plus their own rack.
export type PlayerView = RoomState & { you: string; rack: string[] };

export type MoveRequest =
	{ kind: 'play'; tiles: PlacedTile[] } | { kind: 'pass' } | { kind: 'swap'; letters: string[] };

export const MAX_PLAYERS = 4;
// Six scoreless turns in a row end the game.
export const SCORELESS_LIMIT = 6;
