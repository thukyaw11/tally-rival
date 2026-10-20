<script lang="ts">
	import Board from '#lib/components/Board.svelte';
	import EndGame from '#lib/components/EndGame.svelte';
	import History from '#lib/components/History.svelte';
	import InstallButton from '#lib/components/InstallButton.svelte';
	import ActionBar from '#lib/components/ActionBar.svelte';
	import Logo from '#lib/components/Logo.svelte';
	import Menu from '#lib/components/Menu.svelte';
	import Scoreboard from '#lib/components/Scoreboard.svelte';
	import Setup from '#lib/components/Setup.svelte';
	import TurnOrder from '#lib/components/TurnOrder.svelte';
	import { reshuffle, shuffle, type Seat } from '#lib/players.ts';
	import { Game } from '#lib/scrabble/game.svelte.ts';

	const game = new Game();
	let endGameOpen = $state(false);
	// Players from setup, shuffled into turn order, waiting for "Start game".
	let seats = $state<Seat[] | null>(null);
	let setupNames = $state(['', '']);

	function onsetup(names: string[]) {
		setupNames = names;
		seats = shuffle(names.map((name, color) => ({ name, color })));
	}

	function startGame() {
		if (!seats) return;
		game.start(
			seats.map((s) => s.name),
			seats.map((s) => s.color)
		);
		seats = null;
	}

	function onkeydown(e: KeyboardEvent) {
		if (!game.started || game.ended || e.metaKey || e.ctrlKey || e.altKey) return;
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
		if (endGameOpen) return;
		if (/^[a-zA-Z]$/.test(e.key)) {
			game.placeLetter(e.key);
		} else if (e.key === 'Backspace') {
			game.backspace();
		} else if (e.key === 'Enter') {
			game.submit();
		} else if (e.key === ' ') {
			game.toggleDirection();
		} else if (e.key === '?' || e.key === '*') {
			game.toggleBlank();
		} else if (e.key === 'Escape') {
			game.clearDraft();
		} else {
			return;
		}
		e.preventDefault();
	}
</script>

<svelte:window {onkeydown} />

<main class="mx-auto flex min-h-dvh max-w-6xl flex-col gap-4 px-4 py-4">
	<header class="flex items-center justify-between gap-2">
		{#if game.started}<Logo />{:else}<span></span>{/if}
		<div class="flex items-center gap-2">
			<InstallButton />
			{#if game.started}
				<Menu {game} onendgame={() => (endGameOpen = true)} />
			{/if}
		</div>
	</header>

	{#if !game.started}
		<div class="flex flex-1 flex-col items-center justify-center gap-8 pb-16">
			<Logo size="lg" />
			{#if seats}
				<TurnOrder
					{seats}
					onstart={startGame}
					onshuffle={() => seats && (seats = reshuffle(seats))}
					onback={() => (seats = null)}
				/>
			{:else}
				<Setup onstart={onsetup} initialNames={setupNames} />
			{/if}
		</div>
	{:else}
		<div class="flex flex-col gap-4 lg:flex-row lg:items-start">
			<div class="w-full lg:max-w-[640px] lg:flex-1">
				<Board {game} />
			</div>
			<div class="flex w-full flex-col gap-4 lg:w-96">
				<Scoreboard {game} />
				{#if !game.ended}
					<ActionBar {game} />
				{/if}
				<EndGame {game} bind:open={endGameOpen} />
				<History {game} />
			</div>
		</div>
	{/if}
</main>
