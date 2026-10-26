CREATE TABLE IF NOT EXISTS rooms (
	code text PRIMARY KEY,
	status text NOT NULL DEFAULT 'lobby',
	host_id uuid,
	turn_minutes real,
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

CREATE TABLE IF NOT EXISTS messages (
	id bigserial PRIMARY KEY,
	room_code text NOT NULL REFERENCES rooms (code) ON DELETE CASCADE,
	player_id uuid NOT NULL REFERENCES players (id) ON DELETE CASCADE,
	text text NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_room ON messages (room_code, id);

-- Half minutes (1.5, 2.5 …) need a fractional column; databases made before that have int.
DO $$
BEGIN
	IF (SELECT data_type FROM information_schema.columns
		WHERE table_name = 'rooms' AND column_name = 'turn_minutes') = 'integer' THEN
		ALTER TABLE rooms ALTER COLUMN turn_minutes TYPE real;
	END IF;
END $$;

-- Emoji avatar: an index into AVATARS (packages/game/src/avatars.ts); null = show the initial.
ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar int;

-- Word list moves are checked against: 'common' or 'tournament' (rooms made before the choice).
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS word_list text NOT NULL DEFAULT 'tournament';
