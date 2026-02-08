import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useStore } from '../state/store';
import { MASTER_SEQUENCE } from '../core/algorithms/trainingEngine';

const LEVEL_INFO = [
  { id: 2, name: 'Reciprocal Packets', description: 'Type the reciprocal', route: 'Level2Mode' as const },
  { id: 3, name: 'Vector Orientation', description: 'Say the full packet', route: 'Practice3' as const },
  { id: 4, name: 'Auditory Vector Sense', description: 'Listen and respond', route: 'Practice4' as const },
  { id: 5, name: 'Single Digit Resolution', description: 'Full 3-digit headings', route: 'Practice5' as const },
];

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const deckProgress = useStore((s) => s.deckProgress);
  const level2Progress = useStore((s) => s.level2DeckProgress);
  const unlockAllLevels = useStore((s) => s.unlockAllLevels);

  const unlockedCount = deckProgress.unlockedCount;
  const allComplete = unlockedCount >= 36;
  const level2Complete = level2Progress.unlockedCount >= 36;
  // Levels 3-5 require completing Level 1 OR dev mode; Level 2 is always available
  const levels35Unlocked = unlockAllLevels || allComplete;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Level 1 */}
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('Level1Menu')}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.stageName}>Level 1 — Vector Anchoring</Text>
          {allComplete && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.cardDetail}>
          {(deckProgress.masteredHeadings || []).length}/36 Headings Mastered
        </Text>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${((deckProgress.masteredHeadings || []).length / 36) * 100}%` }]} />
        </View>
      </TouchableOpacity>

      {/* Level 2 - Always available, separate progress */}
      <TouchableOpacity
        style={[styles.card, styles.levelCard]}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('Level2Mode')}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.stageName}>Level 2 — Reciprocal Packets</Text>
          {level2Complete && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.cardDetail}>
          {(level2Progress.masteredHeadings || []).length}/36 Headings Mastered
        </Text>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${((level2Progress.masteredHeadings || []).length / 36) * 100}%`, backgroundColor: '#aa66ff' }]} />
        </View>
      </TouchableOpacity>

      {/* Levels 3-5 */}
      <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Levels 3–5</Text>
      <Text style={styles.sectionHint}>
        {levels35Unlocked
          ? 'Practice reciprocal recall with voice input'
          : 'Master all 36 headings in Level 1 to unlock (or enable in Settings)'}
      </Text>

      {LEVEL_INFO.filter(l => l.id >= 3).map((level) => (
        <TouchableOpacity
          key={level.id}
          style={[styles.card, styles.levelCard, !levels35Unlocked && styles.cardLocked]}
          activeOpacity={levels35Unlocked ? 0.7 : 1}
          onPress={() => levels35Unlocked && navigation.navigate(level.route)}
          disabled={!levels35Unlocked}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.stageName, !levels35Unlocked && styles.textLocked]}>
              Level {level.id} — {level.name}
            </Text>
            {!levels35Unlocked && <Text style={styles.lockIcon}>🔒</Text>}
          </View>
          <Text style={[styles.cardDetail, !levels35Unlocked && styles.textLocked]}>
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
    marginBottom: 8,
  },
  textLocked: {
    color: '#555',
  },
  progressBarBg: {
    width: '100%',
    height: 4,
    backgroundColor: '#2a2a3e',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 4,
    backgroundColor: '#00d4ff',
    borderRadius: 2,
  },
});
