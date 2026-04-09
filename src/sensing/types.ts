export type SensingCapability = "mobility" | "location" | "usage_stats" | "battery" | "audio_level";

export type PermissionState = "granted" | "denied" | "restricted" | "unsupported" | "unknown";
export type RiskLevel = "low" | "medium" | "high";
export type ChangeType = "status_changed" | "value_shift" | "new_capability" | "stale_data";

export interface TimeRange {
  fromTimestamp: number;
  toTimestamp: number;
}

export interface ActivityResult {
  type: "walking" | "running" | "stationary" | "cycling" | "automotive" | "unknown";
  confidence?: number;
  timestamp?: number;
}

export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  timestamp?: number;
}

export interface UsageStatsAppEntry {
  packageName: string;
  foregroundTimeMs: number;
  lastUsedTimestamp?: number;
}

export interface UsageStatsResult {
  windowStartTimestamp: number;
  windowEndTimestamp: number;
  apps: UsageStatsAppEntry[];
}

export interface BatteryStatusResult {
  level: number;
  charging: boolean;
  state?: "charging" | "full" | "unplugged" | "unknown";
}

export interface AudioLevelResult {
  rms: number;
  peak: number;
  timestamp?: number;
}

export interface PermissionSnapshot {
  id: string;
  capability: SensingCapability;
  status: PermissionState;
  valueSummary?: string;
  valueJson?: Record<string, unknown> | null;
  capturedAt: number;
}

export interface ChangeEvent {
  id: string;
  capability: SensingCapability;
  changeType: ChangeType;
  oldJson?: Record<string, unknown> | null;
  newJson?: Record<string, unknown> | null;
  createdAt: number;
}

export interface TrendSeriesPoint {
  timestamp: number;
  score: number;
}

export interface ChangeSummary {
  totalChanges: number;
  changesByCapability: Partial<Record<SensingCapability, number>>;
  recentEvents: ChangeEvent[];
  trendSeries: TrendSeriesPoint[];
}

export interface WellbeingRiskResult {
  score: number;
  level: RiskLevel;
  reasons: string[];
  suggestions: string[];
  disclaimer: string;
}

export interface SensingResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: "UNAVAILABLE" | "UNSUPPORTED" | "PERMISSION_DENIED" | "NATIVE_ERROR";
}

