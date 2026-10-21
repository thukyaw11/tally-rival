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
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

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
	t    *testing.T
	srv  *httptest.Server
	svc  *rooms.Service
	rt   *fakeRealtime
	pool *pgxpool.Pool
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
	return &env{t, srv, svc, rt, pool}
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

func (e *env) create(name string, minutes *float64) rooms.Joined {
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

// setRack replaces a player's tiles (letters, '?' for a blank).
func (e *env) setRack(j rooms.Joined, letters string) {
	e.t.Helper()
	rack := strings.Split(letters, "")
	if _, err := e.pool.Exec(context.Background(), `UPDATE players SET rack = $1 WHERE id = $2`, rack, j.PlayerID); err != nil {
		e.t.Fatal(err)
	}
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

	// Racks are random, so give the first player known tiles.
	e.setRack(first, "XQATSER")
	var errBody map[string]string
	bad := map[string]any{"kind": "play", "tiles": tilesFrom([]string{"X", "Q"}, 7, 7)}
	if s := e.call("POST", "/rooms/"+first.Code+"/move", first.Token, bad, &errBody); s != 400 ||
		errBody["error"] != "Not in the word list: XQ" {
		t.Fatalf("invalid word: %d %v", s, errBody)
	}
	play := map[string]any{"kind": "play", "tiles": tilesFrom([]string{"A", "T"}, 7, 7)}
	if s := e.call("POST", "/rooms/"+first.Code+"/move", first.Token, play, &v); s != 200 {
		t.Fatalf("play: %d", s)
	}
	if len(v.Moves) != 1 || v.Moves[0].Score <= 0 || len(v.Rack) != 7 || v.BagCount != 77 {
		t.Fatalf("after play: moves %+v rack %v bag %d", v.Moves, v.Rack, v.BagCount)
	}

	// Letters the next player doesn't hold are refused.
	second := current(v, players)
	rack := e.view(second).Rack
	missing := "A"
	for c := 'A'; c <= 'Z'; c++ {
		if !slices.Contains(rack, string(c)) {
			missing = string(c)
			break
		}
	}
	bad = map[string]any{"kind": "play", "tiles": tilesFrom([]string{missing, missing}, 8, 7)}
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
	for _, bad := range []float64{1, 1.25, 2.2, 10.5} {
		if s := e.call("POST", "/rooms", "", map[string]any{"name": "X", "turnMinutes": bad}, nil); s != 400 {
			t.Fatalf("%v minute timer: %d", bad, s)
		}
	}
	for _, good := range []float64{1.5, 2.5, 10} {
		j := e.create("X", &good)
		if v := e.view(j); v.TurnMinutes == nil || *v.TurnMinutes != good {
			t.Fatalf("timer %v came back as %v", good, v.TurnMinutes)
		}
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
	// 1:30 per turn, with a minute of 20 ms.
	ninety := 1.5
	ann := e.create("Ann", &ninety)
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

func TestChat(t *testing.T) {
	e := setup(t)
	ann := e.create("Ann", nil)
	bo := e.join(ann.Code, "Bo")
	other := e.create("Cy", nil)
	path := "/rooms/" + ann.Code + "/chat"
	say := func(j rooms.Joined, text string) (int, rooms.Message) {
		var m rooms.Message
		s := e.call("POST", path, j.Token, map[string]string{"text": text}, &m)
		return s, m
	}
	list := func(j rooms.Joined, query string) []rooms.Message {
		var out struct{ Messages []rooms.Message }
		if s := e.call("GET", path+query, j.Token, nil, &out); s != 200 {
			t.Fatalf("list: %d", s)
		}
		return out.Messages
	}

	// Lobby chat.
	s, first := say(ann, "  hi Bo!  ")
	if s != 201 || first.Text != "hi Bo!" || first.PlayerID != ann.PlayerID {
		t.Fatalf("say: %d %+v", s, first)
	}
	if msgs := list(bo, ""); len(msgs) != 1 || msgs[0].Text != "hi Bo!" {
		t.Fatalf("list: %+v", msgs)
	}
	if !slices.Contains(e.rt.triggers, "presence-room-"+ann.Code+" chat") {
		t.Fatalf("no chat event: %v", e.rt.triggers)
	}

	// Still works once the game runs; ?after only returns newer messages.
	e.call("POST", "/rooms/"+ann.Code+"/start", ann.Token, nil, nil)
	if s, _ := say(bo, "👏"); s != 201 {
		t.Fatalf("game chat: %d", s)
	}
	if msgs := list(ann, "?after="+strconv.FormatInt(first.ID, 10)); len(msgs) != 1 || msgs[0].Text != "👏" {
		t.Fatalf("after: %+v", msgs)
	}

	if s, _ := say(ann, "   "); s != 400 {
		t.Fatalf("empty: %d", s)
	}
	if s, _ := say(ann, strings.Repeat("a", rooms.ChatMax+1)); s != 400 {
		t.Fatalf("too long: %d", s)
	}
	if s, _ := say(ann, strings.Repeat("é", rooms.ChatMax)); s != 201 {
		t.Fatalf("200 characters: %d", s)
	}
	if s := e.call("POST", path, "", map[string]string{"text": "x"}, nil); s != 401 {
		t.Fatalf("no token: %d", s)
	}
	if s := e.call("GET", path, other.Token, nil, nil); s != 401 {
		t.Fatalf("other room: %d", s)
	}

	// Bo has sent 1; four more are fine, the sixth within 5 s is refused.
	for i := range 4 {
		if s, _ := say(bo, "spam"); s != 201 {
			t.Fatalf("message %d: %d", i+2, s)
		}
	}
	var errBody map[string]string
	if s := e.call("POST", path, bo.Token, map[string]string{"text": "spam"}, &errBody); s != 429 {
		t.Fatalf("rate limit: %d %v", s, errBody)
	}
}

func TestMigrateMakesOldMinutesColumnFractional(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	if _, err := e.pool.Exec(ctx, "ALTER TABLE rooms ALTER COLUMN turn_minutes TYPE int"); err != nil {
		t.Fatal(err)
	}
	if err := db.Migrate(ctx, e.pool); err != nil {
		t.Fatal(err)
	}
	var kind string
	err := e.pool.QueryRow(ctx, `SELECT data_type FROM information_schema.columns
		WHERE table_name = 'rooms' AND column_name = 'turn_minutes'`).Scan(&kind)
	if err != nil || kind != "real" {
		t.Fatalf("column type %q, err %v", kind, err)
	}
}

func TestAvatars(t *testing.T) {
	e := setup(t)
	fox := 0
	var ann rooms.Joined
	if s := e.call("POST", "/rooms", "", map[string]any{"name": "Ann", "avatar": fox}, &ann); s != 201 {
		t.Fatalf("create: %d", s)
	}
	frog := 1
	var bo rooms.Joined
	if s := e.call("POST", "/rooms/"+ann.Code+"/join", "", map[string]any{"name": "Bo", "avatar": frog}, &bo); s != 201 {
		t.Fatalf("join: %d", s)
	}
	cy := e.join(ann.Code, "Cy")
	v := e.view(cy)
	got := map[string]*int{}
	for _, p := range v.Players {
		got[p.Name] = p.Avatar
	}
	if got["Ann"] == nil || *got["Ann"] != 0 || got["Bo"] == nil || *got["Bo"] != 1 || got["Cy"] != nil {
		t.Fatalf("avatars: %v %v %v", got["Ann"], got["Bo"], got["Cy"])
	}
	for _, bad := range []int{-1, game.AvatarCount} {
		if s := e.call("POST", "/rooms/"+ann.Code+"/join", "", map[string]any{"name": "Di", "avatar": bad}, nil); s != 400 {
			t.Fatalf("avatar %d: %d", bad, s)
		}
		if s := e.call("POST", "/rooms", "", map[string]any{"name": "Di", "avatar": bad}, nil); s != 400 {
			t.Fatalf("create with avatar %d: %d", bad, s)
		}
	}
}

func TestHostEndsGame(t *testing.T) {
	e := setup(t)
	e.svc.Minute, e.svc.Grace = 30*time.Millisecond, 0
	ninety := 1.5
	ann := e.create("Ann", &ninety)
	bo := e.join(ann.Code, "Bo")
	path := "/rooms/" + ann.Code + "/end"

	if s := e.call("POST", path, ann.Token, nil, nil); s != 409 {
		t.Fatalf("end in lobby: %d", s)
	}
	e.call("POST", "/rooms/"+ann.Code+"/start", ann.Token, nil, nil)
	if s := e.call("POST", path, bo.Token, nil, nil); s != 403 {
		t.Fatalf("non-host end: %d", s)
	}
	before := len(e.rt.triggers)
	var v rooms.View
	if s := e.call("POST", path, ann.Token, nil, &v); s != 200 {
		t.Fatalf("host end: %d", s)
	}
	if v.Status != "ended" || v.End == nil || v.End.WentOut != nil || v.End.EndedBy == nil || *v.End.EndedBy != ann.PlayerID {
		t.Fatalf("end state: %+v %+v", v.State, v.End)
	}
	for i, left := range v.End.Leftovers {
		if len(left) != 7 {
			t.Fatalf("player %d leftovers %q", i, left)
		}
	}
	if len(e.rt.triggers) == before {
		t.Fatal("no update sent")
	}
	if s := e.call("POST", path, ann.Token, nil, nil); s != 409 {
		t.Fatalf("second end: %d", s)
	}
	if s := e.call("POST", "/rooms/"+ann.Code+"/move", ann.Token, map[string]string{"kind": "pass"}, nil); s != 409 {
		t.Fatalf("move after end: %d", s)
	}
	// The turn timer (1:30 of 30 ms minutes) must not pass for anyone after the end.
	time.Sleep(150 * time.Millisecond)
	if v := e.view(ann); len(v.Moves) != 0 {
		t.Fatalf("timer moved after end: %+v", v.Moves)
	}
}
