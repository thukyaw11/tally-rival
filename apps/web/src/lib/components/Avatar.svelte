<script lang="ts">
	import { AVATARS } from '@tally/game';
	import { initial } from '#lib/players.ts';

	// A player's circle: their emoji avatar on their colour, or their initial if they have none.
	let {
		name,
		avatar = null,
		bg,
		size = 'sm',
		class: className = ''
	}: {
		name: string;
		avatar?: number | null;
		bg: string;
		size?: 'sm' | 'md' | 'lg';
		class?: string;
	} = $props();

	const emoji = $derived(avatar == null ? null : AVATARS[avatar]);
	const sizes = {
		sm: ['h-8 w-8', 'text-lg', 'text-sm'],
		md: ['h-9 w-9', 'text-xl', 'text-base'],
		lg: ['h-16 w-16', 'text-4xl', 'text-2xl']
	};
</script>

<span
	class={[
		'flex shrink-0 items-center justify-center rounded-full leading-none font-bold text-white',
		sizes[size][0],
		emoji ? sizes[size][1] : sizes[size][2],
		className
	]}
	style={`background: ${bg}`}
	aria-hidden="true">{emoji ?? initial(name)}</span
>
