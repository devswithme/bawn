import { getDb } from "../db/connection";
import { ensureMigrated } from "../db/migrations";

export type GameSession = {
  id: string;
  client_id: string;
  created_at: number;
  song_id: string;
  accuracy: number;
  tap_count: number;
  speed_max: number | null;
};

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function addGameSession(input: {
  clientId: string;
  songId: string;
  accuracy: number;
  tapCount: number;
  speedMax?: number;
}): Promise<GameSession> {
  await ensureMigrated();
  const db = await getDb();
  const id = makeId("game");
  const createdAt = Date.now();

  const accuracy = Math.max(0, Math.min(1, input.accuracy));
  const tapCount = Math.max(0, Math.floor(input.tapCount));
  const speedMax = typeof input.speedMax === "number" ? input.speedMax : null;

  await db.runAsync(
    `INSERT INTO game_sessions (id, client_id, created_at, song_id, accuracy, tap_count, speed_max)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.clientId,
    createdAt,
    input.songId,
    accuracy,
    tapCount,
    speedMax
  );

  return {
    id,
    client_id: input.clientId,
    created_at: createdAt,
    song_id: input.songId,
    accuracy,
    tap_count: tapCount,
    speed_max: speedMax,
  };
}

export async function listGameSessions(clientId: string, limit = 30): Promise<GameSession[]> {
  await ensureMigrated();
  const db = await getDb();
  const rows = await db.getAllAsync<GameSession>(
    `SELECT id, client_id, created_at, song_id, accuracy, tap_count, speed_max
     FROM game_sessions
     WHERE client_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    clientId,
    limit
  );
  return rows;
}

export async function getGameStats(clientId: string): Promise<{
  meanAccuracy: number | null;
  meanTapCount: number | null;
  n: number;
}> {
  await ensureMigrated();
  const db = await getDb();

  const row = await db.getFirstAsync<{
    mean_accuracy: number | null;
    mean_tap_count: number | null;
    n: number;
  }>(
    `SELECT AVG(accuracy) AS mean_accuracy, AVG(tap_count) AS mean_tap_count, COUNT(1) AS n
     FROM game_sessions
     WHERE client_id = ?`,
    clientId
  );

  return {
    meanAccuracy: row?.mean_accuracy ?? null,
    meanTapCount: row?.mean_tap_count ?? null,
    n: row?.n ?? 0,
  };
}

