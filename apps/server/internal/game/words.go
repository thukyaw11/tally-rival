package game

import (
	_ "embed"
	"strings"
	"sync"
)

// The same list as apps/web/static/words/words.txt (a test checks they match).
//
//go:embed words.txt
var wordList string

var words = sync.OnceValue(func() map[string]struct{} {
	set := make(map[string]struct{}, 270_000)
	for _, w := range strings.Split(wordList, "\n") {
		if w = strings.TrimSpace(w); w != "" {
			set[strings.ToUpper(w)] = struct{}{}
		}
	}
	return set
})

// IsWord ignores case, so words with blanks (shown in lowercase) match too.
func IsWord(w string) bool {
	_, ok := words()[strings.ToUpper(w)]
	return ok
}

// InvalidWords lists the words a move forms that aren't in the list.
func InvalidWords(score MoveScore) []string {
	var bad []string
	for _, w := range score.Words {
		if !IsWord(w.Text) {
			bad = append(bad, strings.ToUpper(w.Text))
		}
	}
	return bad
}
