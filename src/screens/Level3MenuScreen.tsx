import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useStore } from '../state/store';

export default function Level3MenuScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const level3Progress = useStore((s) => s.level3DeckProgress);
  const masteryBest = useStore((s) => s.level3MasteryChallengeBest);

  const masteredCount = (level3Progress.masteredHeadings || []).length;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Level 3</Text>
      <Text style={styles.subtitle}>Vector Orientation</Text>

      {/* Practice Mode */}
      <Pressable style={styles.modeCard} onPress={() => navigation.navigate('Practice3Home')}>
        <Text style={styles.modeCardTitle}>Practice Mode</Text>
        <Text style={styles.modeCardDesc}>
          Learn, Focus, and Optimize your headings
        </Text>
        <Text style={styles.modeCardStat}>{masteredCount}/36 mastered in Learn</Text>
        <Text style={styles.modeCardAction}>Enter Practice</Text>
      </Pressable>

      {/* Mastery Challenge */}
      <Pressable
        style={[styles.modeCard, { borderLeftColor: '#ffab00' }]}
        onPress={() => navigation.navigate('Level3MasteryChallenge')}
      >
        <Text style={styles.modeCardTitle}>Mastery Challenge</Text>
        <Text style={styles.modeCardDesc}>
          All 36 headings, 1.7 seconds each
        </Text>
        {masteryBest && (
          <Text style={styles.modeCardStat}>
            Best: {masteryBest.score.toFixed(1)} HPM ({Math.round(masteryBest.accuracy * 100)}%)
          </Text>
        )}
        <Text style={[styles.modeCardAction, { color: '#ffab00' }]}>Start Challenge</Text>
      </Pressable>

      <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('Home')}>
        <Text style={styles.secondaryBtnText}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
    alignItems: 'center',
    paddingTop: 20,
  },
  title: {
    fontSize: 22,
    color: '#ff9500',
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 15,
    color: '#aabbcc',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  modeCard: {
    width: '80%',
    maxWidth: 340,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9500',
  },
  modeCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  modeCardDesc: {
    fontSize: 13,
    color: '#aabbcc',
    marginBottom: 4,
  },
  modeCardStat: {
    fontSize: 12,
    color: '#667788',
    marginBottom: 8,
  },
  modeCardAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff9500',
  },
  secondaryBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#3a4a5a',
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 8,
  },
  secondaryBtnText: {
    color: '#aabbcc',
    fontSize: 15,
    fontWeight: '600',
  },
});
