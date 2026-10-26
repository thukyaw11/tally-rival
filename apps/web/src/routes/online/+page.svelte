<script lang="ts">
	import House from '@lucide/svelte/icons/house';
	import LogIn from '@lucide/svelte/icons/log-in';
	import Plus from '@lucide/svelte/icons/plus';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Logo from '#lib/components/Logo.svelte';
	import TimerOption, { turnMinutes } from '#lib/components/TimerOption.svelte';
	import WordListOption from '#lib/components/WordListOption.svelte';
	import YouCard from '#lib/components/YouCard.svelte';
	import type { WordList } from '@tally/game';
	import { api } from '#lib/online/api.ts';
	import {
		loadAvatar,
		loadName,
		saveAvatar,
		saveName,
		saveSession,
		type Session
	} from '#lib/online/session.ts';

	let name = $state(loadName());
	let avatar = $state(loadAvatar());
	let code = $state('');
	let useTimer = $state(false);
	let minutes = $state(2);
	let wordList = $state<WordList>('common');
	let busy = $state(false);
	let error = $state<string | null>(null);

	async function enter(call: () => Promise<Session>) {
		if (!name.trim()) return (error = 'Type your name first');
		busy = true;
		error = null;
		try {
			const session = await call();
			saveSession(session);
			saveName(name.trim());
			saveAvatar(avatar);
			await goto(resolve('/online/[code]', { code: session.code }));
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	const create = (e: SubmitEvent) => {
		e.preventDefault();
		enter(() => api.create(name.trim(), turnMinutes(useTimer, minutes), wordList, avatar));
	};
	const join = (e: SubmitEvent) => {
		e.preventDefault();
		enter(() => api.join(code, name.trim(), avatar));
	};

	const field =
		'min-w-0 flex-1 rounded-xl border-2 border-cream-edge bg-white px-3 py-2 font-medium';
</script>

<main class="mx-auto flex min-h-dvh max-w-6xl flex-col gap-4 px-4 py-4">
	<header>
		<a href={resolve('/')} class="btn-3d h-10 w-10" aria-label="Home"><House size={20} /></a>
	</header>
	<div class="flex flex-1 flex-col items-center justify-center gap-6 pb-16">
		<Logo size="lg" />
		<div class="flex w-full max-w-sm flex-col gap-4">
			<YouCard bind:name bind:avatar />

			<form onsubmit={create} class="flex flex-col gap-3 panel p-4">
				<h2 class="text-lg font-bold">Start a new room</h2>
				<TimerOption bind:enabled={useTimer} bind:minutes />
				<WordListOption bind:value={wordList} />
				<button type="submit" class="btn-3d h-12 text-lg btn-green" disabled={busy}
					><Plus size={20} /> Create room</button
				>
			</form>

			<form onsubmit={join} class="flex flex-col gap-3 panel p-4">
				<h2 class="text-lg font-bold">Join a friend's room</h2>
				<input
					bind:value={code}
					oninput={() =>
						(code = code
							.toUpperCase()
							.replace(/[^A-Z]/g, '')
							.slice(0, 5))}
					placeholder="Room code"
					aria-label="Room code"
					autocapitalize="characters"
					autocomplete="off"
					class={[
						field,
						'text-center text-2xl tracking-[0.4em] uppercase placeholder:text-base placeholder:tracking-normal placeholder:normal-case'
					]}
				/>
				<button
					type="submit"
					class="btn-3d h-12 text-lg btn-amber"
					disabled={busy || code.length !== 5}><LogIn size={20} /> Join room</button
				>
			</form>

			{#if error}
				<p class="rounded-xl bg-rose-600 px-4 py-2 text-center font-medium text-white" role="alert">
					{error}
				</p>
			{/if}
		</div>
	</div>
</main>
