<script lang="ts">
	import Send from '@lucide/svelte/icons/send';
	import { AVATARS, CHAT_MAX, type ChatMessage } from '@tally/game';
	import { tick } from 'svelte';
	import type { OnlineRoom } from '#lib/online/room.svelte.ts';
	import { PLAYER_COLORS } from '#lib/players.ts';

	let { room, class: className = '' }: { room: OnlineRoom; class?: string } = $props();

	const QUICK = [
		'👏',
		'😂',
		'😮',
		'🔥',
		'😅',
		'ဆရာကြီးပါကွာ',
		'ရှိလို့လား',
		'မြန်မြန်လုပ်လိုက်မလား',
		'မဖြစ်တော့ဘူးနဲ့ တူပါတယ်',
		'အချိန်ပြည့်တော့မယ်နော်',
		'၁ နာရီထိုးတော့မယ် မြန်မြန်'
	];
	// Only emoji (and the joiners/variation marks they use): shown large.
	const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|‍|️|\s)+$/u;

	const chat = $derived(room.chat);
	let text = $state('');
	let sending = $state(false);
	let list: HTMLOListElement;
	// Follow new messages unless the player scrolled up to read.
	let atBottom = true;

	const sender = (m: ChatMessage) => room.view?.players.find((p) => p.id === m.playerId);

	$effect(() => {
		void chat.messages.length;
		if (atBottom) tick().then(() => list?.scrollTo({ top: list.scrollHeight }));
	});

	async function say(message: string) {
		const t = message.trim();
		if (!t || sending) return false;
		sending = true;
		const ok = await chat.send(t);
		sending = false;
		atBottom = true;
		return ok;
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (await say(text)) text = '';
	}
</script>

<div class={['flex min-h-0 flex-col gap-2 panel p-3', className]}>
	<ol
		bind:this={list}
		onscroll={() => (atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40)}
		class="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1"
		aria-label="Chat messages"
		aria-live="polite"
	>
		{#each chat.messages as m (m.id)}
			{@const mine = chat.isMine(m)}
			{@const p = sender(m)}
			{@const big = EMOJI_ONLY.test(m.text)}
			<li class={['flex flex-col', mine ? 'items-end' : 'items-start']}>
				{#if !mine}
					<span
						class="px-1 text-xs font-bold"
						style={`color: ${p ? PLAYER_COLORS[p.color].edge : 'inherit'}`}
						>{p?.avatar != null ? `${AVATARS[p.avatar]} ` : ''}{p?.name ?? 'Player'}</span
					>
				{/if}
				<span
					class={[
						'max-w-[85%] break-words',
						big
							? 'text-3xl leading-tight'
							: ['rounded-2xl px-3 py-1.5 text-sm', mine ? 'bg-green-500 text-white' : 'bg-white']
					]}>{m.text}</span
				>
			</li>
		{:else}
			<li class="m-auto py-4 text-center text-sm opacity-50">No messages yet. Say hi!</li>
		{/each}
	</ol>

	<div class="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
		{#each QUICK as q (q)}
			<button
				type="button"
				class="shrink-0 rounded-full border-2 border-cream-edge bg-white px-2.5 py-1 text-sm font-medium hover:bg-amber-50 disabled:opacity-50"
				disabled={sending}
				onclick={() => say(q)}>{q}</button
			>
		{/each}
	</div>

	<form onsubmit={submit} class="flex gap-2">
		<input
			bind:value={text}
			maxlength={CHAT_MAX}
			placeholder="Message…"
			aria-label="Chat message"
			enterkeyhint="send"
			autocomplete="off"
			class="min-w-0 flex-1 rounded-xl border-2 border-cream-edge bg-white px-3 py-2"
		/>
		<button
			type="submit"
			class="btn-3d h-11 w-11 shrink-0 btn-green"
			disabled={sending || !text.trim()}
			aria-label="Send"><Send size={18} /></button
		>
	</form>
	{#if chat.error}
		<p class="text-sm font-medium text-rose-600" role="alert">{chat.error}</p>
	{/if}
</div>
