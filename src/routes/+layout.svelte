<script lang="ts">
	import './layout.css';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<title>Tally · Scrabble scores</title>
</svelte:head>

<div class="min-h-dvh">
	{@render children()}
</div>
