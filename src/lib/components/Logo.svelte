<script lang="ts">
	import { LETTER_VALUES } from '#lib/scrabble/constants.ts';

	let { size = 'sm' }: { size?: 'sm' | 'lg' } = $props();

	const tilt = ['-rotate-6', 'rotate-3', '-rotate-2', 'rotate-6', '-rotate-3'];
</script>

<h1 class="flex gap-1" aria-label="Tally">
	{#each 'TALLY' as letter, i (i)}
		<span
			class={[
				'relative flex items-center justify-center rounded-md font-bold tile',
				tilt[i],
				size === 'lg' ? 'h-14 w-14 text-4xl' : 'h-9 w-9 text-xl'
			]}
			aria-hidden="true"
		>
			{letter}
			<span
				class={[
					'absolute font-semibold',
					size === 'lg' ? 'right-1 bottom-0.5 text-xs' : 'right-0.5 bottom-0 text-[9px]'
				]}>{LETTER_VALUES[letter]}</span
			>
		</span>
	{/each}
</h1>
