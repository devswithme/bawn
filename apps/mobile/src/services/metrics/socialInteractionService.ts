import { createMetricService } from "./baseMetricService";

export const SocialInteractionService = createMetricService("SOCIAL_INTERACTION", [
  "user_id",
  "consent_type_id",
  "call_count",
  "sms_count",
  "contact_variety",
  "social_app_minutes",
  "recorded_at",
]);

