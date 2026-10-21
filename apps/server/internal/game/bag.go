package game

import (
	"errors"
	"math/rand/v2"
	"sort"
)

// Racks and the bag hold letters A–Z and "?" for a blank.

func FullBag() []string {
	letters := make([]byte, 0, len(TileCounts))
	for l := range TileCounts {
		letters = append(letters, l)
	}
	sort.Slice(letters, func(i, j int) bool { return letters[i] < letters[j] })
	bag := []string{}
	for _, l := range letters {
		for range TileCounts[l] {
			bag = append(bag, string(l))
		}
	}
	for range BlankCount {
		bag = append(bag, "?")
	}
	return bag
}

// DrawTiles takes up to n random tiles; it returns the drawn tiles and what is left.
func DrawTiles(bag []string, n int, rnd *rand.Rand) (drawn, left []string) {
	left = append([]string{}, bag...)
	for len(drawn) < n && len(left) > 0 {
		i := rnd.IntN(len(left))
		drawn = append(drawn, left[i])
		left = append(left[:i], left[i+1:]...)
	}
	return drawn, left
}

// RackLetter is the rack letter a placed tile came from.
func RackLetter(t PlacedTile) string {
	if t.Blank {
		return "?"
	}
	return t.Letter
}

// TakeFromRack removes letters from the rack; ok is false if the rack doesn't hold them all.
func TakeFromRack(rack, letters []string) (left []string, ok bool) {
	left = append([]string{}, rack...)
	for _, l := range letters {
		i := -1
		for j, r := range left {
			if r == l {
				i = j
				break
			}
		}
		if i < 0 {
			return nil, false
		}
		left = append(left[:i], left[i+1:]...)
	}
	return left, true
}

// SwapTiles puts letters back and draws the same number; it needs a full rack's worth in the bag.
func SwapTiles(rack, bag, letters []string, rnd *rand.Rand) (newRack, newBag []string, err error) {
	if len(letters) == 0 {
		return nil, nil, errors.New("Pick tiles to swap")
	}
	if len(bag) < RackSize {
		return nil, nil, errors.New("Not enough tiles in the bag to swap")
	}
	kept, ok := TakeFromRack(rack, letters)
	if !ok {
		return nil, nil, errors.New("Those tiles are not on your rack")
	}
	drawn, left := DrawTiles(bag, len(letters), rnd)
	return append(kept, drawn...), append(left, letters...), nil
}
