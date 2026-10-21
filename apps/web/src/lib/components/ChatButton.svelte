<script lang="ts">
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import type { RoomChat } from '#lib/online/chat.svelte.ts';

	let { chat }: { chat: RoomChat } = $props();
</script>

<button
	type="button"
	class="relative btn-3d h-10 w-10 lg:hidden"
	onclick={() => chat.setOpen(true)}
	aria-label={chat.unread ? `Chat, ${chat.unread} unread` : 'Chat'}
>
	<MessageCircle size={20} />
	{#if chat.unread}
		<span
			class="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-xs font-bold text-white"
			>{chat.unread > 9 ? '9+' : chat.unread}</span
		>
	{/if}
</button>
