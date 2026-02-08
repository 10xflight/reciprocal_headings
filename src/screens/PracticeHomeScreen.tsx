import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useStore } from '../state/store';

export default function PracticeHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const practiceData = useStore((s) => s.practiceData);

  const hasPracticeData = Object.keys(practiceData).length > 0;
  const optimizeEnabled = hasPracticeData;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Practice Mode</Text>
      <Text style={styles.subtitle}>Choose your training approach</Text>

      {/* Learn */}
      <Pressable style={styles.modeCard} onPress={() => navigation.navigate('LearnMode')}>
        <Text style={styles.modeCardTitle}>Learn</Text>
        <Text style={styles.modeCardDesc}>
          Full progression from scratch
        </Text>
        <Text style={styles.modeCardAction}>Start Learning</Text>
      </Pressable>

      {/* Focus */}
      <Pressable style={styles.modeCard} onPress={() => navigation.navigate('FocusSelection')}>
        <Text style={styles.modeCardTitle}>Focus</Text>
        <Text style={styles.modeCardDesc}>
          Choose your own headings
        </Text>
        <Text style={styles.modeCardAction}>Select Headings</Text>
      </Pressable>

      {/* Optimize */}
      <Pressable
        style={[styles.modeCard, !optimizeEnabled && styles.cardDisabled]}
        onPress={() => optimizeEnabled && navigation.navigate('OptimizeMode')}
        disabled={!optimizeEnabled}
      >
        <Text style={[styles.modeCardTitle, !optimizeEnabled && styles.textDisabled]}>Optimize</Text>
        <Text style={[styles.modeCardDesc, !optimizeEnabled && styles.textDisabled]}>
          {!optimizeEnabled
            ? 'Update Practice Data from Mastery to unlock'
            : 'All 36 headings weighted by practice data'}
        </Text>
        {optimizeEnabled && (
          <Text style={styles.modeCardAction}>Start Optimizing</Text>
        )}
      </Pressable>

      <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('Level1Menu')}>
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
    color: '#00d4ff',
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#667788',
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
    borderLeftColor: '#00d4ff',
  },
  cardDisabled: {
    opacity: 0.4,
    borderLeftColor: '#3a4a5a',
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
    marginBottom: 8,
  },
  modeCardAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00d4ff',
  },
  textDisabled: {
    color: '#556677',
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
