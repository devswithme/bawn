import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { getOrCreateClientId } from "../lib/clientId";
import { getProfile, upsertProfile } from "../services/profileService";

type Props = {
  onComplete?: () => void;
};

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

export function OnboardingSurveyScreen({ onComplete }: Props) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [job, setJob] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = await getOrCreateClientId();
        if (cancelled) return;
        setClientId(id);

        const existing = await getProfile(id);
        if (cancelled) return;
        if (existing) {
          setName(existing.name ?? "");
          setAge(existing.age ? String(existing.age) : "");
          setGender(existing.gender ?? "");
          setJob(existing.job ?? "");
        }
      } catch (e) {
        if (!cancelled) {
          Alert.alert("Onboarding error", e instanceof Error ? e.message : "Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ageNumber = useMemo(() => {
    const n = Number(age);
    return Number.isFinite(n) ? n : NaN;
  }, [age]);

  const canSubmit =
    !!clientId && isNonEmpty(name) && Number.isFinite(ageNumber) && ageNumber > 0 && isNonEmpty(gender) && isNonEmpty(job);

  const onSubmit = async () => {
    if (!clientId) return;
    if (!canSubmit) {
      Alert.alert("Incomplete", "Mohon isi nama, usia, gender, dan pekerjaan.");
      return;
    }

    setSaving(true);
    try {
      await upsertProfile({
        client_id: clientId,
        name: name.trim(),
        age: Math.floor(ageNumber),
        gender: gender.trim(),
        job: job.trim(),
      });
      onComplete?.();
    } catch (e) {
      Alert.alert("Save failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Menyiapkan survey…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Survey Awal</Text>
        <Text style={styles.subtitle}>Isi sekali untuk memulai.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Nama</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Nama lengkap" placeholderTextColor="#93A4C7" style={styles.input} />

          <Text style={[styles.label, styles.mt]}>Usia</Text>
          <TextInput
            value={age}
            onChangeText={setAge}
            placeholder="Contoh: 22"
            placeholderTextColor="#93A4C7"
            keyboardType="number-pad"
            style={styles.input}
          />

          <Text style={[styles.label, styles.mt]}>Gender</Text>
          <TextInput value={gender} onChangeText={setGender} placeholder="Contoh: perempuan" placeholderTextColor="#93A4C7" style={styles.input} />

          <Text style={[styles.label, styles.mt]}>Pekerjaan</Text>
          <TextInput value={job} onChangeText={setJob} placeholder="Contoh: mahasiswa" placeholderTextColor="#93A4C7" style={styles.input} />

          <Pressable
            style={[styles.button, (!canSubmit || saving) && styles.buttonDisabled]}
            onPress={onSubmit}
            disabled={!canSubmit || saving}
          >
            <Text style={styles.buttonText}>{saving ? "Menyimpan…" : "Simpan"}</Text>
          </Pressable>

          <Text style={styles.meta}>Client ID: {clientId ?? "-"}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#101622" },
  container: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 26, fontWeight: "800", color: "#fff" },
  subtitle: { fontSize: 14, marginTop: 6, color: "rgba(255,255,255,0.76)" },
  card: {
    marginTop: 16,
    borderRadius: 14,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  label: { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.9)" },
  mt: { marginTop: 12 },
  input: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "rgba(16, 22, 34, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    color: "#fff",
  },
  button: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#7ca6ff",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 15, fontWeight: "800", color: "#0c1220" },
  meta: { marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.6)" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#101622" },
  loadingText: { color: "rgba(255,255,255,0.75)" },
});

