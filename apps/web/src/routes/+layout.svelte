<script lang="ts">
	import './layout.css';
	import { injectSpeedInsights } from '@vercel/speed-insights';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Same as '@vercel/speed-insights/sveltekit', which still uses the removed $app/stores.
	const speedInsights = injectSpeedInsights(
		{
			route: page.route.id,
			framework: 'sveltekit',
			basePath: import.meta.env.VITE_VERCEL_OBSERVABILITY_BASEPATH
		},
		import.meta.env.VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG
	);
	$effect(() => {
		if (page.route.id) speedInsights?.setRoute(page.route.id);
	});
</script>

<svelte:head>
	<title>Tally · Scrabble scores</title>
</svelte:head>

<div class="min-h-dvh">
	{@render children()}
</div>
