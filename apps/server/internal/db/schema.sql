CREATE TABLE IF NOT EXISTS rooms (
	code text PRIMARY KEY,
	status text NOT NULL DEFAULT 'lobby',
	host_id uuid,
	turn_minutes int,
	bag jsonb NOT NULL DEFAULT '[]',
	turn_started_at timestamptz,
	"end" jsonb,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS players (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	room_code text NOT NULL REFERENCES rooms (code) ON DELETE CASCADE,
	name text NOT NULL,
	color int NOT NULL,
	seat int,
	token_hash text NOT NULL UNIQUE,
	rack jsonb NOT NULL DEFAULT '[]',
	joined_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS moves (
	room_code text NOT NULL REFERENCES rooms (code) ON DELETE CASCADE,
	seq int NOT NULL,
	player int NOT NULL,
	kind text NOT NULL,
	tiles jsonb NOT NULL DEFAULT '[]',
	score int NOT NULL DEFAULT 0,
	PRIMARY KEY (room_code, seq)
);
