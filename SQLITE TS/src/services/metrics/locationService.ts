import { createMetricService } from "./baseMetricService";

export const LocationService = createMetricService("LOCATION_METRICS", [
  "user_id",
  "consent_type_id",
  "unique_places_visited",
  "home_radius_meters",
  "time_at_home_minutes",
  "recorded_at"
]);