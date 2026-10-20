<script lang="ts">
	import type { Game } from '#lib/scrabble/game.svelte.ts';

	let { game }: { game: Game } = $props();
</script>

<div class="flex flex-col gap-2">
	<ul class="grid grid-cols-2 gap-2">
		{#each game.players as name, i (i)}
			<li
				class={[
					'flex items-center justify-between rounded-lg px-3 py-2',
					!game.ended && game.current === i
						? 'bg-emerald-600 text-white shadow'
						: 'bg-white text-stone-800'
				]}
			>
				<span class="truncate">{name}</span>
				<span class="text-lg font-bold tabular-nums">{game.scores[i]}</span>
			</li>
		{/each}
	</ul>

	{#if !game.ended}
		<div class="min-h-14 rounded-lg bg-white px-3 py-2 text-sm">
			{#if game.draftError}
				<p class="text-red-600">{game.draftError}</p>
			{:else if game.draftScore}
				<p>
					{#each game.draftScore.words as w, i (i)}
						<span class={['mr-2 font-mono', game.unknownWords.includes(w.text) && 'text-amber-600']}
							>{w.text} <b>{w.score}</b></span
						>
					{/each}
					{#if game.draftScore.bingo}<span class="mr-2 text-amber-600">Bingo +50</span>{/if}
				</p>
				<p class="font-semibold">Total: {game.draftScore.total}</p>
				{#if game.unknownWords.length}
					<p class="text-amber-600">
						Not in word list: {game.unknownWords.join(', ')} (you can still submit)
					</p>
				{/if}
			{:else if game.cursor}
				<p class="text-stone-500">Type letters. Tap the same square again to switch across/down.</p>
			{:else}
				<p class="text-stone-500">
					{game.players[game.current]}'s turn — tap a square to start a word.
				</p>
			{/if}
			{#if game.overused.length}
				<p class="text-amber-600">More tiles than the bag has: {game.overused.join(', ')}</p>
			{/if}
		</div>
	{/if}
</div>
