package game

import "strings"

type Tile struct {
	Letter string `json:"letter"`
	Blank  bool   `json:"blank"`
}

type PlacedTile struct {
	Row    int    `json:"row"`
	Col    int    `json:"col"`
	Letter string `json:"letter"`
	Blank  bool   `json:"blank"`
}

type Board [Size][Size]*Tile

type WordScore struct {
	Text  string `json:"text"`
	Score int    `json:"score"`
}

type MoveScore struct {
	Words []WordScore `json:"words"`
	Bingo bool        `json:"bingo"`
	Total int         `json:"total"`
}

func inBounds(r, c int) bool { return r >= 0 && r < Size && c >= 0 && c < Size }

func (b *Board) IsEmpty() bool {
	for _, row := range b {
		for _, t := range row {
			if t != nil {
				return false
			}
		}
	}
	return true
}

func TileValue(t Tile) int {
	if t.Blank || len(t.Letter) != 1 {
		return 0
	}
	return LetterValues[t.Letter[0]]
}

// WithTiles returns a copy of the board with the tiles added.
func (b Board) WithTiles(tiles []PlacedTile) Board {
	for _, t := range tiles {
		b[t.Row][t.Col] = &Tile{Letter: t.Letter, Blank: t.Blank}
	}
	return b
}

// ValidatePlacement returns an error message, or "" when the placement is legal.
func ValidatePlacement(board Board, tiles []PlacedTile) string {
	if len(tiles) == 0 {
		return "Place at least one tile."
	}
	seen := map[[2]int]bool{}
	for _, t := range tiles {
		if !inBounds(t.Row, t.Col) {
			return "Tile is off the board."
		}
		if board[t.Row][t.Col] != nil {
			return "A tile is already on that square."
		}
		key := [2]int{t.Row, t.Col}
		if seen[key] {
			return "Two tiles on the same square."
		}
		seen[key] = true
	}

	sameRow, sameCol := true, true
	for _, t := range tiles {
		sameRow = sameRow && t.Row == tiles[0].Row
		sameCol = sameCol && t.Col == tiles[0].Col
	}
	if !sameRow && !sameCol {
		return "Tiles must be in one row or one column."
	}

	// Every square between the first and last new tile must be filled.
	filled := board.WithTiles(tiles)
	lo, hi := Size, -1
	for _, t := range tiles {
		v := t.Row
		if sameRow {
			v = t.Col
		}
		lo, hi = min(lo, v), max(hi, v)
	}
	for v := lo; v <= hi; v++ {
		r, c := v, tiles[0].Col
		if sameRow {
			r, c = tiles[0].Row, v
		}
		if filled[r][c] == nil {
			return "Word has a gap."
		}
	}

	if board.IsEmpty() {
		onStar := false
		for _, t := range tiles {
			onStar = onStar || (t.Row == Center && t.Col == Center)
		}
		if !onStar {
			return "First word must cover the center star."
		}
		if len(tiles) < 2 {
			return "First word needs at least 2 letters."
		}
		return ""
	}

	for _, t := range tiles {
		for _, d := range [][2]int{{-1, 0}, {1, 0}, {0, -1}, {0, 1}} {
			r, c := t.Row+d[0], t.Col+d[1]
			if inBounds(r, c) && board[r][c] != nil {
				return ""
			}
		}
	}
	return "Word must connect to tiles already on the board."
}

// scoreLine scores the full word running through (row, col) in the given direction.
func scoreLine(filled *Board, isNew func(r, c int) bool, row, col, dr, dc int) *WordScore {
	r, c := row, col
	for inBounds(r-dr, c-dc) && filled[r-dr][c-dc] != nil {
		r, c = r-dr, c-dc
	}
	var text strings.Builder
	sum, wordMult := 0, 1
	for inBounds(r, c) && filled[r][c] != nil {
		tile := filled[r][c]
		value := TileValue(*tile)
		if isNew(r, c) {
			switch Premiums[r][c] {
			case "DL":
				value *= 2
			case "TL":
				value *= 3
			case "DW":
				wordMult *= 2
			case "TW":
				wordMult *= 3
			}
		}
		if tile.Blank {
			text.WriteString(strings.ToLower(tile.Letter))
		} else {
			text.WriteString(tile.Letter)
		}
		sum += value
		r, c = r+dr, c+dc
	}
	if text.Len() < 2 {
		return nil
	}
	return &WordScore{Text: text.String(), Score: sum * wordMult}
}

// ScoreMove scores a legal placement: the main word, every cross word and the bingo bonus.
func ScoreMove(board Board, tiles []PlacedTile) MoveScore {
	filled := board.WithTiles(tiles)
	newKeys := map[[2]int]bool{}
	for _, t := range tiles {
		newKeys[[2]int{t.Row, t.Col}] = true
	}
	isNew := func(r, c int) bool { return newKeys[[2]int{r, c}] }

	// A single tile may form words both ways; pick across as the main line.
	across := true
	if len(tiles) > 1 {
		for _, t := range tiles {
			across = across && t.Row == tiles[0].Row
		}
	}
	dr, dc := 0, 1
	if !across {
		dr, dc = 1, 0
	}

	words := []WordScore{}
	if main := scoreLine(&filled, isNew, tiles[0].Row, tiles[0].Col, dr, dc); main != nil {
		words = append(words, *main)
	}
	for _, t := range tiles {
		if cross := scoreLine(&filled, isNew, t.Row, t.Col, dc, dr); cross != nil {
			words = append(words, *cross)
		}
	}
	bingo := len(tiles) == RackSize
	total := 0
	for _, w := range words {
		total += w.Score
	}
	if bingo {
		total += BingoBonus
	}
	return MoveScore{Words: words, Bingo: bingo, Total: total}
}
