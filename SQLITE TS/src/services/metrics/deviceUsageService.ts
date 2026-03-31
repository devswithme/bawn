import { createMetricService } from "./baseMetricService";

export const DeviceUsageService = createMetricService("DEVICE_USAGE", [
  "user_id",
  "consent_type_id",
  "screen_on_seconds",
  "notification_count",
  "missed_calls",
  "recorded_at"
]);