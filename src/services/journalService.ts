import { getDb } from "../db/connection";
import { ensureMigrated } from "../db/migrations";

export type JournalEntry = {
  id: string;
  client_id: string;
  created_at: number;
  mood_2w: number;
  notes: string | null;
};

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function addJournalEntry(input: {
  clientId: string;
  mood2w: number;
  notes?: string;
}): Promise<JournalEntry> {
  await ensureMigrated();
  const db = await getDb();
  const id = makeId("journal");
  const createdAt = Date.now();

  await db.runAsync(
    `INSERT INTO journal_entries (id, client_id, created_at, mood_2w, notes)
     VALUES (?, ?, ?, ?, ?)`,
    id,
    input.clientId,
    createdAt,
    input.mood2w,
    input.notes?.trim() ? input.notes.trim() : null
  );

  return {
    id,
    client_id: input.clientId,
    created_at: createdAt,
    mood_2w: input.mood2w,
    notes: input.notes?.trim() ? input.notes.trim() : null,
  };
}

export async function listJournalEntries(clientId: string, limit = 30): Promise<JournalEntry[]> {
  await ensureMigrated();
  const db = await getDb();
  const rows = await db.getAllAsync<JournalEntry>(
    `SELECT id, client_id, created_at, mood_2w, notes
     FROM journal_entries
     WHERE client_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    clientId,
    limit
  );
  return rows;
}

export async function getLatestJournalEntry(clientId: string): Promise<JournalEntry | null> {
  await ensureMigrated();
  const db = await getDb();
  const row = await db.getFirstAsync<JournalEntry>(
    `SELECT id, client_id, created_at, mood_2w, notes
     FROM journal_entries
     WHERE client_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    clientId
  );
  return row ?? null;
}

