import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HeadingDisplay from '../../stimulus/HeadingDisplay';
import CompassRose from '../../compass/CompassRose';
import VoiceInput from '../../voice/VoiceInput';
import FeedbackOverlay from '../../../ui/feedback/FeedbackOverlay';
import { SessionManager } from '../../../state/sessionManager';
import { useStore } from '../../../state/store';
import { FeedbackState, TIMING, ValidationResult } from '../../../core/types';
import { ParsedResponse, assessConfidence } from '../../voice/ResponseParser';
import { HEADING_PACKETS } from '../../../core/data/headingPackets';
import { VoiceResponse } from '../../../core/algorithms/validator';

export default function Level3Screen() {
  const recordResult = useStore((s) => s.recordResult);

  const sessionRef = useRef<SessionManager>(new SessionManager(3));
  const [heading, setHeading] = useState(() => sessionRef.current.getNextHeading());
  const [voiceActive, setVoiceActive] = useState(true);
  const [feedback, setFeedback] = useState<{
    state: FeedbackState;
    result: ValidationResult;
  } | null>(null);
  const [highlightWedge, setHighlightWedge] = useState<number | undefined>(undefined);
  const [highlightColor, setHighlightColor] = useState<FeedbackState | undefined>(undefined);

  useEffect(() => {
    sessionRef.current.startTimer();
  }, [heading]);

  const handleVoiceResult = useCallback(
    (parsed: ParsedResponse, confidence: 'high' | 'low') => {
      setVoiceActive(false);

      if (confidence === 'low') {
        // Speak clearer — amber overlay, retry same card (no stability reset)
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
      const correctWedge = HEADING_PACKETS[sessionRef.current.getCurrentBaseHeading()]?.wedgeId;

      if (result.state === 'green') {
        setHighlightWedge(correctWedge);
        setHighlightColor('green');
      } else if (result.state === 'red') {
        setHighlightWedge(correctWedge);
        setHighlightColor('red');
      }

      recordResult(3, sessionRef.current.getCurrentBaseHeading(), result.state, sessionRef.current.getTimeElapsed());
      setFeedback({ state: result.state, result });
    },
    [recordResult],
  );

  const handleTimeout = useCallback(() => {
    setVoiceActive(false);
    const result = sessionRef.current.submitResponse({ number: '', direction: 'North' } as VoiceResponse);
    recordResult(3, sessionRef.current.getCurrentBaseHeading(), result.state, sessionRef.current.getTimeElapsed());
    setFeedback({ state: result.state, result });
  }, [recordResult]);

  const handleFeedbackComplete = useCallback(() => {
    setFeedback(null);
    setHighlightWedge(undefined);
    setHighlightColor(undefined);

    setTimeout(() => {
      const next = sessionRef.current.getNextHeading();
      setHeading(next);
      setVoiceActive(true);
    }, TIMING.INTER_REP_DELAY);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.levelLabel}>Level 3 — Vector Orientation</Text>
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
        timeLimit={TIMING.VERBAL_LIMIT}
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
    marginBottom: 8,
  },
});
