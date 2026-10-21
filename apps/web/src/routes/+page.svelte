<script lang="ts">
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import Globe from '@lucide/svelte/icons/globe';
	import LogIn from '@lucide/svelte/icons/log-in';
	import { resolve } from '$app/paths';
	import InstallButton from '#lib/components/InstallButton.svelte';
	import Logo from '#lib/components/Logo.svelte';
	import SoundToggle from '#lib/components/SoundToggle.svelte';
	import { api, ApiError } from '#lib/online/api.ts';
	import { loadSession, markSessionEnded } from '#lib/online/session.ts';
	import * as storage from '#lib/scrabble/storage.ts';

	const saved = storage.load();
	const trackerInProgress = !!saved?.players.length && !saved.end;
	const room = loadSession();
	// Only offer to go back to a room that's still going.
	let session = $state(room?.ended ? null : room);

	// Rooms that ended (or were removed) while this page wasn't watching.
	$effect(() => {
		const s = session;
		if (!s) return;
		api
			.view(s)
			.then((v) => {
				if (v.status === 'ended') {
					markSessionEnded(s.code);
					session = null;
				}
			})
			.catch((e) => {
				// Offline: keep the button. Gone or not ours any more: hide it.
				if (e instanceof ApiError && (e.status === 401 || e.status === 404)) session = null;
			});
	});
</script>

<main class="mx-auto flex min-h-dvh max-w-6xl flex-col gap-4 px-4 py-4">
	<header class="flex justify-end gap-2">
		<InstallButton />
		<SoundToggle />
	</header>
	<div class="flex flex-1 flex-col items-center justify-center gap-8 pb-16">
		<Logo size="lg" />
		<div class="flex w-full max-w-sm flex-col gap-4">
			<a href={resolve('/tracker')} class="btn-3d h-auto flex-col gap-0.5 py-4 btn-green">
				<span class="flex items-center gap-2 text-xl"
					><ClipboardList size={22} />
					{trackerInProgress ? 'Continue tracker game' : 'Score tracker'}</span
				>
				<span class="text-sm font-medium opacity-80">Play on a real board, keep score here</span>
			</a>
			<a href={resolve('/online')} class="btn-3d h-auto flex-col gap-0.5 py-4 btn-amber">
				<span class="flex items-center gap-2 text-xl"><Globe size={22} /> Play online</span>
				<span class="text-sm font-medium opacity-80">2–4 players, each on their own device</span>
			</a>
			{#if session}
				<a href={resolve('/online/[code]', { code: session.code })} class="btn-3d h-12 btn-white"
					><LogIn size={18} /> Back to room <span class="tracking-widest">{session.code}</span></a
				>
			{/if}
		</div>
	</div>
</main>
