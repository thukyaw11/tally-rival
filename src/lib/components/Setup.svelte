<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import Timer from '@lucide/svelte/icons/timer';
	import X from '@lucide/svelte/icons/x';
	import { PLAYER_COLORS } from '#lib/players.ts';

	let {
		onstart,
		initialNames = ['', ''],
		initialMinutes = null
	}: {
		onstart: (names: string[], turnMinutes: number | null) => void;
		initialNames?: string[];
		initialMinutes?: number | null;
	} = $props();

	// svelte-ignore state_referenced_locally
	let names = $state([...initialNames]);
	// svelte-ignore state_referenced_locally
	let useTimer = $state(initialMinutes !== null);
	const MIN = 2;
	const MAX = 10;
	// svelte-ignore state_referenced_locally
	let minutes = $state(initialMinutes ?? MIN);

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const turnMinutes = useTimer ? Math.min(MAX, Math.max(MIN, minutes)) : null;
		onstart(
			names.map((n, i) => n.trim() || `Player ${i + 1}`),
			turnMinutes
		);
	}
</script>

<form onsubmit={submit} class="flex w-full max-w-sm flex-col gap-3 panel p-5">
	<h2 class="text-center text-xl font-bold">Who's playing?</h2>
	{#each { length: names.length }, i (i)}
		<div class="flex items-center gap-2">
			<span
				class="h-9 w-9 shrink-0 rounded-full shadow-[inset_0_-3px_0_rgb(0_0_0/0.2)]"
				style={`background: ${PLAYER_COLORS[i].bg}`}
			></span>
			<input
				bind:value={names[i]}
				placeholder={`Player ${i + 1}`}
				aria-label={`Player ${i + 1} name`}
				class="min-w-0 flex-1 rounded-xl border-2 border-cream-edge bg-white px-3 py-2 font-medium"
			/>
			{#if names.length > 2}
				<button
					type="button"
					onclick={() => names.splice(i, 1)}
					class="rounded-lg p-2 opacity-50 hover:bg-amber-100 hover:opacity-100"
					aria-label={`Remove player ${i + 1}`}><X size={18} /></button
				>
			{/if}
		</div>
	{/each}
	{#if names.length < 4}
		<button
			type="button"
			onclick={() => names.push('')}
			class="flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-cream-edge py-2 font-medium opacity-70 hover:bg-amber-50 hover:opacity-100"
			><Plus size={16} /> Add player</button
		>
	{/if}
	<div class="mt-1 flex flex-col gap-3 border-t-2 border-cream-edge pt-3">
		<label class="flex cursor-pointer items-center gap-2 font-medium">
			<Timer size={18} />
			<span class="flex-1">Turn timer</span>
			<input type="checkbox" role="switch" bind:checked={useTimer} class="peer sr-only" />
			<span
				class="relative h-7 w-12 rounded-full bg-cream-edge transition-colors peer-checked:bg-green-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-green-600 after:absolute after:top-1 after:left-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
				aria-hidden="true"
			></span>
		</label>
		{#if useTimer}
			<div class="flex flex-col gap-1">
				<div class="flex items-baseline justify-between text-sm">
					<span class="opacity-70">Time per turn</span>
					<span class="text-lg font-bold tabular-nums">{minutes} min</span>
				</div>
				<input
					type="range"
					bind:value={minutes}
					min={MIN}
					max={MAX}
					step="1"
					aria-label="Minutes per turn"
					class="w-full accent-green-600"
				/>
				<div class="flex justify-between text-xs opacity-50">
					<span>{MIN} min</span><span>{MAX} min</span>
				</div>
			</div>
		{/if}
	</div>
	<button type="submit" class="mt-2 btn-3d h-12 text-lg btn-green">Play!</button>
</form>
