<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import TimerOption, { turnMinutes } from '#lib/components/TimerOption.svelte';
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
	// svelte-ignore state_referenced_locally
	let minutes = $state(initialMinutes ?? 2);

	function submit(e: SubmitEvent) {
		e.preventDefault();
		onstart(
			names.map((n, i) => n.trim() || `Player ${i + 1}`),
			turnMinutes(useTimer, minutes)
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
	<TimerOption bind:enabled={useTimer} bind:minutes />
	<button type="submit" class="mt-2 btn-3d h-12 text-lg btn-green">Play!</button>
</form>
