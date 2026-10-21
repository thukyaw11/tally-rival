<script lang="ts">
	import Volume2 from '@lucide/svelte/icons/volume-2';
	import VolumeX from '@lucide/svelte/icons/volume-x';
	import { sound } from '#lib/sound.svelte.ts';
</script>

<button
	type="button"
	class="btn-3d h-10 w-10"
	onclick={() => sound.toggle()}
	aria-pressed={sound.muted}
	aria-label={sound.muted ? 'Unmute sounds' : 'Mute sounds'}
	title={sound.muted ? 'Sound off' : 'Sound on'}
>
	{#if sound.muted}<VolumeX size={20} />{:else}<Volume2 size={20} />{/if}
</button>
