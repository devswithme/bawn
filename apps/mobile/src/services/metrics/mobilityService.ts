import { createMetricService } from "./baseMetricService";

export const MobilityService = createMetricService("MOBILITY_METRICS", [
  "user_id",
  "consent_type_id",
  "step_count",
  "distance_meters",
  "floors_climbed",
  "recorded_at",
]);

