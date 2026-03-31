import { createMetricService } from "./baseMetricService";

export const SleepService = createMetricService("SLEEP_METRICS", [
  "user_id",
  "consent_type_id",
  "total_sleep_minutes",
  "deep_sleep_minutes",
  "rem_sleep_minutes",
  "awake_count",
  "recorded_at"
]);