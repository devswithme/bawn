import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { getOrCreateClientId } from "../lib/clientId";
import { addJournalEntry, listJournalEntries, type JournalEntry } from "../services/journalService";

const MOOD_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: "Tidak" },
  { value: 1, label: "Jarang" },
  { value: 2, label: "Kadang" },
  { value: 3, label: "Sering" },
  { value: 4, label: "Hampir selalu" },
];

export function JournalScreen() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [mood2w, setMood2w] = useState<number>(2);
  const [notes, setNotes] = useState("");
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  const load = async () => {
    const id = await getOrCreateClientId();
    setClientId(id);
    const rows = await listJournalEntries(id, 30);
    setEntries(rows);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) Alert.alert("Load failed", e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSave = async () => {
    if (!clientId) return;
    setSaving(true);
    try {
      await addJournalEntry({ clientId, mood2w, notes });
      setNotes("");
      await load();
    } catch (e) {
      Alert.alert("Save failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const moodLabel = useMemo(() => MOOD_OPTIONS.find((o) => o.value === mood2w)?.label ?? "-", [mood2w]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Memuat jurnal…</Text>
      </View>
    );
  }

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
            try {
              await load();
            } catch (e) {
              Alert.alert("Refresh failed", e instanceof Error ? e.message : "Unknown error");
            } finally {
              setRefreshing(false);
            }
          }}
        />
      }
    >
      <Text style={styles.title}>Jurnal</Text>
      <Text style={styles.subtitle}>Isi kapanpun untuk mencatat kondisi mentalmu.</Text>

      <View style={styles.card}>
        <Text style={styles.q}>Sedang murung selama 2 minggu ke belakang?</Text>
        <Text style={styles.muted}>Pilihan: {moodLabel}</Text>

        <View style={styles.rowWrap}>
          {MOOD_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setMood2w(opt.value)}
              style={[styles.chip, opt.value === mood2w && styles.chipActive]}
            >
              <Text style={[styles.chipText, opt.value === mood2w && styles.chipTextActive]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { marginTop: 12 }]}>Catatan (opsional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Tulis singkat…"
          placeholderTextColor="#93A4C7"
          style={[styles.input, { minHeight: 88 }]}
          multiline
        />

        <Pressable style={[styles.button, saving && styles.buttonDisabled]} onPress={onSave} disabled={saving}>
          <Text style={styles.buttonText}>{saving ? "Menyimpan…" : "Simpan Jurnal"}</Text>
        </Pressable>
      </View>

      <Text style={[styles.label, { marginTop: 16 }]}>Riwayat</Text>
      {entries.length === 0 ? (
        <Text style={styles.muted}>Belum ada entri.</Text>
      ) : (
        entries.map((e) => (
          <View key={e.id} style={styles.listItem}>
            <Text style={styles.listTitle}>Mood 2w: {e.mood_2w}</Text>
            <Text style={styles.listMeta}>{new Date(e.created_at).toLocaleString()}</Text>
            {!!e.notes && <Text style={styles.listNotes}>{e.notes}</Text>}
          </View>
        ))
      )}

      <Pressable
        style={[styles.debugButton]}
        onPress={() => Alert.alert("Client ID", clientId ?? "-")}
      >
        <Text style={styles.debugText}>Lihat Client ID</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#101622" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#101622" },
  title: { fontSize: 22, fontWeight: "900", color: "#fff" },
  subtitle: { marginTop: 6, color: "rgba(255,255,255,0.76)" },
  muted: { color: "rgba(255,255,255,0.75)" },
  card: {
    marginTop: 14,
    borderRadius: 14,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    gap: 10,
  },
  q: { fontSize: 15, fontWeight: "800", color: "#fff" },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  chip: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(16, 22, 34, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  chipActive: { backgroundColor: "rgba(124,166,255,0.22)", borderColor: "rgba(124,166,255,0.5)" },
  chipText: { color: "rgba(255,255,255,0.85)", fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#fff" },
  label: { fontSize: 13, fontWeight: "800", color: "rgba(255,255,255,0.88)" },
  input: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "rgba(16, 22, 34, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    color: "#fff",
    marginTop: 6,
    textAlignVertical: "top",
  },
  button: { borderRadius: 12, paddingVertical: 12, alignItems: "center", backgroundColor: "#7ca6ff", marginTop: 4 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 15, fontWeight: "900", color: "#0c1220" },
  listItem: {
    marginTop: 10,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    gap: 4,
  },
  listTitle: { color: "#fff", fontWeight: "800" },
  listMeta: { color: "rgba(255,255,255,0.65)", fontSize: 12 },
  listNotes: { color: "rgba(255,255,255,0.82)", marginTop: 6 },
  debugButton: { marginTop: 16, alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  debugText: { color: "rgba(255,255,255,0.6)", fontWeight: "700", fontSize: 12 },
});

