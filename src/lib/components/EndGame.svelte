<script lang="ts">
	import Trophy from '@lucide/svelte/icons/trophy';
	import confetti from 'canvas-confetti';
	import type { Game } from '#lib/scrabble/game.svelte.ts';

	let { game, open = $bindable(false) }: { game: Game; open?: boolean } = $props();

	let dialog: HTMLDialogElement;
	let wentOut = $state<number | null>(null);
	let leftovers = $state<string[]>([]);
	let breakTie = $state(false);

	$effect(() => {
		if (open && !dialog.open) {
			wentOut = null;
			leftovers = game.players.map(() => '');
			breakTie = false;
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});

	function celebrate() {
		const colors = ['#fde047', '#fbbf24', '#fff7e6', ...game.winners.map((i) => game.color(i).bg)];
		const opts = { particleCount: 90, spread: 70, colors, disableForReducedMotion: true };
		confetti({ ...opts, origin: { x: 0.2, y: 0.7 }, angle: 60 });
		confetti({ ...opts, origin: { x: 0.8, y: 0.7 }, angle: 120 });
		setTimeout(
			() => confetti({ ...opts, particleCount: 150, spread: 120, origin: { y: 0.5 } }),
			300
		);
	}

	function finish(e: SubmitEvent) {
		e.preventDefault();
		game.finish({
			wentOut,
			leftovers: leftovers.map((l, i) => (i === wentOut ? '' : l.replace(/[^a-zA-Z?]/g, ''))),
			breakTie
		});
		open = false;
		celebrate();
	}

	const names = (ids: number[]) => ids.map((i) => game.players[i]).join(' & ');
	// Final scores tie but the winner came from the tie-break.
	const tieBroken = $derived(
		game.winners.length === 1 &&
			game.scores.filter((s) => s === game.scores[game.winners[0]]).length > 1
	);
</script>

{#if game.ended}
	<div class="flex flex-col items-center gap-2 panel p-5 text-center">
		<Trophy size={56} class="animate-pop fill-yellow-300 text-amber-500" />
		<p class="text-2xl font-bold">
			{#if game.winners.length > 1}
				It's a tie!
				<span class="block text-lg font-semibold">{names(game.winners)}</span>
			{:else}
				<span style={`color: ${game.color(game.winners[0]).edge}`}>{names(game.winners)}</span>
				wins!
			{/if}
		</p>
		{#if tieBroken}
			<p class="text-sm opacity-60">Tie broken by score before leftover tiles.</p>
		{/if}
		<ul class="text-sm opacity-70">
			{#each game.players as name, i (i)}
				<li>{name}: leftover tiles {game.adjust[i] >= 0 ? '+' : ''}{game.adjust[i]}</li>
			{/each}
		</ul>
	</div>
{/if}

<dialog
	bind:this={dialog}
	onclose={() => (open = false)}
	class="m-auto w-[min(92vw,24rem)] panel p-0 backdrop:bg-night-950/70"
>
	<form onsubmit={finish} class="flex flex-col gap-3 p-4 text-sm">
		<p class="text-xl font-bold">End game</p>
		<label class="flex items-center gap-2">
			Who used all tiles?
			<select
				bind:value={wentOut}
				class="flex-1 rounded-xl border-2 border-cream-edge bg-white px-2 py-1.5"
			>
				<option value={null}>Nobody</option>
				{#each game.players as name, i (i)}
					<option value={i}>{name}</option>
				{/each}
			</select>
		</label>
		<div class="flex flex-col gap-2">
			<p class="opacity-60">Letters left on each rack (? = blank)</p>
			{#each game.players as name, i (i)}
				<label class="flex items-center gap-2">
					<span class="w-24 truncate">{name}</span>
					<input
						bind:value={leftovers[i]}
						disabled={wentOut === i}
						placeholder={wentOut === i ? 'went out' : 'e.g. QE?'}
						autocapitalize="characters"
						class="min-w-0 flex-1 rounded-xl border-2 border-cream-edge bg-white px-2 py-1.5 uppercase placeholder:normal-case disabled:opacity-50"
					/>
				</label>
			{/each}
		</div>
		<fieldset class="flex flex-col gap-1">
			<legend class="mb-1 opacity-60">If final scores are tied</legend>
			<label class="flex items-center gap-2">
				<input type="radio" bind:group={breakTie} value={false} /> Keep it a tie
			</label>
			<label class="flex items-center gap-2">
				<input type="radio" bind:group={breakTie} value={true} /> Break the tie: higher score before leftover
				tiles wins
			</label>
		</fieldset>
		<div class="flex gap-2">
			<button type="button" class="btn-3d h-11 flex-1 btn-white" onclick={() => (open = false)}
				>Cancel</button
			>
			<button type="submit" class="btn-3d h-11 flex-1 btn-green">Finish</button>
		</div>
	</form>
</dialog>
