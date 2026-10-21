<script lang="ts">
	import type { OnlineRoom } from '#lib/online/room.svelte.ts';
	import { AVATARS } from '@tally/game';
	import { PLAYER_COLORS } from '#lib/players.ts';

	// A short bubble for a new message while chat is hidden; tap to open chat.
	let { room }: { room: OnlineRoom } = $props();

	const m = $derived(room.chat.latest);
	const p = $derived(m && room.view?.players.find((p) => p.id === m.playerId));

	$effect(() => {
		if (!m) return;
		const id = setTimeout(() => (room.chat.latest = null), 3000);
		return () => clearTimeout(id);
	});
</script>

<div class="fixed bottom-4 left-1/2 z-40 max-w-[90vw] -translate-x-1/2 lg:hidden" role="status">
	{#if m}
		<button
			type="button"
			onclick={() => room.chat.setOpen(true)}
			class="block max-w-full animate-pop truncate panel px-4 py-2.5 text-left shadow-lg"
		>
			<b style={`color: ${p ? PLAYER_COLORS[p.color].edge : 'inherit'}`}
				>{p?.avatar != null ? `${AVATARS[p.avatar]} ` : ''}{p?.name ?? 'Player'}:</b
			>
			{m.text}
		</button>
	{/if}
</div>
