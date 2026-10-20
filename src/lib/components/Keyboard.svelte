<script lang="ts">
	import type { Game } from '#lib/scrabble/game.svelte.ts';

	let { game }: { game: Game } = $props();

	const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
	const key =
		'flex h-11 flex-1 items-center justify-center rounded-md bg-white font-semibold shadow-sm active:bg-stone-200 disabled:opacity-40';
</script>

<div class="flex flex-col gap-1.5">
	{#each rows as row, i (row)}
		<div class="flex gap-1">
			{#if i === 2}
				<button
					type="button"
					class={[key, 'flex-[1.5] text-xs', game.blankNext && 'bg-amber-300!']}
					onclick={() => game.toggleBlank()}
					aria-pressed={game.blankNext}>Blank</button
				>
			{/if}
			{#each row as letter (letter)}
				<button
					type="button"
					class={key}
					disabled={!game.cursor}
					onclick={() => game.placeLetter(letter)}>{letter}</button
				>
			{/each}
			{#if i === 2}
				<button
					type="button"
					class={[key, 'flex-[1.5]']}
					onclick={() => game.backspace()}
					aria-label="Backspace">⌫</button
				>
			{/if}
		</div>
	{/each}
	<div class="mt-1 flex gap-1">
		<button type="button" class={[key, 'text-sm']} onclick={() => game.toggleDirection()}
			>{game.direction === 'across' ? '→ Across' : '↓ Down'}</button
		>
		<button
			type="button"
			class={[key, 'text-sm']}
			onclick={() => game.clearDraft()}
			disabled={!game.draft.length}>Clear</button
		>
		<button type="button" class={[key, 'text-sm']} onclick={() => game.pass()}>Pass / Swap</button>
		<button
			type="button"
			class={[key, 'bg-emerald-600! text-sm text-white']}
			onclick={() => game.submit()}
			disabled={!game.draftScore}>Submit</button
		>
	</div>
</div>
