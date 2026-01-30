import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

const LEVELS = [
  { id: 1, name: 'Vector Anchoring', subtitle: 'The Map', description: 'Tap the compass wedge' },
  { id: 2, name: 'Reciprocal Packets', subtitle: 'The Bond', description: 'Type the reciprocal' },
  { id: 3, name: 'Vector Orientation', subtitle: 'The Lock', description: 'Say the full packet' },
  { id: 4, name: 'Auditory Vector Sense', subtitle: 'The Ear', description: 'Listen and respond' },
  { id: 5, name: 'Single Digit Resolution', subtitle: 'The Real World', description: 'Full 3-digit headings' },
];

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Training Levels</Text>
      {LEVELS.map((level) => (
        <TouchableOpacity
          key={level.id}
          style={styles.card}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Training', { level: level.id })}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.levelNumber}>Level {level.id}</Text>
            <Text style={styles.levelSubtitle}>{level.subtitle}</Text>
          </View>
          <Text style={styles.levelName}>{level.name}</Text>
          <Text style={styles.levelDescription}>{level.description}</Text>
        </TouchableOpacity>
      ))}

      {/* Navigation buttons */}
      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('Progress')}
        >
          <Text style={styles.navButtonText}>Progress</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.navButtonText}>Settings</Text>
        </TouchableOpacity>
      </View>
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#00d4ff',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  levelNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00d4ff',
  },
  levelSubtitle: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  levelName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  levelDescription: {
    fontSize: 14,
    color: '#aaa',
  },
  navRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  navButton: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  navButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#00d4ff',
  },
});
