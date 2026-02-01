import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useStore } from '../state/store';
import { getStageName, STAGES, SETS } from '../core/algorithms/trainingEngine';

const LEVEL_INFO = [
  { id: 2, name: 'Reciprocal Packets', description: 'Type the reciprocal', route: 'Practice2' as const },
  { id: 3, name: 'Vector Orientation', description: 'Say the full packet', route: 'Practice3' as const },
  { id: 4, name: 'Auditory Vector Sense', description: 'Listen and respond', route: 'Practice4' as const },
  { id: 5, name: 'Single Digit Resolution', description: 'Full 3-digit headings', route: 'Practice5' as const },
];

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const currentStage = useStore((s) => s.currentStage);
  const completedStages = useStore((s) => s.completedStages);
  const trialBestTimes = useStore((s) => s.trialBestTimes);
  const unlockAllLevels = useStore((s) => s.unlockAllLevels);

  const allStage11Complete = completedStages.includes(11);
  const levelsUnlocked = unlockAllLevels || allStage11Complete;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Level 1: Learning Mode */}
      <Text style={styles.sectionTitle}>Level 1 — Vector Anchoring</Text>
      <Text style={styles.sectionHint}>Tap the compass wedge where each heading belongs</Text>

      {STAGES.map((_, idx) => {
        const stage = idx + 1;
        const isUnlocked = stage <= currentStage;
        const isCompleted = completedStages.includes(stage);
        const name = getStageName(stage);
        const headingCount = STAGES[idx].reduce((sum, si) => sum + SETS[si].length, 0);

        return (
          <TouchableOpacity
            key={stage}
            style={[styles.card, !isUnlocked && styles.cardLocked]}
            activeOpacity={isUnlocked ? 0.7 : 1}
            onPress={() => isUnlocked && navigation.navigate('Learning', { stage })}
            disabled={!isUnlocked}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.stageName, !isUnlocked && styles.textLocked]}>
                {name}
              </Text>
              {isCompleted && <Text style={styles.checkmark}>✓</Text>}
              {!isUnlocked && <Text style={styles.lockIcon}>🔒</Text>}
            </View>
            <Text style={[styles.cardDetail, !isUnlocked && styles.textLocked]}>
              {headingCount} headings
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Level 1: Trial Mode */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Level 1 — Trials</Text>
      <Text style={styles.sectionHint}>Speed run — eliminate all headings as fast as possible</Text>

      {STAGES.map((_, idx) => {
        const stage = idx + 1;
        const isUnlocked = completedStages.includes(stage);
        const bestResult = trialBestTimes[String(stage)];
        const name = getStageName(stage);

        return (
          <TouchableOpacity
            key={`trial-${stage}`}
            style={[styles.card, styles.trialCard, !isUnlocked && styles.cardLocked]}
            activeOpacity={isUnlocked ? 0.7 : 1}
            onPress={() => isUnlocked && navigation.navigate('Trial', { stage })}
            disabled={!isUnlocked}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.stageName, !isUnlocked && styles.textLocked]}>
                {name}
              </Text>
              {!isUnlocked && <Text style={styles.lockIcon}>🔒</Text>}
            </View>
            {bestResult ? (
              <Text style={styles.bestTime}>
                Best: {(bestResult.time / 1000).toFixed(1)}s · {bestResult.mistakes} mistakes · {bestResult.headingsPerMinute.toFixed(0)} h/min
              </Text>
            ) : (
              <Text style={[styles.cardDetail, !isUnlocked && styles.textLocked]}>
                {isUnlocked ? 'Not attempted' : 'Complete learning stage to unlock'}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}

      {/* Levels 2-5 */}
      <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Levels 2–5</Text>
      <Text style={styles.sectionHint}>
        {levelsUnlocked
          ? 'Practice reciprocal recall with different input methods'
          : 'Complete Level 1 Stage 11 to unlock (or enable in Settings)'}
      </Text>

      {LEVEL_INFO.map((level) => (
        <TouchableOpacity
          key={level.id}
          style={[styles.card, styles.levelCard, !levelsUnlocked && styles.cardLocked]}
          activeOpacity={levelsUnlocked ? 0.7 : 1}
          onPress={() => levelsUnlocked && navigation.navigate(level.route)}
          disabled={!levelsUnlocked}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.stageName, !levelsUnlocked && styles.textLocked]}>
              Level {level.id} — {level.name}
            </Text>
            {!levelsUnlocked && <Text style={styles.lockIcon}>🔒</Text>}
          </View>
          <Text style={[styles.cardDetail, !levelsUnlocked && styles.textLocked]}>
            {level.description}
          </Text>
        </TouchableOpacity>
      ))}

      {/* Settings */}
      <TouchableOpacity
        style={[styles.card, { marginTop: 24 }]}
        onPress={() => navigation.navigate('Settings')}
      >
        <Text style={styles.stageName}>Settings</Text>
        <Text style={styles.cardDetail}>Export, import, reset, or unlock levels</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 13,
    color: '#667788',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#00d4ff',
  },
  trialCard: {
    borderLeftColor: '#ffab00',
  },
  levelCard: {
    borderLeftColor: '#aa66ff',
  },
  cardLocked: {
    opacity: 0.4,
    borderLeftColor: '#3a4a5a',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  stageName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  checkmark: {
    fontSize: 16,
    color: '#00e676',
    fontWeight: 'bold',
  },
  lockIcon: {
    fontSize: 14,
  },
  cardDetail: {
    fontSize: 13,
    color: '#aaa',
  },
  bestTime: {
    fontSize: 13,
    color: '#00e676',
  },
  textLocked: {
    color: '#555',
  },
});
