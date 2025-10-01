-- players
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  created_at timestamptz DEFAULT now(),
  data jsonb DEFAULT '{}'::jsonb
);

-- tasks
CREATE TABLE IF NOT EXISTS tasks (
  id serial PRIMARY KEY,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  task text NOT NULL,
  deadline timestamptz,
  done boolean DEFAULT false,
  coins integer DEFAULT 0,
  xp integer DEFAULT 0,
  stat text DEFAULT 'discipline',
  created_at timestamptz DEFAULT now()
);

-- non_negotiables
CREATE TABLE IF NOT EXISTS non_negotiables (
  id serial PRIMARY KEY,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- punishments
CREATE TABLE IF NOT EXISTS punishments (
  id serial PRIMARY KEY,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- shop items
CREATE TABLE IF NOT EXISTS shop_items (
  id serial PRIMARY KEY,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  name text NOT NULL,
  price integer NOT NULL,
  effect text,
  value integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- diary
CREATE TABLE IF NOT EXISTS diary (
  id serial PRIMARY KEY,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  entry text,
  ts timestamptz DEFAULT now()
);

-- stats / progress (optional separate table)
CREATE TABLE IF NOT EXISTS stat_progress (
  id serial PRIMARY KEY,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  stat_name text NOT NULL,
  level integer DEFAULT 1,
  xp integer DEFAULT 0,
  UNIQUE(player_id, stat_name)
);

