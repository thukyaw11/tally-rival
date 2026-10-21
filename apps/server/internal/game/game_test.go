package game

import (
	"encoding/json"
	"math/rand/v2"
	"os"
	"reflect"
	"slices"
	"testing"
)

// Shared with the TS tests; regenerate with `bun run fixtures` in packages/game.
const fixtures = "../../../../packages/game/fixtures/"

func readFixture(t *testing.T, name string, v any) {
	t.Helper()
	data, err := os.ReadFile(fixtures + name)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(data, v); err != nil {
		t.Fatal(err)
	}
}

func TestConstantsMatchTS(t *testing.T) {
	var c struct {
		LetterValues map[string]int `json:"letterValues"`
		TileCounts   map[string]int `json:"tileCounts"`
		BlankCount   int            `json:"blankCount"`
		AvatarCount  int            `json:"avatarCount"`
	}
	readFixture(t, "constants.json", &c)
	toStr := func(m map[byte]int) map[string]int {
		out := map[string]int{}
		for k, v := range m {
			out[string(k)] = v
		}
		return out
	}
	if !reflect.DeepEqual(toStr(LetterValues), c.LetterValues) {
		t.Errorf("letter values differ from TS: %v", c.LetterValues)
	}
	if !reflect.DeepEqual(toStr(TileCounts), c.TileCounts) {
		t.Errorf("tile counts differ from TS: %v", c.TileCounts)
	}
	if BlankCount != c.BlankCount {
		t.Errorf("blank count %d, TS has %d", BlankCount, c.BlankCount)
	}
	if AvatarCount != c.AvatarCount {
		t.Errorf("avatar count %d, TS has %d", AvatarCount, c.AvatarCount)
	}
}

func TestRuleFixtures(t *testing.T) {
	var cases []struct {
		Name  string         `json:"name"`
		Board [][]PlacedTile `json:"board"`
		Tiles []PlacedTile   `json:"tiles"`
		Error *string        `json:"error"`
		Score *MoveScore     `json:"score"`
	}
	readFixture(t, "rules.json", &cases)
	if len(cases) == 0 {
		t.Fatal("no cases")
	}
	for _, c := range cases {
		t.Run(c.Name, func(t *testing.T) {
			var board Board
			for _, play := range c.Board {
				board = board.WithTiles(play)
			}
			want := ""
			if c.Error != nil {
				want = *c.Error
			}
			if got := ValidatePlacement(board, c.Tiles); got != want {
				t.Fatalf("error = %q, want %q", got, want)
			}
			if c.Score != nil {
				if got := ScoreMove(board, c.Tiles); !reflect.DeepEqual(got, *c.Score) {
					t.Fatalf("score = %+v, want %+v", got, *c.Score)
				}
			}
		})
	}
}

func TestBag(t *testing.T) {
	rnd := rand.New(rand.NewPCG(1, 2))
	bag := FullBag()
	if len(bag) != 100 {
		t.Fatalf("bag has %d tiles", len(bag))
	}
	drawn, left := DrawTiles(bag, 7, rnd)
	if len(drawn) != 7 || len(left) != 93 {
		t.Fatalf("drew %d, left %d", len(drawn), len(left))
	}
	all := append(append([]string{}, drawn...), left...)
	full := FullBag()
	slices.Sort(all)
	slices.Sort(full)
	if !slices.Equal(all, full) {
		t.Fatal("tiles lost while drawing")
	}
	if drawn, left := DrawTiles([]string{"A", "B"}, 7, rnd); len(drawn) != 2 || len(left) != 0 {
		t.Fatal("should draw only what is left")
	}
}

func TestRack(t *testing.T) {
	left, ok := TakeFromRack([]string{"A", "B", "A", "?"}, []string{"A", "?"})
	if !ok || !slices.Equal(left, []string{"B", "A"}) {
		t.Fatalf("got %v %v", left, ok)
	}
	if _, ok := TakeFromRack([]string{"A", "B"}, []string{"A", "A"}); ok {
		t.Fatal("took a letter twice")
	}
	if RackLetter(PlacedTile{Letter: "Q", Blank: true}) != "?" {
		t.Fatal("blank should come from ?")
	}
}

func TestSwap(t *testing.T) {
	rnd := rand.New(rand.NewPCG(3, 4))
	rack, bag, err := SwapTiles([]string{"A", "B", "C", "D", "E", "F", "G"}, FullBag(), []string{"A", "B"}, rnd)
	if err != nil || len(rack) != 7 || len(bag) != 100 || !slices.Contains(rack, "C") {
		t.Fatalf("rack %v, bag %d, err %v", rack, len(bag), err)
	}
	if _, _, err := SwapTiles([]string{"A"}, []string{"B", "C"}, []string{"A"}, rnd); err == nil {
		t.Fatal("swap with a small bag should fail")
	}
}

func TestWordListMatchesWeb(t *testing.T) {
	web, err := os.ReadFile("../../../web/static/words/words.txt")
	if err != nil {
		t.Fatal(err)
	}
	if string(web) != wordList {
		t.Fatal("internal/game/words.txt differs from apps/web/static/words/words.txt; copy it over")
	}
}

func TestWords(t *testing.T) {
	for _, w := range []string{"CAT", "cat", "QI", "ZA", "cAT"} {
		if !IsWord(w) {
			t.Errorf("%s should be a word", w)
		}
	}
	for _, w := range []string{"CXT", "NR", ""} {
		if IsWord(w) {
			t.Errorf("%q should not be a word", w)
		}
	}
	var board Board
	board = board.WithTiles([]PlacedTile{{Row: 7, Col: 6, Letter: "C"}, {Row: 7, Col: 7, Letter: "A"}, {Row: 7, Col: 8, Letter: "T"}})
	// "OAX" down through the A is not a word; "CATS" is.
	if bad := InvalidWords(ScoreMove(board, []PlacedTile{{Row: 6, Col: 7, Letter: "O"}, {Row: 8, Col: 7, Letter: "X"}})); len(bad) != 1 || bad[0] != "OAX" {
		t.Errorf("bad words: %v", bad)
	}
	if bad := InvalidWords(ScoreMove(board, []PlacedTile{{Row: 7, Col: 9, Letter: "S"}})); len(bad) != 0 {
		t.Errorf("CATS flagged: %v", bad)
	}
}
