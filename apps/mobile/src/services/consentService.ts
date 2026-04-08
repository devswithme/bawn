import { getDb } from "../db/connection";
import { ensureMigrated } from "../db/migrations";

export interface ConsentType {
  consent_type_id?: number;
  type_code: string;
  display_name: string;
  description?: string;
  is_required?: boolean;
  is_active?: boolean;
}

export const ConsentService = {
  async create(consent: ConsentType) {
    await ensureMigrated();
    const db = await getDb();
    return db.runAsync(
      `INSERT INTO CONSENT_TYPES (type_code, display_name, description, is_required, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      consent.type_code,
      consent.display_name,
      consent.description ?? null,
      consent.is_required ? 1 : 0,
      consent.is_active ?? 1
    );
  },

  async getAll(): Promise<ConsentType[]> {
    await ensureMigrated();
    const db = await getDb();
    return db.getAllAsync<ConsentType>("SELECT * FROM CONSENT_TYPES");
  },

  async getById(id: number): Promise<ConsentType | null> {
    await ensureMigrated();
    const db = await getDb();
    const row = await db.getFirstAsync<ConsentType>("SELECT * FROM CONSENT_TYPES WHERE consent_type_id = ?", id);
    return row ?? null;
  },

  async update(id: number, data: Partial<ConsentType>) {
    await ensureMigrated();
    const db = await getDb();
    const existing = await this.getById(id);
    if (!existing) return null;
    const next = { ...existing, ...data };

    return db.runAsync(
      `UPDATE CONSENT_TYPES
       SET type_code = ?, display_name = ?, description = ?, is_required = ?, is_active = ?
       WHERE consent_type_id = ?`,
      next.type_code,
      next.display_name,
      next.description ?? null,
      next.is_required ? 1 : 0,
      next.is_active ?? 1,
      id
    );
  },

  async delete(id: number) {
    await ensureMigrated();
    const db = await getDb();
    return db.runAsync("DELETE FROM CONSENT_TYPES WHERE consent_type_id = ?", id);
  },
};

