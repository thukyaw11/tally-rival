<script lang="ts">
	import { initial } from '#lib/players.ts';
	import type { Game } from '#lib/scrabble/game.svelte.ts';

	let { game }: { game: Game } = $props();
</script>

<div class="flex flex-col gap-4">
	<ul class="grid grid-cols-2 gap-3">
		{#each game.players as name, i (i)}
			{@const color = game.color(i)}
			{@const active = !game.ended && game.current === i}
			<li
				class={[
					'relative flex items-center gap-2 rounded-2xl px-3 py-2.5 transition-colors',
					active ? 'text-white outline-3 outline-offset-2 outline-yellow-300' : 'panel'
				]}
				style={active ? `background: ${color.bg}; box-shadow: 0 4px 0 ${color.edge}` : undefined}
			>
				<span
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
					style={`background: ${active ? color.edge : color.bg}`}>{initial(name)}</span
				>
				<span class="min-w-0 flex-1 truncate font-medium">{name}</span>
				{#key game.scores[i]}
					<span class="animate-pop text-2xl font-bold tabular-nums">{game.scores[i]}</span>
				{/key}
				{#if active}
					<span
						class="absolute -top-2 left-3 rounded-full bg-yellow-300 px-2 text-[10px] font-bold tracking-wide text-yellow-900 uppercase"
						>Your turn</span
					>
				{/if}
			</li>
		{/each}
	</ul>

	{#if !game.ended && (game.draft.length || game.overused.length)}
		<div class="flex min-h-16 flex-col justify-center panel px-4 py-2.5 text-sm">
			{#if game.draftError}
				<p class="font-medium text-rose-600">{game.draftError}</p>
			{:else if game.draftScore}
				<div class="flex items-center justify-between gap-3">
					<p class="flex flex-wrap items-center gap-x-3 gap-y-1">
						{#each game.draftScore.words as w, i (i)}
							<span
								class={[
									'font-semibold tracking-wide',
									game.unknownWords.includes(w.text) && 'text-amber-600'
								]}>{w.text} <span class="opacity-60">{w.score}</span></span
							>
						{/each}
						{#if game.draftScore.bingo}
							<span class="rounded-full bg-amber-400 px-2 text-xs font-bold text-amber-950"
								>BINGO +50</span
							>
						{/if}
					</p>
					{#key game.draftScore.total}
						<span
							class="shrink-0 animate-pop rounded-xl bg-green-500 px-3 py-0.5 text-2xl font-bold text-white tabular-nums shadow-[0_3px_0_#15803d]"
							aria-label="Total">+{game.draftScore.total}</span
						>
					{/key}
				</div>
			{/if}
			{#if game.overused.length}
				<p class="text-amber-600">More tiles than the bag has: {game.overused.join(', ')}</p>
			{/if}
		</div>
	{/if}
</div>
