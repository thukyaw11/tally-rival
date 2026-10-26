<script lang="ts" module>
	import type { WordList } from '@tally/game';

	export const WORD_LISTS: { value: WordList; label: string; hint: string }[] = [
		{ value: 'common', label: 'Everyday', hint: 'Only words most people know' },
		{ value: 'tournament', label: 'Tournament', hint: 'Every official word, even QI and ZA' }
	];

	export const wordListName = (list: WordList) =>
		`${WORD_LISTS.find((l) => l.value === list)?.label ?? list} words`;
</script>

<script lang="ts">
	import BookOpen from '@lucide/svelte/icons/book-open';

	let { value = $bindable('common') }: { value?: WordList } = $props();

	const hint = $derived(WORD_LISTS.find((l) => l.value === value)?.hint);
</script>

<fieldset class="mt-1 flex flex-col gap-2 border-t-2 border-cream-edge pt-3">
	<legend class="contents">
		<span class="flex items-center gap-2 font-medium"><BookOpen size={18} /> Word list</span>
	</legend>
	<div class="grid grid-cols-2 gap-1 rounded-xl bg-cream-edge p-1">
		{#each WORD_LISTS as list (list.value)}
			<label
				class="cursor-pointer rounded-lg py-1.5 text-center font-semibold transition-colors has-checked:bg-white has-checked:shadow has-focus-visible:outline-2 has-focus-visible:outline-green-600"
			>
				<input
					type="radio"
					name="word-list"
					value={list.value}
					bind:group={value}
					class="sr-only"
				/>
				{list.label}
			</label>
		{/each}
	</div>
	<p class="text-sm opacity-60">{hint}</p>
</fieldset>
