<script lang="ts">
	let { onstart }: { onstart: (names: string[]) => void } = $props();

	let names = $state(['', '']);

	function submit(e: SubmitEvent) {
		e.preventDefault();
		onstart(names.map((n, i) => n.trim() || `Player ${i + 1}`));
	}
</script>

<form
	onsubmit={submit}
	class="mx-auto flex w-full max-w-sm flex-col gap-3 rounded-xl bg-white p-5 shadow"
>
	<h2 class="text-lg font-semibold">New game</h2>
	{#each { length: names.length }, i (i)}
		<div class="flex gap-2">
			<input
				bind:value={names[i]}
				placeholder={`Player ${i + 1}`}
				aria-label={`Player ${i + 1} name`}
				class="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2"
			/>
			{#if names.length > 2}
				<button
					type="button"
					onclick={() => names.splice(i, 1)}
					class="rounded-lg px-3 text-stone-500 hover:bg-stone-100"
					aria-label={`Remove player ${i + 1}`}>✕</button
				>
			{/if}
		</div>
	{/each}
	{#if names.length < 4}
		<button
			type="button"
			onclick={() => names.push('')}
			class="rounded-lg border border-dashed border-stone-300 py-2 text-stone-600 hover:bg-stone-50"
			>+ Add player</button
		>
	{/if}
	<button
		type="submit"
		class="rounded-lg bg-emerald-600 py-2 font-semibold text-white hover:bg-emerald-700"
		>Start game</button
	>
</form>
