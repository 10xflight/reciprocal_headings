import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useStore } from '../state/store';

function showAlert(title: string, message: string, onOk?: () => void) {
  if (Platform.OS === 'web') {
    if (onOk) {
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) onOk();
    } else {
      window.alert(`${title}\n\n${message}`);
    }
  } else {
    if (onOk) {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'OK', onPress: onOk },
      ]);
    } else {
      Alert.alert(title, message);
    }
  }
}

export default function SettingsScreen() {
  const exportState = useStore((s) => s.exportState);
  const importState = useStore((s) => s.importState);
  const resetProgress = useStore((s) => s.resetProgress);
  const unlockAllLevels = useStore((s) => s.unlockAllLevels);
  const toggleUnlockAllLevels = useStore((s) => s.toggleUnlockAllLevels);

  const [importCode, setImportCode] = useState('');
  const [exportedCode, setExportedCode] = useState<string | null>(null);

  const handleExport = async () => {
    const code = exportState();
    setExportedCode(code);
    try {
      await Clipboard.setStringAsync(code);
      showAlert('Exported', 'Save code copied to clipboard.');
    } catch {
      showAlert('Exported', 'Copy the code below manually.');
    }
  };

  const handleImport = () => {
    const trimmed = importCode.trim();
    if (!trimmed) {
      showAlert('Error', 'Please paste a save code first.');
      return;
    }
    const success = importState(trimmed);
    if (success) {
      showAlert('Imported', 'Progress restored successfully.');
      setImportCode('');
    } else {
      showAlert('Error', 'Invalid save code. Please check and try again.');
    }
  };

  const handleReset = () => {
    showAlert(
      'Reset Progress',
      'This will permanently erase all training data. This cannot be undone. Are you sure?',
      () => {
        resetProgress();
        showAlert('Reset', 'All progress has been cleared.');
      },
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      {/* Developer / Testing */}
      <Text style={styles.sectionTitle}>Developer</Text>
      <TouchableOpacity
        style={[styles.button, unlockAllLevels && styles.activeButton]}
        onPress={toggleUnlockAllLevels}
      >
        <Text style={[styles.buttonText, unlockAllLevels && styles.activeButtonText]}>
          {unlockAllLevels ? 'All Levels Unlocked ✓' : 'Unlock All Levels'}
        </Text>
      </TouchableOpacity>
      <Text style={styles.hint}>
        Bypass Level 1 Stage 11 requirement to access Levels 2–5.
      </Text>

      {/* Export */}
      <Text style={styles.sectionTitle}>Export Progress</Text>
      <Text style={styles.hint}>
        Generate a save code to transfer your progress to another device.
      </Text>
      <TouchableOpacity style={styles.button} onPress={handleExport}>
        <Text style={styles.buttonText}>Export &amp; Copy</Text>
      </TouchableOpacity>
      {exportedCode && (
        <View style={styles.codeBox}>
          <Text style={styles.codeText} selectable>
            {exportedCode}
          </Text>
        </View>
      )}

      {/* Import */}
      <Text style={styles.sectionTitle}>Import Progress</Text>
      <Text style={styles.hint}>Paste a save code to restore progress.</Text>
      <TextInput
        style={styles.input}
        value={importCode}
        onChangeText={setImportCode}
        placeholder="Paste save code here"
        placeholderTextColor="#555"
        multiline
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity style={styles.button} onPress={handleImport}>
        <Text style={styles.buttonText}>Import</Text>
      </TouchableOpacity>

      {/* Reset */}
      <Text style={styles.sectionTitle}>Reset Progress</Text>
      <Text style={styles.hint}>Permanently erase all training data.</Text>
      <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={handleReset}>
        <Text style={[styles.buttonText, styles.dangerText]}>Reset All Progress</Text>
      </TouchableOpacity>

      {/* About */}
      <Text style={styles.sectionTitle}>About</Text>
      <Text style={styles.aboutText}>
        Reciprocal Headings Trainer v1.0.0{'\n'}
        A 10X Flight Training tool for building reflex-level reciprocal heading recall.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  content: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 24 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00d4ff',
    marginTop: 24,
    marginBottom: 6,
  },
  hint: { fontSize: 13, color: '#888', marginBottom: 12 },
  button: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonText: { fontSize: 15, fontWeight: '600', color: '#00d4ff' },
  activeButton: { backgroundColor: '#0a2a1a', borderWidth: 1, borderColor: '#00e676' },
  activeButtonText: { color: '#00e676' },
  dangerButton: { backgroundColor: '#2a1014' },
  dangerText: { color: '#ff4455' },
  codeBox: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  codeText: { fontSize: 11, color: '#aaa', fontFamily: 'monospace' },
  input: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 13,
    fontFamily: 'monospace',
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  aboutText: { fontSize: 13, color: '#666', lineHeight: 20 },
});
