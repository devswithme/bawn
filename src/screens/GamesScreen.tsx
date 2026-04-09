import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PianoTilesGame } from "../ui/PianoTilesGame";

const SONGS = [
  { id: "song_01", title: "Morning Drift" },
  { id: "song_02", title: "After Rain" },
  { id: "song_03", title: "Quiet Orbit" },
  { id: "song_04", title: "Neon Lullaby" },
  { id: "song_05", title: "Sunset Pulse" },
] as const;

export function GamesScreen() {
  const [selectedSongId, setSelectedSongId] = useState<(typeof SONGS)[number]["id"]>("song_01");
  const [playing, setPlaying] = useState(false);

  const selected = useMemo(() => SONGS.find((s) => s.id === selectedSongId) ?? SONGS[0], [selectedSongId]);

  if (playing) {
    return (
      <View style={styles.screen}>
        <PianoTilesGame
          songId={selected.id}
          onExit={() => setPlaying(false)}
          onSaved={(summary) => Alert.alert("Session saved", `accuracy=${Math.round(summary.accuracy * 100)}%, taps=${summary.tapCount}`)}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={styles.title}>Games</Text>
      <Text style={styles.subtitle}>Piano Tiles (tanpa nyawa). Kecepatan akan naik saat dimainkan.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Pilih lagu</Text>
        <View style={styles.list}>
          {SONGS.map((song) => {
            const active = song.id === selectedSongId;
            return (
              <Pressable
                key={song.id}
                onPress={() => setSelectedSongId(song.id)}
                style={[styles.songRow, active && styles.songRowActive]}
              >
                <Text style={[styles.songTitle, active && styles.songTitleActive]}>{song.title}</Text>
                <Text style={styles.songMeta}>{song.id}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.button} onPress={() => setPlaying(true)}>
          <Text style={styles.buttonText}>Mulai Main</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#101622" },
  title: { fontSize: 22, fontWeight: "900", color: "#fff" },
  subtitle: { marginTop: 6, color: "rgba(255,255,255,0.76)" },
  card: {
    marginTop: 14,
    borderRadius: 14,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    gap: 12,
  },
  label: { color: "rgba(255,255,255,0.9)", fontWeight: "800" },
  list: { gap: 8 },
  songRow: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: "rgba(16, 22, 34, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    gap: 4,
  },
  songRowActive: { backgroundColor: "rgba(124,166,255,0.22)", borderColor: "rgba(124,166,255,0.5)" },
  songTitle: { color: "rgba(255,255,255,0.9)", fontWeight: "900" },
  songTitleActive: { color: "#fff" },
  songMeta: { color: "rgba(255,255,255,0.6)", fontSize: 12 },
  button: { borderRadius: 12, paddingVertical: 12, alignItems: "center", backgroundColor: "#7ca6ff" },
  buttonText: { fontSize: 15, fontWeight: "900", color: "#0c1220" },
});

