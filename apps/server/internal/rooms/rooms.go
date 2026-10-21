// Package rooms runs online games: lobby, dealing, moves and the turn timer.
// JSON shapes match RoomState / PlayerView in packages/game/src/online.ts.
package rooms

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"log"
	"math"
	mrand "math/rand/v2"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/thukyaw11/tally/apps/server/internal/game"
	"github.com/thukyaw11/tally/apps/server/internal/realtime"
)

const (
	MaxPlayers = 4
	// Six scoreless turns in a row end the game.
	ScorelessLimit = 6
	maxName        = 20
	codeLetters    = "ABCDEFGHJKLMNPQRSTUVWXYZ"
)

// Seat is the turn order, set when the game starts (nil in the lobby).
type Player struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color int    `json:"color"`
	Seat  *int   `json:"seat"`
	// Index into the avatar list; nil for players who didn't pick one.
	Avatar *int `json:"avatar"`
	rack   []string
}

// Player is a seat index.
type Move struct {
	Player int               `json:"player"`
	Kind   string            `json:"kind"`
	Tiles  []game.PlacedTile `json:"tiles"`
	Score  int               `json:"score"`
}

// Leftovers use "?" for a blank.
type End struct {
	WentOut   *int     `json:"wentOut"`
	Leftovers []string `json:"leftovers"`
	// Set when the host ended the game early (their player id).
	EndedBy *string `json:"endedBy,omitempty"`
}

// State is what everyone in the room may see. Players are in seat order once the game starts.
type State struct {
	Code          string     `json:"code"`
	Status        string     `json:"status"`
	HostID        string     `json:"hostId"`
	TurnMinutes   *float64   `json:"turnMinutes"`
	Players       []Player   `json:"players"`
	Moves         []Move     `json:"moves"`
	BagCount      int        `json:"bagCount"`
	RackCounts    []int      `json:"rackCounts"`
	TurnStartedAt *time.Time `json:"turnStartedAt"`
	End           *End       `json:"end"`
}

// View is one player's view: the public state plus their own rack.
type View struct {
	State
	You  string   `json:"you"`
	Rack []string `json:"rack"`
}

type MoveRequest struct {
	Kind    string            `json:"kind"`
	Tiles   []game.PlacedTile `json:"tiles"`
	Letters []string          `json:"letters"`
}

type Joined struct {
	Code     string `json:"code"`
	PlayerID string `json:"playerId"`
	Token    string `json:"token"`
}

// Error carries the HTTP status to answer with.
type Error struct {
	Status int
	Msg    string
}

func (e *Error) Error() string { return e.Msg }

func fail(status int, msg string) error { return &Error{status, msg} }

type Service struct {
	db *pgxpool.Pool
	rt realtime.Realtime
	// Minute is shorter in tests. Grace is extra time before the server passes for a player.
	Minute, Grace time.Duration

	mu     sync.Mutex
	timers map[string]*time.Timer

	chatMu sync.Mutex
	sent   map[string][]time.Time
}

func New(db *pgxpool.Pool, rt realtime.Realtime) *Service {
	return &Service{db: db, rt: rt, Minute: time.Minute, Grace: 15 * time.Second, timers: map[string]*time.Timer{}, sent: map[string][]time.Time{}}
}

type querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

type loaded struct {
	State
	bag []string
}

func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func newToken() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func newRand() *mrand.Rand { return mrand.New(mrand.NewPCG(mrand.Uint64(), mrand.Uint64())) }

func cleanName(name string) (string, error) {
	n := strings.TrimSpace(name)
	if n == "" || utf8.RuneCountInString(n) > maxName {
		return "", fail(400, "Name must be 1–20 characters")
	}
	return n, nil
}

// Turn timer: 1:30 to 10:00 in half-minute steps.
func cleanMinutes(m *float64) error {
	if m != nil && (*m < 1.5 || *m > 10 || *m*2 != math.Trunc(*m*2)) {
		return fail(400, "Turn timer must be 1:30–10:00 in 30-second steps")
	}
	return nil
}

func load(ctx context.Context, q querier, code string, lock bool) (*loaded, error) {
	sql := `SELECT status, coalesce(host_id::text, ''), turn_minutes, bag, turn_started_at, "end"
		FROM rooms WHERE code = $1`
	if lock {
		sql += " FOR UPDATE"
	}
	l := &loaded{State: State{Code: code}}
	err := q.QueryRow(ctx, sql, code).Scan(&l.Status, &l.HostID, &l.TurnMinutes, &l.bag, &l.TurnStartedAt, &l.End)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fail(404, "Room not found")
	}
	if err != nil {
		return nil, err
	}

	rows, _ := q.Query(ctx, `SELECT id::text, name, color, seat, avatar, rack FROM players
		WHERE room_code = $1 ORDER BY seat NULLS LAST, color`, code)
	l.Players, err = pgx.CollectRows(rows, func(row pgx.CollectableRow) (Player, error) {
		var p Player
		err := row.Scan(&p.ID, &p.Name, &p.Color, &p.Seat, &p.Avatar, &p.rack)
		return p, err
	})
	if err != nil {
		return nil, err
	}

	rows, _ = q.Query(ctx, `SELECT player, kind, tiles, score FROM moves WHERE room_code = $1 ORDER BY seq`, code)
	l.Moves, err = pgx.CollectRows(rows, func(row pgx.CollectableRow) (Move, error) {
		var m Move
		err := row.Scan(&m.Player, &m.Kind, &m.Tiles, &m.Score)
		return m, err
	})
	if err != nil {
		return nil, err
	}

	l.BagCount = len(l.bag)
	l.RackCounts = make([]int, len(l.Players))
	for i, p := range l.Players {
		l.RackCounts[i] = len(p.rack)
	}
	return l, nil
}

// endOf ends the game when someone uses their last tile with the bag empty, or after six scoreless turns.
func endOf(moves []Move, racks [][]string, bag []string, seat int) *End {
	wentOut := len(bag) == 0 && len(racks[seat]) == 0
	scoreless := len(moves) >= ScorelessLimit
	for _, m := range moves[max(0, len(moves)-ScorelessLimit):] {
		scoreless = scoreless && m.Score == 0
	}
	if !wentOut && !scoreless {
		return nil
	}
	end := &End{Leftovers: make([]string, len(racks))}
	if wentOut {
		end.WentOut = &seat
	}
	for i, r := range racks {
		end.Leftovers[i] = strings.Join(r, "")
	}
	return end
}

func (s *Service) notify(code string) {
	if err := s.rt.Trigger(realtime.RoomChannel(code), "updated", map[string]any{}); err != nil {
		s.notifyFailed(code, err)
	}
}

func (s *Service) notifyFailed(code string, err error) {
	log.Printf("realtime trigger failed for %s: %v", code, err)
}

// schedule sets up the auto-pass for the current turn, replacing any earlier one.
func (s *Service) schedule(l *loaded) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if t := s.timers[l.Code]; t != nil {
		t.Stop()
		delete(s.timers, l.Code)
	}
	if l.Status != "playing" || l.TurnMinutes == nil || l.TurnStartedAt == nil {
		return
	}
	code, seq := l.Code, len(l.Moves)
	deadline := l.TurnStartedAt.Add(time.Duration(*l.TurnMinutes*float64(s.Minute)) + s.Grace)
	var t *time.Timer
	t = time.AfterFunc(time.Until(deadline), func() {
		s.mu.Lock()
		if s.timers[code] == t {
			delete(s.timers, code)
		}
		s.mu.Unlock()
		if err := s.applyMove(context.Background(), code, "", seq, MoveRequest{Kind: "pass"}); err != nil {
			log.Printf("auto-pass failed for %s: %v", code, err)
		}
	})
	s.timers[code] = t
}

func (s *Service) changed(ctx context.Context, code string) error {
	l, err := load(ctx, s.db, code, false)
	if err != nil {
		return err
	}
	s.schedule(l)
	s.notify(code)
	return nil
}

// applyMove plays for playerID, or for the timer when playerID is "" (only if the turn is still timerSeq).
func (s *Service) applyMove(ctx context.Context, code, playerID string, timerSeq int, req MoveRequest) error {
	done := false
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		l, err := load(ctx, tx, code, true)
		if err != nil {
			return err
		}
		seq := len(l.Moves)
		if playerID == "" {
			if l.Status != "playing" || seq != timerSeq {
				return nil
			}
		} else if l.Status != "playing" {
			return fail(409, "The game is not running")
		}
		seat := seq % len(l.Players)
		mover := l.Players[seat]
		if playerID != "" && mover.ID != playerID {
			return fail(409, "Not your turn")
		}

		rnd := newRand()
		rack, bag := mover.rack, l.bag
		tiles, score := []game.PlacedTile{}, 0
		switch req.Kind {
		case "play":
			var board game.Board
			for _, m := range l.Moves {
				if m.Kind == "play" {
					board = board.WithTiles(m.Tiles)
				}
			}
			if msg := game.ValidatePlacement(board, req.Tiles); msg != "" {
				return fail(400, msg)
			}
			letters := make([]string, len(req.Tiles))
			for i, t := range req.Tiles {
				letters[i] = game.RackLetter(t)
			}
			kept, ok := game.TakeFromRack(rack, letters)
			if !ok {
				return fail(400, "Those tiles are not on your rack")
			}
			tiles = req.Tiles
			scored := game.ScoreMove(board, tiles)
			if bad := game.InvalidWords(scored); len(bad) > 0 {
				return fail(400, "Not in the word list: "+strings.Join(bad, ", "))
			}
			score = scored.Total
			drawn, left := game.DrawTiles(bag, game.RackSize-len(kept), rnd)
			rack, bag = append(kept, drawn...), left
		case "swap":
			var err error
			if rack, bag, err = game.SwapTiles(rack, bag, req.Letters, rnd); err != nil {
				return fail(400, err.Error())
			}
		case "pass":
		default:
			return fail(400, "Bad move")
		}

		moves := append(l.Moves, Move{Player: seat, Kind: req.Kind, Tiles: tiles, Score: score})
		racks := make([][]string, len(l.Players))
		for i, p := range l.Players {
			racks[i] = p.rack
		}
		racks[seat] = rack
		end := endOf(moves, racks, bag, seat)
		status := "playing"
		if end != nil {
			status = "ended"
		}

		if _, err := tx.Exec(ctx, `INSERT INTO moves (room_code, seq, player, kind, tiles, score)
			VALUES ($1, $2, $3, $4, $5, $6)`, code, seq, seat, req.Kind, tiles, score); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `UPDATE players SET rack = $1 WHERE id = $2`, rack, mover.ID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `UPDATE rooms SET bag = $1, turn_started_at = now(), status = $2, "end" = $3
			WHERE code = $4`, bag, status, end, code); err != nil {
			return err
		}
		done = true
		return nil
	})
	if err != nil || !done {
		return err
	}
	return s.changed(ctx, code)
}

func (s *Service) PlayerFor(ctx context.Context, code, token string) (realtime.User, error) {
	var u realtime.User
	if token == "" {
		return u, fail(401, "Missing token")
	}
	err := s.db.QueryRow(ctx, `SELECT id::text, name FROM players WHERE room_code = $1 AND token_hash = $2`,
		code, HashToken(token)).Scan(&u.ID, &u.Name)
	if errors.Is(err, pgx.ErrNoRows) {
		return u, fail(401, "You are not in this room")
	}
	return u, err
}

func cleanAvatar(a *int) error {
	if a != nil && (*a < 0 || *a >= game.AvatarCount) {
		return fail(400, "Unknown avatar")
	}
	return nil
}

func (s *Service) Create(ctx context.Context, name string, turnMinutes *float64, avatar *int) (*Joined, error) {
	n, err := cleanName(name)
	if err != nil {
		return nil, err
	}
	if err := cleanAvatar(avatar); err != nil {
		return nil, err
	}
	if err := cleanMinutes(turnMinutes); err != nil {
		return nil, err
	}
	var code string
	for {
		b := make([]byte, 5)
		for i := range b {
			b[i] = codeLetters[mrand.IntN(len(codeLetters))]
		}
		code = string(b)
		var taken bool
		if err := s.db.QueryRow(ctx, `SELECT exists(SELECT 1 FROM rooms WHERE code = $1)`, code).Scan(&taken); err != nil {
			return nil, err
		}
		if !taken {
			break
		}
	}
	j := &Joined{Code: code, Token: newToken()}
	err = pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `INSERT INTO rooms (code, turn_minutes) VALUES ($1, $2)`, code, turnMinutes); err != nil {
			return err
		}
		if err := tx.QueryRow(ctx, `INSERT INTO players (room_code, name, color, avatar, token_hash)
			VALUES ($1, $2, 0, $3, $4) RETURNING id::text`, code, n, avatar, HashToken(j.Token)).Scan(&j.PlayerID); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `UPDATE rooms SET host_id = $1 WHERE code = $2`, j.PlayerID, code)
		return err
	})
	if err != nil {
		return nil, err
	}
	return j, nil
}

func (s *Service) Join(ctx context.Context, code, name string, avatar *int) (*Joined, error) {
	n, err := cleanName(name)
	if err != nil {
		return nil, err
	}
	if err := cleanAvatar(avatar); err != nil {
		return nil, err
	}
	j := &Joined{Code: code, Token: newToken()}
	err = pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		l, err := load(ctx, tx, code, true)
		if err != nil {
			return err
		}
		if l.Status != "lobby" {
			return fail(409, "The game has already started")
		}
		if len(l.Players) >= MaxPlayers {
			return fail(409, "The room is full")
		}
		used := map[int]bool{}
		for _, p := range l.Players {
			used[p.Color] = true
		}
		color := 0
		for used[color] {
			color++
		}
		return tx.QueryRow(ctx, `INSERT INTO players (room_code, name, color, avatar, token_hash)
			VALUES ($1, $2, $3, $4, $5) RETURNING id::text`, code, n, color, avatar, HashToken(j.Token)).Scan(&j.PlayerID)
	})
	if err != nil {
		return nil, err
	}
	s.notify(code)
	return j, nil
}

func (s *Service) Start(ctx context.Context, code, playerID string) error {
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		l, err := load(ctx, tx, code, true)
		if err != nil {
			return err
		}
		if l.HostID != playerID {
			return fail(403, "Only the host can start the game")
		}
		if l.Status != "lobby" {
			return fail(409, "The game has already started")
		}
		if len(l.Players) < 2 {
			return fail(409, "Need at least 2 players")
		}
		rnd := newRand()
		order := append([]Player{}, l.Players...)
		rnd.Shuffle(len(order), func(i, j int) { order[i], order[j] = order[j], order[i] })
		bag := game.FullBag()
		for seat, p := range order {
			var drawn []string
			drawn, bag = game.DrawTiles(bag, game.RackSize, rnd)
			if _, err := tx.Exec(ctx, `UPDATE players SET seat = $1, rack = $2 WHERE id = $3`, seat, drawn, p.ID); err != nil {
				return err
			}
		}
		_, err = tx.Exec(ctx, `UPDATE rooms SET status = 'playing', bag = $1, turn_started_at = now()
			WHERE code = $2`, bag, code)
		return err
	})
	if err != nil {
		return err
	}
	return s.changed(ctx, code)
}

func (s *Service) View(ctx context.Context, code, playerID string) (*View, error) {
	l, err := load(ctx, s.db, code, false)
	if err != nil {
		return nil, err
	}
	v := &View{State: l.State, You: playerID, Rack: []string{}}
	for _, p := range l.Players {
		if p.ID == playerID {
			v.Rack = p.rack
		}
	}
	return v, nil
}

// EndGame lets the host stop a running game. Everyone keeps their score minus their leftover
// tiles (nobody went out), and the highest final score wins.
func (s *Service) EndGame(ctx context.Context, code, playerID string) error {
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		l, err := load(ctx, tx, code, true)
		if err != nil {
			return err
		}
		if l.HostID != playerID {
			return fail(403, "Only the host can end the game")
		}
		if l.Status != "playing" {
			return fail(409, "The game is not running")
		}
		end := &End{Leftovers: make([]string, len(l.Players)), EndedBy: &playerID}
		for i, p := range l.Players {
			end.Leftovers[i] = strings.Join(p.rack, "")
		}
		_, err = tx.Exec(ctx, `UPDATE rooms SET status = 'ended', "end" = $1 WHERE code = $2`, end, code)
		return err
	})
	if err != nil {
		return err
	}
	return s.changed(ctx, code)
}

func (s *Service) Move(ctx context.Context, code, playerID string, req MoveRequest) error {
	return s.applyMove(ctx, code, playerID, 0, req)
}

var channelRe = regexp.MustCompile(`^presence-room-([A-Z]+)$`)

// Authorize signs a Pusher presence subscription for a player in the room.
func (s *Service) Authorize(ctx context.Context, token string, body []byte) ([]byte, error) {
	form, err := url.ParseQuery(string(body))
	if err != nil {
		return nil, fail(400, "Bad auth request")
	}
	m := channelRe.FindStringSubmatch(form.Get("channel_name"))
	if m == nil {
		return nil, fail(403, "Unknown channel")
	}
	u, err := s.PlayerFor(ctx, m[1], token)
	if err != nil {
		return nil, err
	}
	auth, err := s.rt.Authorize(body, u)
	if errors.Is(err, realtime.ErrOff) {
		return nil, fail(503, "Realtime is not set up")
	}
	return auth, err
}

// RestoreTimers brings back auto-pass timers after a restart.
func (s *Service) RestoreTimers(ctx context.Context) error {
	rows, _ := s.db.Query(ctx, `SELECT code FROM rooms WHERE status = 'playing' AND turn_minutes IS NOT NULL`)
	codes, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		return err
	}
	for _, code := range codes {
		l, err := load(ctx, s.db, code, false)
		if err != nil {
			return err
		}
		s.schedule(l)
	}
	return nil
}

func (s *Service) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	for code, t := range s.timers {
		t.Stop()
		delete(s.timers, code)
	}
}
