// Package realtime sends room updates through Pusher.
package realtime

import (
	"errors"
	"log"

	"github.com/pusher/pusher-http-go/v5"
)

type User struct {
	ID   string
	Name string
}

type Realtime interface {
	Trigger(channel, event string, data any) error
	// Authorize signs a presence subscription; body is the raw form pusher-js sent.
	Authorize(body []byte, user User) ([]byte, error)
}

var ErrOff = errors.New("realtime is not set up")

func RoomChannel(code string) string { return "presence-room-" + code }

type pusherRealtime struct{ client *pusher.Client }

func (p pusherRealtime) Trigger(channel, event string, data any) error {
	return p.client.Trigger(channel, event, data)
}

func (p pusherRealtime) Authorize(body []byte, user User) ([]byte, error) {
	return p.client.AuthorizePresenceChannel(body, pusher.MemberData{
		UserID:   user.ID,
		UserInfo: map[string]string{"name": user.Name},
	})
}

type off struct{}

func (off) Trigger(string, string, any) error      { return nil }
func (off) Authorize([]byte, User) ([]byte, error) { return nil, ErrOff }

// New uses Pusher when all keys are set; otherwise realtime is off (fine for local work).
func New(appID, key, secret, cluster string) Realtime {
	if appID == "" || key == "" || secret == "" || cluster == "" {
		log.Print("Pusher env vars missing: realtime is off")
		return off{}
	}
	return pusherRealtime{&pusher.Client{AppID: appID, Key: key, Secret: secret, Cluster: cluster, Secure: true}}
}
