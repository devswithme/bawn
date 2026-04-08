import { createMetricService } from "./baseMetricService";

export const ActivityService = createMetricService("ACTIVITY_METRICS", [
  "user_id",
  "consent_type_id",
  "sedentary_minutes",
  "active_minutes",
  "exercise_minutes",
  "activity_type",
  "recorded_at",
]);

