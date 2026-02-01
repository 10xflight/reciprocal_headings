import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CompassDirection, FeedbackState, TIMING } from '../../core/types';

interface FeedbackOverlayProps {
  state: FeedbackState | null;
  correctAnswer?: { reciprocal: string; direction: CompassDirection };
  message?: string;
  onAnimationComplete: () => void;
}

const COLORS: Record<FeedbackState, string> = {
  green: 'rgba(0, 230, 118, 0.25)',
  amber: 'rgba(255, 171, 0, 0.25)',
  red: 'rgba(255, 23, 68, 0.25)',
};

const TEXT_COLORS: Record<FeedbackState, string> = {
  green: '#00e676',
  amber: '#ffab00',
  red: '#ff1744',
};

const DISPLAY_DURATION = 1000; // ms to show feedback

export default function FeedbackOverlay({
  state,
  correctAnswer,
  message,
  onAnimationComplete,
}: FeedbackOverlayProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(onAnimationComplete);
  callbackRef.current = onAnimationComplete;

  useEffect(() => {
    if (!state) {
      setVisible(false);
      return;
    }

    setVisible(true);

    // Clear any existing timer
    if (timerRef.current) clearTimeout(timerRef.current);

    // Auto-dismiss after duration, then call onAnimationComplete
    timerRef.current = setTimeout(() => {
      setVisible(false);
      callbackRef.current();
    }, DISPLAY_DURATION);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state]);

  if (!state || !visible) return null;

  return (
    <View style={[styles.overlay, { backgroundColor: COLORS[state] }]} pointerEvents="none">
      <View style={styles.content}>
        {state === 'green' && (
          <Text style={[styles.icon, { color: TEXT_COLORS.green }]}>✓</Text>
        )}

        {state === 'amber' && (
          <Text style={[styles.message, { color: TEXT_COLORS.amber }]}>
            {message || 'Too Slow'}
          </Text>
        )}

        {state === 'red' && correctAnswer && (
          <View style={styles.answerContainer}>
            <Text style={[styles.answerNumber, { color: TEXT_COLORS.red }]}>
              {correctAnswer.reciprocal}
            </Text>
            <Text style={[styles.answerDirection, { color: TEXT_COLORS.red }]}>
              {correctAnswer.direction}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  content: {
    alignItems: 'center',
  },
  icon: {
    fontSize: 72,
    fontWeight: 'bold',
  },
  message: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  answerContainer: {
    alignItems: 'center',
  },
  answerNumber: {
    fontSize: 56,
    fontWeight: 'bold',
  },
  answerDirection: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: 8,
  },
});
