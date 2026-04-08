import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  captureAndPersistSnapshot,
  getChangeSummary,
  getPermissionHistory,
  getPermissionStatus,
  getWellbeingRisk,
  getActivity,
  getAudioLevel,
  getBatteryStatus,
  getLocation,
  getUsageStats,
  requestPermission,
  startAudioLevelStream,
  stopAudioLevelStream,
} from "./src/sensing/sensing";
import type {
  ChangeEvent,
  ChangeSummary,
  PermissionSnapshot,
  SensingCapability,
  WellbeingRiskResult,
} from "./src/sensing/types";

const CAPABILITIES: SensingCapability[] = ["mobility", "location", "usage_stats", "battery", "audio_level"];

const EMPTY_SUMMARY: ChangeSummary = {
  totalChanges: 0,
  changesByCapability: {},
  recentEvents: [],
  trendSeries: [],
};

const EMPTY_RISK: WellbeingRiskResult = {
  score: 0,
  level: "low",
  reasons: ["No local trend data available yet."],
  suggestions: ["Capture snapshots over time to unlock trend-based suggestions."],
  disclaimer: "This score is non-diagnostic and only reflects app-observable behavior trends.",
};

export default function App() {
  const [activity, setActivity] = useState("Tap to load");
  const [location, setLocationState] = useState("Tap to load");
  const [usage, setUsage] = useState("Tap to load");
  const [battery, setBattery] = useState("Tap to load");
  const [audio, setAudio] = useState("Tap to load");
  const [audioStreaming, setAudioStreaming] = useState(false);
  const [statusMessage, setStatusMessage] = useState("No snapshots captured yet.");
  const [permissionStatuses, setPermissionStatuses] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<PermissionSnapshot[]>([]);
  const [changeSummary, setChangeSummary] = useState<ChangeSummary>(EMPTY_SUMMARY);
  const [risk, setRisk] = useState<WellbeingRiskResult>(EMPTY_RISK);

  useEffect(() => {
    console.info("Expo sensing demo ready");
  }, []);

  const onGetActivity = useCallback(async () => {
    const permission = await requestPermission("mobility");
    if (!permission.ok) {
      setActivity(`${permission.code}: ${permission.error}`);
      return;
    }
    const result = await getActivity();
    setActivity(result.ok ? JSON.stringify(result.data) : `${result.code}: ${result.error}`);
  }, []);

  const onGetLocation = useCallback(async () => {
    const permission = await requestPermission("location");
    if (!permission.ok) {
      setLocationState(`${permission.code}: ${permission.error}`);
      return;
    }
    const result = await getLocation();
    setLocationState(result.ok ? JSON.stringify(result.data) : `${result.code}: ${result.error}`);
  }, []);

  const onGetBattery = useCallback(async () => {
    const result = await getBatteryStatus();
    setBattery(result.ok ? JSON.stringify(result.data) : `${result.code}: ${result.error}`);
  }, []);

  const onGetUsageStats = useCallback(async () => {
    const permission = await requestPermission("usage_stats");
    if (!permission.ok) {
      setUsage(`${permission.code}: ${permission.error}`);
      return;
    }
    const result = await getUsageStats();
    if (result.ok && result.data === null) {
      setUsage("UNSUPPORTED: Usage stats are not available on this platform.");
      return;
    }
    setUsage(result.ok ? JSON.stringify(result.data) : `${result.code}: ${result.error}`);
  }, []);

  const onToggleAudio = useCallback(async () => {
    if (audioStreaming) {
      const stopResult = await stopAudioLevelStream();
      if (!stopResult.ok) {
        setAudio(`${stopResult.code}: ${stopResult.error}`);
      }
      setAudioStreaming(false);
      return;
    }

    const permission = await requestPermission("audio_level");
    if (!permission.ok) {
      setAudio(`${permission.code}: ${permission.error}`);
      return;
    }

    const streamResult = await startAudioLevelStream();
    if (!streamResult.ok) {
      setAudio(`${streamResult.code}: ${streamResult.error}`);
      return;
    }

    const levelResult = await getAudioLevel();
    setAudio(levelResult.ok ? JSON.stringify(levelResult.data) : `${levelResult.code}: ${levelResult.error}`);
    setAudioStreaming(true);
  }, [audioStreaming]);

  const onCaptureSnapshot = useCallback(async () => {
    const result = await captureAndPersistSnapshot();
    if (!result.ok || !result.data) {
      setStatusMessage(`${result.code}: ${result.error}`);
      return;
    }
    setStatusMessage(`Snapshot captured for ${result.data.capability} at ${result.data.capturedAt}.`);
  }, []);

  const onRefreshTrends = useCallback(async () => {
    const now = Date.now();
    const range = { fromTimestamp: now - 7 * 24 * 60 * 60 * 1000, toTimestamp: now };

    const summaryResult = await getChangeSummary(range);
    if (summaryResult.ok && summaryResult.data) {
      setChangeSummary(summaryResult.data);
    } else {
      setStatusMessage(`${summaryResult.code}: ${summaryResult.error}`);
    }

    const riskResult = await getWellbeingRisk(range);
    if (riskResult.ok && riskResult.data) {
      setRisk(riskResult.data);
    } else {
      setStatusMessage(`${riskResult.code}: ${riskResult.error}`);
    }

    const historyResult = await getPermissionHistory("location", range);
    if (historyResult.ok && historyResult.data) {
      setHistory(historyResult.data.slice(0, 8));
    }

    const nextStatuses: Record<string, string> = {};
    for (const capability of CAPABILITIES) {
      const status = await getPermissionStatus(capability);
      nextStatuses[capability] = status.ok && status.data ? status.data : `${status.code ?? "ERROR"}`;
    }
    setPermissionStatuses(nextStatuses);
  }, []);

  const riskStyles = [
    styles.riskBadge,
    risk.level === "high" ? styles.riskHigh : risk.level === "medium" ? styles.riskMedium : styles.riskLow,
  ];

  const renderRecentEvent = (event: ChangeEvent) => {
    return (
      <View style={styles.listItem} key={event.id}>
        <Text style={styles.listItemTitle}>
          {event.capability} · {event.changeType}
        </Text>
        <Text style={styles.listItemValue}>{event.createdAt}</Text>
      </View>
    );
  };

  const renderHistory = (item: PermissionSnapshot) => {
    return (
      <View style={styles.listItem} key={item.id}>
        <Text style={styles.listItemTitle}>
          {item.capability} · {item.status}
        </Text>
        <Text style={styles.listItemValue}>{item.capturedAt}</Text>
      </View>
    );
  };

  const renderChartBar = (score: number, timestamp: number) => {
    const widthPercent = `${Math.max(0, Math.min(100, score))}%` as const;
    return (
      <View style={styles.chartRow} key={`${timestamp}`}>
        <View style={styles.chartTrack}>
          <View style={[styles.chartFill, { width: widthPercent }]} />
        </View>
        <Text style={styles.chartLabel}>{score}</Text>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.appRoot} alwaysBounceVertical={false}>
        <Text style={styles.title}>Sensing + Wellbeing Trend Demo</Text>
        <Text style={styles.subtitle}>SQLite snapshots, permission changes, and non-diagnostic insights</Text>

        <Pressable style={styles.actionRow} onPress={onGetActivity}>
          <Text style={styles.actionLabel}>Get Activity</Text>
          <Text style={styles.valueText}>{activity}</Text>
        </Pressable>

        <Pressable style={styles.actionRow} onPress={onGetLocation}>
          <Text style={styles.actionLabel}>Get Location</Text>
          <Text style={styles.valueText}>{location}</Text>
        </Pressable>

        <Pressable style={styles.actionRow} onPress={onGetBattery}>
          <Text style={styles.actionLabel}>Get Battery</Text>
          <Text style={styles.valueText}>{battery}</Text>
        </Pressable>

        <Pressable style={styles.actionRow} onPress={onGetUsageStats}>
          <Text style={styles.actionLabel}>Get Usage Stats</Text>
          <Text style={styles.valueText}>{usage}</Text>
        </Pressable>

        <Pressable style={styles.actionRow} onPress={onToggleAudio}>
          <Text style={styles.actionLabel}>{audioStreaming ? "Stop Audio Stream" : "Start Audio Stream"}</Text>
          <Text style={styles.valueText}>{audio}</Text>
        </Pressable>

        <Pressable style={styles.actionRow} onPress={onCaptureSnapshot}>
          <Text style={styles.actionLabel}>Capture + Persist Snapshot</Text>
          <Text style={styles.valueText}>{statusMessage}</Text>
        </Pressable>

        <Pressable style={styles.actionRow} onPress={onRefreshTrends}>
          <Text style={styles.actionLabel}>Refresh Change Summary + Risk</Text>
          <Text style={styles.valueText}>Total Changes: {changeSummary.totalChanges}</Text>
        </Pressable>

        <View style={riskStyles}>
          <Text style={styles.riskTitle}>Risk Level: {risk.level.toUpperCase()}</Text>
          <Text style={styles.riskScore}>Score: {risk.score}/100</Text>
          <Text style={styles.riskDisclaimer}>{risk.disclaimer}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trend Chart (Last 7 days)</Text>
          {changeSummary.trendSeries.length === 0 ? (
            <Text style={styles.valueText}>No trend points yet.</Text>
          ) : (
            changeSummary.trendSeries.map((point) => renderChartBar(point.score, point.timestamp))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permission Statuses</Text>
          {CAPABILITIES.map((capability) => (
            <View key={capability} style={styles.listItem}>
              <Text style={styles.listItemTitle}>{capability}</Text>
              <Text style={styles.listItemValue}>{permissionStatuses[capability] ?? "unknown"}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Change Events</Text>
          {changeSummary.recentEvents.length === 0 ? (
            <Text style={styles.valueText}>No change events yet.</Text>
          ) : (
            changeSummary.recentEvents.map((event) => renderRecentEvent(event))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Location Snapshot History</Text>
          {history.length === 0 ? (
            <Text style={styles.valueText}>No history rows yet.</Text>
          ) : (
            history.map((item) => renderHistory(item))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suggestions</Text>
          {risk.suggestions.map((suggestion, index) => (
            <View style={styles.suggestionCard} key={`${index}-${suggestion}`}>
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why this score changed</Text>
          {risk.reasons.map((reason, index) => (
            <Text style={styles.valueText} key={`${index}-${reason}`}>
              - {reason}
            </Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#101622",
  },
  appRoot: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.76)",
    marginBottom: 8,
  },
  actionRow: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    gap: 6,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  valueText: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.82)",
  },
  riskBadge: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  riskLow: {
    backgroundColor: "rgba(56, 196, 120, 0.16)",
    borderColor: "rgba(56, 196, 120, 0.5)",
  },
  riskMedium: {
    backgroundColor: "rgba(255, 188, 56, 0.16)",
    borderColor: "rgba(255, 188, 56, 0.5)",
  },
  riskHigh: {
    backgroundColor: "rgba(255, 87, 87, 0.16)",
    borderColor: "rgba(255, 87, 87, 0.5)",
  },
  riskTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  riskScore: {
    fontSize: 14,
    marginTop: 6,
    color: "#fff",
  },
  riskDisclaimer: {
    fontSize: 12,
    marginTop: 6,
    color: "rgba(255, 255, 255, 0.78)",
  },
  section: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 2,
  },
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  listItemTitle: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.92)",
    flex: 1,
  },
  listItemValue: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.72)",
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  chartTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    overflow: "hidden",
  },
  chartFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#7ca6ff",
  },
  chartLabel: {
    width: 52,
    fontSize: 12,
    textAlign: "right",
    color: "rgba(255, 255, 255, 0.84)",
  },
  suggestionCard: {
    borderRadius: 10,
    padding: 10,
    backgroundColor: "rgba(124, 166, 255, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(124, 166, 255, 0.35)",
  },
  suggestionText: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.9)",
  },
});
