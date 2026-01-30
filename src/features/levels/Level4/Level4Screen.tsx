import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AudioStimulus from '../../stimulus/AudioStimulus';
import VoiceInput from '../../voice/VoiceInput';
import FeedbackOverlay from '../../../ui/feedback/FeedbackOverlay';
import { SessionManager } from '../../../state/sessionManager';
import { useStore } from '../../../state/store';
import { FeedbackState, TIMING, ValidationResult } from '../../../core/types';
import { ParsedResponse } from '../../voice/ResponseParser';
import { VoiceResponse } from '../../../core/algorithms/validator';

export default function Level4Screen() {
  const recordResult = useStore((s) => s.recordResult);

  const sessionRef = useRef<SessionManager>(new SessionManager(4));
  const [heading, setHeading] = useState(() => sessionRef.current.getNextHeading());
  const [phase, setPhase] = useState<'stimulus' | 'listening'>('stimulus');
  const [voiceActive, setVoiceActive] = useState(false);
  const [feedback, setFeedback] = useState<{
    state: FeedbackState;
    result: ValidationResult;
  } | null>(null);

  useEffect(() => {
    sessionRef.current.startTimer();
  }, [heading]);

  const handleAudioComplete = useCallback(() => {
    setPhase('listening');
    setVoiceActive(true);
    // Re-start timer from when audio finishes (user can now respond)
    sessionRef.current.startTimer();
  }, []);

  const handleVoiceResult = useCallback(
    (parsed: ParsedResponse, confidence: 'high' | 'low') => {
      setVoiceActive(false);

      if (confidence === 'low') {
        // Speak clearer — will play correct answer as interrupt
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
      recordResult(4, sessionRef.current.getCurrentBaseHeading(), result.state, sessionRef.current.getTimeElapsed());

      // Interrupt mechanic: on wrong/timeout, the correct answer audio would play here.
      // TODO: integrate AudioManager.playAnswer() for interrupt
      setFeedback({ state: result.state, result });
    },
    [recordResult],
  );

  const handleTimeout = useCallback(() => {
    setVoiceActive(false);
    const result = sessionRef.current.submitResponse({ number: '', direction: 'North' } as VoiceResponse);
    recordResult(4, sessionRef.current.getCurrentBaseHeading(), result.state, sessionRef.current.getTimeElapsed());
    // Interrupt: play answer audio
    // TODO: AudioManager.playAnswer(heading)
    setFeedback({ state: result.state, result });
  }, [recordResult]);

  const handleFeedbackComplete = useCallback(() => {
    setFeedback(null);
    setTimeout(() => {
      const next = sessionRef.current.getNextHeading();
      setHeading(next);
      setPhase('stimulus');
      setVoiceActive(false);
    }, TIMING.INTER_REP_DELAY);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.levelLabel}>Level 4 — Auditory Vector Sense</Text>

      {phase === 'stimulus' && (
        <AudioStimulus heading={heading} onPlayComplete={handleAudioComplete} />
      )}

      {phase === 'listening' && (
        <VoiceInput
          onResult={handleVoiceResult}
          onTimeout={handleTimeout}
          timeLimit={TIMING.VERBAL_LIMIT}
          level={4}
          active={voiceActive}
        />
      )}

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
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelLabel: {
    position: 'absolute',
    top: 20,
    fontSize: 14,
    color: '#00d4ff',
    fontWeight: '600',
    letterSpacing: 1,
  },
});
