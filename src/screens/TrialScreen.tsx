import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import CompassRose from '../features/compass/CompassRose';
import HeadingDisplay from '../features/stimulus/HeadingDisplay';
import FeedbackOverlay from '../ui/feedback/FeedbackOverlay';
import CountdownTimer from '../ui/CountdownTimer';
import { TrialEngine, getStageHeadings } from '../core/algorithms/trainingEngine';
import { SessionManager } from '../state/sessionManager';
import { useStore } from '../state/store';
import { FeedbackState, TIMING, ValidationResult } from '../core/types';
import { HEADING_PACKETS } from '../core/data/headingPackets';
import { getStageName } from '../core/algorithms/trainingEngine';
import { RootStackParamList } from '../navigation/AppNavigator';

type TrialPhase = 'idle' | 'countdown' | 'active' | 'complete';

export default function TrialScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Trial'>>();
  const navigation = useNavigation();
  const stage = route.params.stage;
  const saveTrialResult = useStore((s) => s.saveTrialResult);

  const headings = getStageHeadings(stage);
  const engineRef = useRef<TrialEngine>(new TrialEngine(headings));
  const sessionRef = useRef<SessionManager>(new SessionManager(engineRef.current));
  const trialStartRef = useRef(0);

  const [phase, setPhase] = useState<TrialPhase>('idle');
  const [heading, setHeading] = useState('');
  const [feedback, setFeedback] = useState<{
    state: FeedbackState;
    result: ValidationResult;
  } | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [highlightWedge, setHighlightWedge] = useState<number | undefined>(undefined);
  const [highlightColor, setHighlightColor] = useState<FeedbackState | undefined>(undefined);
  const [repKey, setRepKey] = useState(0);
  const [showHeading, setShowHeading] = useState(false);
  const [remaining, setRemaining] = useState(headings.length);
  const [mistakes, setMistakes] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [frozenTime, setFrozenTime] = useState<number | null>(null);
  const [trialElapsed, setTrialElapsed] = useState(0);

  // Trial clock
  const trialRafRef = useRef<number | null>(null);
  useEffect(() => {
    if (phase === 'active') {
      const tick = () => {
        setTrialElapsed(Date.now() - trialStartRef.current);
        trialRafRef.current = requestAnimationFrame(tick);
      };
      trialRafRef.current = requestAnimationFrame(tick);
      return () => {
        if (trialRafRef.current != null) cancelAnimationFrame(trialRafRef.current);
      };
    }
  }, [phase]);

  useEffect(() => {
    if (heading && phase === 'active') {
      setShowHeading(true);
      sessionRef.current.startTimer();
      setTimerRunning(true);
      setFrozenTime(null);
    }
  }, [repKey, phase]);

  const startTrial = useCallback(() => {
    engineRef.current = new TrialEngine(headings);
    sessionRef.current = new SessionManager(engineRef.current);
    setPhase('countdown');
    setMistakes(0);
    setRemaining(headings.length);
    setDisabled(false);
    setTrialElapsed(0);

    setTimeout(() => {
      trialStartRef.current = Date.now();
      const first = sessionRef.current.getNextHeading();
      setHeading(first);
      setShowHeading(true);
      setPhase('active');
    }, 1000);
  }, [headings]);

  const handleTimeout = useCallback(() => {
    if (disabled || phase !== 'active') return;
    setDisabled(true);
    setShowHeading(false);
    setTimerRunning(false);
    setFrozenTime(TIMING.LEVEL1_LIMIT);

    const { result } = sessionRef.current.submitResponse(-1);
    const correctWedge = HEADING_PACKETS[heading]?.wedgeId;
    setHighlightWedge(correctWedge);
    setHighlightColor('red');
    setFeedback({ state: 'red', result });
    setMistakes((m) => m + 1);
    setRemaining(engineRef.current.getRemaining());
  }, [disabled, heading, phase]);

  const handleWedgeTap = useCallback(
    (wedgeId: number) => {
      if (disabled || phase !== 'active') return;
      setDisabled(true);
      setShowHeading(false);

      const elapsed = sessionRef.current.getTimeElapsed();
      setTimerRunning(false);
      setFrozenTime(elapsed);

      const { result, grade } = sessionRef.current.submitResponse(wedgeId);
      const correctWedge = HEADING_PACKETS[heading]?.wedgeId;

      setHighlightWedge(correctWedge);
      setHighlightColor(result.state);
      setFeedback({ state: result.state, result });
      setRemaining(engineRef.current.getRemaining());

      if (grade !== 'fast') {
        setMistakes((m) => m + 1);
      }
    },
    [disabled, heading, phase],
  );

  const handleFeedbackComplete = useCallback(() => {
    setFeedback(null);
    setHighlightWedge(undefined);
    setHighlightColor(undefined);

    if (engineRef.current.isTrialComplete()) {
      const totalTime = Date.now() - trialStartRef.current;
      if (trialRafRef.current != null) cancelAnimationFrame(trialRafRef.current);
      setTrialElapsed(totalTime);

      const hpm = (headings.length / (totalTime / 60000));
      saveTrialResult(stage, {
        trialId: `stage-${stage}-${Date.now()}`,
        time: totalTime,
        mistakes: engineRef.current.getMistakes(),
        headingsPerMinute: hpm,
      });

      setPhase('complete');
      return;
    }

    setTimeout(() => {
      const next = sessionRef.current.getNextHeading();
      setHeading(next);
      setRepKey((k) => k + 1);
      setDisabled(false);
    }, TIMING.INTER_REP_DELAY);
  }, [headings.length, saveTrialResult, stage]);

  const stageName = getStageName(stage);

  if (phase === 'idle') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Trial — {stageName}</Text>
        <Text style={styles.description}>
          Eliminate all {headings.length} headings as fast as you can.{'\n'}
          Only fast + correct answers remove a heading.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={startTrial}>
          <Text style={styles.primaryBtnText}>Start Trial</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'complete') {
    const totalSecs = trialElapsed / 1000;
    const hpm = (headings.length / (trialElapsed / 60000));
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Trial Complete!</Text>
        <Text style={styles.completeText}>{totalSecs.toFixed(1)}s</Text>
        <Text style={styles.statsLine}>{mistakes} mistakes</Text>
        <Text style={styles.statsLine}>{hpm.toFixed(0)} headings/min</Text>
        <View style={styles.btnRow}>
          <Pressable style={styles.primaryBtn} onPress={startTrial}>
            <Text style={styles.primaryBtnText}>Retry</Text>
          </Pressable>
          <Pressable style={styles.outlineBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.outlineBtnText}>Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (phase === 'countdown') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Trial — {stageName}</Text>
        <Text style={styles.getReady}>Get Ready...</Text>
        <CompassRose onWedgeTap={() => {}} disabled={true} size={300} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CountdownTimer
        running={timerRunning}
        onTimeout={handleTimeout}
        frozenTime={frozenTime}
        duration={TIMING.LEVEL1_LIMIT}
      />

      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Trial — {stageName}</Text>
        <Text style={styles.timerText}>{(trialElapsed / 1000).toFixed(1)}s</Text>
      </View>

      {showHeading ? (
        <HeadingDisplay heading={heading} />
      ) : (
        <View style={styles.headingPlaceholder} />
      )}

      <CompassRose
        onWedgeTap={handleWedgeTap}
        highlightedWedge={highlightWedge}
        highlightColor={highlightColor}
        disabled={disabled}
      />

      <View style={styles.statsRow}>
        <Text style={styles.statText}>Remaining: {remaining}</Text>
        <Text style={styles.statText}>Mistakes: {mistakes}</Text>
      </View>

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
  title: {
    fontSize: 14,
    color: '#ffab00',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 4,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 2,
  },
  topTitle: {
    fontSize: 14,
    color: '#ffab00',
    fontWeight: '600',
  },
  timerText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  description: {
    fontSize: 16,
    color: '#aabbcc',
    textAlign: 'center',
    marginTop: 60,
    lineHeight: 24,
  },
  getReady: {
    fontSize: 24,
    color: '#ffab00',
    fontWeight: '700',
    marginTop: 40,
    marginBottom: 20,
  },
  primaryBtn: {
    marginTop: 30,
    backgroundColor: '#ffab00',
    paddingHorizontal: 36,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f0f23',
  },
  outlineBtn: {
    marginTop: 30,
    borderWidth: 1,
    borderColor: '#3a4a5a',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
  },
  outlineBtnText: {
    color: '#aabbcc',
    fontSize: 18,
    fontWeight: '700',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 12,
  },
  statText: {
    fontSize: 13,
    color: '#667788',
  },
  headingPlaceholder: {
    height: 136,
  },
  completeText: {
    fontSize: 48,
    color: '#00e676',
    fontWeight: '700',
    marginTop: 40,
  },
  statsLine: {
    fontSize: 18,
    color: '#aabbcc',
    marginTop: 12,
  },
});
