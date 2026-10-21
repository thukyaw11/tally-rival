<script lang="ts">
	import { AVATARS } from '@tally/game';
	import AvatarPicker from '#lib/components/AvatarPicker.svelte';

	// Name and avatar for online play; tap the avatar to change it.
	let { name = $bindable(''), avatar = $bindable(0) }: { name?: string; avatar?: number } =
		$props();

	let picking = $state(false);
</script>

<div class="flex flex-col gap-3 panel p-4">
	<div class="flex items-center gap-3">
		<button
			type="button"
			onclick={() => (picking = !picking)}
			aria-expanded={picking}
			aria-label="Change avatar"
			class="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-4xl ring-3 ring-cream-edge transition-transform hover:scale-105"
		>
			{AVATARS[avatar] ?? AVATARS[0]}
			<span
				class="absolute -right-1 -bottom-1 rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-amber-950"
				>{picking ? 'done' : 'edit'}</span
			>
		</button>
		<label class="flex min-w-0 flex-1 flex-col gap-1">
			<span class="font-bold">Your name</span>
			<input
				bind:value={name}
				maxlength="20"
				placeholder="e.g. Ann"
				class="min-w-0 rounded-xl border-2 border-cream-edge bg-white px-3 py-2 font-medium"
			/>
		</label>
	</div>
	{#if picking}
		<AvatarPicker bind:value={avatar} onpick={() => (picking = false)} />
	{/if}
</div>
