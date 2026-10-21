<script lang="ts">
	import Trophy from '@lucide/svelte/icons/trophy';
	import { LETTER_VALUES } from '@tally/game';
	import Avatar from '#lib/components/Avatar.svelte';
	import type { Game } from '#lib/scrabble/game.svelte.ts';

	// Online end-of-game summary: everyone's leftover tiles and what they cost.
	// endedBy: the host's name when they ended the game early.
	let { game, me = null, endedBy }: { game: Game; me?: number | null; endedBy?: string } = $props();

	const order = $derived(
		game.players.map((_, i) => i).sort((a, b) => game.scores[b] - game.scores[a])
	);
	const names = (ids: number[]) => ids.map((i) => game.players[i]).join(' & ');
	// '?' is a blank.
	const leftover = (i: number) => [...(game.end?.leftovers[i] ?? '')];
	const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
</script>

<section class="flex flex-col gap-3 panel p-4" aria-label="Final results">
	<div class="flex flex-col items-center gap-1 text-center">
		<Trophy size={48} class="animate-pop fill-yellow-300 text-amber-500" />
		<p class="text-2xl font-bold">
			{#if game.winners.length > 1}
				It's a tie!
				<span class="block text-lg font-semibold">{names(game.winners)}</span>
			{:else}
				<span style={`color: ${game.color(game.winners[0]).edge}`}>{names(game.winners)}</span>
				wins!
			{/if}
		</p>
		{#if endedBy}
			<p class="text-sm opacity-60">{endedBy} ended the game early.</p>
		{/if}
	</div>

	<ol class="flex flex-col gap-2">
		{#each order as i, rank (i)}
			{@const tiles = leftover(i)}
			{@const wentOut = game.end?.wentOut === i}
			<li class="flex flex-col gap-1.5 rounded-xl bg-white px-3 py-2.5">
				<div class="flex items-center gap-2">
					<span class="w-4 text-center font-bold opacity-50">{rank + 1}</span>
					<Avatar name={game.players[i]} avatar={game.avatar(i)} bg={game.color(i).bg} />
					<span class="min-w-0 flex-1 truncate font-semibold">
						{game.players[i]}{#if me === i}<span class="font-normal opacity-60">&nbsp;(you)</span
							>{/if}
					</span>
					<span class="text-2xl font-bold tabular-nums">{game.scores[i]}</span>
				</div>
				<div class="flex flex-wrap items-center gap-x-2 gap-y-1 pl-6 text-sm">
					{#if wentOut}
						<span class="rounded-full bg-green-500 px-2 py-0.5 text-xs font-bold text-white"
							>Went out</span
						>
						<span class="font-semibold text-green-700">{signed(game.adjust[i])}</span>
					{:else}
						{#if tiles.length}
							<span class="flex gap-0.5" aria-hidden="true">
								{#each tiles as letter, j (j)}
									<span
										class="relative flex h-6 w-6 items-center justify-center rounded text-sm font-bold tile"
										>{letter === '?' ? '' : letter}{#if letter !== '?'}<span
												class="absolute right-px bottom-0 text-[7px] leading-none"
												>{LETTER_VALUES[letter]}</span
											>{/if}</span
									>
								{/each}
							</span>
						{/if}
						<span>
							{tiles.length}
							{tiles.length === 1 ? 'tile' : 'tiles'}
							{#if game.adjust[i]}
								· <span class="font-semibold text-rose-600">{signed(game.adjust[i])}</span>
							{/if}
						</span>
					{/if}
					{#if game.playScores[i] !== game.scores[i]}
						<span class="w-full text-xs opacity-60">{game.playScores[i]} before leftovers</span>
					{/if}
				</div>
			</li>
		{/each}
	</ol>
</section>
