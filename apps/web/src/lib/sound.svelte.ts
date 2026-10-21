import { asset } from '$app/paths';
import type { Game } from '#lib/scrabble/game.svelte.ts';

// Game sounds: most are made with the Web Audio API; a few are recorded files (see FILES).
export type SoundName =
	| 'place'
	| 'remove'
	| 'score'
	| 'bingo'
	| 'pass'
	| 'swap'
	| 'turn'
	| 'tick'
	| 'buzzer'
	| 'join'
	| 'error'
	| 'win'
	| 'message';

const MUTED_KEY = 'tally:muted';

// Recorded sounds in static/sounds; until they load (or if they fail) the made-up version plays.
const FILES: Partial<Record<SoundName, string>> = {
	buzzer: asset('sounds/timeup.mp3'),
	win: asset('sounds/complete.mp3')
};
// The files are full volume; the made-up sounds are mixed lower.
const FILE_GAIN = 2;

type ToneOptions = { type?: OscillatorType; gain?: number; endFreq?: number };
type NoiseOptions = { gain?: number; freq?: number; endFreq?: number; filter?: BiquadFilterType };

export class Sound {
	muted = $state(false);

	private ctx: AudioContext | null = null;
	private master: GainNode | null = null;
	private noise: AudioBuffer | null = null;
	private buffers: Partial<Record<SoundName, AudioBuffer>> = {};
	private playing: Partial<Record<SoundName, AudioBufferSourceNode>> = {};

	constructor() {
		try {
			this.muted = localStorage.getItem(MUTED_KEY) === '1';
		} catch {
			// No storage: keep sound on.
		}
		if (typeof window === 'undefined') return;
		// Browsers only allow audio after the player touches the page.
		const unlock = () => this.unlock();
		window.addEventListener('pointerdown', unlock, { capture: true });
		window.addEventListener('keydown', unlock, { capture: true });
	}

	private unlock() {
		if (!this.ctx) {
			const Ctx =
				window.AudioContext ??
				(window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
			if (!Ctx) return;
			this.ctx = new Ctx();
			this.master = this.ctx.createGain();
			this.master.gain.value = 0.4;
			this.master.connect(this.ctx.destination);
			this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate / 2, this.ctx.sampleRate);
			const data = this.noise.getChannelData(0);
			for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
			this.loadFiles(this.ctx);
		}
		if (this.ctx.state === 'suspended') this.ctx.resume();
	}

	private loadFiles(ctx: AudioContext) {
		for (const [name, url] of Object.entries(FILES) as [SoundName, string][]) {
			fetch(url)
				.then((res) => res.arrayBuffer())
				.then((data) => ctx.decodeAudioData(data))
				.then((buffer) => (this.buffers[name] = buffer))
				.catch(() => {
					// Keep the made-up sound.
				});
		}
	}

	// Whether a recorded file is ready for this sound.
	hasFile(name: SoundName) {
		return !!this.buffers[name];
	}

	toggle() {
		this.muted = !this.muted;
		try {
			localStorage.setItem(MUTED_KEY, this.muted ? '1' : '0');
		} catch {
			// The choice lasts until the page closes.
		}
	}

	// Returns whether anything was played.
	play(name: SoundName): boolean {
		const ctx = this.ctx;
		if (this.muted || !ctx || ctx.state !== 'running') return false;
		const buffer = this.buffers[name];
		if (!buffer) {
			RECIPES[name](this, ctx.currentTime);
			return true;
		}
		this.stop(name);
		const src = ctx.createBufferSource();
		const gain = ctx.createGain();
		src.buffer = buffer;
		gain.gain.value = FILE_GAIN;
		src.connect(gain).connect(this.master!);
		src.onended = () => this.playing[name] === src && delete this.playing[name];
		src.start();
		this.playing[name] = src;
		return true;
	}

	// Stops a recorded sound that is still playing (e.g. the 4 s time-up sound once the turn moves on).
	stop(name: SoundName) {
		this.playing[name]?.stop();
		delete this.playing[name];
	}

	tone(
		freq: number,
		start: number,
		dur: number,
		{ type = 'sine', gain = 0.5, endFreq }: ToneOptions = {}
	) {
		const ctx = this.ctx!;
		const osc = ctx.createOscillator();
		const g = ctx.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(freq, start);
		if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
		this.envelope(g, start, dur, gain);
		osc.connect(g).connect(this.master!);
		osc.start(start);
		osc.stop(start + dur + 0.02);
	}

	burst(
		start: number,
		dur: number,
		{ gain = 0.5, freq = 2000, endFreq, filter = 'bandpass' }: NoiseOptions = {}
	) {
		const ctx = this.ctx!;
		const src = ctx.createBufferSource();
		const f = ctx.createBiquadFilter();
		const g = ctx.createGain();
		src.buffer = this.noise;
		f.type = filter;
		f.frequency.setValueAtTime(freq, start);
		if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
		this.envelope(g, start, dur, gain);
		src.connect(f).connect(g).connect(this.master!);
		src.start(start);
		src.stop(start + dur + 0.02);
	}

	// Quick fade in, then fade out by the end.
	private envelope(g: GainNode, start: number, dur: number, peak: number) {
		g.gain.setValueAtTime(0.0001, start);
		g.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.01, dur / 4));
		g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
	}
}

const notes = (s: Sound, t: number, freqs: number[], step: number, last = 0.4) =>
	freqs.forEach((f, i) =>
		s.tone(f, t + i * step, i === freqs.length - 1 ? last : step * 1.6, {
			type: 'triangle',
			gain: 0.35
		})
	);

const RECIPES: Record<SoundName, (s: Sound, t: number) => void> = {
	place: (s, t) => {
		s.burst(t, 0.04, { gain: 0.6, freq: 2500 });
		s.tone(190, t, 0.07, { gain: 0.5, endFreq: 120 });
	},
	remove: (s, t) => {
		s.burst(t, 0.03, { gain: 0.25, freq: 3500 });
		s.tone(280, t, 0.04, { gain: 0.2, endFreq: 210 });
	},
	score: (s, t) => notes(s, t, [660, 990], 0.09, 0.3),
	bingo: (s, t) => {
		notes(s, t, [523, 659, 784, 1047], 0.09, 0.5);
		s.tone(1568, t + 0.36, 0.6, { gain: 0.15 });
	},
	pass: (s, t) => s.burst(t, 0.28, { gain: 0.35, freq: 400, endFreq: 2600 }),
	swap: (s, t) => {
		s.burst(t, 0.18, { gain: 0.3, freq: 500, endFreq: 2400 });
		s.burst(t + 0.16, 0.18, { gain: 0.3, freq: 2400, endFreq: 500 });
	},
	turn: (s, t) => {
		s.tone(880, t, 0.16, { gain: 0.35 });
		s.tone(1320, t + 0.12, 0.35, { gain: 0.35 });
	},
	tick: (s, t) => s.tone(1600, t, 0.03, { type: 'square', gain: 0.1 }),
	buzzer: (s, t) => {
		s.tone(150, t, 0.45, { type: 'sawtooth', gain: 0.25 });
		s.tone(156, t, 0.45, { type: 'square', gain: 0.12 });
	},
	join: (s, t) => s.tone(420, t, 0.14, { gain: 0.4, endFreq: 900 }),
	error: (s, t) => {
		s.tone(140, t, 0.22, { type: 'triangle', gain: 0.55, endFreq: 80 });
		s.burst(t, 0.06, { gain: 0.3, freq: 300, filter: 'lowpass' });
	},
	win: (s, t) => notes(s, t, [523, 659, 784, 659, 784, 1047], 0.12, 0.7),
	message: (s, t) => {
		s.tone(740, t, 0.08, { gain: 0.25 });
		s.tone(988, t + 0.07, 0.12, { gain: 0.25 });
	}
};

export const sound = new Sound();

// What the game looked like last time, to tell which sound a change needs.
export type Snapshot = {
	moves: number;
	last: { kind: 'play' | 'pass' | 'swap'; bingo: boolean } | null;
	draft: string;
	draftCount: number;
	ended: boolean;
};

export function snapshot(game: Game): Snapshot {
	const h = game.history.at(-1);
	return {
		moves: game.moves.length,
		last: h ? { kind: h.kind, bingo: !!h.score?.bingo } : null,
		draft: game.draft.map((t) => `${t.row},${t.col},${t.letter},${t.blank}`).join('|'),
		draftCount: game.draft.length,
		ended: game.ended
	};
}

// The first snapshot (prev = null) is silent, so opening a page makes no noise.
export function soundForChange(prev: Snapshot | null, next: Snapshot): SoundName | null {
	if (!prev) return null;
	if (next.ended && !prev.ended) return 'win';
	if (next.moves > prev.moves) {
		if (!next.last) return null;
		if (next.last.kind === 'play') return next.last.bingo ? 'bingo' : 'score';
		return next.last.kind;
	}
	if (next.moves < prev.moves) return 'remove';
	if (next.draftCount < prev.draftCount) return 'remove';
	if (next.draft !== prev.draft) return 'place';
	return null;
}
