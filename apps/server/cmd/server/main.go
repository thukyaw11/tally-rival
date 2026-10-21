package main

import (
	"cmp"
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/thukyaw11/tally/apps/server/internal/db"
	"github.com/thukyaw11/tally/apps/server/internal/httpapi"
	"github.com/thukyaw11/tally/apps/server/internal/realtime"
	"github.com/thukyaw11/tally/apps/server/internal/rooms"
)

func main() {
	loadDotenv(".env")
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.Connect(ctx, cmp.Or(os.Getenv("DATABASE_URL"), "postgres://tally:tally@localhost:5432/tally"))
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	rt := realtime.New(os.Getenv("PUSHER_APP_ID"), os.Getenv("PUSHER_KEY"), os.Getenv("PUSHER_SECRET"), os.Getenv("PUSHER_CLUSTER"))
	svc := rooms.New(pool, rt)
	defer svc.Close()
	if err := svc.RestoreTimers(ctx); err != nil {
		log.Fatalf("restore timers: %v", err)
	}

	srv := &http.Server{
		Addr:              ":" + cmp.Or(os.Getenv("PORT"), "8787"),
		Handler:           httpapi.New(svc, os.Getenv("CORS_ORIGIN")),
		ReadHeaderTimeout: 10 * time.Second,
	}
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdown)
	}()
	log.Printf("Tally server on %s", srv.Addr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
