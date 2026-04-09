export default function App() {
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { getOrCreateClientId } from "./src/lib/clientId";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { OnboardingSurveyScreen } from "./src/screens/OnboardingSurveyScreen";
import { getProfile } from "./src/services/profileService";

type BootState =
  | { kind: "loading" }
  | { kind: "needs_onboarding" }
  | { kind: "ready" }
  | { kind: "error"; message: string };

function isProfileComplete(profile: Awaited<ReturnType<typeof getProfile>>): boolean {
  if (!profile) return false;
  return !!profile.client_id && !!profile.name && !!profile.gender && !!profile.job && Number.isFinite(profile.age) && profile.age > 0;
}

export default function App() {
  const [boot, setBoot] = useState<BootState>({ kind: "loading" });

  const load = async () => {
    try {
      const clientId = await getOrCreateClientId();
      const profile = await getProfile(clientId);
      setBoot(isProfileComplete(profile) ? { kind: "ready" } : { kind: "needs_onboarding" });
    } catch (e) {
      setBoot({ kind: "error", message: e instanceof Error ? e.message : "Unknown error" });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (boot.kind === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Menyiapkan aplikasi…</Text>
      </View>
    );
  }

  if (boot.kind === "error") {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Setup error</Text>
        <Text style={styles.muted}>{boot.message}</Text>
        <Text style={[styles.muted, { marginTop: 10 }]}>
          Pastikan env sudah di-set: EXPO_PUBLIC_SUPABASE_URL dan EXPO_PUBLIC_SUPABASE_ANON_KEY.
        </Text>
      </View>
    );
  }

  if (boot.kind === "needs_onboarding") {
    return <OnboardingSurveyScreen onComplete={load} />;
  }

  return <RootNavigator />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#101622", padding: 16 },
  title: { fontSize: 18, fontWeight: "900", color: "#fff" },
  muted: { color: "rgba(255,255,255,0.75)", textAlign: "center" },
});

