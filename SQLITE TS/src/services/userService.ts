import db from "../db/connection";

export interface User {
    user_id?: number;
    full_name: string;
    email: string;
    phone_number: string;
    is_active?: boolean;
}

export const UserService = {
  create(user: User) {
    const stmt = db.prepare(`
      INSERT INTO USERS (full_name, email, phone_number, is_active)
      VALUES (?, ?, ?, 1)
    `);

    const result = stmt.run(user.full_name, user.email, user.phone_number);
    return { user_id: result.lastInsertRowid };
  },

  getById(id: number): User | undefined {
    return db.prepare(`SELECT * FROM USERS WHERE user_id = ?`).get(id) as User |undefined;
  },

  getAll() {
    return db.prepare(`SELECT * FROM USERS ORDER BY created_at DESC`).all();
  },

  update(id: number, data: Partial<User>) {
    const existing = this.getById(id);
    if (!existing) return null;

    const stmt = db.prepare(`
      UPDATE USERS SET 
        full_name = ?, 
        email = ?, 
        phone_number = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `);

    stmt.run(
      data.full_name ?? existing.full_name,
      data.email ?? existing.email,
      data.phone_number ?? existing.phone_number,
      id
    );

    return this.getById(id);
  },

  delete(id: number) {
    const stmt = db.prepare(`DELETE FROM USERS WHERE user_id = ?`);
    return stmt.run(id);
  }
};