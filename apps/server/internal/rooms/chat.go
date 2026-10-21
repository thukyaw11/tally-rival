package rooms

import (
	"context"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"

	"github.com/thukyaw11/tally/apps/server/internal/realtime"
)

const (
	ChatMax = 200
	// At most chatBurst messages per chatWindow for each player.
	chatBurst   = 5
	chatWindow  = 5 * time.Second
	chatHistory = 100
)

type Message struct {
	ID       int64     `json:"id"`
	PlayerID string    `json:"playerId"`
	Text     string    `json:"text"`
	At       time.Time `json:"at"`
}

// allowChat records a message for the rate limit; false means the player is sending too fast.
func (s *Service) allowChat(playerID string) bool {
	s.chatMu.Lock()
	defer s.chatMu.Unlock()
	now := time.Now()
	recent := s.sent[playerID][:0]
	for _, t := range s.sent[playerID] {
		if now.Sub(t) < chatWindow {
			recent = append(recent, t)
		}
	}
	if len(recent) >= chatBurst {
		s.sent[playerID] = recent
		return false
	}
	s.sent[playerID] = append(recent, now)
	return true
}

// Chat saves a message and sends it to everyone in the room. Works in any room status.
func (s *Service) Chat(ctx context.Context, code, playerID, text string) (*Message, error) {
	text = strings.TrimSpace(text)
	if text == "" || utf8.RuneCountInString(text) > ChatMax {
		return nil, fail(400, "Messages must be 1–200 characters")
	}
	if !s.allowChat(playerID) {
		return nil, fail(429, "Slow down a little")
	}
	m := &Message{PlayerID: playerID, Text: text}
	err := s.db.QueryRow(ctx, `INSERT INTO messages (room_code, player_id, text) VALUES ($1, $2, $3)
		RETURNING id, created_at`, code, playerID, text).Scan(&m.ID, &m.At)
	if err != nil {
		return nil, err
	}
	// Small enough for a Pusher event, so clients don't need to fetch it.
	if err := s.rt.Trigger(realtime.RoomChannel(code), "chat", m); err != nil {
		s.notifyFailed(code, err)
	}
	return m, nil
}

// Messages returns the last 100 messages, or only those after the given id. Oldest first.
func (s *Service) Messages(ctx context.Context, code string, after int64) ([]Message, error) {
	rows, _ := s.db.Query(ctx, `SELECT id, player_id::text, text, created_at FROM (
			SELECT * FROM messages WHERE room_code = $1 AND id > $2 ORDER BY id DESC LIMIT $3
		) recent ORDER BY id`, code, after, chatHistory)
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (Message, error) {
		var m Message
		err := row.Scan(&m.ID, &m.PlayerID, &m.Text, &m.At)
		return m, err
	})
}
