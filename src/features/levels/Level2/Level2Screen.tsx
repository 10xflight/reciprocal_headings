import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Numpad from '../../numpad/Numpad';
import HeadingDisplay from '../../stimulus/HeadingDisplay';
import FeedbackOverlay from '../../../ui/feedback/FeedbackOverlay';
import { FeedbackState, TIMING, ValidationResult } from '../../../core/types';
import { HEADING_PACKETS } from '../../../core/data/headingPackets';
import { calculateReciprocal, getDirection } from '../../../core/algorithms/reciprocal';

const ALL_HEADINGS = Object.keys(HEADING_PACKETS);

function randomHeading(): string {
  return ALL_HEADINGS[Math.floor(Math.random() * ALL_HEADINGS.length)];
}

export default function Level2Screen() {
  const [heading, setHeading] = useState(() => randomHeading());
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<{
    state: FeedbackState;
    result: ValidationResult;
  } | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [streak, setStreak] = useState(0);
  const [repsCount, setRepsCount] = useState(0);
  const timerRef = useRef(0);

  useEffect(() => {
    timerRef.current = Date.now();
  }, [heading]);

  // Auto-submit on 2nd digit
  useEffect(() => {
    if (input.length === 2 && !disabled) {
      setDisabled(true);
      const timeMs = Date.now() - timerRef.current;
      const expected = calculateReciprocal(heading);
      const expectedDir = getDirection(heading);
      const isCorrect = input === expected;

      let state: FeedbackState;
      let feedbackMsg: string | undefined;
      if (!isCorrect) {
        state = 'red';
      } else if (timeMs > TIMING.LEVEL1_LIMIT) {
        state = 'amber';
        feedbackMsg = 'Too Slow';
      } else {
        state = 'green';
      }

      const result: ValidationResult = {
        isCorrect,
        state,
        feedback: feedbackMsg,
        correctAnswer: { reciprocal: expected, direction: expectedDir },
      };

      setRepsCount((c) => c + 1);
      if (state === 'green') {
        setStreak((s) => s + 1);
      } else {
        setStreak(0);
      }
      setFeedback({ state, result });
    }
  }, [input, disabled, heading]);

  const handleDigit = useCallback(
    (digit: string) => {
      if (disabled) return;
      setInput((prev) => (prev.length < 2 ? prev + digit : prev));
    },
    [disabled],
  );

  const handleClear = useCallback(() => {
    if (disabled) return;
    setInput('');
  }, [disabled]);

  const handleBackspace = useCallback(() => {
    if (disabled) return;
    setInput((prev) => prev.slice(0, -1));
  }, [disabled]);

  const handleFeedbackComplete = useCallback(() => {
    setFeedback(null);
    setTimeout(() => {
      setHeading(randomHeading());
      setInput('');
      setDisabled(false);
    }, TIMING.INTER_REP_DELAY);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.levelLabel}>Level 2 — Reciprocal Packets</Text>
      <View style={styles.statsRow}>
        <Text style={styles.statText}>Streak: {streak}</Text>
        <Text style={styles.statText}>Reps: {repsCount}</Text>
      </View>
      <HeadingDisplay heading={heading} />
      <Numpad
        onDigit={handleDigit}
        onClear={handleClear}
        onBackspace={handleBackspace}
        disabled={disabled}
        currentInput={input}
      />
      <FeedbackOverlay
        state={feedback?.state ?? null}
        correctAnswer={feedback?.result.correctAnswer}
        message={feedback?.result.feedback}
        onAnimationComplete={handleFeedbackComplete}
      />
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
  levelLabel: {
    fontSize: 14,
    color: '#00d4ff',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 4,
  },
  statText: {
    fontSize: 13,
    color: '#667788',
  },
});
