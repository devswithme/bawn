import { createMetricService } from "./baseMetricService";

export const AppUsageService = createMetricService("APP_USAGE", [
  "user_id",
  "consent_type_id",
  "app_name",
  "app_category",
  "duration_seconds",
  "recorded_at"
]);