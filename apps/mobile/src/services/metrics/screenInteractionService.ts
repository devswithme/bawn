import { createMetricService } from "./baseMetricService";

export const ScreenInteractionService = createMetricService("SCREEN_INTERACTION", [
  "user_id",
  "consent_type_id",
  "tap_count",
  "swipe_count",
  "avg_session_minutes",
  "unlock_count",
  "recorded_at",
]);

