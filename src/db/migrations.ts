import { getDb } from "./connection";

let didMigrate = false;

export async function ensureMigrated(): Promise<void> {
  if (didMigrate) return;
  const db = await getDb();

  await db.execAsync(`
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS permission_snapshots (
  id TEXT PRIMARY KEY,
  capability TEXT NOT NULL,
  status TEXT NOT NULL,
  value_summary TEXT,
  value_json TEXT,
  captured_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_permission_snapshots_capability_time
  ON permission_snapshots(capability, captured_at DESC);

CREATE TABLE IF NOT EXISTS change_events (
  id TEXT PRIMARY KEY,
  capability TEXT NOT NULL,
  old_json TEXT,
  new_json TEXT,
  change_type TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_change_events_time
  ON change_events(created_at DESC);

-----------------------------------
-- CORE ENTITIES BELOW (ported from SQLITE TS init.sql)
-----------------------------------
CREATE TABLE IF NOT EXISTS USERS (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT,
  email TEXT,
  phone_number TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN
);

CREATE TABLE IF NOT EXISTS CONSENT_TYPES (
  consent_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
  type_code TEXT,
  display_name TEXT,
  description TEXT,
  is_required BOOLEAN,
  is_active BOOLEAN
);

CREATE TABLE IF NOT EXISTS USER_CONSENTS (
  consent_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  consent_type_id INTEGER,
  is_granted BOOLEAN,
  granted_at TIMESTAMP,
  revoked_at TIMESTAMP,
  consent_version TEXT
);

-----------------------------------
-- RAW SENSOR METRICS TABLES BELOW (ported from SQLITE TS init.sql)
-----------------------------------
CREATE TABLE IF NOT EXISTS APP_USAGE (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  consent_type_id INTEGER,
  app_name TEXT,
  app_category TEXT,
  duration_seconds INTEGER,
  recorded_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS SCREEN_INTERACTION (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  consent_type_id INTEGER,
  tap_count INTEGER,
  swipe_count INTEGER,
  avg_session_minutes REAL,
  unlock_count INTEGER,
  recorded_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS DEVICE_USAGE (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  consent_type_id INTEGER,
  screen_on_seconds INTEGER,
  notification_count INTEGER,
  missed_calls INTEGER,
  recorded_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS MOBILITY_METRICS (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  consent_type_id INTEGER,
  step_count REAL,
  distance_meters REAL,
  floors_climbed INTEGER,
  recorded_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS LOCATION_METRICS (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  consent_type_id INTEGER,
  unique_places_visited INTEGER,
  home_radius_meters REAL,
  time_at_home_minutes INTEGER,
  recorded_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS PHYSIOLOGY_METRICS (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  consent_type_id INTEGER,
  heart_rate_bpm INTEGER,
  hrv_ms INTEGER,
  skin_temp_celsius REAL,
  recorded_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ACTIVITY_METRICS (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  consent_type_id INTEGER,
  sedentary_minutes INTEGER,
  active_minutes INTEGER,
  exercise_minutes INTEGER,
  activity_type TEXT,
  recorded_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS SLEEP_METRICS (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  consent_type_id INTEGER,
  total_sleep_minutes INTEGER,
  deep_sleep_minutes INTEGER,
  rem_sleep_minutes INTEGER,
  awake_count INTEGER,
  recorded_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS SOCIAL_INTERACTION (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  consent_type_id INTEGER,
  call_count INTEGER,
  sms_count INTEGER,
  contact_variety INTEGER,
  social_app_minutes INTEGER,
  recorded_at TIMESTAMP
);

-----------------------------------
-- APP FEATURES: JOURNAL + GAME SESSIONS
-----------------------------------
CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  mood_2w INTEGER NOT NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_client_time
  ON journal_entries(client_id, created_at DESC);

CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  song_id TEXT NOT NULL,
  accuracy REAL NOT NULL,
  tap_count INTEGER NOT NULL,
  speed_max REAL
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_client_time
  ON game_sessions(client_id, created_at DESC);

-----------------------------------
-- DASHBOARD: SCORE SNAPSHOTS (for deviation history)
-----------------------------------
CREATE TABLE IF NOT EXISTS mental_index_snapshots (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  index_0_100 INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mental_index_snapshots_client_time
  ON mental_index_snapshots(client_id, created_at DESC);
`);

  didMigrate = true;
}

