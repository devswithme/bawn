import { ensureMigrated } from "../db/migrations";
import { getDb } from "../db/connection";
import { getLatestJournalEntry } from "./journalService";

export type MentalIndexResult = {
  index: number; // 0..100
  score10: number; // 1..10
  emoji: string; // 5-level emoji derived from score10
  components: {
    accuracyScore: number;
    tapScore: number;
    journalScore: number;
  };
  debug: {
    meanAccuracy: number | null;
    meanTapCount: number | null;
    mood2w: number | null;
    z: { acc: number | null; taps: number | null; journal: number | null };
  };
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function toScore10(index0to100: number): number {
  const raw = Math.round(index0to100 / 10);
  return clamp(raw, 1, 10);
}

export function emojiForScore10(score10: number): string {
  if (score10 <= 2) return "😢";
  if (score10 <= 4) return "😟";
  if (score10 <= 6) return "😐";
  if (score10 <= 8) return "🙂";
  return "😄";
}

// Abramowitz & Stegun 7.1.26 (erf approximation)
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-ax * ax);
  return sign * y;
}

function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

function zToScore(z: number): number {
  const p = clamp(normalCdf(z), 0, 1);
  return Math.round(p * 100);
}

async function getMeanStd(clientId: string, table: string, field: string): Promise<{ mean: number | null; std: number | null }> {
  await ensureMigrated();
  const db = await getDb();
  const row = await db.getFirstAsync<{ mean: number | null; mean_sq: number | null; n: number }>(
    `SELECT AVG(${field}) AS mean, AVG(${field} * ${field}) AS mean_sq, COUNT(1) AS n
     FROM ${table}
     WHERE client_id = ?`,
    clientId
  );
  if (!row || !row.n) return { mean: null, std: null };
  const mean = row.mean ?? null;
  const meanSq = row.mean_sq ?? null;
  if (mean === null || meanSq === null) return { mean, std: null };
  const variance = Math.max(0, meanSq - mean * mean);
  const std = Math.sqrt(variance);
  return { mean, std: std > 1e-9 ? std : null };
}

export async function computeMentalIndex(clientId: string): Promise<MentalIndexResult> {
  await ensureMigrated();
  const db = await getDb();

  const gameRow = await db.getFirstAsync<{ mean_accuracy: number | null; mean_tap_count: number | null }>(
    `SELECT AVG(accuracy) AS mean_accuracy, AVG(tap_count) AS mean_tap_count
     FROM game_sessions
     WHERE client_id = ?`,
    clientId
  );

  const meanAccuracy = gameRow?.mean_accuracy ?? null;
  const meanTapCount = gameRow?.mean_tap_count ?? null;

  const journal = await getLatestJournalEntry(clientId);
  const mood2w = journal ? journal.mood_2w : null; // 0..4, higher = worse

  // Feature definitions:
  // - accuracy: higher is better
  // - tap_count: higher can imply higher arousal; we invert in scoring
  // - journal mood_2w: higher is worse; invert
  const { mean: accMu, std: accStd } = await getMeanStd(clientId, "game_sessions", "accuracy");
  const { mean: tapsMu, std: tapsStd } = await getMeanStd(clientId, "game_sessions", "tap_count");
  const { mean: moodMu, std: moodStd } = await getMeanStd(clientId, "journal_entries", "mood_2w");

  const accZ = meanAccuracy !== null && accMu !== null && accStd ? (meanAccuracy - accMu) / accStd : null;
  const tapsZ = meanTapCount !== null && tapsMu !== null && tapsStd ? (meanTapCount - tapsMu) / tapsStd : null;
  const moodZ = mood2w !== null && moodMu !== null && moodStd ? (mood2w - moodMu) / moodStd : null;

  const accuracyScore = meanAccuracy === null ? 50 : accZ === null ? Math.round(clamp(meanAccuracy, 0, 1) * 100) : zToScore(accZ);
  const tapScore = meanTapCount === null ? 50 : tapsZ === null ? Math.round(100 - clamp(meanTapCount / 400, 0, 1) * 100) : 100 - zToScore(tapsZ);
  const journalScore = mood2w === null ? 50 : moodZ === null ? Math.round(100 - clamp(mood2w / 4, 0, 1) * 100) : 100 - zToScore(moodZ);

  const index = Math.round(0.4 * accuracyScore + 0.3 * tapScore + 0.3 * journalScore);
  const score10 = toScore10(index);
  const emoji = emojiForScore10(score10);

  return {
    index,
    score10,
    emoji,
    components: { accuracyScore, tapScore, journalScore },
    debug: { meanAccuracy, meanTapCount, mood2w, z: { acc: accZ, taps: tapsZ, journal: moodZ } },
  };
}

