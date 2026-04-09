import { Audio } from "expo-av";
import * as Battery from "expo-battery";
import * as Location from "expo-location";

import { getDb } from "../db/connection";
import { ensureMigrated } from "../db/migrations";
import type {
  ActivityResult,
  AudioLevelResult,
  BatteryStatusResult,
  ChangeEvent,
  ChangeSummary,
  LocationResult,
  PermissionSnapshot,
  PermissionState,
  SensingCapability,
  SensingResult,
  TimeRange,
  UsageStatsResult,
  WellbeingRiskResult,
} from "./types";

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "Unknown error";
}

function ok<T>(data: T): SensingResult<T> {
  return { ok: true, data };
}

function unsupported<T>(message: string): SensingResult<T> {
  return { ok: false, code: "UNSUPPORTED", error: message };
}

function permissionDenied<T>(message: string): SensingResult<T> {
  return { ok: false, code: "PERMISSION_DENIED", error: message };
}

async function withInit<T>(fn: () => Promise<SensingResult<T>>): Promise<SensingResult<T>> {
  try {
    await ensureMigrated();
    return await fn();
  } catch (error) {
    return { ok: false, code: "NATIVE_ERROR", error: normalizeErrorMessage(error) };
  }
}

function mapExpoPermission(status?: string): PermissionState {
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  if (status === "undetermined") return "unknown";
  return "unknown";
}

export async function requestPermission(capability: SensingCapability): Promise<SensingResult<PermissionState>> {
  return withInit(async () => {
    try {
      if (capability === "location") {
        const res = await Location.requestForegroundPermissionsAsync();
        return ok(mapExpoPermission(res.status));
      }
      if (capability === "audio_level") {
        const res = await Audio.requestPermissionsAsync();
        return ok(mapExpoPermission(res.status));
      }
      if (capability === "battery") {
        return ok("granted");
      }
      if (capability === "mobility") {
        return unsupported("Activity recognition is not available in Expo managed by default.");
      }
      if (capability === "usage_stats") {
        return unsupported("Usage stats are not available in Expo managed by default.");
      }
      return ok("unknown");
    } catch (error) {
      return { ok: false, code: "NATIVE_ERROR", error: normalizeErrorMessage(error) };
    }
  });
}

export async function getPermissionStatus(capability: SensingCapability): Promise<SensingResult<PermissionState>> {
  return withInit(async () => {
    try {
      if (capability === "location") {
        const res = await Location.getForegroundPermissionsAsync();
        return ok(mapExpoPermission(res.status));
      }
      if (capability === "audio_level") {
        const res = await Audio.getPermissionsAsync();
        return ok(mapExpoPermission(res.status));
      }
      if (capability === "battery") {
        return ok("granted");
      }
      if (capability === "mobility" || capability === "usage_stats") {
        return ok("unsupported");
      }
      return ok("unknown");
    } catch (error) {
      return { ok: false, code: "NATIVE_ERROR", error: normalizeErrorMessage(error) };
    }
  });
}

export async function getActivity(): Promise<SensingResult<ActivityResult>> {
  return withInit(async () => unsupported("Activity recognition is not implemented in Expo managed."));
}

export async function getLocation(): Promise<SensingResult<LocationResult>> {
  return withInit(async () => {
    const status = await Location.getForegroundPermissionsAsync();
    if (status.status !== "granted") {
      return permissionDenied("Location permission not granted.");
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return ok({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? undefined,
      altitude: pos.coords.altitude ?? undefined,
      timestamp: pos.timestamp,
    });
  });
}

export async function getUsageStats(_windowMs = 60 * 60 * 1000): Promise<SensingResult<UsageStatsResult | null>> {
  return withInit(async () => ok(null));
}

export async function getBatteryStatus(): Promise<SensingResult<BatteryStatusResult>> {
  return withInit(async () => {
    const level = await Battery.getBatteryLevelAsync();
    const power = await Battery.getPowerStateAsync();
    const state = power.batteryState;
    const charging = state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;
    const mappedState =
      state === Battery.BatteryState.CHARGING
        ? "charging"
        : state === Battery.BatteryState.FULL
          ? "full"
          : state === Battery.BatteryState.UNPLUGGED
            ? "unplugged"
            : "unknown";
    return ok({ level, charging, state: mappedState });
  });
}

type AudioStreamState = {
  recording: Audio.Recording | null;
  intervalId: ReturnType<typeof setInterval> | null;
};

const audioState: AudioStreamState = {
  recording: null,
  intervalId: null,
};

export async function getAudioLevel(): Promise<SensingResult<AudioLevelResult>> {
  return withInit(async () => {
    if (!audioState.recording) {
      return unsupported("Audio metering is only available while the audio stream is running.");
    }
    const status = await audioState.recording.getStatusAsync();
    const metering = "metering" in status ? (status as any).metering : undefined;
    if (typeof metering !== "number") {
      return unsupported("Audio metering is not available on this platform/runtime.");
    }

    const clampedDb = Math.max(-160, Math.min(0, metering));
    const normalized = (clampedDb + 160) / 160;
    return ok({
      rms: Number(normalized.toFixed(3)),
      peak: Number(normalized.toFixed(3)),
      timestamp: Date.now(),
    });
  });
}

export async function startAudioLevelStream(intervalMs = 500): Promise<SensingResult<null>> {
  return withInit(async () => {
    if (audioState.recording) return ok(null);
    const permission = await Audio.getPermissionsAsync();
    if (permission.status !== "granted") {
      return permissionDenied("Microphone permission not granted.");
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync({
      ...Audio.RecordingOptionsPresets.LOW_QUALITY,
      android: {
        ...Audio.RecordingOptionsPresets.LOW_QUALITY.android,
        isMeteringEnabled: true,
      },
      ios: {
        ...Audio.RecordingOptionsPresets.LOW_QUALITY.ios,
        isMeteringEnabled: true,
      },
      web: Audio.RecordingOptionsPresets.LOW_QUALITY.web,
    } as any);
    await recording.startAsync();

    audioState.recording = recording;
    audioState.intervalId = setInterval(() => {
      void recording.getStatusAsync();
    }, intervalMs);
    return ok(null);
  });
}

export async function stopAudioLevelStream(): Promise<SensingResult<null>> {
  return withInit(async () => {
    if (audioState.intervalId) {
      clearInterval(audioState.intervalId);
      audioState.intervalId = null;
    }
    if (audioState.recording) {
      try {
        await audioState.recording.stopAndUnloadAsync();
      } finally {
        audioState.recording = null;
      }
    }
    return ok(null);
  });
}

async function getCapabilityValue(capability: SensingCapability): Promise<{
  status: PermissionState;
  valueJson: Record<string, unknown> | null;
  valueSummary: string | null;
}> {
  const statusResult = await getPermissionStatus(capability);
  const status = statusResult.ok && statusResult.data ? statusResult.data : "unknown";

  if (status !== "granted") {
    return { status, valueJson: null, valueSummary: null };
  }

  if (capability === "location") {
    const loc = await getLocation();
    if (!loc.ok || !loc.data) return { status: "unknown", valueJson: null, valueSummary: null };
    const valueJson = {
      latitude: loc.data.latitude,
      longitude: loc.data.longitude,
      accuracy: loc.data.accuracy,
    };
    return { status, valueJson, valueSummary: "location" };
  }

  if (capability === "battery") {
    const bat = await getBatteryStatus();
    if (!bat.ok || !bat.data) return { status: "unknown", valueJson: null, valueSummary: null };
    const valueJson = { level: bat.data.level, charging: bat.data.charging, state: bat.data.state };
    return { status, valueJson, valueSummary: "battery" };
  }

  if (capability === "audio_level") {
    const audio = await getAudioLevel();
    if (!audio.ok || !audio.data) return { status: "unknown", valueJson: null, valueSummary: null };
    const valueJson = { rms: audio.data.rms, peak: audio.data.peak };
    return { status, valueJson, valueSummary: "audio_level" };
  }

  return { status: "unsupported", valueJson: null, valueSummary: null };
}

export async function captureAndPersistSnapshot(): Promise<SensingResult<PermissionSnapshot>> {
  return withInit(async () => {
    const db = await getDb();
    const capturedAt = Date.now();

    let returned: PermissionSnapshot | null = null;

    for (const capability of ["location", "battery", "audio_level", "mobility", "usage_stats"] as SensingCapability[]) {
      const { status, valueJson, valueSummary } = await getCapabilityValue(capability);
      const id = makeId("snap");

      const last = await db.getFirstAsync<{ value_json: string | null; status: string | null }>(
        "SELECT status, value_json FROM permission_snapshots WHERE capability = ? ORDER BY captured_at DESC LIMIT 1",
        capability
      );

      await db.runAsync(
        `INSERT INTO permission_snapshots (id, capability, status, value_summary, value_json, captured_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        id,
        capability,
        status,
        valueSummary,
        valueJson ? JSON.stringify(valueJson) : null,
        capturedAt
      );

      const oldJson = last?.value_json ? safeParseJson(last.value_json) : null;
      const oldStatus = (last?.status as PermissionState | null) ?? null;
      const changed =
        oldStatus !== null &&
        (oldStatus !== status || JSON.stringify(oldJson ?? null) !== JSON.stringify(valueJson ?? null));

      if (changed) {
        await db.runAsync(
          `INSERT INTO change_events (id, capability, old_json, new_json, change_type, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          makeId("evt"),
          capability,
          oldJson ? JSON.stringify(oldJson) : null,
          valueJson ? JSON.stringify(valueJson) : null,
          oldStatus !== status ? "status_changed" : "value_shift",
          capturedAt
        );
      } else if (oldStatus === null) {
        await db.runAsync(
          `INSERT INTO change_events (id, capability, old_json, new_json, change_type, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          makeId("evt"),
          capability,
          null,
          valueJson ? JSON.stringify(valueJson) : null,
          "new_capability",
          capturedAt
        );
      }

      const snapshot: PermissionSnapshot = {
        id,
        capability,
        status,
        valueSummary: valueSummary ?? undefined,
        valueJson,
        capturedAt,
      };

      if (!returned && (capability === "location" || capability === "battery")) {
        returned = snapshot;
      }
    }

    return ok(returned ?? { id: makeId("snap"), capability: "battery", status: "unknown", capturedAt });
  });
}

function safeParseJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function getPermissionHistory(
  capability: SensingCapability,
  range?: TimeRange
): Promise<SensingResult<PermissionSnapshot[]>> {
  return withInit(async () => {
    const db = await getDb();
    const rows = await db.getAllAsync<{
      id: string;
      capability: string;
      status: string;
      value_summary: string | null;
      value_json: string | null;
      captured_at: number;
    }>(
      `SELECT id, capability, status, value_summary, value_json, captured_at
       FROM permission_snapshots
       WHERE capability = ?
       ${range ? "AND captured_at BETWEEN ? AND ?" : ""}
       ORDER BY captured_at DESC`,
      ...(range ? ([capability, range.fromTimestamp, range.toTimestamp] as any) : ([capability] as any))
    );

    return ok(
      rows.map((row) => ({
        id: row.id,
        capability: row.capability as SensingCapability,
        status: row.status as PermissionState,
        valueSummary: row.value_summary ?? undefined,
        valueJson: row.value_json ? safeParseJson(row.value_json) : null,
        capturedAt: row.captured_at,
      }))
    );
  });
}

export async function getChangeSummary(range?: TimeRange): Promise<SensingResult<ChangeSummary>> {
  return withInit(async () => {
    const db = await getDb();
    const args = range ? ([range.fromTimestamp, range.toTimestamp] as any) : ([] as any);
    const where = range ? "WHERE created_at BETWEEN ? AND ?" : "";

    const changeRows = await db.getAllAsync<{
      id: string;
      capability: string;
      change_type: string;
      old_json: string | null;
      new_json: string | null;
      created_at: number;
    }>(
      `SELECT id, capability, change_type, old_json, new_json, created_at
       FROM change_events
       ${where}
       ORDER BY created_at DESC`,
      ...args
    );

    const changesByCapability: Partial<Record<SensingCapability, number>> = {};
    for (const row of changeRows) {
      const cap = row.capability as SensingCapability;
      changesByCapability[cap] = (changesByCapability[cap] ?? 0) + 1;
    }

    const recentEvents: ChangeEvent[] = changeRows.slice(0, 10).map((row) => ({
      id: row.id,
      capability: row.capability as SensingCapability,
      changeType: row.change_type as any,
      oldJson: row.old_json ? safeParseJson(row.old_json) : null,
      newJson: row.new_json ? safeParseJson(row.new_json) : null,
      createdAt: row.created_at,
    }));

    const series = buildTrendSeries(changeRows, range);

    return ok({
      totalChanges: changeRows.length,
      changesByCapability,
      recentEvents,
      trendSeries: series,
    });
  });
}

function buildTrendSeries(
  events: Array<{ created_at: number }>,
  range?: TimeRange
): Array<{ timestamp: number; score: number }> {
  const now = Date.now();
  const from = range?.fromTimestamp ?? now - 7 * 24 * 60 * 60 * 1000;
  const to = range?.toTimestamp ?? now;
  const dayMs = 24 * 60 * 60 * 1000;

  const buckets = new Map<number, number>();
  for (const evt of events) {
    const t = evt.created_at;
    if (t < from || t > to) continue;
    const day = Math.floor(t / dayMs) * dayMs;
    buckets.set(day, (buckets.get(day) ?? 0) + 1);
  }

  const result: Array<{ timestamp: number; score: number }> = [];
  for (let day = Math.floor(from / dayMs) * dayMs; day <= to; day += dayMs) {
    const count = buckets.get(day) ?? 0;
    const score = Math.max(0, Math.min(100, count * 15));
    result.push({ timestamp: day, score });
  }
  return result;
}

export async function getWellbeingRisk(range?: TimeRange): Promise<SensingResult<WellbeingRiskResult>> {
  return withInit(async () => {
    const summary = await getChangeSummary(range);
    if (!summary.ok || !summary.data) {
      return { ok: false, code: summary.code, error: summary.error };
    }

    const points = summary.data.trendSeries;
    const avg = points.length ? points.reduce((a, p) => a + p.score, 0) / points.length : 0;
    const score = Math.round(Math.max(0, Math.min(100, avg)));
    const level = score >= 70 ? "high" : score >= 35 ? "medium" : "low";

    const reasons: string[] = [];
    const suggestions: string[] = [];

    if (summary.data.totalChanges === 0) {
      reasons.push("No change events recorded for the selected time range.");
      suggestions.push("Capture snapshots daily to establish a baseline trend.");
    } else {
      reasons.push(`Detected ${summary.data.totalChanges} change events in the selected time range.`);
      if ((summary.data.changesByCapability.location ?? 0) > 0) {
        reasons.push("Location permission/value changes contributed to the trend signal.");
      }
      if ((summary.data.changesByCapability.audio_level ?? 0) > 0) {
        reasons.push("Microphone permission/value changes contributed to the trend signal.");
      }

      if (level === "high") {
        suggestions.push("Review recent permission changes and ensure they match your current needs.");
        suggestions.push("If unexpected changes occurred, consider tightening app permissions.");
      } else if (level === "medium") {
        suggestions.push("Keep monitoring changes and capture a few more snapshots for stability.");
      } else {
        suggestions.push("Trends look stable; continue periodic snapshots to keep insights fresh.");
      }
    }

    return ok({
      score,
      level,
      reasons,
      suggestions,
      disclaimer: "This score is non-diagnostic and only reflects app-observable behavior trends.",
    });
  });
}

