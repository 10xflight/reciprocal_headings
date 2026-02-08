import React, { useCallback, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';

type FeedbackState = 'green' | 'amber' | 'red' | undefined;

interface NumpadProps {
  onDigit: (digit: string) => void;
  onClear: () => void;
  onBackspace: () => void;
  disabled?: boolean;
  currentInput?: string;
  /** When set, shows the correct answer instead of user input (for wrong answers) */
  showCorrect?: string;
  /** Feedback state for styling the feedback card */
  feedbackState?: FeedbackState;
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
  showCorrect,
  feedbackState,
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

  // Determine what to show on the feedback card
  const showFeedbackCard = feedbackState != null;
  const cardValue = showCorrect ?? currentInput;

  let cardStyle = styles.cardGreen;
  if (feedbackState === 'red') {
    cardStyle = styles.cardRed;
  } else if (feedbackState === 'amber') {
    cardStyle = styles.cardAmber;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.tooltip}>Left Hand 1-3, Right Hand 4-0</Text>

      <View style={styles.numpadArea}>
        {/* Input display */}
        <InputDisplay value={currentInput} />

        {/* Numpad keys */}
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

        {/* Feedback card overlay */}
        {showFeedbackCard && (
          <View style={[styles.feedbackCard, cardStyle]}>
            <Text style={styles.feedbackCardText}>{cardValue}</Text>
          </View>
        )}
      </View>
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
    paddingVertical: 8,
  },
  tooltip: {
    fontSize: 10,
    color: '#888',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  numpadArea: {
    position: 'relative',
  },
  inputDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
    gap: 8,
  },
  inputDigit: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#555',
    width: 40,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    paddingBottom: 2,
  },
  inputDigitFilled: {
    color: '#fff',
    borderBottomColor: '#00d4ff',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  key: {
    width: 56,
    height: 44,
    backgroundColor: '#1e2a3a',
    borderRadius: 8,
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
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  controlKeyText: {
    fontSize: 14,
    color: '#ff6b6b',
  },
  feedbackCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  cardRed: {
    backgroundColor: '#dc3545',
  },
  cardAmber: {
    backgroundColor: '#ffab00',
  },
  cardGreen: {
    backgroundColor: '#00c853',
  },
  feedbackCardText: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#ffffff',
    fontVariant: ['tabular-nums'],
  },
});
