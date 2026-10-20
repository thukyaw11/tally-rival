<script lang="ts">
	import type { Game } from '#lib/scrabble/game.svelte.ts';

	let { game }: { game: Game } = $props();

	let open = $state(false);
	let wentOut = $state<number | null>(null);
	let leftovers = $state<string[]>([]);

	const winners = $derived.by(() => {
		const best = Math.max(...game.scores);
		return game.players.filter((_, i) => game.scores[i] === best);
	});

	function openForm() {
		wentOut = null;
		leftovers = game.players.map(() => '');
		open = true;
	}

	function finish(e: SubmitEvent) {
		e.preventDefault();
		game.finish({
			wentOut,
			leftovers: leftovers.map((l, i) => (i === wentOut ? '' : l.replace(/[^a-zA-Z?]/g, '')))
		});
		open = false;
	}

	function newGame() {
		if (confirm('Start a new game? The current game will be deleted.')) game.newGame();
	}
</script>

{#if game.ended}
	<div class="flex flex-col gap-2 rounded-lg bg-white p-3">
		<p class="text-lg font-semibold">
			{winners.length > 1 ? `Tie: ${winners.join(' & ')}` : `${winners[0]} wins!`}
		</p>
		<ul class="text-sm text-stone-600">
			{#each game.players as name, i (i)}
				<li>{name}: leftover {game.adjust[i] >= 0 ? '+' : ''}{game.adjust[i]}</li>
			{/each}
		</ul>
		<button
			type="button"
			class="rounded-lg bg-emerald-600 py-2 font-semibold text-white"
			onclick={newGame}>New game</button
		>
	</div>
{:else if open}
	<form onsubmit={finish} class="flex flex-col gap-2 rounded-lg bg-white p-3 text-sm">
		<p class="font-semibold">End game</p>
		<label class="flex items-center gap-2">
			Who used all tiles?
			<select bind:value={wentOut} class="flex-1 rounded-md border border-stone-300 px-2 py-1">
				<option value={null}>Nobody</option>
				{#each game.players as name, i (i)}
					<option value={i}>{name}</option>
				{/each}
			</select>
		</label>
		{#each game.players as name, i (i)}
			<label class="flex items-center gap-2">
				<span class="w-24 truncate">{name}</span>
				<input
					bind:value={leftovers[i]}
					disabled={wentOut === i}
					placeholder={wentOut === i ? 'went out' : 'leftover letters, ? = blank'}
					class="min-w-0 flex-1 rounded-md border border-stone-300 px-2 py-1 uppercase disabled:bg-stone-100"
				/>
			</label>
		{/each}
		<div class="flex gap-2">
			<button
				type="button"
				class="flex-1 rounded-md bg-stone-100 py-2"
				onclick={() => (open = false)}>Cancel</button
			>
			<button type="submit" class="flex-1 rounded-md bg-emerald-600 py-2 font-semibold text-white"
				>Finish</button
			>
		</div>
	</form>
{:else}
	<div class="flex gap-2">
		<button type="button" class="flex-1 rounded-lg bg-white py-2 text-sm" onclick={openForm}
			>End game</button
		>
		<button
			type="button"
			class="flex-1 rounded-lg bg-white py-2 text-sm text-red-600"
			onclick={newGame}>New game</button
		>
	</div>
{/if}
