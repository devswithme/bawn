import db from "../db/connection";

export interface ConsentType {
  consent_type_id?: number;
  type_code: string;
  display_name: string;
  description?: string;
  is_required?: boolean;
  is_active?: boolean;
}

export const ConsentService = {
  create(consent: ConsentType) {
    const stmt = db.prepare(`
      INSERT INTO CONSENT_TYPES (type_code, display_name, description, is_required, is_active)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      consent.type_code,
      consent.display_name,
      consent.description ?? "",
      consent.is_required ?? false,
      consent.is_active ?? true
    );

    return { consent_type_id: result.lastInsertRowid };
  },

  getAll() {
    return db.prepare(`SELECT * FROM CONSENT_TYPES WHERE is_active = 1`).all();
  },

  getById(id: number): ConsentType | undefined {
    return db.prepare(`SELECT * FROM CONSENT_TYPES WHERE consent_type_id = ?`).get(id) as ConsentType | undefined;
  },

  update(id: number, data: Partial<ConsentType>) {
    const existing = this.getById(id);
    if (!existing) return null;

    const stmt = db.prepare(`
      UPDATE CONSENT_TYPES
      SET type_code = ?, display_name = ?, description = ?, is_required = ?, is_active = ?
      WHERE consent_type_id = ?
    `);

    stmt.run(
      data.type_code ?? existing.type_code,
      data.display_name ?? existing.display_name,
      data.description ?? existing.description,
      data.is_required ?? existing.is_required,
      data.is_active ?? existing.is_active,
      id
    );

    return this.getById(id);
  },

  delete(id: number) {
    return db.prepare(`DELETE FROM CONSENT_TYPES WHERE consent_type_id = ?`).run(id);
  }
};