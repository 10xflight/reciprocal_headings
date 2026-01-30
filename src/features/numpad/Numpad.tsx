import React, { useCallback, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';

interface NumpadProps {
  onDigit: (digit: string) => void;
  onClear: () => void;
  onBackspace: () => void;
  disabled?: boolean;
  currentInput?: string;
}

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['C', '0', '⌫'],
];

export default function Numpad({
  onDigit,
  onClear,
  onBackspace,
  disabled = false,
  currentInput = '',
}: NumpadProps) {
  // Web keyboard support
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handler = (e: KeyboardEvent) => {
      if (disabled) return;
      if (e.key >= '0' && e.key <= '9') {
        onDigit(e.key);
      } else if (e.key === 'Backspace') {
        onBackspace();
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        onClear();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [disabled, onDigit, onClear, onBackspace]);

  const handlePress = useCallback(
    (key: string) => {
      if (disabled) return;
      if (key === 'C') {
        onClear();
      } else if (key === '⌫') {
        onBackspace();
      } else {
        onDigit(key);
      }
    },
    [disabled, onDigit, onClear, onBackspace],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.tooltip}>Left Hand 1-3, Right Hand 4-0</Text>

      <InputDisplay value={currentInput} />

      {ROWS.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((key) => {
            const isControl = key === 'C' || key === '⌫';
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.key,
                  isControl && styles.controlKey,
                  disabled && styles.keyDisabled,
                ]}
                activeOpacity={0.5}
                onPress={() => handlePress(key)}
                disabled={disabled}
              >
                <Text style={[styles.keyText, isControl && styles.controlKeyText]}>{key}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function InputDisplay({ value }: { value: string }) {
  const d0 = value.length >= 1 ? value[0] : '_';
  const d1 = value.length >= 2 ? value[1] : '_';

  return (
    <View style={styles.inputDisplay}>
      <Text style={[styles.inputDigit, d0 !== '_' && styles.inputDigitFilled]}>{d0}</Text>
      <Text style={[styles.inputDigit, d1 !== '_' && styles.inputDigitFilled]}>{d1}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  tooltip: {
    fontSize: 12,
    color: '#888',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  inputDisplay: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  inputDigit: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#555',
    width: 48,
    textAlign: 'center',
    borderBottomWidth: 3,
    borderBottomColor: '#333',
    paddingBottom: 4,
  },
  inputDigitFilled: {
    color: '#fff',
    borderBottomColor: '#00d4ff',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  key: {
    width: 72,
    height: 56,
    backgroundColor: '#1e2a3a',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlKey: {
    backgroundColor: '#2a1a1a',
  },
  keyDisabled: {
    opacity: 0.3,
  },
  keyText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
  },
  controlKeyText: {
    fontSize: 18,
    color: '#ff6b6b',
  },
});
