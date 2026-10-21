<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import Chat from '#lib/components/Chat.svelte';
	import type { OnlineRoom } from '#lib/online/room.svelte.ts';

	// The phone chat: a panel that slides up from the bottom.
	let { room }: { room: OnlineRoom } = $props();

	let dialog: HTMLDialogElement;

	$effect(() => {
		if (room.chat.open && !dialog.open) dialog.showModal();
		else if (!room.chat.open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	onclose={() => room.chat.setOpen(false)}
	onclick={(e) => e.target === dialog && dialog.close()}
	class="mx-auto mt-auto mb-0 h-[75dvh] w-full max-w-lg rounded-t-3xl bg-night-900 p-0 transition-transform duration-200 backdrop:bg-night-950/60 open:translate-y-0 starting:open:translate-y-full"
	aria-label="Chat"
>
	<div class="flex h-full flex-col gap-2 p-3">
		<div class="flex items-center justify-between px-1 text-cream">
			<p class="text-lg font-bold">Chat</p>
			<button
				type="button"
				class="btn-3d h-9 w-9"
				onclick={() => dialog.close()}
				aria-label="Close chat"><X size={18} /></button
			>
		</div>
		{#if room.chat.open}
			<Chat {room} class="flex-1" />
		{/if}
	</div>
</dialog>
