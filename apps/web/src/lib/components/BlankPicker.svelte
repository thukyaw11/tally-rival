<script lang="ts">
	// Asks which letter a blank tile stands for.
	let dialog: HTMLDialogElement;
	let resolve: ((letter: string | null) => void) | null = null;

	const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

	export function pick(): Promise<string | null> {
		resolve?.(null);
		dialog.showModal();
		return new Promise((r) => (resolve = r));
	}

	function choose(letter: string | null) {
		resolve?.(letter);
		resolve = null;
		if (dialog.open) dialog.close();
	}
</script>

<dialog
	bind:this={dialog}
	onclose={() => choose(null)}
	onclick={(e) => e.target === dialog && choose(null)}
	class="m-auto w-[min(92vw,22rem)] panel p-4 backdrop:bg-night-950/70"
	aria-label="Choose a letter for the blank"
>
	<p class="mb-3 text-lg font-bold">Blank tile is…</p>
	<div class="grid grid-cols-7 gap-1.5">
		{#each LETTERS as letter (letter)}
			<button
				type="button"
				onclick={() => choose(letter)}
				class="flex aspect-square items-center justify-center rounded-md text-xl font-bold tile hover:scale-110"
				>{letter}</button
			>
		{/each}
	</div>
	<button type="button" class="mt-3 btn-3d h-10 w-full btn-white" onclick={() => choose(null)}
		>Cancel</button
	>
</dialog>
