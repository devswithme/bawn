import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";

import { getOrCreateClientId } from "../lib/clientId";
import { addGameSession } from "../services/gameSessionService";

export type PianoTilesSummary = {
  accuracy: number;
  tapCount: number;
  speedMax: number;
};

type Props = {
  songId: string;
  onExit: () => void;
  onSaved?: (summary: PianoTilesSummary) => void;
};

type Tile = {
  id: string;
  col: number;
  y: number;
  hit: boolean;
};

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromSongId(songId: string): number {
  let h = 2166136261;
  for (let i = 0; i < songId.length; i += 1) {
    h ^= songId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function PianoTilesGame({ songId, onExit, onSaved }: Props) {
  const [tapCount, setTapCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [requiredCount, setRequiredCount] = useState(0);
  const [missedCount, setMissedCount] = useState(0);
  const [speedMult, setSpeedMult] = useState(1);
  const [speedMax, setSpeedMax] = useState(1);

  const [running, setRunning] = useState(true);
  const [playSize, setPlaySize] = useState<{ w: number; h: number } | null>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);

  const tilesRef = useRef<Tile[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const spawnAccMsRef = useRef(0);

  const cols = 4;
  const tileH = 84;

  const rng = useMemo(() => mulberry32(seedFromSongId(songId)), [songId]);

  useEffect(() => {
    tilesRef.current = tiles;
  }, [tiles]);

  const onLayoutPlayArea = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setPlaySize({ w: width, h: height });
  };

  const hitY = useMemo(() => {
    if (!playSize) return 0;
    return playSize.h - 140;
  }, [playSize]);

  useEffect(() => {
    if (!running || !playSize) return;
    startedAtRef.current ??= performance.now();

    const step = (ts: number) => {
      if (!running) return;
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = ts - lastTsRef.current;
      lastTsRef.current = ts;

      const startedAt = startedAtRef.current ?? ts;
      const elapsed = ts - startedAt;

      const nextSpeed = 1 + Math.min(1, elapsed / 60000) * 1.8; // 1.0 -> 2.8
      setSpeedMult(nextSpeed);
      setSpeedMax((prev) => (nextSpeed > prev ? nextSpeed : prev));

      const baseFall = 240; // px/s
      const fallPx = (baseFall * nextSpeed * dt) / 1000;

      const intervalMs = 520 / nextSpeed;
      spawnAccMsRef.current += dt;

      let produced = 0;
      const newTiles: Tile[] = [];
      while (spawnAccMsRef.current >= intervalMs && elapsed <= 60000) {
        spawnAccMsRef.current -= intervalMs;
        produced += 1;
        const col = Math.floor(rng() * cols);
        newTiles.push({ id: makeId("tile"), col, y: -tileH - produced * 6, hit: false });
      }
      if (produced) setRequiredCount((n) => n + produced);

      setTiles((prev) => {
        const next = [...prev, ...newTiles].map((t) => (t.hit ? t : { ...t, y: t.y + fallPx }));
        const kept: Tile[] = [];
        let missedNow = 0;
        for (const t of next) {
          if (!t.hit && t.y > playSize.h + tileH) missedNow += 1;
          else kept.push(t);
        }
        if (missedNow) setMissedCount((m) => m + missedNow);
        if (elapsed > 60000 && kept.length === 0) setRunning(false);
        return kept;
      });

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    };
  }, [running, playSize, rng]);

  const accuracy = useMemo(() => {
    const denom = Math.max(1, requiredCount);
    return Math.max(0, Math.min(1, correctCount / denom));
  }, [correctCount, requiredCount]);

  const onTapColumn = (col: number) => {
    if (!playSize) return;
    setTapCount((t) => t + 1);

    const window = 64;
    let bestIdx = -1;
    let bestY = -Infinity;
    const current = tilesRef.current;
    for (let i = 0; i < current.length; i += 1) {
      const t = current[i];
      if (t.hit || t.col !== col) continue;
      const dy = Math.abs(t.y + tileH / 2 - hitY);
      if (dy <= window && t.y > bestY) {
        bestY = t.y;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      setCorrectCount((c) => c + 1);
      setTiles((prev) => prev.map((t, idx) => (idx === bestIdx ? { ...t, hit: true } : t)));
    }
  };

  const onFinish = async () => {
    const clientId = await getOrCreateClientId();
    const summary: PianoTilesSummary = { accuracy, tapCount, speedMax };
    await addGameSession({ clientId, songId, accuracy, tapCount, speedMax });
    onSaved?.(summary);
    onExit();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={onExit} style={styles.topBtn}>
          <Text style={styles.topBtnText}>Keluar</Text>
        </Pressable>
        <Text style={styles.topTitle}>{songId}</Text>
        <View style={{ width: 70 }} />
      </View>

      <View style={styles.hud}>
        <Text style={styles.hudText}>speed: {speedMult.toFixed(2)}x</Text>
        <Text style={styles.hudText}>taps: {tapCount}</Text>
        <Text style={styles.hudText}>acc: {Math.round(accuracy * 100)}%</Text>
      </View>

      <View style={styles.playArea} onLayout={onLayoutPlayArea}>
        <View style={styles.columns}>
          {Array.from({ length: cols }).map((_, col) => (
            <Pressable key={col} style={styles.col} onPress={() => onTapColumn(col)} />
          ))}
        </View>

        {playSize &&
          tiles.map((t) => (
            <View
              key={t.id}
              style={[
                styles.tile,
                {
                  top: t.y,
                  left: (playSize.w / cols) * t.col + 6,
                  width: playSize.w / cols - 12,
                  height: tileH,
                  opacity: t.hit ? 0.2 : 1,
                },
              ]}
            />
          ))}

        {playSize && (
          <View style={[styles.hitLine, { top: hitY }]}>
            <Text style={styles.hitText}>HIT</Text>
          </View>
        )}

        <View style={styles.bottomHud}>
          <Text style={styles.bottomText}>
            required: {requiredCount} · correct: {correctCount} · missed: {missedCount}
          </Text>
          {!running && (
            <Pressable style={styles.finishBtn} onPress={onFinish}>
              <Text style={styles.finishText}>Simpan & Kembali</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#101622" },
  topBar: {
    paddingTop: 48,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  topBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.08)" },
  topBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  topTitle: { color: "#fff", fontWeight: "900" },
  hud: { padding: 12, flexDirection: "row", justifyContent: "space-between" },
  hudText: { color: "rgba(255,255,255,0.8)", fontWeight: "700" },
  playArea: {
    flex: 1,
    margin: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  columns: { ...StyleSheet.absoluteFillObject, flexDirection: "row" },
  col: { flex: 1 },
  tile: {
    position: "absolute",
    borderRadius: 12,
    backgroundColor: "rgba(124,166,255,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  hitLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  hitText: {
    position: "absolute",
    top: -10,
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "900",
    letterSpacing: 2,
  },
  bottomHud: { position: "absolute", left: 0, right: 0, bottom: 10, alignItems: "center", gap: 10 },
  bottomText: { color: "rgba(255,255,255,0.7)", fontWeight: "800", fontSize: 12 },
  finishBtn: { backgroundColor: "#7ca6ff", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },
  finishText: { fontWeight: "900", color: "#0c1220" },
});

