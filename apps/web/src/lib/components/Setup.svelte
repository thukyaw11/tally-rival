<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import { randomAvatar, type WordList } from '@tally/game';
	import Avatar from '#lib/components/Avatar.svelte';
	import AvatarPicker from '#lib/components/AvatarPicker.svelte';
	import TimerOption, { turnMinutes } from '#lib/components/TimerOption.svelte';
	import WordListOption from '#lib/components/WordListOption.svelte';
	import { PLAYER_COLORS } from '#lib/players.ts';

	let {
		onstart,
		initialNames = ['', ''],
		initialMinutes = null,
		initialAvatars = [],
		initialWordList = 'common'
	}: {
		onstart: (
			names: string[],
			turnMinutes: number | null,
			avatars: number[],
			wordList: WordList
		) => void;
		initialNames?: string[];
		initialMinutes?: number | null;
		initialAvatars?: number[];
		initialWordList?: WordList;
	} = $props();

	// svelte-ignore state_referenced_locally
	let names = $state([...initialNames]);
	// One avatar per name, different ones to start with.
	// svelte-ignore state_referenced_locally
	let avatars = $state(
		initialNames.reduce<number[]>(
			(list, _, i) => [...list, initialAvatars[i] ?? randomAvatar(list)],
			[]
		)
	);
	// Whose avatar the picker is changing.
	let editing = $state<number | null>(null);
	let picker: HTMLDialogElement;

	function editAvatar(i: number) {
		editing = i;
		picker.showModal();
	}

	function addPlayer() {
		names.push('');
		avatars.push(randomAvatar(avatars));
	}

	function removePlayer(i: number) {
		names.splice(i, 1);
		avatars.splice(i, 1);
	}
	// svelte-ignore state_referenced_locally
	let useTimer = $state(initialMinutes !== null);
	// svelte-ignore state_referenced_locally
	let minutes = $state(initialMinutes ?? 2);
	// svelte-ignore state_referenced_locally
	let wordList = $state(initialWordList);

	function submit(e: SubmitEvent) {
		e.preventDefault();
		onstart(
			names.map((n, i) => n.trim() || `Player ${i + 1}`),
			turnMinutes(useTimer, minutes),
			$state.snapshot(avatars),
			wordList
		);
	}
</script>

<form onsubmit={submit} class="flex w-full max-w-sm flex-col gap-3 panel p-5">
	<h2 class="text-center text-xl font-bold">Who's playing?</h2>
	{#each { length: names.length }, i (i)}
		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={() => editAvatar(i)}
				class="rounded-full shadow-[inset_0_-3px_0_rgb(0_0_0/0.2)] transition-transform hover:scale-110"
				aria-label={`Change avatar for player ${i + 1}`}
			>
				<Avatar
					name={names[i] || `Player ${i + 1}`}
					avatar={avatars[i]}
					bg={PLAYER_COLORS[i].bg}
					size="md"
				/>
			</button>
			<input
				bind:value={names[i]}
				placeholder={`Player ${i + 1}`}
				aria-label={`Player ${i + 1} name`}
				class="min-w-0 flex-1 rounded-xl border-2 border-cream-edge bg-white px-3 py-2 font-medium"
			/>
			{#if names.length > 2}
				<button
					type="button"
					onclick={() => removePlayer(i)}
					class="rounded-lg p-2 opacity-50 hover:bg-amber-100 hover:opacity-100"
					aria-label={`Remove player ${i + 1}`}><X size={18} /></button
				>
			{/if}
		</div>
	{/each}
	{#if names.length < 4}
		<button
			type="button"
			onclick={addPlayer}
			class="flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-cream-edge py-2 font-medium opacity-70 hover:bg-amber-50 hover:opacity-100"
			><Plus size={16} /> Add player</button
		>
	{/if}
	<TimerOption bind:enabled={useTimer} bind:minutes />
	<WordListOption bind:value={wordList} />
	<button type="submit" class="mt-2 btn-3d h-12 text-lg btn-green">Play!</button>
</form>

<dialog
	bind:this={picker}
	onclose={() => (editing = null)}
	onclick={(e) => e.target === picker && picker.close()}
	class="m-auto w-[min(92vw,22rem)] panel p-4 backdrop:bg-night-950/70"
	aria-label="Choose an avatar"
>
	{#if editing !== null}
		<p class="mb-3 text-lg font-bold">
			Avatar for {names[editing].trim() || `Player ${editing + 1}`}
		</p>
		<AvatarPicker bind:value={avatars[editing]} onpick={() => picker.close()} />
	{/if}
</dialog>
