import db from "../db/connection";

export interface UserConsent {
  user_id: number;
  consent_type_id: number;
  is_granted: boolean;
  consent_version: string;
}

export const UserConsentService = {
  grant(data: UserConsent) {
    const stmt = db.prepare(`
      INSERT INTO USER_CONSENTS (user_id, consent_type_id, is_granted, granted_at, consent_version)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
    `);

    return stmt.run(
      data.user_id,
      data.consent_type_id,
      data.is_granted,
      data.consent_version
    );
  },

  revoke(userId: number, consentTypeId: number) {
    const stmt = db.prepare(`
      UPDATE USER_CONSENTS
      SET is_granted = 0, revoked_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND consent_type_id = ?
    `);

    return stmt.run(userId, consentTypeId);
  },

  getForUser(userId: number) {
    return db.prepare(`
      SELECT * FROM USER_CONSENTS WHERE user_id = ?
    `).all(userId);
  }
};