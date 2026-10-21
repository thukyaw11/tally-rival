package main

import (
	"bufio"
	"os"
	"strings"
)

// loadDotenv reads KEY=value lines from .env for local runs; real env vars win.
func loadDotenv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()
	scan := bufio.NewScanner(f)
	for scan.Scan() {
		line := strings.TrimSpace(scan.Text())
		key, value, ok := strings.Cut(line, "=")
		if !ok || strings.HasPrefix(line, "#") {
			continue
		}
		key = strings.TrimSpace(key)
		if _, set := os.LookupEnv(key); !set {
			os.Setenv(key, strings.Trim(strings.TrimSpace(value), `"'`))
		}
	}
}
