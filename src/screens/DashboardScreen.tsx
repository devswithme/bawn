import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { getOrCreateClientId } from "../lib/clientId";
import { computeMentalIndex } from "../services/mentalIndexService";
import { getMeanBaselineIndex, insertSnapshotIfNeeded, listSnapshots } from "../services/mentalIndexHistoryService";

type LoadState =
  | { kind: "loading" }
  | {
      kind: "ready";
      clientId: string;
      index0to100: number;
      score10: number;
      emoji: string;
      details: string;
      deviationPct: number | null;
      deviationStatus: "netral" | "waspada" | "mengkhawatirkan" | "butuh_data";
      history: Array<{ createdAt: number; status: "netral" | "waspada" | "mengkhawatirkan" }>;
    }
  | { kind: "error"; message: string };

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function statusFromDeviation(dev: number): "netral" | "waspada" | "mengkhawatirkan" {
  if (dev >= 0.2) return "mengkhawatirkan";
  if (dev >= 0.1) return "waspada";
  return "netral";
}

function statusColors(status: "netral" | "waspada" | "mengkhawatirkan" | "butuh_data"): {
  bg: string;
  border: string;
  text: string;
} {
  if (status === "mengkhawatirkan") {
    return { bg: "rgba(255, 87, 87, 0.14)", border: "rgba(255, 87, 87, 0.5)", text: "rgba(255,255,255,0.92)" };
  }
  if (status === "waspada") {
    return { bg: "rgba(255, 188, 56, 0.14)", border: "rgba(255, 188, 56, 0.55)", text: "rgba(255,255,255,0.92)" };
  }
  if (status === "butuh_data") {
    return { bg: "rgba(124, 166, 255, 0.12)", border: "rgba(124, 166, 255, 0.35)", text: "rgba(255,255,255,0.9)" };
  }
  return { bg: "rgba(56, 196, 120, 0.14)", border: "rgba(56, 196, 120, 0.55)", text: "rgba(255,255,255,0.92)" };
}

export function DashboardScreen() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const clientId = await getOrCreateClientId();
      const result = await computeMentalIndex(clientId);
      const details = `acc=${result.components.accuracyScore}, taps=${result.components.tapScore}, jurnal=${result.components.journalScore}`;

      await insertSnapshotIfNeeded(clientId, result.index);
      const meanBaseline = await getMeanBaselineIndex(clientId);

      let deviationPct: number | null = null;
      let deviationStatus: "netral" | "waspada" | "mengkhawatirkan" | "butuh_data" = "butuh_data";
      if (meanBaseline !== null && meanBaseline > 0) {
        const dev = Math.abs(result.index - meanBaseline) / Math.max(meanBaseline, 1);
        deviationPct = dev * 100;
        deviationStatus = statusFromDeviation(dev);
      }

      const snaps = await listSnapshots(clientId, 14);
      const history = snaps.slice(0, 7).map((s) => {
        const dev = meanBaseline && meanBaseline > 0 ? Math.abs(s.index_0_100 - meanBaseline) / Math.max(meanBaseline, 1) : 0;
        return {
          createdAt: s.created_at,
          status: statusFromDeviation(dev),
        };
      });

      setState({
        kind: "ready",
        clientId,
        index0to100: result.index,
        score10: result.score10,
        emoji: result.emoji,
        details,
        deviationPct,
        deviationStatus,
        history,
      });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Unknown error" });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const content = useMemo(() => {
    if (state.kind === "loading") {
      return (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Memuat dashboard…</Text>
        </View>
      );
    }
    if (state.kind === "error") {
      return (
        <View style={styles.center}>
          <Text style={styles.title}>Error</Text>
          <Text style={styles.muted}>{state.message}</Text>
        </View>
      );
    }

    const cardColors = statusColors(state.deviationStatus);
    const lastHistory = state.history[0]?.status ?? "netral";
    const prevHistory = state.history[1]?.status ?? lastHistory;
    const trendLabel =
      lastHistory === prevHistory
        ? "Stabil"
        : lastHistory === "mengkhawatirkan"
          ? "Meningkat ke mengkhawatirkan"
          : lastHistory === "waspada"
            ? "Meningkat ke waspada"
            : "Membaik";

    const ctaText =
      state.deviationStatus === "mengkhawatirkan"
        ? "Pergi menemui ahli/psikolog untuk bantuan profesional."
        : state.deviationStatus === "waspada"
          ? "Terapkan teknik kesadaran mental: mindfulness 5 menit, napas 4-7-8, dan kurangi distraksi."
          : state.deviationStatus === "butuh_data"
            ? "Isi jurnal dan main game beberapa kali supaya baseline deviasi terbentuk."
            : "Tidak perlu apa-apa saat ini. Pertahankan kebiasaan baikmu.";

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Skor Stabilitas Mental</Text>
        <View style={[styles.card, { backgroundColor: cardColors.bg, borderColor: cardColors.border }]}>
          <Text style={styles.emoji}>{state.emoji}</Text>
          <Text style={styles.score}>{state.score10}/10</Text>
          <Text style={styles.muted}>
            Deviasi:{" "}
            {state.deviationPct === null ? "butuh data" : `${clamp(state.deviationPct, 0, 999).toFixed(1)}%`} · Status:{" "}
            {state.deviationStatus === "mengkhawatirkan"
              ? "mengkhawatirkan"
              : state.deviationStatus === "waspada"
                ? "waspada"
                : state.deviationStatus === "butuh_data"
                  ? "butuh data"
                  : "netral"}
          </Text>
        </View>

        <View style={styles.box}>
          <Text style={styles.boxTitle}>Tingkatan Skor (1–10)</Text>
          <View style={styles.legendRow}>
            <Text style={styles.legendEmoji}>😢</Text>
            <Text style={styles.legendText}>1–2 · Sedih</Text>
          </View>
          <View style={styles.legendRow}>
            <Text style={styles.legendEmoji}>😟</Text>
            <Text style={styles.legendText}>3–4 · Kurang baik</Text>
          </View>
          <View style={styles.legendRow}>
            <Text style={styles.legendEmoji}>😐</Text>
            <Text style={styles.legendText}>5–6 · Netral</Text>
          </View>
          <View style={styles.legendRow}>
            <Text style={styles.legendEmoji}>🙂</Text>
            <Text style={styles.legendText}>7–8 · Baik</Text>
          </View>
          <View style={styles.legendRow}>
            <Text style={styles.legendEmoji}>😄</Text>
            <Text style={styles.legendText}>9–10 · Sangat baik</Text>
          </View>
        </View>

        <View style={[styles.box, { backgroundColor: cardColors.bg, borderColor: cardColors.border }]}>
          <Text style={styles.boxTitle}>Histori Deviasi</Text>
          <Text style={styles.muted}>{trendLabel}</Text>
          <View style={styles.historyRow}>
            {state.history.length === 0 ? (
              <Text style={styles.muted}>Belum ada histori.</Text>
            ) : (
              state.history.map((h, idx) => {
                const c = statusColors(h.status);
                return <View key={`${h.createdAt}-${idx}`} style={[styles.historyDot, { backgroundColor: c.border }]} />;
              })
            )}
          </View>
          <Text style={styles.small}>
            Titik terbaru di kiri. Warna: hijau (netral), kuning (waspada ≥10%), merah (mengkhawatirkan ≥20%).
          </Text>
        </View>

        <View style={[styles.box, { backgroundColor: cardColors.bg, borderColor: cardColors.border }]}>
          <Text style={styles.boxTitle}>Apa yang perlu dilakukan</Text>
          <Text style={styles.cta}>{ctaText}</Text>
        </View>

        <Text style={styles.meta}>Client ID: {state.clientId}</Text>
        <Text style={styles.note}>Catatan: skor ini non-diagnostik dan akan makin akurat setelah ada data jurnal + game.</Text>
        <Text style={styles.small}>Debug: {state.details} · index={state.index0to100}/100</Text>
      </View>
    );
  }, [state]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          tintColor="#fff"
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      {content}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#101622" },
  container: { gap: 12 },
  center: { paddingTop: 48, alignItems: "center", gap: 10 },
  title: { fontSize: 20, fontWeight: "800", color: "#fff" },
  muted: { color: "rgba(255,255,255,0.75)" },
  card: {
    borderRadius: 14,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    gap: 6,
  },
  emoji: { fontSize: 56 },
  score: { fontSize: 28, fontWeight: "900", color: "#fff" },
  box: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    gap: 8,
  },
  boxTitle: { color: "#fff", fontWeight: "900", fontSize: 15 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  legendEmoji: { fontSize: 18 },
  legendText: { color: "rgba(255,255,255,0.86)", fontWeight: "700" },
  historyRow: { flexDirection: "row", gap: 8, marginTop: 6, alignItems: "center" },
  historyDot: { width: 10, height: 10, borderRadius: 999 },
  cta: { color: "rgba(255,255,255,0.88)", lineHeight: 18, fontWeight: "700" },
  meta: { marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.6)" },
  note: { marginTop: 6, fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 18 },
  small: { marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.6)" },
});

