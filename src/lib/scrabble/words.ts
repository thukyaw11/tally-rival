// ENABLE word list (public domain), served from static/words/enable.txt.
let loading: Promise<Set<string> | null> | null = null;

export function loadWords(url = '/words/enable.txt'): Promise<Set<string> | null> {
	loading ??= fetch(url)
		.then((res) => (res.ok ? res.text() : Promise.reject(new Error(res.statusText))))
		.then((text) => new Set(text.toUpperCase().split(/\r?\n/).filter(Boolean)))
		// Without the list, word checking is just turned off.
		.catch(() => null);
	return loading;
}

export function isWord(words: Set<string>, text: string): boolean {
	return words.has(text.toUpperCase());
}
