package httpapi

import (
	"bytes"
	"cmp"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/thukyaw11/tally/apps/server/internal/db"
	"github.com/thukyaw11/tally/apps/server/internal/game"
	"github.com/thukyaw11/tally/apps/server/internal/realtime"
	"github.com/thukyaw11/tally/apps/server/internal/rooms"
)

type fakeRealtime struct {
	mu       sync.Mutex
	triggers []string
}

func (f *fakeRealtime) Trigger(channel, event string, _ any) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.triggers = append(f.triggers, channel+" "+event)
	return nil
}

func (f *fakeRealtime) Authorize(_ []byte, u realtime.User) ([]byte, error) {
	return json.Marshal(map[string]string{"auth": "signed", "user": u.ID})
}

type env struct {
	t   *testing.T
	srv *httptest.Server
	svc *rooms.Service
	rt  *fakeRealtime
}

// Needs the Docker Postgres: `docker compose up -d` in the repo root.
func setup(t *testing.T) *env {
	t.Helper()
	ctx := context.Background()
	url := cmp.Or(os.Getenv("TEST_DATABASE_URL"), "postgres://tally:tally@localhost:5432/tally_test")
	pool, err := db.Connect(ctx, url)
	if err != nil {
		t.Skipf("no test database (%v); run `docker compose up -d`", err)
	}
	t.Cleanup(pool.Close)
	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "TRUNCATE rooms CASCADE"); err != nil {
		t.Fatal(err)
	}
	rt := &fakeRealtime{}
	svc := rooms.New(pool, rt)
	t.Cleanup(svc.Close)
	srv := httptest.NewServer(New(svc, ""))
	t.Cleanup(srv.Close)
	return &env{t, srv, svc, rt}
}

// call sends a JSON request and decodes the reply into out (if not nil); it returns the status.
func (e *env) call(method, path, token string, body, out any) int {
	e.t.Helper()
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req, _ := http.NewRequest(method, e.srv.URL+path, &buf)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		e.t.Fatal(err)
	}
	defer res.Body.Close()
	if out != nil {
		_ = json.NewDecoder(res.Body).Decode(out)
	}
	return res.StatusCode
}

func (e *env) create(name string, minutes *int) rooms.Joined {
	e.t.Helper()
	var j rooms.Joined
	if s := e.call("POST", "/rooms", "", map[string]any{"name": name, "turnMinutes": minutes}, &j); s != 201 {
		e.t.Fatalf("create: %d", s)
	}
	return j
}

func (e *env) join(code, name string) rooms.Joined {
	e.t.Helper()
	var j rooms.Joined
	if s := e.call("POST", "/rooms/"+code+"/join", "", map[string]string{"name": name}, &j); s != 201 {
		e.t.Fatalf("join: %d", s)
	}
	return j
}

func (e *env) view(j rooms.Joined) rooms.View {
	e.t.Helper()
	var v rooms.View
	if s := e.call("GET", "/rooms/"+j.Code, j.Token, nil, &v); s != 200 {
		e.t.Fatalf("view: %d", s)
	}
	return v
}

// current returns whoever's turn it is.
func current(v rooms.View, players []rooms.Joined) rooms.Joined {
	id := v.Players[len(v.Moves)%len(v.Players)].ID
	for _, p := range players {
		if p.PlayerID == id {
			return p
		}
	}
	panic("no current player")
}

func tilesFrom(rack []string, row, col int) []game.PlacedTile {
	tiles := []game.PlacedTile{}
	for i, l := range rack {
		t := game.PlacedTile{Row: row, Col: col + i, Letter: l}
		if l == "?" {
			t.Letter, t.Blank = "E", true
		}
		tiles = append(tiles, t)
	}
	return tiles
}

func TestFullGameFlow(t *testing.T) {
	e := setup(t)
	ann := e.create("Ann", nil)
	bo := e.join(ann.Code, "Bo")
	cy := e.join(strings.ToLower(ann.Code), "Cy")
	players := []rooms.Joined{ann, bo, cy}

	lobby := e.view(bo)
	if lobby.Status != "lobby" || len(lobby.Players) != 3 || lobby.HostID != ann.PlayerID {
		t.Fatalf("lobby: %+v", lobby.State)
	}
	if s := e.call("POST", "/rooms/"+ann.Code+"/start", bo.Token, nil, nil); s != 403 {
		t.Fatalf("non-host start: %d", s)
	}
	var v rooms.View
	if s := e.call("POST", "/rooms/"+ann.Code+"/start", ann.Token, nil, &v); s != 200 {
		t.Fatalf("start: %d", s)
	}
	if v.Status != "playing" || len(v.Rack) != 7 || v.BagCount != 79 || !slices.Equal(v.RackCounts, []int{7, 7, 7}) {
		t.Fatalf("after start: %+v rack %v", v.State, v.Rack)
	}
	if s := e.call("POST", "/rooms/"+ann.Code+"/join", "", map[string]string{"name": "Di"}, nil); s != 409 {
		t.Fatalf("join after start: %d", s)
	}

	// Other players' racks never leave the server.
	var raw map[string]any
	e.call("GET", "/rooms/"+ann.Code, bo.Token, nil, &raw)
	if p := raw["players"].([]any)[0].(map[string]any); p["rack"] != nil {
		t.Fatal("players list leaks a rack")
	}

	first := current(v, players)
	for _, p := range players {
		if p != first {
			move := map[string]any{"kind": "pass"}
			if s := e.call("POST", "/rooms/"+p.Code+"/move", p.Token, move, nil); s != 409 {
				t.Fatalf("out of turn: %d", s)
			}
			break
		}
	}

	rack := e.view(first).Rack
	play := map[string]any{"kind": "play", "tiles": tilesFrom(rack[:2], 7, 7)}
	if s := e.call("POST", "/rooms/"+first.Code+"/move", first.Token, play, &v); s != 200 {
		t.Fatalf("play: %d", s)
	}
	if len(v.Moves) != 1 || v.Moves[0].Score <= 0 || len(v.Rack) != 7 || v.BagCount != 77 {
		t.Fatalf("after play: moves %+v rack %v bag %d", v.Moves, v.Rack, v.BagCount)
	}

	// Letters the next player doesn't hold are refused.
	second := current(v, players)
	rack = e.view(second).Rack
	missing := "A"
	for c := 'A'; c <= 'Z'; c++ {
		if !slices.Contains(rack, string(c)) {
			missing = string(c)
			break
		}
	}
	var errBody map[string]string
	bad := map[string]any{"kind": "play", "tiles": tilesFrom([]string{missing, missing}, 8, 7)}
	if s := e.call("POST", "/rooms/"+second.Code+"/move", second.Token, bad, &errBody); s != 400 ||
		errBody["error"] != "Those tiles are not on your rack" {
		t.Fatalf("missing letters: %d %v", s, errBody)
	}

	swap := map[string]any{"kind": "swap", "letters": rack[:2]}
	if s := e.call("POST", "/rooms/"+second.Code+"/move", second.Token, swap, &v); s != 200 {
		t.Fatalf("swap: %d", s)
	}
	if len(v.Rack) != 7 || v.BagCount != 77 || v.Moves[1].Kind != "swap" {
		t.Fatalf("after swap: rack %v bag %d", v.Rack, v.BagCount)
	}
	if len(e.rt.triggers) == 0 || e.rt.triggers[0] != "presence-room-"+ann.Code+" updated" {
		t.Fatalf("triggers: %v", e.rt.triggers)
	}
}

func TestRoomLimits(t *testing.T) {
	e := setup(t)
	host := e.create("Ann", nil)
	for _, n := range []string{"Bo", "Cy", "Di"} {
		e.join(host.Code, n)
	}
	if s := e.call("POST", "/rooms/"+host.Code+"/join", "", map[string]string{"name": "Ed"}, nil); s != 409 {
		t.Fatalf("fifth player: %d", s)
	}

	solo := e.create("Solo", nil)
	if s := e.call("POST", "/rooms/"+solo.Code+"/start", solo.Token, nil, nil); s != 409 {
		t.Fatalf("start alone: %d", s)
	}
	one := 1
	if s := e.call("POST", "/rooms", "", map[string]any{"name": "X", "turnMinutes": one}, nil); s != 400 {
		t.Fatalf("1 minute timer: %d", s)
	}
	if s := e.call("POST", "/rooms", "", map[string]any{"name": "  "}, nil); s != 400 {
		t.Fatalf("blank name: %d", s)
	}
	if s := e.call("POST", "/rooms/ZZZZZ/join", "", map[string]string{"name": "Bo"}, nil); s != 404 {
		t.Fatalf("unknown room: %d", s)
	}
	if s := e.call("GET", "/rooms/"+host.Code, "", nil, nil); s != 401 {
		t.Fatalf("no token: %d", s)
	}
}

func TestSixScorelessTurnsEndTheGame(t *testing.T) {
	e := setup(t)
	ann := e.create("Ann", nil)
	bo := e.join(ann.Code, "Bo")
	players := []rooms.Joined{ann, bo}
	e.call("POST", "/rooms/"+ann.Code+"/start", ann.Token, nil, nil)

	var v rooms.View
	for range 6 {
		p := current(e.view(ann), players)
		if s := e.call("POST", "/rooms/"+p.Code+"/move", p.Token, map[string]string{"kind": "pass"}, &v); s != 200 {
			t.Fatalf("pass: %d", s)
		}
	}
	if v.Status != "ended" || v.End == nil || v.End.WentOut != nil || len(v.End.Leftovers[0]) != 7 {
		t.Fatalf("end: %+v %+v", v.State, v.End)
	}
	if s := e.call("POST", "/rooms/"+ann.Code+"/move", ann.Token, map[string]string{"kind": "pass"}, nil); s != 409 {
		t.Fatalf("move after end: %d", s)
	}
}

func TestTimerPassesForSlowPlayer(t *testing.T) {
	e := setup(t)
	e.svc.Minute, e.svc.Grace = 20*time.Millisecond, 0
	two := 2
	ann := e.create("Ann", &two)
	e.join(ann.Code, "Bo")
	e.call("POST", "/rooms/"+ann.Code+"/start", ann.Token, nil, nil)

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if v := e.view(ann); len(v.Moves) > 0 {
			if v.Moves[0].Kind != "pass" || v.Moves[0].Player != 0 {
				t.Fatalf("auto move: %+v", v.Moves[0])
			}
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("timer did not pass the turn")
}

func TestPusherAuth(t *testing.T) {
	e := setup(t)
	ann := e.create("Ann", nil)
	other := e.create("Bo", nil)
	auth := func(token, code string) int {
		form := url.Values{"socket_id": {"1.2"}, "channel_name": {"presence-room-" + code}}
		req, _ := http.NewRequest("POST", e.srv.URL+"/pusher/auth", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.Header.Set("Authorization", "Bearer "+token)
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		return res.StatusCode
	}
	if s := auth(ann.Token, ann.Code); s != 200 {
		t.Fatalf("own room: %d", s)
	}
	if s := auth(ann.Token, other.Code); s != 401 {
		t.Fatalf("other room: %d", s)
	}
	if s := auth("", ann.Code); s != 401 {
		t.Fatalf("no token: %d", s)
	}
}
