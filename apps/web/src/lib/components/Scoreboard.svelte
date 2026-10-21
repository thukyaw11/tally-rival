<script lang="ts">
	import Avatar from '#lib/components/Avatar.svelte';
	import type { Game } from '#lib/scrabble/game.svelte.ts';

	// timeLeft: seconds left in the current turn, or null with no timer.
	// me: this device's player online; other players' active badge then says "Playing".
	let {
		game,
		timeLeft = null,
		me = null,
		tilesLeft = null
	}: {
		game: Game;
		timeLeft?: number | null;
		me?: number | null;
		// Online once the bag is empty: tiles each player still holds.
		tilesLeft?: number[] | null;
	} = $props();

	const R = 20;
	const RING = 2 * Math.PI * R;
	const limit = $derived((game.turnMinutes ?? 0) * 60);
	const low = $derived(timeLeft !== null && timeLeft <= 10);
	const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
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
				<span class="relative flex h-8 w-8 shrink-0 items-center justify-center">
					{#if active && timeLeft !== null && limit}
						<svg viewBox="0 0 44 44" class="absolute -inset-1.5 -rotate-90" aria-hidden="true">
							<circle cx="22" cy="22" r={R} fill="none" stroke-width="4" class="stroke-white/30" />
							<circle
								cx="22"
								cy="22"
								r={R}
								fill="none"
								stroke-width="4"
								stroke-linecap="round"
								class={low ? 'stroke-rose-500' : 'stroke-yellow-300'}
								stroke-dasharray={RING}
								stroke-dashoffset={RING * (1 - timeLeft / limit)}
								style="transition: stroke-dashoffset 300ms linear"
							/>
						</svg>
					{/if}
					<Avatar
						{name}
						avatar={game.avatar(i)}
						bg={active ? color.edge : color.bg}
						class="h-full w-full"
					/>
				</span>
				<span class="min-w-0 flex-1 truncate font-medium">{name}</span>
				{#if tilesLeft}
					<span
						class={[
							'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums',
							active ? 'bg-white/25' : 'bg-cream-edge/60'
						]}
						aria-label={`${tilesLeft[i]} ${tilesLeft[i] === 1 ? 'tile' : 'tiles'} left`}
						title="Tiles left"
						><span class="h-3 w-3 rounded-[3px] tile" aria-hidden="true"></span>{tilesLeft[i]}</span
					>
				{/if}
				{#key game.scores[i]}
					<span class="animate-pop text-2xl font-bold tabular-nums">{game.scores[i]}</span>
				{/key}
				{#if active}
					<span
						class="absolute -top-2 left-3 rounded-full bg-yellow-300 px-2 text-[10px] font-bold tracking-wide text-yellow-900 uppercase"
						>{me === null || me === i ? 'Your turn' : 'Playing'}{#if timeLeft !== null}
							&nbsp;· <span class={['tabular-nums', low && 'animate-pulse text-rose-700']}
								>{clock(timeLeft)}</span
							>{/if}</span
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
									game.unknownWords.includes(w.text) &&
										(game.strictWords ? 'text-rose-600 line-through' : 'text-amber-600')
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
							class={[
								'shrink-0 animate-pop rounded-xl px-3 py-0.5 text-2xl font-bold text-white tabular-nums',
								game.canSubmit
									? 'bg-green-500 shadow-[0_3px_0_#15803d]'
									: 'bg-stone-400 line-through shadow-[0_3px_0_#78716c]'
							]}
							aria-label="Total">+{game.draftScore.total}</span
						>
					{/key}
				</div>
			{/if}
			{#if game.strictWords && game.unknownWords.length}
				<p class="mt-1 font-medium text-rose-600" role="alert">
					Not in the word list: {game.unknownWords.map((w) => w.toUpperCase()).join(', ')}
				</p>
			{/if}
			{#if game.overused.length}
				<p class="text-amber-600">More tiles than the bag has: {game.overused.join(', ')}</p>
			{/if}
		</div>
	{/if}
</div>
