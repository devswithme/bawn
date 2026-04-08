import { createMetricService } from "./baseMetricService";

export const PhysiologyService = createMetricService("PHYSIOLOGY_METRICS", [
  "user_id",
  "consent_type_id",
  "heart_rate_bpm",
  "hrv_ms",
  "skin_temp_celsius",
  "recorded_at",
]);

