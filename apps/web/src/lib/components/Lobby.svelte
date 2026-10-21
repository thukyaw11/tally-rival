<script lang="ts">
	import Crown from '@lucide/svelte/icons/crown';
	import Share2 from '@lucide/svelte/icons/share-2';
	import Timer from '@lucide/svelte/icons/timer';
	import { MAX_PLAYERS } from '@tally/game';
	import { resolve } from '$app/paths';
	import { formatMinutes } from '#lib/components/TimerOption.svelte';
	import Avatar from '#lib/components/Avatar.svelte';
	import { PLAYER_COLORS } from '#lib/players.ts';
	import type { OnlineRoom } from '#lib/online/room.svelte.ts';
	import { sound } from '#lib/sound.svelte.ts';

	let { room }: { room: OnlineRoom } = $props();

	const view = $derived(room.view!);
	const host = $derived(view.players.find((p) => p.id === view.hostId));
	let copied = $state(false);

	let seenPlayers = -1;
	$effect(() => {
		const n = view.players.length;
		if (seenPlayers !== -1 && n > seenPlayers) sound.play('join');
		seenPlayers = n;
	});

	async function share() {
		const url = new URL(resolve('/online/[code]', { code: view.code }), location.href).href;
		const text = `Join my Scrabble game on Tally — room ${view.code}`;
		try {
			if (navigator.share) return await navigator.share({ title: 'Tally', text, url });
			await navigator.clipboard.writeText(url);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Share sheet closed.
		}
	}
</script>

<div class="flex w-full max-w-sm flex-col gap-4">
	<div class="flex flex-col items-center gap-2 panel p-5 text-center">
		<p class="text-sm font-semibold opacity-60">Room code</p>
		<p class="text-5xl font-bold tracking-[0.2em]">{view.code}</p>
		<button type="button" class="mt-1 btn-3d h-11 w-full btn-white" onclick={share}
			><Share2 size={18} /> {copied ? 'Link copied!' : 'Invite friends'}</button
		>
		{#if view.turnMinutes}
			<p class="flex items-center gap-1 text-sm opacity-70">
				<Timer size={14} />
				{formatMinutes(view.turnMinutes)} per turn
			</p>
		{/if}
	</div>

	<div class="flex flex-col gap-2 panel p-4">
		<p class="font-bold">Players ({view.players.length}/{MAX_PLAYERS})</p>
		<ul class="flex flex-col gap-2">
			{#each view.players as p (p.id)}
				{@const away = room.here.length > 0 && !room.here.includes(p.id)}
				<li class="flex items-center gap-2">
					<Avatar name={p.name} avatar={p.avatar} bg={PLAYER_COLORS[p.color].bg} size="md" />
					<span class="min-w-0 flex-1 truncate font-medium" class:opacity-50={away}>
						{p.name}{p.id === view.you ? ' (you)' : ''}
					</span>
					{#if p.id === view.hostId}
						<Crown size={18} class="text-amber-500" aria-label="Host" />
					{/if}
				</li>
			{/each}
			{#each { length: MAX_PLAYERS - view.players.length }, i (i)}
				<li class="flex items-center gap-2 opacity-40">
					<span class="h-9 w-9 shrink-0 rounded-full border-2 border-dashed border-cream-edge"
					></span>
					<span class="text-sm">Waiting for a player…</span>
				</li>
			{/each}
		</ul>
	</div>

	{#if room.isHost}
		<button
			type="button"
			class="btn-3d h-12 text-lg btn-green"
			disabled={room.busy || view.players.length < 2}
			onclick={() => room.start()}
			>{view.players.length < 2 ? 'Need at least 2 players' : 'Start game'}</button
		>
	{:else}
		<p class="text-center font-medium opacity-80">
			Waiting for {host?.name ?? 'the host'} to start…
		</p>
	{/if}
</div>
