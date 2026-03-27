# Native `Sensing` Module Integration

This project is a Lynx JS bundle, so Android/iOS native code lives in your host app repository.
Use this as the implementation contract for the host-side `NativeModules.Sensing`.

## Capability to Platform Mapping

| Category | Android Permission/API | iOS Framework/Class |
| --- | --- | --- |
| Mobility | `ACTIVITY_RECOGNITION` + Activity Recognition APIs | `CMMotionActivityManager` |
| Location | `ACCESS_FINE_LOCATION` + `FusedLocationProviderClient`/`LocationManager` | `CLLocationManager` |
| Usage | `PACKAGE_USAGE_STATS` + `UsageStatsManager` | Not supported |
| Hardware/Battery | Public battery APIs (`BatteryManager`, `ACTION_BATTERY_CHANGED`) | `UIDevice` battery APIs |
| Audio Level | `RECORD_AUDIO` + `AudioRecord` RMS/peak | `AVAudioSession` + `AVAudioEngine`/`AVAudioRecorder` |

## JS Contract

Implement these methods in native and expose them under `NativeModules.Sensing`:

- `requestPermission(capability)`
- `getPermissionStatus(capability)`
- `getActivity()`
- `getLocation()`
- `getUsageStats(windowMs?)`
- `getBatteryStatus()`
- `getAudioLevel()`
- `startAudioLevelStream(intervalMs?)`
- `stopAudioLevelStream()`
- `captureAndPersistSnapshot()`
- `getPermissionHistory(capability, range?)`
- `getChangeSummary(range?)`
- `getWellbeingRisk(range?)`

`capability` values:
- `"mobility"`
- `"location"`
- `"usage_stats"`
- `"battery"`
- `"audio_level"`

## Android Skeleton (Kotlin)

```kotlin
class SensingModule : LynxNativeModule {
  suspend fun requestPermission(capability: String): String { /* granted|denied|... */ }
  suspend fun getPermissionStatus(capability: String): String { /* granted|denied|... */ }

  suspend fun getActivity(): Map<String, Any?> {
    // Requires ACTIVITY_RECOGNITION
    return mapOf("type" to "walking", "confidence" to 85, "timestamp" to System.currentTimeMillis())
  }

  suspend fun getLocation(): Map<String, Any?> {
    // Requires ACCESS_FINE_LOCATION
    return mapOf("latitude" to 0.0, "longitude" to 0.0, "accuracy" to 10.0)
  }

  suspend fun getUsageStats(windowMs: Long?): Map<String, Any?>? {
    // Requires PACKAGE_USAGE_STATS user opt-in in settings
    return mapOf(
      "windowStartTimestamp" to (System.currentTimeMillis() - (windowMs ?: 3600000)),
      "windowEndTimestamp" to System.currentTimeMillis(),
      "apps" to listOf(
        mapOf("packageName" to "com.example", "foregroundTimeMs" to 120000L)
      )
    )
  }

  suspend fun getBatteryStatus(): Map<String, Any?> {
    // Use public APIs, not BATTERY_STATS
    return mapOf("level" to 0.72, "charging" to true, "state" to "charging")
  }

  suspend fun getAudioLevel(): Map<String, Any?> {
    // Requires RECORD_AUDIO; return metering values only
    return mapOf("rms" to 0.12, "peak" to 0.31, "timestamp" to System.currentTimeMillis())
  }

  suspend fun startAudioLevelStream(intervalMs: Long?) { /* start metering timer */ }
  suspend fun stopAudioLevelStream() { /* stop metering timer */ }
}
```

## iOS Skeleton (Swift)

```swift
final class SensingModule: NSObject {
  func requestPermission(_ capability: String, resolve: @escaping (Any?) -> Void, reject: @escaping (Error) -> Void) {}
  func getPermissionStatus(_ capability: String, resolve: @escaping (Any?) -> Void, reject: @escaping (Error) -> Void) {}

  func getActivity(resolve: @escaping (Any?) -> Void, reject: @escaping (Error) -> Void) {
    // CMMotionActivityManager
    resolve(["type": "walking", "confidence": 80, "timestamp": Date().timeIntervalSince1970 * 1000])
  }

  func getLocation(resolve: @escaping (Any?) -> Void, reject: @escaping (Error) -> Void) {
    // CLLocationManager + requestWhenInUseAuthorization
    resolve(["latitude": 0.0, "longitude": 0.0, "accuracy": 10.0])
  }

  func getUsageStats(resolve: @escaping (Any?) -> Void, reject: @escaping (Error) -> Void) {
    // Not supported on iOS
    resolve(nil)
  }

  func getBatteryStatus(resolve: @escaping (Any?) -> Void, reject: @escaping (Error) -> Void) {
    UIDevice.current.isBatteryMonitoringEnabled = true
    resolve([
      "level": UIDevice.current.batteryLevel,
      "charging": UIDevice.current.batteryState == .charging || UIDevice.current.batteryState == .full
    ])
  }

  func getAudioLevel(resolve: @escaping (Any?) -> Void, reject: @escaping (Error) -> Void) {
    // AVAudioSession + AVAudioEngine/AVAudioRecorder metering
    resolve(["rms": 0.10, "peak": 0.25, "timestamp": Date().timeIntervalSince1970 * 1000])
  }

  func startAudioLevelStream(_ intervalMs: NSNumber?) {}
  func stopAudioLevelStream() {}
}
```

## Required iOS `Info.plist` keys

- `NSLocationWhenInUseUsageDescription`
- `NSMicrophoneUsageDescription`
- `NSMotionUsageDescription`

## Notes

- `BATTERY_STATS` is restricted on Android; prefer public battery APIs.
- `PACKAGE_USAGE_STATS` requires explicit user enablement in system settings.
- For audio, compute only level metrics (RMS/peak) and avoid storing raw audio.

## SQLite Schema Proposal

Keep storage in the native host app database layer (not inside the Lynx bundle).

```sql
CREATE TABLE permission_snapshots (
  id TEXT PRIMARY KEY,
  capability TEXT NOT NULL,
  status TEXT NOT NULL,
  value_json TEXT,
  captured_at INTEGER NOT NULL
);

CREATE INDEX idx_permission_snapshots_capability_time
  ON permission_snapshots(capability, captured_at DESC);

CREATE TABLE change_events (
  id TEXT PRIMARY KEY,
  capability TEXT NOT NULL,
  old_json TEXT,
  new_json TEXT,
  change_type TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_change_events_time
  ON change_events(created_at DESC);
```

## Native Method Semantics for DB-backed APIs

- `captureAndPersistSnapshot()`
  - Collect current values across capabilities.
  - Insert one or more rows in `permission_snapshots`.
  - Compare with previous snapshot values and append rows in `change_events` when deltas are detected.
  - Return the latest stored snapshot record payload.

- `getPermissionHistory(capability, range?)`
  - Return ordered rows from `permission_snapshots` by capability and optional time range.
  - If capability is unsupported on platform, return empty array with status `unsupported` snapshots only if you choose to materialize unsupported rows.

- `getChangeSummary(range?)`
  - Aggregate:
    - `totalChanges`
    - `changesByCapability`
    - `recentEvents`
    - `trendSeries` (for chart points, score 0-100 over time buckets)

- `getWellbeingRisk(range?)`
  - Compute **non-diagnostic** score from trend + change signals.
  - Return:
    - score `0..100`
    - level `low|medium|high`
    - reasons list
    - actionable suggestions list
    - disclaimer text

## Platform Normalization Rules

- Android:
  - Usage stats can be `granted` only when usage access is enabled in system settings.
  - Permission revocations should emit `change_events` entries.

- iOS:
  - Usage stats must be normalized to unsupported behavior.
  - Keep payload structure consistent with Android, but return empty datasets where APIs are unavailable.
