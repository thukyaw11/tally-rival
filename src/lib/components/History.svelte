<script lang="ts">
	import type { Game } from '#lib/scrabble/game.svelte.ts';

	let { game }: { game: Game } = $props();
</script>

<details class="rounded-lg bg-white" open>
	<summary class="cursor-pointer px-3 py-2 font-semibold">Moves ({game.history.length})</summary>
	<div class="flex gap-2 px-3 pb-2">
		<button
			type="button"
			class="rounded-md bg-stone-100 px-3 py-1 text-sm hover:bg-stone-200 disabled:opacity-40"
			onclick={() => game.undo()}
			disabled={!game.moves.length && !game.ended}>Undo</button
		>
		<button
			type="button"
			class="rounded-md bg-stone-100 px-3 py-1 text-sm hover:bg-stone-200 disabled:opacity-40"
			onclick={() => game.editLast()}
			disabled={!game.moves.length || game.ended || game.moves.at(-1)?.kind !== 'play'}
			>Edit last</button
		>
	</div>
	<ol class="max-h-64 overflow-y-auto px-3 pb-3 text-sm">
		{#each [...game.history].reverse() as h, i (i)}
			{@const unknown = game.unknownIn(h.score)}
			<li class="flex justify-between gap-2 border-t border-stone-100 py-1">
				<span class="shrink-0 text-stone-500">{game.history.length - i}.</span>
				<span class="shrink-0">{game.players[h.player]}</span>
				<span class="flex-1 truncate font-mono">
					{#if h.score}
						{#each h.score.words as w, j (j)}
							{j ? ', ' : ''}<span class={[unknown.includes(w.text) && 'text-amber-600']}
								>{w.text}{unknown.includes(w.text) ? ' ⚠' : ''}</span
							>
						{/each}
					{:else}
						pass
					{/if}
					{h.score?.bingo ? '★' : ''}
				</span>
				<span class="font-semibold tabular-nums">{h.score?.total ?? 0}</span>
			</li>
		{/each}
	</ol>
</details>
