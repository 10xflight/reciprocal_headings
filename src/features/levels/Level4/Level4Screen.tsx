import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AudioStimulus from '../../stimulus/AudioStimulus';
import VoiceInput from '../../voice/VoiceInput';
import FeedbackOverlay from '../../../ui/feedback/FeedbackOverlay';
import { FeedbackState, TIMING, ValidationResult } from '../../../core/types';
import { HEADING_PACKETS } from '../../../core/data/headingPackets';
import { calculateReciprocal, getDirection } from '../../../core/algorithms/reciprocal';
import { ParsedResponse } from '../../voice/ResponseParser';

const ALL_HEADINGS = Object.keys(HEADING_PACKETS);
const VOICE_LIMIT = 2000;

function randomHeading(): string {
  return ALL_HEADINGS[Math.floor(Math.random() * ALL_HEADINGS.length)];
}

export default function Level4Screen() {
  const [heading, setHeading] = useState(() => randomHeading());
  const [phase, setPhase] = useState<'stimulus' | 'listening'>('stimulus');
  const [voiceActive, setVoiceActive] = useState(false);
  const [feedback, setFeedback] = useState<{
    state: FeedbackState;
    result: ValidationResult;
  } | null>(null);
  const [streak, setStreak] = useState(0);
  const [repsCount, setRepsCount] = useState(0);

  const handleAudioComplete = useCallback(() => {
    setPhase('listening');
    setVoiceActive(true);
  }, []);

  const handleVoiceResult = useCallback(
    (parsed: ParsedResponse, confidence: 'high' | 'low') => {
      setVoiceActive(false);

      const expected = calculateReciprocal(heading);
      const expectedDir = getDirection(heading);

      if (confidence === 'low') {
        setFeedback({
          state: 'amber',
          result: { isCorrect: false, state: 'amber', feedback: 'Speak Clearer!' },
        });
        return;
      }

      const isCorrect = parsed.number === expected && parsed.direction === expectedDir;
      const state: FeedbackState = isCorrect ? 'green' : 'red';

      setRepsCount((c) => c + 1);
      if (state === 'green') {
        setStreak((s) => s + 1);
      } else {
        setStreak(0);
      }

      setFeedback({
        state,
        result: {
          isCorrect,
          state,
          correctAnswer: { reciprocal: expected, direction: expectedDir },
        },
      });
    },
    [heading],
  );

  const handleTimeout = useCallback(() => {
    setVoiceActive(false);
    const expected = calculateReciprocal(heading);
    const expectedDir = getDirection(heading);

    setRepsCount((c) => c + 1);
    setStreak(0);

    setFeedback({
      state: 'red',
      result: {
        isCorrect: false,
        state: 'red',
        correctAnswer: { reciprocal: expected, direction: expectedDir },
      },
    });
  }, [heading]);

  const handleFeedbackComplete = useCallback(() => {
    setFeedback(null);
    setTimeout(() => {
      setHeading(randomHeading());
      setPhase('stimulus');
      setVoiceActive(false);
    }, TIMING.INTER_REP_DELAY);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.levelLabel}>Level 4 — Auditory Vector Sense</Text>
      <View style={styles.statsRow}>
        <Text style={styles.statText}>Streak: {streak}</Text>
        <Text style={styles.statText}>Reps: {repsCount}</Text>
      </View>

      {phase === 'stimulus' && (
        <AudioStimulus heading={heading} onPlayComplete={handleAudioComplete} />
      )}

      {phase === 'listening' && (
        <VoiceInput
          onResult={handleVoiceResult}
          onTimeout={handleTimeout}
          timeLimit={VOICE_LIMIT}
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
  statsRow: {
    position: 'absolute',
    top: 42,
    flexDirection: 'row',
    gap: 20,
  },
  statText: {
    fontSize: 13,
    color: '#667788',
  },
});
