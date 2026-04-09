import { getDb } from "../db/connection";
import { ensureMigrated } from "../db/migrations";

export type MentalIndexSnapshot = {
  id: string;
  client_id: string;
  created_at: number;
  index_0_100: number;
};

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function dayKeyLocal(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function insertSnapshotIfNeeded(clientId: string, index0to100: number): Promise<boolean> {
  await ensureMigrated();
  const db = await getDb();
  const now = Date.now();
  const today = dayKeyLocal(now);

  const last = await db.getFirstAsync<{ created_at: number }>(
    `SELECT created_at
     FROM mental_index_snapshots
     WHERE client_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    clientId
  );

  if (last && dayKeyLocal(last.created_at) === today) {
    return false;
  }

  const normalized = Math.max(0, Math.min(100, Math.round(index0to100)));

  await db.runAsync(
    `INSERT INTO mental_index_snapshots (id, client_id, created_at, index_0_100)
     VALUES (?, ?, ?, ?)`,
    makeId("idx"),
    clientId,
    now,
    normalized
  );

  return true;
}

export async function listSnapshots(clientId: string, limit = 14): Promise<MentalIndexSnapshot[]> {
  await ensureMigrated();
  const db = await getDb();
  return db.getAllAsync<MentalIndexSnapshot>(
    `SELECT id, client_id, created_at, index_0_100
     FROM mental_index_snapshots
     WHERE client_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    clientId,
    limit
  );
}

export async function getMeanBaselineIndex(clientId: string): Promise<number | null> {
  await ensureMigrated();
  const db = await getDb();
  const row = await db.getFirstAsync<{ mean_index: number | null; n: number }>(
    `SELECT AVG(index_0_100) AS mean_index, COUNT(1) AS n
     FROM mental_index_snapshots
     WHERE client_id = ?`,
    clientId
  );

  if (!row || !row.n) return null;
  return typeof row.mean_index === "number" && Number.isFinite(row.mean_index) ? row.mean_index : null;
}

