import db from "../../db/connection";

export function createMetricService(tableName: string, fields: string[]) {
  return {
    insert(data: any) {
      const placeholders = fields.map(() => "?").join(",");
      const stmt = db.prepare(`
        INSERT INTO ${tableName} (${fields.join(",")})
        VALUES (${placeholders})
      `);

      const values = fields.map(f => data[f]);
      return stmt.run(values);
    },

    getByUser(userId: number) {
      return db.prepare(`
        SELECT * FROM ${tableName}
        WHERE user_id = ?
        ORDER BY recorded_at DESC
      `).all(userId);
    }
  };
}