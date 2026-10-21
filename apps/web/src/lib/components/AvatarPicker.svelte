<script lang="ts">
	import Dices from '@lucide/svelte/icons/dices';
	import { AVATARS, randomAvatar } from '@tally/game';

	// Grid of emoji avatars; onpick fires after a choice (e.g. to close a dialog).
	let { value = $bindable(0), onpick }: { value?: number; onpick?: (avatar: number) => void } =
		$props();

	function pick(avatar: number) {
		value = avatar;
		onpick?.(avatar);
	}
</script>

<div class="flex flex-col gap-2">
	<div class="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="Avatar">
		{#each AVATARS as emoji, i (emoji)}
			<button
				type="button"
				role="radio"
				aria-checked={value === i}
				aria-label={emoji}
				onclick={() => pick(i)}
				class={[
					'flex aspect-square items-center justify-center rounded-xl text-2xl transition-transform hover:scale-110',
					value === i ? 'bg-amber-100 ring-3 ring-amber-400' : 'bg-white'
				]}>{emoji}</button
			>
		{/each}
	</div>
	<button
		type="button"
		class="btn-3d h-10 text-sm btn-white"
		onclick={() => pick(randomAvatar([value]))}><Dices size={16} /> Random</button
	>
</div>
