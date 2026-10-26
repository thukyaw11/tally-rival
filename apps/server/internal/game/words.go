package game

import (
	_ "embed"
	"strings"
	"sync"
)

// Word lists a room can pick. Both files are copies of apps/web/static/words/ (a test checks they match).
const (
	CommonWords     = "common"
	TournamentWords = "tournament"
)

// Tournament list (SOWPODS).
//
//go:embed words.txt
var wordList string

// Everyday words: SCOWL size 50 found in words.txt, without abbreviations.
//
//go:embed common.txt
var commonList string

func wordSet(list string) func() map[string]struct{} {
	return sync.OnceValue(func() map[string]struct{} {
		set := make(map[string]struct{}, strings.Count(list, "\n"))
		for _, w := range strings.Split(list, "\n") {
			if w = strings.TrimSpace(w); w != "" {
				set[strings.ToUpper(w)] = struct{}{}
			}
		}
		return set
	})
}

var (
	tournamentSet = wordSet(wordList)
	commonSet     = wordSet(commonList)
)

func ValidWordList(list string) bool {
	return list == CommonWords || list == TournamentWords
}

// IsWord ignores case, so words with blanks (shown in lowercase) match too. Unknown lists use the tournament one.
func IsWord(list, w string) bool {
	set := tournamentSet
	if list == CommonWords {
		set = commonSet
	}
	_, ok := set()[strings.ToUpper(w)]
	return ok
}

// InvalidWords lists the words a move forms that aren't in the list.
func InvalidWords(list string, score MoveScore) []string {
	var bad []string
	for _, w := range score.Words {
		if !IsWord(list, w.Text) {
			bad = append(bad, strings.ToUpper(w.Text))
		}
	}
	return bad
}
