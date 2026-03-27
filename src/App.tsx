import { useCallback, useEffect, useState } from "@lynx-js/react";

import "./App.css";
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
} from "./sensing";
import type {
  ChangeEvent,
  ChangeSummary,
  PermissionSnapshot,
  SensingCapability,
  WellbeingRiskResult,
} from "./sensing-contract";

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

export function App(props: { onRender?: () => void }) {
  const [activity, setActivity] = useState("Tap to load");
  const [location, setLocation] = useState("Tap to load");
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
    "background only";
    console.info("Sensing demo ready");
  }, []);
  props.onRender?.();

  const onGetActivity = useCallback(async () => {
    "background only";
    await requestPermission("mobility");
    const result = await getActivity();
    setActivity(result.ok ? JSON.stringify(result.data) : `${result.code}: ${result.error}`);
  }, []);

  const onGetLocation = useCallback(async () => {
    "background only";
    await requestPermission("location");
    const result = await getLocation();
    setLocation(result.ok ? JSON.stringify(result.data) : `${result.code}: ${result.error}`);
  }, []);

  const onGetBattery = useCallback(async () => {
    "background only";
    const result = await getBatteryStatus();
    setBattery(result.ok ? JSON.stringify(result.data) : `${result.code}: ${result.error}`);
  }, []);

  const onGetUsageStats = useCallback(async () => {
    "background only";
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
    "background only";
    if (audioStreaming) {
      const stopResult = await stopAudioLevelStream();
      if (!stopResult.ok) {
        setAudio(`${stopResult.code}: ${stopResult.error}`);
      }
      setAudioStreaming(false);
      return;
    }

    await requestPermission("audio_level");
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
    "background only";
    const result = await captureAndPersistSnapshot();
    if (!result.ok || !result.data) {
      setStatusMessage(`${result.code}: ${result.error}`);
      return;
    }
    setStatusMessage(`Snapshot captured for ${result.data.capability} at ${result.data.capturedAt}.`);
  }, []);

  const onRefreshTrends = useCallback(async () => {
    "background only";
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

  const riskClassName = risk.level === "high" ? "RiskHigh" : risk.level === "medium" ? "RiskMedium" : "RiskLow";

  const renderRecentEvent = (event: ChangeEvent) => {
    return (
      <view className="ListItem" key={event.id}>
        <text className="ListItemTitle">
          {event.capability} · {event.changeType}
        </text>
        <text className="ListItemValue">{event.createdAt}</text>
      </view>
    );
  };

  const renderHistory = (item: PermissionSnapshot) => {
    return (
      <view className="ListItem" key={item.id}>
        <text className="ListItemTitle">
          {item.capability} · {item.status}
        </text>
        <text className="ListItemValue">{item.capturedAt}</text>
      </view>
    );
  };

  const renderChartBar = (score: number, timestamp: number) => {
    return (
      <view className="ChartRow" key={`${timestamp}`}>
        <view className="ChartTrack">
          <view className="ChartFill" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
        </view>
        <text className="ChartLabel">{score}</text>
      </view>
    );
  };

  return (
    <view className="AppRoot">
      <text className="Title">Sensing + Wellbeing Trend Demo</text>
      <text className="Subtitle">SQLite snapshots, permission changes, and non-diagnostic insights</text>

      <view className="ActionRow" bindtap={onGetActivity}>
        <text className="ActionLabel">Get Activity</text>
        <text className="ValueText">{activity}</text>
      </view>

      <view className="ActionRow" bindtap={onGetLocation}>
        <text className="ActionLabel">Get Location</text>
        <text className="ValueText">{location}</text>
      </view>

      <view className="ActionRow" bindtap={onGetBattery}>
        <text className="ActionLabel">Get Battery</text>
        <text className="ValueText">{battery}</text>
      </view>

      <view className="ActionRow" bindtap={onGetUsageStats}>
        <text className="ActionLabel">Get Usage Stats</text>
        <text className="ValueText">{usage}</text>
      </view>

      <view className="ActionRow" bindtap={onToggleAudio}>
        <text className="ActionLabel">{audioStreaming ? "Stop Audio Stream" : "Start Audio Stream"}</text>
        <text className="ValueText">{audio}</text>
      </view>

      <view className="ActionRow" bindtap={onCaptureSnapshot}>
        <text className="ActionLabel">Capture + Persist Snapshot</text>
        <text className="ValueText">{statusMessage}</text>
      </view>

      <view className="ActionRow" bindtap={onRefreshTrends}>
        <text className="ActionLabel">Refresh Change Summary + Risk</text>
        <text className="ValueText">Total Changes: {changeSummary.totalChanges}</text>
      </view>

      <view className={`RiskBadge ${riskClassName}`}>
        <text className="RiskTitle">Risk Level: {risk.level.toUpperCase()}</text>
        <text className="RiskScore">Score: {risk.score}/100</text>
        <text className="RiskDisclaimer">{risk.disclaimer}</text>
      </view>

      <view className="Section">
        <text className="SectionTitle">Trend Chart (Last 7 days)</text>
        {changeSummary.trendSeries.length === 0 ? (
          <text className="ValueText">No trend points yet.</text>
        ) : (
          changeSummary.trendSeries.map((point) => renderChartBar(point.score, point.timestamp))
        )}
      </view>

      <view className="Section">
        <text className="SectionTitle">Permission Statuses</text>
        {CAPABILITIES.map((capability) => (
          <view key={capability} className="ListItem">
            <text className="ListItemTitle">{capability}</text>
            <text className="ListItemValue">{permissionStatuses[capability] ?? "unknown"}</text>
          </view>
        ))}
      </view>

      <view className="Section">
        <text className="SectionTitle">Recent Change Events</text>
        {changeSummary.recentEvents.length === 0 ? (
          <text className="ValueText">No change events yet.</text>
        ) : (
          changeSummary.recentEvents.map((event) => renderRecentEvent(event))
        )}
      </view>

      <view className="Section">
        <text className="SectionTitle">Recent Location Snapshot History</text>
        {history.length === 0 ? (
          <text className="ValueText">No history rows yet.</text>
        ) : (
          history.map((item) => renderHistory(item))
        )}
      </view>

      <view className="Section">
        <text className="SectionTitle">Suggestions</text>
        {risk.suggestions.map((suggestion, index) => (
          <view className="SuggestionCard" key={`${index}-${suggestion}`}>
            <text className="SuggestionText">{suggestion}</text>
          </view>
        ))}
      </view>

      <view className="Section">
        <text className="SectionTitle">Why this score changed</text>
        {risk.reasons.map((reason, index) => (
          <text className="ValueText" key={`${index}-${reason}`}>
            - {reason}
          </text>
        ))}
      </view>
    </view>
  );
}
