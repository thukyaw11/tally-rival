// Package httpapi exposes the rooms service over HTTP.
package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"

	"github.com/thukyaw11/tally/apps/server/internal/game"
	"github.com/thukyaw11/tally/apps/server/internal/rooms"
)

var letterRe = regexp.MustCompile(`^[A-Z]$`)

func send(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func sendErr(w http.ResponseWriter, err error) {
	var re *rooms.Error
	if errors.As(err, &re) {
		send(w, re.Status, map[string]string{"error": re.Msg})
		return
	}
	log.Print(err)
	send(w, http.StatusInternalServerError, map[string]string{"error": "Server error"})
}

func readJSON(r *http.Request, v any) error {
	if err := json.NewDecoder(io.LimitReader(r.Body, 64<<10)).Decode(v); err != nil {
		return &rooms.Error{Status: 400, Msg: "Body must be JSON"}
	}
	return nil
}

func token(r *http.Request) string {
	return strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
}

func code(r *http.Request) string { return strings.ToUpper(r.PathValue("code")) }

func checkMove(m rooms.MoveRequest) error {
	bad := &rooms.Error{Status: 400, Msg: "Bad move"}
	switch m.Kind {
	case "pass":
	case "swap":
		for _, l := range m.Letters {
			if l != "?" && !letterRe.MatchString(l) {
				return bad
			}
		}
	case "play":
		if len(m.Tiles) < 1 || len(m.Tiles) > game.RackSize {
			return bad
		}
		for _, t := range m.Tiles {
			if !letterRe.MatchString(t.Letter) {
				return bad
			}
		}
	default:
		return bad
	}
	return nil
}

// New returns the API handler; corsOrigin is the web app's origin ("*" when empty).
func New(svc *rooms.Service, corsOrigin string) http.Handler {
	if corsOrigin == "" {
		corsOrigin = "*"
	}
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		send(w, 200, map[string]bool{"ok": true})
	})

	mux.HandleFunc("POST /rooms", func(w http.ResponseWriter, r *http.Request) {
		var b struct {
			Name        string `json:"name"`
			TurnMinutes *int   `json:"turnMinutes"`
		}
		if err := readJSON(r, &b); err != nil {
			sendErr(w, err)
			return
		}
		j, err := svc.Create(r.Context(), b.Name, b.TurnMinutes)
		if err != nil {
			sendErr(w, err)
			return
		}
		send(w, 201, j)
	})

	mux.HandleFunc("POST /rooms/{code}/join", func(w http.ResponseWriter, r *http.Request) {
		var b struct {
			Name string `json:"name"`
		}
		if err := readJSON(r, &b); err != nil {
			sendErr(w, err)
			return
		}
		j, err := svc.Join(r.Context(), code(r), b.Name)
		if err != nil {
			sendErr(w, err)
			return
		}
		send(w, 201, j)
	})

	// The rest need the player's token; each returns the caller's fresh view.
	withPlayer := func(act func(r *http.Request, playerID string) error) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			me, err := svc.PlayerFor(r.Context(), code(r), token(r))
			if err == nil && act != nil {
				err = act(r, me.ID)
			}
			if err != nil {
				sendErr(w, err)
				return
			}
			v, err := svc.View(r.Context(), code(r), me.ID)
			if err != nil {
				sendErr(w, err)
				return
			}
			send(w, 200, v)
		}
	}

	mux.HandleFunc("GET /rooms/{code}", withPlayer(nil))

	mux.HandleFunc("POST /rooms/{code}/start", withPlayer(func(r *http.Request, id string) error {
		return svc.Start(r.Context(), code(r), id)
	}))

	mux.HandleFunc("POST /rooms/{code}/move", withPlayer(func(r *http.Request, id string) error {
		var m rooms.MoveRequest
		if err := readJSON(r, &m); err != nil {
			return err
		}
		if err := checkMove(m); err != nil {
			return err
		}
		return svc.Move(r.Context(), code(r), id, m)
	}))

	// pusher-js sends a form body with socket_id and channel_name.
	mux.HandleFunc("POST /pusher/auth", func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(io.LimitReader(r.Body, 4<<10))
		if err != nil {
			sendErr(w, err)
			return
		}
		auth, err := svc.Authorize(r.Context(), token(r), body)
		if err != nil {
			sendErr(w, err)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(auth)
	})

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", corsOrigin)
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		mux.ServeHTTP(w, r)
	})
}
