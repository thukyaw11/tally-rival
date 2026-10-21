<script lang="ts">
	import House from '@lucide/svelte/icons/house';
	import LogIn from '@lucide/svelte/icons/log-in';
	import { RACK_SIZE } from '@tally/game';
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import ActionBar from '#lib/components/ActionBar.svelte';
	import Board from '#lib/components/Board.svelte';
	import EndGame from '#lib/components/EndGame.svelte';
	import History from '#lib/components/History.svelte';
	import Lobby from '#lib/components/Lobby.svelte';
	import Logo from '#lib/components/Logo.svelte';
	import GameSounds from '#lib/components/GameSounds.svelte';
	import Menu from '#lib/components/Menu.svelte';
	import Rack from '#lib/components/Rack.svelte';
	import Scoreboard from '#lib/components/Scoreboard.svelte';
	import SoundToggle from '#lib/components/SoundToggle.svelte';
	import TurnTimer from '#lib/components/TurnTimer.svelte';
	import { api } from '#lib/online/api.ts';
	import { OnlineRoom } from '#lib/online/room.svelte.ts';
	import {
		clearSession,
		loadName,
		loadSession,
		saveName,
		saveSession
	} from '#lib/online/session.ts';

	const code = (page.params.code ?? '').toUpperCase();
	const saved = loadSession();
	let room = $state.raw(saved?.code === code ? new OnlineRoom(saved) : null);

	$effect(() => {
		const r = room;
		if (r) return untrack(() => r.connect());
	});

	// Joining from a shared link.
	let name = $state(loadName());
	let joinError = $state<string | null>(null);
	let joining = $state(false);

	async function join(e: SubmitEvent) {
		e.preventDefault();
		if (!name.trim()) return (joinError = 'Type your name first');
		joining = true;
		try {
			const session = await api.join(code, name.trim());
			saveSession(session);
			saveName(name.trim());
			room = new OnlineRoom(session);
		} catch (err) {
			joinError = err instanceof Error ? err.message : String(err);
		} finally {
			joining = false;
		}
	}

	const view = $derived(room?.view ?? null);
	const playing = $derived(view?.status === 'playing');
	const turnName = $derived(room ? room.game.players[room.game.current] : '');

	let timeUp = $state(false);
	let timeLeft = $state(0);
	let swapping = $state(false);
	let selected = $state<number[]>([]);

	// The turn can move on while picking tiles (e.g. the timer ran out).
	$effect(() => {
		if (!room?.myTurn) swapping = false;
	});

	function swap() {
		if (!room?.view) return;
		const rack = room.view.rack;
		room.swap(selected.map((i) => rack[i]));
		swapping = false;
	}

	function leave() {
		clearSession();
		room = null;
	}

	function onkeydown(e: KeyboardEvent) {
		if (!room || !playing || swapping || timeUp || e.metaKey || e.ctrlKey || e.altKey) return;
		if (e.target instanceof HTMLInputElement) return;
		if (room.game.handleKey(e.key)) e.preventDefault();
	}

	const field =
		'min-w-0 flex-1 rounded-xl border-2 border-cream-edge bg-white px-3 py-2 font-medium';
</script>

<svelte:window {onkeydown} />

<main class="mx-auto flex min-h-dvh max-w-6xl flex-col gap-4 px-4 py-4">
	<header class="flex items-center justify-between gap-2">
		{#if room && view && view.status !== 'lobby'}
			<Logo />
		{:else}
			<a href={resolve('/')} class="btn-3d h-10 w-10" aria-label="Home"><House size={20} /></a>
		{/if}
		<div class="flex items-center gap-2">
			<SoundToggle />
			{#if room && view && view.status !== 'lobby'}
				<Menu
					game={room.game}
					onswap={() => {
						selected = [];
						swapping = true;
					}}
					canSwap={view.bagCount >= RACK_SIZE}
				/>
			{/if}
		</div>
	</header>

	{#if !room || room.lost}
		<div class="flex flex-1 flex-col items-center justify-center gap-8 pb-16">
			<Logo size="lg" />
			{#if room?.lost}
				<div class="flex w-full max-w-sm flex-col gap-3 panel p-5 text-center">
					<p class="text-lg font-bold">Can't open room {code}</p>
					<p class="opacity-70">{room.error}</p>
					<a href={resolve('/online')} class="btn-3d h-11 btn-green" onclick={leave}
						>Start or join another room</a
					>
				</div>
			{:else}
				<form onsubmit={join} class="flex w-full max-w-sm flex-col gap-3 panel p-5">
					<h2 class="text-center text-xl font-bold">
						Join room <span class="tracking-widest">{code}</span>
					</h2>
					<input
						bind:value={name}
						maxlength="20"
						placeholder="Your name"
						aria-label="Your name"
						class={field}
					/>
					<button type="submit" class="btn-3d h-12 text-lg btn-green" disabled={joining}
						><LogIn size={20} /> Join</button
					>
					{#if joinError}
						<p class="text-center font-medium text-rose-600" role="alert">{joinError}</p>
					{/if}
				</form>
			{/if}
		</div>
	{:else if !view}
		<div class="flex flex-1 items-center justify-center pb-16">
			<p class="panel px-5 py-3 font-medium" role="status">{room.error ?? 'Opening room…'}</p>
		</div>
	{:else if view.status === 'lobby'}
		<div class="flex flex-1 flex-col items-center justify-center gap-6 pb-16">
			<Logo size="lg" />
			<Lobby {room} />
			{#if room.error}
				<p class="rounded-xl bg-rose-600 px-4 py-2 font-medium text-white" role="alert">
					{room.error}
				</p>
			{/if}
		</div>
	{:else}
		<GameSounds game={room.game} myTurn={room.myTurn} error={room.error} />
		<div class="flex flex-col gap-4 lg:flex-row lg:items-start">
			<div class="w-full lg:max-w-[640px] lg:flex-1">
				<Board game={room.game} />
			</div>
			<div class="flex w-full flex-col gap-4 lg:w-96">
				<Scoreboard
					game={room.game}
					me={room.me}
					timeLeft={playing && view.turnMinutes ? timeLeft : null}
				/>
				{#if playing}
					{#if view.turnMinutes}
						<TurnTimer
							game={room.game}
							bind:timeUp
							ontick={(s) => (timeLeft = s)}
							startedAt={view.turnStartedAt ? Date.parse(view.turnStartedAt) : null}
							canAct={room.myTurn}
							canSwap={view.bagCount >= RACK_SIZE}
						/>
					{/if}
					<Rack game={room.game} bagCount={view.bagCount} {swapping} bind:selected />
					{#if swapping}
						<div class="flex gap-2">
							<button type="button" class="btn-3d h-11 flex-1" onclick={() => (swapping = false)}
								>Cancel</button
							>
							<button
								type="button"
								class="btn-3d h-11 flex-1 btn-amber"
								disabled={!selected.length || room.busy}
								onclick={swap}>Swap {selected.length || ''} tiles</button
							>
						</div>
					{:else if room.myTurn}
						<ActionBar game={room.game} />
					{:else}
						<p class="text-center font-medium opacity-80" role="status">
							Waiting for {turnName}…
						</p>
					{/if}
				{/if}
				{#if room.error}
					<p class="rounded-xl bg-rose-600 px-4 py-2 font-medium text-white" role="alert">
						{room.error}
					</p>
				{/if}
				<EndGame game={room.game} />
				<History game={room.game} />
			</div>
		</div>
	{/if}
</main>
