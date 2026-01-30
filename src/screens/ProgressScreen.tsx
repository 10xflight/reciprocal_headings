import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { useStore } from '../state/store';
import { MASTER_SEQUENCE } from '../core/data/masterSequence';

const LEVEL_INFO = [
  { id: 1, name: 'Vector Anchoring', subtitle: 'The Map' },
  { id: 2, name: 'Reciprocal Packets', subtitle: 'The Bond' },
  { id: 3, name: 'Vector Orientation', subtitle: 'The Lock' },
  { id: 4, name: 'Auditory Vector Sense', subtitle: 'The Ear' },
  { id: 5, name: 'Single Digit Resolution', subtitle: 'The Real World' },
];

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec}s`;
}

export default function ProgressScreen() {
  const stats = useStore((s) => s.stats);
  const levels = useStore((s) => s.levels);
  const unlockedIndex = useStore((s) => s.unlockedIndex);

  const masteredCount = (levelId: number) =>
    Object.values(levels[levelId] ?? {}).filter((p) => p.stability >= 3).length;

  const unlockedCount = unlockedIndex + 1;
  const globalMastery = Math.round((masteredCount(1) / MASTER_SEQUENCE.length) * 100);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Progress</Text>

      {/* Overall stats */}
      <View style={styles.statsCard}>
        <StatRow label="Total Reps" value={stats.totalReps.toString()} />
        <StatRow label="Training Time" value={formatTime(stats.totalTimeMs)} />
        <StatRow label="Current Streak" value={stats.currentStreak.toString()} />
        <StatRow label="Best Streak" value={stats.bestStreak.toString()} />
        <StatRow label="Items Unlocked" value={`${unlockedCount} / ${MASTER_SEQUENCE.length}`} />
        <StatRow label="Overall Mastery" value={`${globalMastery}%`} />
      </View>

      {/* Mastery bar */}
      <View style={styles.barOuter}>
        <View style={[styles.barInner, { width: `${globalMastery}%` }]} />
      </View>

      {/* Per-level breakdown */}
      <Text style={styles.sectionTitle}>Level Breakdown</Text>

      {LEVEL_INFO.map((info) => {
        const mastered = masteredCount(info.id);
        const entries = Object.keys(levels[info.id] ?? {}).length;
        const pct = entries > 0 ? Math.round((mastered / MASTER_SEQUENCE.length) * 100) : 0;

        return (
          <View key={info.id} style={styles.levelCard}>
            <View style={styles.levelHeader}>
              <Text style={styles.levelName}>
                Level {info.id}: {info.name}
              </Text>
              <Text style={styles.levelSubtitle}>{info.subtitle}</Text>
            </View>
            <Text style={styles.levelStat}>
              {mastered} / {MASTER_SEQUENCE.length} mastered
            </Text>
            <View style={styles.levelBarOuter}>
              <View style={[styles.levelBarInner, { width: `${pct}%` }]} />
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  statsCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  statLabel: { fontSize: 14, color: '#aaa' },
  statValue: { fontSize: 14, fontWeight: '700', color: '#fff' },
  barOuter: {
    height: 8,
    backgroundColor: '#1a1a2e',
    borderRadius: 4,
    marginBottom: 24,
    overflow: 'hidden',
  },
  barInner: {
    height: 8,
    backgroundColor: '#00e676',
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  levelCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  levelName: { fontSize: 14, fontWeight: '600', color: '#00d4ff' },
  levelSubtitle: { fontSize: 12, color: '#666', fontStyle: 'italic' },
  levelStat: { fontSize: 13, color: '#aaa', marginBottom: 6 },
  levelBarOuter: {
    height: 6,
    backgroundColor: '#0f0f23',
    borderRadius: 3,
    overflow: 'hidden',
  },
  levelBarInner: {
    height: 6,
    backgroundColor: '#00d4ff',
    borderRadius: 3,
  },
});
