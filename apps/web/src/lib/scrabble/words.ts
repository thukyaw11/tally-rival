// The word list, served from static/words/words.txt (the Go server embeds the same file).
let loading: Promise<Set<string> | null> | null = null;

export function loadWords(url = '/words/words.txt'): Promise<Set<string> | null> {
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
