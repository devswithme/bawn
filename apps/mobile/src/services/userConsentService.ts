import { getDb } from "../db/connection";
import { ensureMigrated } from "../db/migrations";

export interface UserConsent {
  user_id: number;
  consent_type_id: number;
  is_granted: boolean;
  consent_version: string;
}

export const UserConsentService = {
  async grant(data: UserConsent) {
    await ensureMigrated();
    const db = await getDb();
    return db.runAsync(
      `
      INSERT INTO USER_CONSENTS (user_id, consent_type_id, is_granted, granted_at, consent_version)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
    `,
      data.user_id,
      data.consent_type_id,
      data.is_granted ? 1 : 0,
      data.consent_version
    );
  },

  async revoke(userId: number, consentTypeId: number) {
    await ensureMigrated();
    const db = await getDb();
    return db.runAsync(
      `
      UPDATE USER_CONSENTS
      SET is_granted = 0, revoked_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND consent_type_id = ?
    `,
      userId,
      consentTypeId
    );
  },

  async getForUser(userId: number) {
    await ensureMigrated();
    const db = await getDb();
    return db.getAllAsync(
      `
      SELECT * FROM USER_CONSENTS WHERE user_id = ?
    `,
      userId
    );
  },
};

