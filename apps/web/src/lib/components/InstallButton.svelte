<script lang="ts">
	import Download from '@lucide/svelte/icons/download';
	// Chrome's install event; not in TS's DOM types.
	type InstallPrompt = Event & { prompt: () => Promise<void> };

	let prompt = $state<InstallPrompt | null>(null);
	let showIosHint = $state(false);

	const standalone =
		matchMedia('(display-mode: standalone)').matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true;
	// iPhone/iPad Safari has no install prompt, only "Add to Home Screen".
	const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

	function onbeforeinstallprompt(e: Event) {
		e.preventDefault();
		prompt = e as InstallPrompt;
	}

	async function install() {
		if (prompt) {
			await prompt.prompt();
			prompt = null;
		} else {
			showIosHint = !showIosHint;
		}
	}
</script>

<svelte:window {onbeforeinstallprompt} />

{#if !standalone && (prompt || ios)}
	<div class="relative">
		<button type="button" onclick={install} class="btn-3d h-10 px-3 text-sm"
			><Download size={16} /> Install app</button
		>
		{#if showIosHint}
			<p class="absolute top-full right-0 z-20 mt-3 w-60 panel p-3 text-sm">
				Tap the <b>Share</b> button in Safari, then <b>Add to Home Screen</b>.
			</p>
		{/if}
	</div>
{/if}
