import type { WordList } from '@tally/game';

// The word lists, served from static/words/ (the Go server embeds the same files).
const FILES: Record<WordList, string> = {
	common: '/words/common.txt',
	tournament: '/words/words.txt'
};
const loading = new Map<WordList, Promise<Set<string> | null>>();

export function loadWords(list: WordList): Promise<Set<string> | null> {
	let words = loading.get(list);
	if (!words) {
		words = fetch(FILES[list])
			.then((res) => (res.ok ? res.text() : Promise.reject(new Error(res.statusText))))
			.then((text) => new Set(text.toUpperCase().split(/\r?\n/).filter(Boolean)))
			// Without the list, word checking is just turned off.
			.catch(() => null);
		loading.set(list, words);
	}
	return words;
}

export function isWord(words: Set<string>, text: string): boolean {
	return words.has(text.toUpperCase());
}
