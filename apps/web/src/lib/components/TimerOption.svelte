<script lang="ts" module>
	export const MIN = 2;
	export const MAX = 10;

	// The minutes to send, or null with the timer off.
	export const turnMinutes = (enabled: boolean, minutes: number) =>
		enabled ? Math.min(MAX, Math.max(MIN, minutes)) : null;
</script>

<script lang="ts">
	import Timer from '@lucide/svelte/icons/timer';

	let {
		enabled = $bindable(false),
		minutes = $bindable(MIN)
	}: { enabled?: boolean; minutes?: number } = $props();
</script>

<div class="mt-1 flex flex-col gap-3 border-t-2 border-cream-edge pt-3">
	<label class="flex cursor-pointer items-center gap-2 font-medium">
		<Timer size={18} />
		<span class="flex-1">Turn timer</span>
		<input type="checkbox" role="switch" bind:checked={enabled} class="peer sr-only" />
		<span
			class="relative h-7 w-12 rounded-full bg-cream-edge transition-colors peer-checked:bg-green-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-green-600 after:absolute after:top-1 after:left-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
			aria-hidden="true"
		></span>
	</label>
	{#if enabled}
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
