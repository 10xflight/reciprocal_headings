import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HeadingDisplay from '../../stimulus/HeadingDisplay';
import CompassRose from '../../compass/CompassRose';
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

export default function Level3Screen() {
  const [heading, setHeading] = useState(() => randomHeading());
  const [voiceActive, setVoiceActive] = useState(true);
  const [feedback, setFeedback] = useState<{
    state: FeedbackState;
    result: ValidationResult;
  } | null>(null);
  const [highlightWedge, setHighlightWedge] = useState<number | undefined>(undefined);
  const [highlightColor, setHighlightColor] = useState<FeedbackState | undefined>(undefined);
  const [streak, setStreak] = useState(0);
  const [repsCount, setRepsCount] = useState(0);

  const handleVoiceResult = useCallback(
    (parsed: ParsedResponse, confidence: 'high' | 'low') => {
      setVoiceActive(false);

      const expected = calculateReciprocal(heading);
      const expectedDir = getDirection(heading);
      const correctWedge = HEADING_PACKETS[heading]?.wedgeId;

      if (confidence === 'low') {
        setFeedback({
          state: 'amber',
          result: { isCorrect: false, state: 'amber', feedback: 'Speak Clearer!' },
        });
        return;
      }

      const isCorrect = parsed.number === expected && parsed.direction === expectedDir;
      let state: FeedbackState;
      if (!isCorrect) {
        state = 'red';
      } else {
        state = 'green';
      }

      setHighlightWedge(correctWedge);
      setHighlightColor(state);
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
    const correctWedge = HEADING_PACKETS[heading]?.wedgeId;

    setHighlightWedge(correctWedge);
    setHighlightColor('red');
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
    setHighlightWedge(undefined);
    setHighlightColor(undefined);
    setTimeout(() => {
      setHeading(randomHeading());
      setVoiceActive(true);
    }, TIMING.INTER_REP_DELAY);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.levelLabel}>Level 3 — Vector Orientation</Text>
      <View style={styles.statsRow}>
        <Text style={styles.statText}>Streak: {streak}</Text>
        <Text style={styles.statText}>Reps: {repsCount}</Text>
      </View>
      <HeadingDisplay heading={heading} />
      <CompassRose
        onWedgeTap={() => {}}
        highlightedWedge={highlightWedge}
        highlightColor={highlightColor}
        disabled
        size={200}
      />
      <VoiceInput
        onResult={handleVoiceResult}
        onTimeout={handleTimeout}
        timeLimit={VOICE_LIMIT}
        level={3}
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
