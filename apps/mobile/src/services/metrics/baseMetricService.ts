import { getDb } from "../../db/connection";
import { ensureMigrated } from "../../db/migrations";

type InsertResult = { lastInsertRowId: number; changes: number };

export function createMetricService<T extends Record<string, any>>(tableName: string, fields: string[]) {
  const placeholders = fields.map(() => "?").join(", ");
  const columns = fields.join(", ");

  return {
    async insert(data: T): Promise<InsertResult> {
      await ensureMigrated();
      const db = await getDb();
      const values = fields.map((field) => (data as any)[field] ?? null);
      const result = await db.runAsync(
        `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`,
        ...values
      );
      return { lastInsertRowId: result.lastInsertRowId, changes: result.changes };
    },

    async getByUser(userId: number): Promise<any[]> {
      await ensureMigrated();
      const db = await getDb();
      return db.getAllAsync(`SELECT * FROM ${tableName} WHERE user_id = ? ORDER BY recorded_at DESC`, userId);
    },
  };
}

