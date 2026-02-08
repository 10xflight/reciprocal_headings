import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, usePreventRemove, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import Numpad from '../features/numpad/Numpad';
import HeadingDisplay from '../features/stimulus/HeadingDisplay';
import CountdownTimer from '../ui/CountdownTimer';
import { MASTER_SEQUENCE, GRID_PAIRS } from '../core/algorithms/trainingEngine';
import { FocusDeckEngine } from '../core/algorithms/focusDeckEngine';
import { SessionManager } from '../state/sessionManager';
import { useStore } from '../state/store';
import { FeedbackState, TIMING } from '../core/types';
import { calculateReciprocal } from '../core/algorithms/reciprocal';

type SessionPhase = 'countdown' | 'active' | 'paused' | 'complete';

const FEEDBACK_HOLD_MS = 1200;

function ProgressGrid({ engine, selectedSet }: { engine: FocusDeckEngine; selectedSet: Set<string> }) {
  const mastered = engine.getMasteredHeadings();
  const deck = engine.getDeckSet();

  const renderCell = (h: string) => {
    const isSelected = selectedSet.has(h);
    const isMastered = mastered.has(h);
    const inDeck = deck.has(h);
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
      cellColor = '#aa66ff';
      textColor = '#aa66ff';
      bgColor = 'rgba(170,102,255,0.08)';
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

export default function Level2FocusModeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Level2Focus'>>();
  const { headings } = route.params;
  const practiceData = useStore((s) => s.level2PracticeData);

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
      return scoreB - scoreA;
    });
  }, [headings, practiceData]);

  const engineRef = useRef<FocusDeckEngine>(new FocusDeckEngine(orderedHeadings));
  const sessionRef = useRef<SessionManager>(new SessionManager(engineRef.current));
  const [phase, setPhase] = useState<SessionPhase>('countdown');
  const phaseRef = useRef<SessionPhase>('countdown');
  const [heading, setHeading] = useState('');
  const [input, setInput] = useState('');
  const [disabled, setDisabled] = useState(false);
  const [repKey, setRepKey] = useState(0);
  const [showHeading, setShowHeading] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [frozenTime, setFrozenTime] = useState<number | null>(null);
  const [resumeFrom, setResumeFrom] = useState<number | null>(null);
  const resumeFromRef = useRef<number>(0);
  const [feedbackColor, setFeedbackColor] = useState<FeedbackState | undefined>(undefined);
  const [showCorrect, setShowCorrect] = useState<string | undefined>(undefined);

  const [masteredCount, setMasteredCount] = useState(0);
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
    setTotalReps((r) => r + 1);
    setGridKey((k) => k + 1);
  }, []);

  const stopSession = useCallback(() => {
    setPhase('complete');
    phaseRef.current = 'complete';
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

    setFeedbackColor(undefined);
    setShowCorrect(undefined);
    setShowHeading(false);
    setInput('');

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

  const processAnswer = useCallback((userInput: string, timeMs: number) => {
    const expected = calculateReciprocal(heading);
    const isCorrect = userInput === expected;

    // Level 2 offset for grading
    const adjustedTime = Math.max(0, timeMs - TIMING.LEVEL2_OFFSET);
    const engine = engineRef.current;
    const engineResult = engine.recordResult(heading, adjustedTime, isCorrect);

    setFeedbackColor(engineResult.feedbackColor);
    updateStats();

    if (!isCorrect) {
      setShowCorrect(expected);
    }

    setTimeout(() => {
      setShowCorrect(undefined);
      clearFeedbackAndAdvance();
    }, FEEDBACK_HOLD_MS);
  }, [heading, updateStats, clearFeedbackAndAdvance]);

  const handleTimeout = useCallback(() => {
    if (disabled || phase !== 'active') return;
    setDisabled(true);
    setTimerRunning(false);
    setFrozenTime(TIMING.LEVEL2_LIMIT);

    const expected = calculateReciprocal(heading);
    const engine = engineRef.current;
    engine.recordResult(heading, TIMING.LEVEL1_LIMIT, false);

    setFeedbackColor('red');
    setShowCorrect(expected);
    updateStats();

    setTimeout(() => {
      setShowCorrect(undefined);
      clearFeedbackAndAdvance();
    }, FEEDBACK_HOLD_MS);
  }, [disabled, heading, phase, updateStats, clearFeedbackAndAdvance]);

  // Auto-submit when 2 digits entered
  useEffect(() => {
    if (input.length === 2 && !disabled && phase === 'active') {
      setDisabled(true);
      const sinceLast = sessionRef.current.getTimeElapsed();
      const totalElapsed = sinceLast + resumeFromRef.current;
      setTimerRunning(false);
      setFrozenTime(totalElapsed);
      processAnswer(input, totalElapsed);
    }
  }, [input, disabled, phase, processAnswer]);

  const handleDigit = useCallback(
    (digit: string) => {
      if (disabled || phase !== 'active') return;
      setInput((prev) => (prev.length < 2 ? prev + digit : prev));
    },
    [disabled, phase],
  );

  const handleClear = useCallback(() => {
    if (disabled || phase !== 'active') return;
    setInput('');
  }, [disabled, phase]);

  const handleBackspace = useCallback(() => {
    if (disabled || phase !== 'active') return;
    setInput((prev) => prev.slice(0, -1));
  }, [disabled, phase]);

  const restartSession = useCallback(() => {
    engineRef.current = new FocusDeckEngine(orderedHeadings);
    sessionRef.current = new SessionManager(engineRef.current);
    setPhase('countdown');
    phaseRef.current = 'countdown';
    setDisabled(false);
    setInput('');
    setFeedbackColor(undefined);
    setShowCorrect(undefined);
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
        <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('Level2FocusSelection')}>
          <Text style={styles.secondaryBtnText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  const isCountdown = phase === 'countdown';
  const isPaused = phase === 'paused';

  return (
    <View style={styles.activeContainer}>
      <View style={styles.gridPositioner}>
        <ProgressGrid key={gridKey} engine={engineRef.current} selectedSet={selectedSet} />
      </View>

      <ScrollView
        style={styles.activeScrollView}
        contentContainerStyle={styles.activeScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.activeInner}>
          <View style={styles.headingAreaCompact}>
            {isCountdown ? (
              <Text style={styles.getReady}>Get Ready...</Text>
            ) : (
              <>
                {showHeading ? (
                  <HeadingDisplay heading={heading} size="compact" />
                ) : (
                  <View style={styles.headingPlaceholderCompact} />
                )}
              </>
            )}
          </View>

          <View style={styles.numpadArea}>
            <View style={styles.timerRow}>
              <CountdownTimer
                running={timerRunning}
                onTimeout={handleTimeout}
                frozenTime={frozenTime}
                duration={TIMING.LEVEL2_LIMIT}
                resumeFrom={resumeFrom}
              />
            </View>
            <Numpad
              onDigit={handleDigit}
              onClear={handleClear}
              onBackspace={handleBackspace}
              disabled={disabled || isCountdown || isPaused}
              currentInput={input}
              showCorrect={showCorrect}
              feedbackState={feedbackColor}
            />
          </View>

          <View style={styles.controlRow}>
            {isPaused ? (
              <Pressable style={styles.controlBtn} onPress={resumeSession}>
                <Text style={[styles.controlBtnText, styles.resumeText]}>Resume</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.controlBtn} onPress={pauseSession}>
                <Text style={styles.controlBtnText}>Pause</Text>
              </Pressable>
            )}
            <Pressable style={[styles.controlBtn, styles.stopCtrl]} onPress={stopSession}>
              <Text style={[styles.controlBtnText, styles.stopCtrlText]}>Stop</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {isPaused && (
        <View style={styles.pausedBadge} pointerEvents="none">
          <Text style={styles.pausedText}>PAUSED</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23', alignItems: 'center', paddingTop: 20 },
  activeContainer: { flex: 1, backgroundColor: '#0f0f23' },
  activeScrollView: { flex: 1 },
  activeScrollContent: { flexGrow: 1, paddingBottom: 40 },
  activeInner: { flex: 1, alignItems: 'center', paddingTop: 12 },
  title: { fontSize: 22, color: '#aa66ff', fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  headingAreaCompact: { height: 100, width: '100%', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  headingPlaceholderCompact: { height: 100 },
  getReady: { fontSize: 24, color: '#ffab00', fontWeight: '700' },
  gridContainer: { gap: 1 },
  gridRow: { flexDirection: 'row', gap: 1 },
  gridCell: { width: 28, height: 20, borderWidth: 1, borderRadius: 2, justifyContent: 'center', alignItems: 'center' },
  gridCellText: { fontSize: 8, fontWeight: '700', fontVariant: ['tabular-nums'] },
  gridPositioner: { position: 'absolute', left: 12, top: 12, zIndex: 10 },
  numpadArea: { alignItems: 'center', marginTop: 4 },
  timerRow: { marginBottom: 8 },
  controlRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 20, marginBottom: 20 },
  controlBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#3a4a5a' },
  controlBtnText: { color: '#aabbcc', fontSize: 13, fontWeight: '600' },
  resumeText: { color: '#00e676' },
  stopCtrl: { borderColor: '#ff5555' },
  stopCtrlText: { color: '#ff5555' },
  pausedBadge: { position: 'absolute', top: '45%', alignSelf: 'center', backgroundColor: 'rgba(15, 15, 35, 0.85)', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, zIndex: 90 },
  pausedText: { fontSize: 24, fontWeight: '700', color: '#ffab00', letterSpacing: 4 },
  primaryBtn: { marginTop: 24, backgroundColor: '#aa66ff', paddingHorizontal: 36, paddingVertical: 12, borderRadius: 8 },
  primaryBtnText: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  secondaryBtn: { marginTop: 12, borderWidth: 1, borderColor: '#3a4a5a', paddingHorizontal: 28, paddingVertical: 10, borderRadius: 8 },
  secondaryBtnText: { color: '#aabbcc', fontSize: 15, fontWeight: '600' },
  statsLine: { fontSize: 16, color: '#aabbcc', marginTop: 8 },
  statsDetail: { fontSize: 13, color: '#667788', marginTop: 4 },
});
