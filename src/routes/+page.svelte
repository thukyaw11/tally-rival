<script lang="ts">
	import Board from '#lib/components/Board.svelte';
	import EndGame from '#lib/components/EndGame.svelte';
	import History from '#lib/components/History.svelte';
	import InstallButton from '#lib/components/InstallButton.svelte';
	import Keyboard from '#lib/components/Keyboard.svelte';
	import Scoreboard from '#lib/components/Scoreboard.svelte';
	import Setup from '#lib/components/Setup.svelte';
	import { Game } from '#lib/scrabble/game.svelte.ts';

	const game = new Game();

	function onkeydown(e: KeyboardEvent) {
		if (!game.started || game.ended || e.metaKey || e.ctrlKey || e.altKey) return;
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
		if (/^[a-zA-Z]$/.test(e.key)) {
			game.placeLetter(e.key);
		} else if (e.key === 'Backspace') {
			game.backspace();
		} else if (e.key === 'Enter') {
			game.submit();
		} else if (e.key === ' ') {
			game.toggleDirection();
		} else if (e.key === 'Escape') {
			game.clearDraft();
		} else {
			return;
		}
		e.preventDefault();
	}
</script>

<svelte:window {onkeydown} />

<main class="mx-auto flex min-h-dvh max-w-6xl flex-col gap-3 px-4 py-3">
	<header class="flex items-center justify-between gap-2">
		<h1 class="text-xl font-bold text-emerald-900">
			Tally <span class="font-normal text-stone-500">· Scrabble scores</span>
		</h1>
		<InstallButton />
	</header>

	{#if !game.started}
		<Setup onstart={(names) => game.start(names)} />
	{:else}
		<div class="flex flex-col gap-3 lg:flex-row lg:items-start">
			<div class="w-full lg:max-w-[640px] lg:flex-1">
				<Board {game} />
			</div>
			<div class="flex w-full flex-col gap-3 lg:w-96">
				<Scoreboard {game} />
				{#if !game.ended}
					<Keyboard {game} />
				{/if}
				<EndGame {game} />
				<History {game} />
			</div>
		</div>
	{/if}
</main>
