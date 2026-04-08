import { getDb } from "../db/connection";
import { ensureMigrated } from "../db/migrations";

export interface User {
  user_id?: number;
  full_name: string;
  email: string;
  phone_number: string;
  is_active?: boolean;
}

export const UserService = {
  async create(user: User) {
    await ensureMigrated();
    const db = await getDb();
    return db.runAsync(
      `INSERT INTO USERS (full_name, email, phone_number, is_active)
       VALUES (?, ?, ?, ?)`,
      user.full_name,
      user.email,
      user.phone_number,
      user.is_active ?? 1
    );
  },

  async getById(id: number): Promise<User | null> {
    await ensureMigrated();
    const db = await getDb();
    const row = await db.getFirstAsync<User>("SELECT * FROM USERS WHERE user_id = ?", id);
    return row ?? null;
  },

  async getAll(): Promise<User[]> {
    await ensureMigrated();
    const db = await getDb();
    return db.getAllAsync<User>("SELECT * FROM USERS");
  },

  async update(id: number, data: Partial<User>) {
    await ensureMigrated();
    const db = await getDb();
    const existing = await this.getById(id);
    if (!existing) return null;

    const next = { ...existing, ...data };
    return db.runAsync(
      `UPDATE USERS
       SET full_name = ?, email = ?, phone_number = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      next.full_name,
      next.email,
      next.phone_number,
      next.is_active ?? 1,
      id
    );
  },

  async delete(id: number) {
    await ensureMigrated();
    const db = await getDb();
    return db.runAsync("DELETE FROM USERS WHERE user_id = ?", id);
  },
};

