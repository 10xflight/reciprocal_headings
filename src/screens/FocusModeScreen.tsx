import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, usePreventRemove, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import CompassRose from '../features/compass/CompassRose';
import HeadingDisplay from '../features/stimulus/HeadingDisplay';
import FeedbackOverlay from '../ui/feedback/FeedbackOverlay';
import CountdownTimer from '../ui/CountdownTimer';
import { MASTER_SEQUENCE, GRID_PAIRS } from '../core/algorithms/trainingEngine';
import { FocusDeckEngine } from '../core/algorithms/focusDeckEngine';
import { SessionManager } from '../state/sessionManager';
import { useStore } from '../state/store';
import { FeedbackState, TIMING, CompassDirection } from '../core/types';
import { HEADING_PACKETS } from '../core/data/headingPackets';

type SessionPhase = 'countdown' | 'active' | 'paused' | 'complete';

const FEEDBACK_HOLD_MS = 1200;

function ProgressGrid({ engine, selectedSet }: { engine: FocusDeckEngine; selectedSet: Set<string> }) {
  const mastered = engine.getMasteredHeadings();
  const deck = engine.getDeckSet();

  const renderCell = (h: string) => {
    const isSelected = selectedSet.has(h);
    const isMastered = mastered.has(h);
    const inDeck = deck.has(h);
    // Unselected = very dim; selected: green=mastered, amber=in-deck, cyan=not-yet-seen
    let cellColor: string;
    let textColor: string;
    let bgColor = 'transparent';

    if (!isSelected) {
      cellColor = '#1a1a24';
      textColor = '#2a2a3a';
    } else if (isMastered) {
      cellColor = '#00e676';
      textColor = '#00e676';
      bgColor = 'rgba(0,230,118,0.15)';
    } else if (inDeck) {
      cellColor = '#ffab00';
      textColor = '#ffab00';
      bgColor = 'rgba(255,171,0,0.10)';
    } else {
      // Selected but not yet seen - use cyan tint to stand out
      cellColor = '#00d4ff';
      textColor = '#00d4ff';
      bgColor = 'rgba(0,212,255,0.08)';
    }

    return (
      <View
        key={h}
        style={[
          styles.gridCell,
          { borderColor: cellColor, backgroundColor: bgColor },
        ]}
      >
        <Text style={[styles.gridCellText, { color: textColor }]}>{h}</Text>
      </View>
    );
  };

  return (
    <View style={styles.gridContainer}>
      {GRID_PAIRS.map(([left, right]) => (
        <View key={left} style={styles.gridRow}>
          {renderCell(left)}
          {renderCell(right)}
        </View>
      ))}
    </View>
  );
}

export default function FocusModeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'FocusMode'>>();
  const { headings } = route.params;
  const practiceData = useStore((s) => s.practiceData);
  const saveFocusSelection = useStore((s) => s.saveFocusSelection);

  // Sort headings: weakest first if practice data, else master sequence order
  const orderedHeadings = useMemo(() => {
    const hasPractice = Object.keys(practiceData).length > 0;
    if (!hasPractice) {
      return MASTER_SEQUENCE.filter((h) => headings.includes(h));
    }
    return [...headings].sort((a, b) => {
      const pa = practiceData[a];
      const pb = practiceData[b];
      const scoreA = pa ? pa.avgTime + pa.mistakes * 500 : 9999;
      const scoreB = pb ? pb.avgTime + pb.mistakes * 500 : 9999;
      return scoreB - scoreA; // weakest (highest score) first
    });
  }, [headings, practiceData]);

  const engineRef = useRef<FocusDeckEngine>(new FocusDeckEngine(orderedHeadings));
  const sessionRef = useRef<SessionManager>(new SessionManager(engineRef.current));
  const [phase, setPhase] = useState<SessionPhase>('countdown');
  const phaseRef = useRef<SessionPhase>('countdown');
  const [heading, setHeading] = useState('');
  const [feedback, setFeedback] = useState<{
    state: FeedbackState;
    correctAnswer?: { reciprocal: string; direction: CompassDirection };
    message?: string;
  } | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [highlightWedge, setHighlightWedge] = useState<number | undefined>(undefined);
  const [highlightColor, setHighlightColor] = useState<FeedbackState | undefined>(undefined);
  const [wrongWedge, setWrongWedge] = useState<number | undefined>(undefined);
  const [arrowFill, setArrowFill] = useState<'filled-green' | 'filled-yellow' | 'outline'>('filled-green');
  const [wedgeOutlineOnly, setWedgeOutlineOnly] = useState(false);
  const [wedgeFillColor, setWedgeFillColor] = useState<FeedbackState | undefined>(undefined);
  const [repKey, setRepKey] = useState(0);
  const [showHeading, setShowHeading] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [frozenTime, setFrozenTime] = useState<number | null>(null);
  const [resumeFrom, setResumeFrom] = useState<number | null>(null);
  const resumeFromRef = useRef<number>(0);
  const [radialFlash, setRadialFlash] = useState<string | undefined>(undefined);

  const [masteredCount, setMasteredCount] = useState(0);
  const [unlockedCount, setUnlockedCount] = useState(1);
  const [totalReps, setTotalReps] = useState(0);
  const [gridKey, setGridKey] = useState(0);
  const selectedSet = useMemo(() => new Set(headings), [headings]);

  // Start countdown on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (phaseRef.current !== 'countdown') return;
      const first = sessionRef.current.getNextHeading();
      setHeading(first);
      setShowHeading(true);
      setPhase('active');
      phaseRef.current = 'active';
      sessionRef.current.startTimer();
      resumeFromRef.current = 0;
      setTimerRunning(true);
      setFrozenTime(null);
      setResumeFrom(null);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (heading && phase === 'active') {
      setShowHeading(true);
    }
  }, [repKey]);

  const updateStats = useCallback(() => {
    const engine = engineRef.current;
    setMasteredCount(engine.getMasteredCount());
    setUnlockedCount(engine.getUnlockedCount());
    setTotalReps((r) => r + 1);
    setGridKey((k) => k + 1);
  }, []);

  const stopSession = useCallback(() => {
    setPhase('complete');
    phaseRef.current = 'complete';
    setFeedback(null);
    setHighlightWedge(undefined);
    setHighlightColor(undefined);
    setWrongWedge(undefined);
    setDisabled(false);
    setTimerRunning(false);
    setFrozenTime(null);
  }, []);

  usePreventRemove(phase !== 'complete', () => {
    stopSession();
  });

  const pauseSession = useCallback(() => {
    const sinceLast = sessionRef.current.getTimeElapsed();
    const totalElapsed = sinceLast + resumeFromRef.current;
    setPhase('paused');
    phaseRef.current = 'paused';
    setTimerRunning(false);
    setFrozenTime(totalElapsed);
  }, []);

  const resumeSession = useCallback(() => {
    setPhase('active');
    phaseRef.current = 'active';
    sessionRef.current.startTimer();
    resumeFromRef.current = frozenTime ?? 0;
    setResumeFrom(frozenTime);
    setTimerRunning(true);
    setFrozenTime(null);
  }, [frozenTime]);

  const clearFeedbackAndAdvance = useCallback(() => {
    if (phaseRef.current !== 'active') return;

    setHighlightWedge(undefined);
    setHighlightColor(undefined);
    setWrongWedge(undefined);
    setWedgeOutlineOnly(false);
    setWedgeFillColor(undefined);
    setArrowFill('filled-green');
    setRadialFlash(undefined);
    setShowHeading(false);

    const engine = engineRef.current;
    if (engine.isComplete()) {
      setPhase('complete');
      phaseRef.current = 'complete';
      return;
    }

    setTimerRunning(false);
    setFrozenTime(0);

    setTimeout(() => {
      if (phaseRef.current !== 'active') return;
      const next = sessionRef.current.getNextHeading();
      setHeading(next);
      setRepKey((k) => k + 1);
      setDisabled(false);
      setShowHeading(true);
      sessionRef.current.startTimer();
      resumeFromRef.current = 0;
      setTimerRunning(true);
      setFrozenTime(null);
      setResumeFrom(null);
    }, TIMING.INTER_REP_DELAY);
  }, []);

  const handleTimeout = useCallback(() => {
    if (disabled || phase !== 'active') return;
    setDisabled(true);
    setTimerRunning(false);
    setFrozenTime(TIMING.LEVEL1_LIMIT);

    const { result, engineResult } = sessionRef.current.submitResponseFocusDeck(-1, TIMING.LEVEL1_LIMIT);
    const correctWedge = HEADING_PACKETS[heading]?.wedgeId;
    setHighlightWedge(correctWedge);
    setHighlightColor('green');
    setWedgeOutlineOnly(true);
    setWedgeFillColor(undefined);
    setArrowFill('filled-green');
    setRadialFlash(heading);
    updateStats();

    setTimeout(() => {
      clearFeedbackAndAdvance();
    }, FEEDBACK_HOLD_MS);
  }, [disabled, heading, phase, updateStats, clearFeedbackAndAdvance]);

  const handleWedgeTap = useCallback(
    (wedgeId: number) => {
      if (disabled || phase !== 'active') return;
      setDisabled(true);

      const sinceLast = sessionRef.current.getTimeElapsed();
      const totalElapsed = sinceLast + resumeFromRef.current;
      setTimerRunning(false);
      setFrozenTime(totalElapsed);

      const { result, engineResult } = sessionRef.current.submitResponseFocusDeck(wedgeId, totalElapsed);
      const correctWedge = HEADING_PACKETS[heading]?.wedgeId;

      setHighlightWedge(correctWedge);
      setHighlightColor('green');
      setArrowFill('filled-green');

      if (engineResult.feedbackColor === 'red') {
        if (wedgeId !== correctWedge) setWrongWedge(wedgeId);
        setWedgeOutlineOnly(true);
        setWedgeFillColor(undefined);
      } else if (engineResult.feedbackColor === 'amber') {
        setWedgeOutlineOnly(false);
        setWedgeFillColor('amber');
      } else {
        setWedgeOutlineOnly(false);
        setWedgeFillColor('green');
      }
      setRadialFlash(heading);
      updateStats();

      setTimeout(() => {
        clearFeedbackAndAdvance();
      }, FEEDBACK_HOLD_MS);
    },
    [disabled, heading, phase, updateStats, clearFeedbackAndAdvance],
  );

  const handleFeedbackComplete = useCallback(() => {
    setFeedback(null);
    clearFeedbackAndAdvance();
  }, [clearFeedbackAndAdvance]);

  const restartSession = useCallback(() => {
    engineRef.current = new FocusDeckEngine(orderedHeadings);
    sessionRef.current = new SessionManager(engineRef.current);
    setPhase('countdown');
    phaseRef.current = 'countdown';
    setDisabled(false);
    setFeedback(null);
    setHighlightWedge(undefined);
    setHighlightColor(undefined);
    setWrongWedge(undefined);
    setWedgeOutlineOnly(false);
    setWedgeFillColor(undefined);
    setRadialFlash(undefined);
    setShowHeading(false);
    setTimerRunning(false);
    setFrozenTime(null);
    setMasteredCount(0);
    setTotalReps(0);
    setGridKey((k) => k + 1);

    setTimeout(() => {
      if (phaseRef.current !== 'countdown') return;
      const first = sessionRef.current.getNextHeading();
      setHeading(first);
      setShowHeading(true);
      setPhase('active');
      phaseRef.current = 'active';
      sessionRef.current.startTimer();
      resumeFromRef.current = 0;
      setTimerRunning(true);
      setFrozenTime(null);
      setResumeFrom(null);
    }, 1000);
  }, [orderedHeadings]);

  if (phase === 'complete') {
    const engine = engineRef.current;
    const allComplete = engine.isComplete();
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          {allComplete ? 'All Mastered!' : 'Session Ended'}
        </Text>
        <Text style={styles.statsLine}>
          Mastered: {engine.getMasteredCount()}/{orderedHeadings.length}
        </Text>
        <Text style={styles.statsDetail}>{totalReps} reps this session</Text>

        <Pressable style={styles.primaryBtn} onPress={restartSession}>
          <Text style={styles.primaryBtnText}>Try Again</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('FocusSelection')}>
          <Text style={styles.secondaryBtnText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  const isCountdown = phase === 'countdown';
  const isPaused = phase === 'paused';

  return (
    <View style={styles.container}>
      <View style={styles.headingArea}>
        {isCountdown ? (
          <Text style={styles.getReady}>Get Ready...</Text>
        ) : showHeading ? (
          <HeadingDisplay heading={heading} />
        ) : (
          <View style={styles.headingPlaceholder} />
        )}
      </View>

      <View style={styles.gridPositioner}>
        <ProgressGrid key={gridKey} engine={engineRef.current} selectedSet={selectedSet} />
      </View>

      <View style={styles.compassRow}>
        <View style={styles.compassWrap}>
          <CompassRose
            onWedgeTap={isCountdown ? () => {} : handleWedgeTap}
            highlightedWedge={highlightWedge}
            highlightColor={highlightColor}
            highlightOutlineOnly={wedgeOutlineOnly}
            highlightFillColor={wedgeFillColor}
            secondHighlight={wrongWedge != null ? { wedgeId: wrongWedge, color: 'red' } : undefined}
            disabled={disabled || isCountdown || isPaused}
            radialFlash={radialFlash ? { heading: radialFlash } : undefined}
            arrowStyle={arrowFill}
          />
          <View style={styles.compassCenter} pointerEvents="none">
            <CountdownTimer
              running={timerRunning}
              onTimeout={handleTimeout}
              frozenTime={frozenTime}
              duration={TIMING.LEVEL1_LIMIT}
              resumeFrom={resumeFrom}
            />
          </View>
        </View>
      </View>

      <View style={styles.controlRow}>
        {isPaused ? (
          <Pressable style={styles.controlBtn} onPress={resumeSession}>
            <Text style={[styles.controlBtnText, { color: '#00e676' }]}>Resume</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.controlBtn} onPress={pauseSession}>
            <Text style={styles.controlBtnText}>Pause</Text>
          </Pressable>
        )}
        <Pressable style={[styles.controlBtn, { borderColor: '#ff5555' }]} onPress={stopSession}>
          <Text style={[styles.controlBtnText, { color: '#ff5555' }]}>Stop</Text>
        </Pressable>
      </View>

      {isPaused && (
        <View style={styles.pausedBadge} pointerEvents="none">
          <Text style={styles.pausedText}>PAUSED</Text>
        </View>
      )}

      <FeedbackOverlay
        state={feedback?.state ?? null}
        correctAnswer={feedback?.correctAnswer}
        message={feedback?.message}
        onAnimationComplete={handleFeedbackComplete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23', alignItems: 'center', paddingTop: 20 },
  title: { fontSize: 22, color: '#00d4ff', fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  gridContainer: { gap: 1 },
  gridRow: { flexDirection: 'row', gap: 1 },
  gridCell: { width: 28, height: 20, borderWidth: 1, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  gridCellText: { fontSize: 8, fontWeight: '700', fontVariant: ['tabular-nums'] },
  gridPositioner: { position: 'absolute', left: 12, top: 60, zIndex: 10 },
  headingArea: { height: 136, width: '100%', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  headingPlaceholder: { height: 136 },
  getReady: { fontSize: 24, color: '#ffab00', fontWeight: '700' },
  compassRow: { position: 'relative', alignSelf: 'center' },
  compassWrap: { position: 'relative' },
  compassCenter: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -26 }, { translateY: -26 }], zIndex: 50 },
  controlRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 32 },
  controlBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#3a4a5a' },
  controlBtnText: { color: '#aabbcc', fontSize: 13, fontWeight: '600' },
  pausedBadge: { position: 'absolute', top: '45%', alignSelf: 'center', backgroundColor: 'rgba(15, 15, 35, 0.85)', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, zIndex: 90 },
  pausedText: { fontSize: 24, fontWeight: '700', color: '#ffab00', letterSpacing: 4 },
  primaryBtn: { marginTop: 24, backgroundColor: '#00d4ff', paddingHorizontal: 36, paddingVertical: 12, borderRadius: 8 },
  primaryBtnText: { fontSize: 18, fontWeight: '700', color: '#0f0f23' },
  secondaryBtn: { marginTop: 12, borderWidth: 1, borderColor: '#3a4a5a', paddingHorizontal: 28, paddingVertical: 10, borderRadius: 8 },
  secondaryBtnText: { color: '#aabbcc', fontSize: 15, fontWeight: '600' },
  statsLine: { fontSize: 16, color: '#aabbcc', marginTop: 8 },
  statsDetail: { fontSize: 13, color: '#667788', marginTop: 4 },
});
