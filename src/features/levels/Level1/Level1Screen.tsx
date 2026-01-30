import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import CompassRose from '../../compass/CompassRose';
import HeadingDisplay from '../../stimulus/HeadingDisplay';
import FeedbackOverlay from '../../../ui/feedback/FeedbackOverlay';
import { SessionManager } from '../../../state/sessionManager';
import { useStore } from '../../../state/store';
import { FeedbackState, TIMING, ValidationResult } from '../../../core/types';
import { HEADING_PACKETS } from '../../../core/data/headingPackets';

export default function Level1Screen() {
  const recordResult = useStore((s) => s.recordResult);

  const sessionRef = useRef<SessionManager>(new SessionManager(1));
  const [heading, setHeading] = useState(() => sessionRef.current.getNextHeading());
  const [feedback, setFeedback] = useState<{
    state: FeedbackState;
    result: ValidationResult;
  } | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [highlightWedge, setHighlightWedge] = useState<number | undefined>(undefined);
  const [highlightColor, setHighlightColor] = useState<FeedbackState | undefined>(undefined);

  // Start timer when heading changes
  useEffect(() => {
    sessionRef.current.startTimer();
  }, [heading]);

  const handleWedgeTap = useCallback(
    (wedgeId: number) => {
      if (disabled) return;
      setDisabled(true);

      const result = sessionRef.current.submitResponse(wedgeId);
      const correctWedge = HEADING_PACKETS[heading]?.wedgeId;

      setHighlightWedge(correctWedge);
      setHighlightColor(result.state);

      recordResult(1, sessionRef.current.getCurrentBaseHeading(), result.state, sessionRef.current.getTimeElapsed());
      setFeedback({ state: result.state, result });
    },
    [disabled, heading, recordResult],
  );

  const handleFeedbackComplete = useCallback(() => {
    setFeedback(null);
    setHighlightWedge(undefined);
    setHighlightColor(undefined);

    // Inter-rep delay, then next heading
    setTimeout(() => {
      const next = sessionRef.current.getNextHeading();
      setHeading(next);
      setDisabled(false);
    }, TIMING.INTER_REP_DELAY);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.levelLabel}>Level 1 — Vector Anchoring</Text>
      <HeadingDisplay heading={heading} />
      <CompassRose
        onWedgeTap={handleWedgeTap}
        highlightedWedge={highlightWedge}
        highlightColor={highlightColor}
        disabled={disabled}
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
