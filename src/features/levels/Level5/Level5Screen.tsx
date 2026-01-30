import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HeadingDisplay from '../../stimulus/HeadingDisplay';
import VoiceInput from '../../voice/VoiceInput';
import FeedbackOverlay from '../../../ui/feedback/FeedbackOverlay';
import { SessionManager } from '../../../state/sessionManager';
import { useStore } from '../../../state/store';
import { FeedbackState, TIMING, ValidationResult } from '../../../core/types';
import { ParsedResponse } from '../../voice/ResponseParser';
import { VoiceResponse } from '../../../core/algorithms/validator';

export default function Level5Screen() {
  const recordResult = useStore((s) => s.recordResult);

  const sessionRef = useRef<SessionManager>(new SessionManager(5));
  const [heading, setHeading] = useState(() => sessionRef.current.getNextHeading());
  const [voiceActive, setVoiceActive] = useState(true);
  const [feedback, setFeedback] = useState<{
    state: FeedbackState;
    result: ValidationResult;
  } | null>(null);

  useEffect(() => {
    sessionRef.current.startTimer();
  }, [heading]);

  const handleVoiceResult = useCallback(
    (parsed: ParsedResponse, confidence: 'high' | 'low') => {
      setVoiceActive(false);

      if (confidence === 'low') {
        setFeedback({
          state: 'amber',
          result: { isCorrect: false, state: 'amber', feedback: 'Speak Clearer!' },
        });
        return;
      }

      const voiceResponse: VoiceResponse = {
        number: parsed.number ?? '',
        direction: parsed.direction ?? 'North',
      };

      const result = sessionRef.current.submitResponse(voiceResponse);
      recordResult(5, sessionRef.current.getCurrentBaseHeading(), result.state, sessionRef.current.getTimeElapsed());
      setFeedback({ state: result.state, result });
    },
    [recordResult],
  );

  const handleTimeout = useCallback(() => {
    setVoiceActive(false);
    const result = sessionRef.current.submitResponse({ number: '', direction: 'North' } as VoiceResponse);
    recordResult(5, sessionRef.current.getCurrentBaseHeading(), result.state, sessionRef.current.getTimeElapsed());
    setFeedback({ state: result.state, result });
  }, [recordResult]);

  const handleFeedbackComplete = useCallback(() => {
    setFeedback(null);
    setTimeout(() => {
      const next = sessionRef.current.getNextHeading();
      setHeading(next);
      setVoiceActive(true);
    }, TIMING.INTER_REP_DELAY);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.levelLabel}>Level 5 — Single Digit Resolution</Text>
      <HeadingDisplay heading={heading} size="large" />
      <VoiceInput
        onResult={handleVoiceResult}
        onTimeout={handleTimeout}
        timeLimit={TIMING.VERBAL_LIMIT}
        level={5}
        active={voiceActive}
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
