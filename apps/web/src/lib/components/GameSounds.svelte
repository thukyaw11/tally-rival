<script lang="ts">
	import type { Game } from '#lib/scrabble/game.svelte.ts';
	import { snapshot, sound, soundForChange, type Snapshot } from '#lib/sound.svelte.ts';

	// Plays sounds as the game changes; draws nothing. Online also passes myTurn and the server error.
	let {
		game,
		myTurn = false,
		error = null
	}: { game: Game; myTurn?: boolean; error?: string | null } = $props();

	let last: Snapshot | null = null;
	$effect(() => {
		const next = snapshot(game);
		const name = soundForChange(last, next);
		last = next;
		if (name) sound.play(name);
	});

	let wasMyTurn: boolean | null = null;
	$effect(() => {
		// After the other player's move sound.
		if (wasMyTurn === false && myTurn) setTimeout(() => sound.play('turn'), 300);
		wasMyTurn = myTurn;
	});

	let seenRejects = -1;
	$effect(() => {
		const r = game.rejects;
		if (seenRejects !== -1 && r > seenRejects) sound.play('error');
		seenRejects = r;
	});

	let lastError: string | null = null;
	$effect(() => {
		if (error && error !== lastError) sound.play('error');
		lastError = error;
	});
</script>
