<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Play from '@lucide/svelte/icons/play';
	import Shuffle from '@lucide/svelte/icons/shuffle';
	import { flip } from 'svelte/animate';
	import { PLAYER_COLORS, initial, shuffle, type Seat } from '#lib/players.ts';

	let {
		seats,
		onstart,
		onshuffle,
		onback
	}: { seats: Seat[]; onstart: () => void; onshuffle: () => void; onback: () => void } = $props();

	const DURATION = 3000;
	const place = ['1st', '2nd', '3rd', '4th'];

	// Start from setup order so the final order isn't shown before the shuffle.
	// svelte-ignore state_referenced_locally
	let shown = $state([...seats].sort((a, b) => a.color - b.color));
	let shuffling = $state(false);
	let step = $state(150);

	// Swap times: fast at first, slowing down until the 3 s mark.
	function schedule(): number[] {
		const times: number[] = [];
		let gap = 90;
		for (let t = gap; t < DURATION - 250; t += gap) {
			times.push(t);
			gap *= 1.12;
		}
		return times;
	}

	// Each new final order (Play! or Shuffle again) plays the animation, then lands on it.
	$effect(() => {
		const final = seats;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
			shown = final;
			shuffling = false;
			return;
		}
		shuffling = true;
		let last = 0;
		const timers = schedule().map((t) => {
			const gap = t - last;
			last = t;
			return setTimeout(() => {
				step = Math.min(gap, 300);
				shown = shuffle(final);
			}, t);
		});
		timers.push(
			setTimeout(() => {
				step = 300;
				shown = final;
				shuffling = false;
			}, DURATION)
		);
		return () => timers.forEach(clearTimeout);
	});
</script>

<div class="flex w-full max-w-sm flex-col gap-3 panel p-5">
	<h2 class="text-center text-xl font-bold">
		{#if shuffling}
			<span class="inline-flex items-center gap-2"
				><Shuffle size={20} class="animate-spin [animation-duration:1.2s]" /> Shuffling…</span
			>
		{:else}
			Turn order
		{/if}
	</h2>
	<ol class="flex flex-col gap-2">
		{#each shown as seat, i (seat.color)}
			{@const color = PLAYER_COLORS[seat.color]}
			<!-- flip moves the li; the wobble sits on the inner div so the two don't clash. -->
			<li animate:flip={{ duration: step }}>
				<div
					class={[
						'relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-white',
						shuffling && (i % 2 ? 'animate-wobble-r' : 'animate-wobble-l')
					]}
					style={`background: ${color.bg}; box-shadow: 0 4px 0 ${color.edge}`}
				>
					{#if shuffling}
						<span class="w-10 text-center text-lg font-bold opacity-80">?</span>
					{:else}
						<span class="w-10 animate-pop text-lg font-bold opacity-80">{place[i]}</span>
					{/if}
					<span
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
						style={`background: ${color.edge}`}>{initial(seat.name)}</span
					>
					<span class="min-w-0 flex-1 truncate text-lg font-medium">{seat.name}</span>
					{#if i === 0 && !shuffling}
						<span
							class="animate-pop rounded-full bg-yellow-300 px-2 text-[10px] font-bold tracking-wide text-yellow-900 uppercase"
							>Starts</span
						>
					{/if}
				</div>
			</li>
		{/each}
	</ol>
	<div class="mt-2 flex gap-2">
		<button
			type="button"
			class="btn-3d h-12 w-12 shrink-0 btn-white"
			onclick={onback}
			aria-label="Back"><ArrowLeft size={20} /></button
		>
		<button
			type="button"
			class="btn-3d h-12 flex-1 btn-white"
			onclick={onshuffle}
			disabled={shuffling}><Shuffle size={18} /> Shuffle again</button
		>
	</div>
	<button type="button" class="btn-3d h-12 text-lg btn-green" onclick={onstart} disabled={shuffling}
		><Play size={18} class="fill-current" /> Start game</button
	>
</div>
