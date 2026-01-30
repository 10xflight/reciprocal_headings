import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Numpad from '../../numpad/Numpad';
import HeadingDisplay from '../../stimulus/HeadingDisplay';
import FeedbackOverlay from '../../../ui/feedback/FeedbackOverlay';
import { SessionManager } from '../../../state/sessionManager';
import { useStore } from '../../../state/store';
import { FeedbackState, TIMING, ValidationResult } from '../../../core/types';

export default function Level2Screen() {
  const recordResult = useStore((s) => s.recordResult);

  const sessionRef = useRef<SessionManager>(new SessionManager(2));
  const [heading, setHeading] = useState(() => sessionRef.current.getNextHeading());
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<{
    state: FeedbackState;
    result: ValidationResult;
  } | null>(null);
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    sessionRef.current.startTimer();
  }, [heading]);

  // Auto-submit on 2nd digit
  useEffect(() => {
    if (input.length === 2 && !disabled) {
      setDisabled(true);
      const result = sessionRef.current.submitResponse(input);
      recordResult(2, sessionRef.current.getCurrentBaseHeading(), result.state, sessionRef.current.getTimeElapsed());
      setFeedback({ state: result.state, result });
    }
  }, [input, disabled, recordResult]);

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
      const next = sessionRef.current.getNextHeading();
      setHeading(next);
      setInput('');
      setDisabled(false);
    }, TIMING.INTER_REP_DELAY);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.levelLabel}>Level 2 — Reciprocal Packets</Text>
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
    marginBottom: 8,
  },
});
