<script lang="ts">
	import House from '@lucide/svelte/icons/house';
	import { resolve } from '$app/paths';
	import Board from '#lib/components/Board.svelte';
	import EndGame from '#lib/components/EndGame.svelte';
	import History from '#lib/components/History.svelte';
	import InstallButton from '#lib/components/InstallButton.svelte';
	import ActionBar from '#lib/components/ActionBar.svelte';
	import Logo from '#lib/components/Logo.svelte';
	import GameSounds from '#lib/components/GameSounds.svelte';
	import Menu from '#lib/components/Menu.svelte';
	import SoundToggle from '#lib/components/SoundToggle.svelte';
	import Scoreboard from '#lib/components/Scoreboard.svelte';
	import Setup from '#lib/components/Setup.svelte';
	import TurnOrder from '#lib/components/TurnOrder.svelte';
	import TurnTimer from '#lib/components/TurnTimer.svelte';
	import { reshuffle, shuffle, type Seat } from '#lib/players.ts';
	import { Game } from '#lib/scrabble/game.svelte.ts';

	const game = new Game();
	let endGameOpen = $state(false);
	let timeUp = $state(false);
	let timeLeft = $state(0);
	// Players from setup, shuffled into turn order, waiting for "Start game".
	let seats = $state<Seat[] | null>(null);
	let setupNames = $state(['', '']);
	let setupMinutes = $state<number | null>(null);

	let setupAvatars = $state<number[]>([]);

	function onsetup(names: string[], turnMinutes: number | null, avatars: number[]) {
		setupNames = names;
		setupAvatars = avatars;
		setupMinutes = turnMinutes;
		seats = shuffle(names.map((name, color) => ({ name, color, avatar: avatars[color] })));
	}

	function startGame() {
		if (!seats) return;
		game.start(
			seats.map((s) => s.name),
			seats.map((s) => s.color),
			setupMinutes,
			seats.map((s) => s.avatar)
		);
		seats = null;
	}

	function onkeydown(e: KeyboardEvent) {
		if (!game.started || game.ended || e.metaKey || e.ctrlKey || e.altKey) return;
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
		if (endGameOpen || timeUp) return;
		if (game.handleKey(e.key)) e.preventDefault();
	}
</script>

<svelte:window {onkeydown} />

<!-- On desktop a running game fits one screen; History scrolls inside. -->
<main
	class={['mx-auto flex min-h-dvh max-w-6xl flex-col gap-4 px-4 py-4', game.started && 'lg:h-dvh']}
>
	<header class="flex items-center justify-between gap-2">
		{#if game.started}<Logo />{:else}<a
				href={resolve('/')}
				class="btn-3d h-10 w-10"
				aria-label="Home"><House size={20} /></a
			>{/if}
		<div class="flex items-center gap-2">
			<InstallButton />
			<SoundToggle />
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
				<Setup
					onstart={onsetup}
					initialNames={setupNames}
					initialMinutes={setupMinutes}
					initialAvatars={setupAvatars}
				/>
			{/if}
		</div>
	{:else}
		<GameSounds {game} />
		<div class="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row lg:items-stretch">
			<!-- On desktop the board also fits the window height. -->
			<div class="w-full lg:max-w-[min(640px,calc(100dvh-7rem))] lg:flex-1">
				<Board {game} />
			</div>
			<!-- Padding keeps the turn badge and card outline from being clipped by the scroll box. -->
			<div
				class="flex w-full flex-col gap-4 lg:-mx-1.5 lg:min-h-0 lg:w-99 lg:overflow-y-auto lg:px-1.5 lg:pt-2.5"
			>
				<Scoreboard {game} timeLeft={game.turnMinutes ? timeLeft : null} />
				{#if !game.ended}
					{#if game.turnMinutes}
						<TurnTimer {game} bind:timeUp ontick={(s) => (timeLeft = s)} />
					{/if}
					<ActionBar {game} />
				{/if}
				<EndGame {game} bind:open={endGameOpen} />
				<History {game} class="lg:min-h-40 lg:flex-1" />
			</div>
		</div>
	{/if}
</main>
