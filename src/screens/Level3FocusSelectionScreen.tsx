import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { MASTER_SEQUENCE } from '../core/algorithms/trainingEngine';
import { useStore } from '../state/store';

function formatDate(timestamp: number | null): string {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}-${dd}-${yy}`;
}

export default function Level3FocusSelectionScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const practiceData = useStore((s) => s.level3PracticeData);
  const practiceDataUpdatedAt = useStore((s) => s.level3PracticeDataUpdatedAt);
  const savedSelection = useStore((s) => s.level3FocusSelection);
  const saveFocusSelection = useStore((s) => s.saveLevel3FocusSelection);
  const resetPracticeData = useStore((s) => s.resetLevel3PracticeData);

  const [selected, setSelected] = useState<Set<string>>(
    new Set(savedSelection.length > 0 ? savedSelection : []),
  );
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const toggleHeading = (h: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(h)) next.delete(h);
      else next.add(h);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(MASTER_SEQUENCE));
  const deselectAll = () => setSelected(new Set());

  const canStart = selected.size >= 6;

  const startSession = () => {
    const headings = Array.from(selected);
    saveFocusSelection(headings);
    navigation.navigate('Level3Focus', { headings });
  };

  // 6x6 grid layout
  const gridRows: string[][] = [];
  for (let i = 0; i < MASTER_SEQUENCE.length; i += 6) {
    gridRows.push(MASTER_SEQUENCE.slice(i, i + 6));
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Focus Mode</Text>
      <Text style={styles.dataSource}>
        Based on Practice Data{practiceDataUpdatedAt ? ` • Updated ${formatDate(practiceDataUpdatedAt)}` : ''}
      </Text>
      <Text style={styles.subtitle}>
        {selected.size} selected {selected.size < 6 ? `(need ${6 - selected.size} more)` : ''}
      </Text>

      <View style={styles.grid}>
        {gridRows.map((row, ri) => (
          <View key={ri} style={styles.gridRow}>
            {row.map((h, ci) => {
              const perf = practiceData[h];
              const isSelected = selected.has(h);
              const statusColor = perf
                ? perf.status === 'green' ? '#00e676' : perf.status === 'amber' ? '#ffab00' : '#ff5555'
                : '#556677';

              return (
                <Pressable
                  key={h}
                  style={[
                    styles.gridCell,
                    { borderColor: isSelected ? '#ff9500' : statusColor },
                    !isSelected && perf?.status === 'green' && { backgroundColor: 'rgba(0,230,118,0.12)' },
                    !isSelected && perf?.status === 'amber' && { backgroundColor: 'rgba(255,171,0,0.08)' },
                    !isSelected && perf?.status === 'red' && { backgroundColor: 'rgba(255,85,85,0.08)' },
                    isSelected && styles.cellSelected,
                    (ci === 2 || ci === 4) && { marginLeft: 16 },
                  ]}
                  onPress={() => toggleHeading(h)}
                >
                  <Text style={[styles.gridCellText, { color: isSelected ? '#ff9500' : statusColor }]}>{h}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.utilRow}>
        <Pressable style={styles.utilBtn} onPress={selectAll}>
          <Text style={styles.utilBtnText}>Select All</Text>
        </Pressable>
        <Pressable style={styles.utilBtn} onPress={deselectAll}>
          <Text style={styles.utilBtnText}>Deselect All</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.primaryBtn, !canStart && styles.btnDisabled]}
        onPress={startSession}
        disabled={!canStart}
      >
        <Text style={styles.primaryBtnText}>
          {canStart ? 'Start Focus Session' : `Select at least 6 to Focus`}
        </Text>
      </Pressable>

      <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('Practice3Home')}>
        <Text style={styles.secondaryBtnText}>Back</Text>
      </Pressable>

      <Pressable style={styles.resetBtn} onPress={() => setShowResetConfirm(true)}>
        <Text style={styles.resetBtnText}>Reset Practice Data</Text>
      </Pressable>

      {showResetConfirm && (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Reset Practice Data?</Text>
            <Text style={styles.confirmMessage}>This will lock Optimize until you complete a Mastery Challenge.</Text>
            <View style={styles.confirmBtnRow}>
              <Pressable style={styles.confirmBtnNo} onPress={() => setShowResetConfirm(false)}>
                <Text style={styles.confirmBtnNoText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmBtnYes} onPress={() => { setShowResetConfirm(false); resetPracticeData(); }}>
                <Text style={styles.confirmBtnYesText}>Reset</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23', alignItems: 'center', paddingTop: 20 },
  title: { fontSize: 22, color: '#ff9500', fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  dataSource: { fontSize: 12, color: '#667788', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#aabbcc', marginBottom: 16 },
  grid: { gap: 4 },
  gridRow: { flexDirection: 'row', gap: 4 },
  gridCell: {
    width: 48, height: 40, borderWidth: 1, borderRadius: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  cellSelected: { borderWidth: 3, backgroundColor: 'rgba(255,149,0,0.25)' },
  gridCellText: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  utilRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  utilBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#3a4a5a' },
  utilBtnText: { color: '#aabbcc', fontSize: 13, fontWeight: '600' },
  primaryBtn: { marginTop: 20, backgroundColor: '#ff9500', paddingHorizontal: 36, paddingVertical: 12, borderRadius: 8 },
  primaryBtnText: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  btnDisabled: { opacity: 0.4 },
  secondaryBtn: { marginTop: 12, borderWidth: 1, borderColor: '#3a4a5a', paddingHorizontal: 28, paddingVertical: 10, borderRadius: 8 },
  secondaryBtnText: { color: '#aabbcc', fontSize: 15, fontWeight: '600' },
  resetBtn: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#ff5555', borderRadius: 6, zIndex: 20 },
  resetBtnText: { color: '#ff5555', fontSize: 13, fontWeight: '600' },
  confirmOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  confirmCard: { backgroundColor: '#1a1a2e', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 24, alignItems: 'center', borderWidth: 1, borderColor: '#3a4a5a' },
  confirmTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff', marginBottom: 10 },
  confirmMessage: { fontSize: 14, color: '#aabbcc', textAlign: 'center', marginBottom: 24 },
  confirmBtnRow: { flexDirection: 'row', gap: 16 },
  confirmBtnNo: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#3a4a5a' },
  confirmBtnNoText: { fontSize: 15, fontWeight: '600', color: '#aabbcc' },
  confirmBtnYes: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, backgroundColor: '#ff5555' },
  confirmBtnYesText: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
});
