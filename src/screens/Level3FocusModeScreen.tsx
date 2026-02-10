import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, usePreventRemove, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import WedgeFirstInput from '../ui/WedgeFirstInput';
import { GRID_PAIRS } from '../core/algorithms/trainingEngine';
import { FocusDeckEngine } from '../core/algorithms/focusDeckEngine';
import { SessionManager } from '../state/sessionManager';
import { useStore } from '../state/store';
import { TIMING } from '../core/types';
import { HEADING_PACKETS } from '../core/data/headingPackets';
import { calculateReciprocal } from '../core/algorithms/reciprocal';

type SessionPhase = 'countdown' | 'active' | 'paused' | 'complete';

const FEEDBACK_HOLD_MS = 1200;

// Level 3 Focus Mode timing: Level 1 thresholds + 1.0s
// Level 1: Green ≤1.0s, Amber 1.0-2.0s, Timeout >2.0s
// Level 3 Focus: Green ≤2.0s, Amber 2.0-3.0s, Timeout >3.0s
const GREEN_THRESHOLD = 2000;
const SLOW_THRESHOLD = 3000;
const FOCUS_LIMIT = 3000;

function ProgressGrid({ engine, selectedSet }: { engine: FocusDeckEngine; selectedSet: Set<string> }) {
  const mastered = engine.getMasteredHeadings();

  const renderCell = (h: string) => {
    const isSelected = selectedSet.has(h);
    const isMastered = mastered.has(h);
    let cellColor: string;
    let bgColor = 'transparent';

    if (!isSelected) {
      cellColor = '#334455';
    } else if (isMastered) {
      cellColor = '#00e676';
      bgColor = 'rgba(0,230,118,0.12)';
    } else {
      cellColor = '#ffab00';
      bgColor = 'rgba(255,171,0,0.08)';
    }

    return (
      <View
        key={h}
        style={[
          styles.gridCell,
          { borderColor: cellColor, backgroundColor: bgColor },
        ]}
      >
        <Text style={[styles.gridCellText, { color: cellColor }]}>{h}</Text>
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

export default function Level3FocusModeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Level3Focus'>>();
  const { headings } = route.params;
  const selectedSet = new Set(headings);

  const batchUpdatePracticeData = useStore((s) => s.batchUpdateLevel3PracticeData);

  const engineRef = useRef<FocusDeckEngine>(new FocusDeckEngine(headings));
  const sessionRef = useRef<SessionManager>(new SessionManager(engineRef.current));
  const sessionDataRef = useRef<{ heading: string; time: number; isCorrect: boolean }[]>([]);

  const [phase, setPhase] = useState<SessionPhase>('countdown');
  const phaseRef = useRef<SessionPhase>('countdown');
  const [heading, setHeading] = useState('');
  const [disabled, setDisabled] = useState(false);
  const [repKey, setRepKey] = useState(0);
  const [showHeading, setShowHeading] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [frozenTime, setFrozenTime] = useState<number | null>(null);
  const [resumeFrom, setResumeFrom] = useState<number | null>(null);
  const resumeFromRef = useRef<number>(0);
  const timerStartRef = useRef<number>(0);

  // WedgeFirstInput feedback state
  const [feedbackState, setFeedbackState] = useState<{ correct: boolean; fast: boolean } | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Timer display state
  const [timerProgress, setTimerProgress] = useState(0);
  const [timerColor, setTimerColor] = useState('#00e676');
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [masteredCount, setMasteredCount] = useState(0);
  const [totalReps, setTotalReps] = useState(0);
  const [gridKey, setGridKey] = useState(0);

  // Timer tick function
  const startTimer = useCallback(() => {
    timerStartRef.current = Date.now() - (resumeFromRef.current || 0);
    const initialElapsed = resumeFromRef.current || 0;
    const initialProgress = Math.min(initialElapsed / FOCUS_LIMIT, 1);
    setTimerProgress(initialProgress);

    const tick = () => {
      if (phaseRef.current !== 'active') return;
      const elapsed = Date.now() - timerStartRef.current;
      const progress = Math.min(elapsed / FOCUS_LIMIT, 1);
      setTimerProgress(progress);

      // Update timer color
      if (elapsed < GREEN_THRESHOLD) {
        setTimerColor('#00e676');
      } else if (elapsed < SLOW_THRESHOLD) {
        setTimerColor('#ffab00');
      } else {
        setTimerColor('#ff1744');
      }

      // Check timeout
      if (elapsed >= FOCUS_LIMIT) {
        handleTimeoutRef.current?.();
      }
    };

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(tick, 50);
    tick();
  }, []);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

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
      startTimer();
    }, 1000);
    return () => clearTimeout(timer);
  }, [startTimer]);

  useEffect(() => {
    if (heading && phase === 'active') {
      setShowHeading(true);
    }
  }, [repKey]);

  const saveSessionData = useCallback(() => {
    if (sessionDataRef.current.length > 0) {
      const mastered = Array.from(engineRef.current.getMasteredHeadings());
      batchUpdatePracticeData(sessionDataRef.current, mastered);
      sessionDataRef.current = [];
    }
  }, [batchUpdatePracticeData]);

  const updateStats = useCallback(() => {
    const engine = engineRef.current;
    setMasteredCount(engine.getMasteredCount());
    setTotalReps((r) => r + 1);
    setGridKey((k) => k + 1);
  }, []);

  const stopSession = useCallback(() => {
    stopTimer();
    setPhase('complete');
    phaseRef.current = 'complete';
    setDisabled(false);
    setTimerRunning(false);
    setFrozenTime(null);
    setShowFeedback(false);
    setFeedbackState(null);
    saveSessionData();
  }, [stopTimer, saveSessionData]);

  usePreventRemove(phase !== 'complete', () => {
    stopSession();
  });

  const pauseSession = useCallback(() => {
    stopTimer();
    const elapsed = Date.now() - timerStartRef.current;
    setPhase('paused');
    phaseRef.current = 'paused';
    setTimerRunning(false);
    setFrozenTime(elapsed);
  }, [stopTimer]);

  const resumeSession = useCallback(() => {
    setPhase('active');
    phaseRef.current = 'active';
    setDisabled(false); // Re-enable input
    sessionRef.current.startTimer();
    const savedTime = frozenTime ?? 0;
    resumeFromRef.current = savedTime;
    setResumeFrom(savedTime);
    setTimerRunning(true);
    setFrozenTime(null);
    startTimer();
  }, [frozenTime, startTimer]);

  const clearFeedbackAndAdvance = useCallback(() => {
    if (phaseRef.current !== 'active') return;

    setShowFeedback(false);
    setFeedbackState(null);
    setShowHeading(false);

    const engine = engineRef.current;
    if (engine.isComplete()) {
      stopTimer();
      saveSessionData();
      setPhase('complete');
      phaseRef.current = 'complete';
      return;
    }

    stopTimer();
    setTimerRunning(false);
    setTimerProgress(0);
    setTimerColor('#00e676');

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
      startTimer();
    }, TIMING.INTER_REP_DELAY);
  }, [stopTimer, startTimer, saveSessionData]);

  // Ref to avoid stale closure in timer
  const handleTimeoutRef = useRef<(() => void) | null>(null);

  const handleTimeout = useCallback(() => {
    if (disabled || phase !== 'active') return;
    stopTimer();
    setDisabled(true);
    setTimerRunning(false);

    // Timeout = wrong answer
    const engine = engineRef.current;
    engine.recordResult(heading, 3000, false);
    sessionDataRef.current.push({ heading, time: FOCUS_LIMIT, isCorrect: false });

    setFeedbackState({ correct: false, fast: false });
    setShowFeedback(true);
    updateStats();

    setTimeout(() => {
      clearFeedbackAndAdvance();
    }, FEEDBACK_HOLD_MS);
  }, [disabled, heading, phase, updateStats, clearFeedbackAndAdvance, stopTimer]);

  // Keep handleTimeoutRef updated
  useEffect(() => {
    handleTimeoutRef.current = handleTimeout;
  }, [handleTimeout]);

  // Handle answer from WedgeFirstInput
  const handleAnswer = useCallback(
    (selectedHeading: string, wedgeId: number) => {
      if (disabled || phase !== 'active') return;
      stopTimer();
      setDisabled(true);

      const elapsed = Date.now() - timerStartRef.current;
      setTimerRunning(false);

      // Check if correct: selected heading must match the current heading
      // Check if selected heading matches the RECIPROCAL of the stimulus
      const reciprocal = calculateReciprocal(heading);
      const isCorrect = selectedHeading === reciprocal;
      const isFast = elapsed < GREEN_THRESHOLD;

      // Record result to engine
      const engine = engineRef.current;
      let engineTime: number;
      if (isCorrect && isFast) {
        engineTime = 500; // green
      } else if (isCorrect) {
        engineTime = 1500; // amber
      } else {
        engineTime = 3000; // red
      }
      engine.recordResult(heading, engineTime, isCorrect);

      // Track session data
      sessionDataRef.current.push({ heading, time: elapsed, isCorrect });

      setFeedbackState({ correct: isCorrect, fast: isFast });
      setShowFeedback(true);
      updateStats();

      setTimeout(() => {
        clearFeedbackAndAdvance();
      }, FEEDBACK_HOLD_MS);
    },
    [disabled, heading, phase, updateStats, clearFeedbackAndAdvance, stopTimer],
  );

  // Complete screen
  if (phase === 'complete') {
    const engine = engineRef.current;
    const allComplete = engine.isComplete();
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          {allComplete ? 'All Mastered!' : 'Session Ended'}
        </Text>
        <Text style={styles.statsLine}>
          Mastered: {engine.getMasteredCount()}/{headings.length}
        </Text>
        <Text style={styles.statsDetail}>{totalReps} reps this session</Text>

        <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate('Level3FocusSelection')}>
          <Text style={styles.primaryBtnText}>Done</Text>
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

      <View style={styles.compassWrapCentered}>
        <WedgeFirstInput
          heading={heading}
          onAnswer={handleAnswer}
          disabled={disabled || isCountdown || isPaused}
          timerProgress={timerProgress}
          timerColor={timerColor}
          feedbackState={feedbackState}
          showFeedback={showFeedback}
          centerText={isCountdown ? 'Ready' : undefined}
          correctAnswer={heading ? `${calculateReciprocal(heading)} ${HEADING_PACKETS[calculateReciprocal(heading)]?.direction || ''}` : ''}
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
  activeContainer: { flex: 1, backgroundColor: '#0f0f23', alignItems: 'center', paddingTop: 20 },
  title: { fontSize: 22, color: '#00d4ff', fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  gridContainer: { gap: 1 },
  gridRow: { flexDirection: 'row', gap: 1 },
  gridCell: { width: 28, height: 20, borderWidth: 1, borderRadius: 2, justifyContent: 'center', alignItems: 'center' },
  gridCellText: { fontSize: 8, fontWeight: '700', fontVariant: ['tabular-nums'] },
  gridPositioner: { position: 'absolute', left: 12, top: 12, zIndex: 10 },
  compassWrapCentered: { marginTop: 0 },
  controlRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 32 },
  controlBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#3a4a5a' },
  controlBtnText: { color: '#aabbcc', fontSize: 13, fontWeight: '600' },
  resumeText: { color: '#00e676' },
  stopCtrl: { borderColor: '#ff5555' },
  stopCtrlText: { color: '#ff5555' },
  pausedBadge: { position: 'absolute', top: '45%', alignSelf: 'center', backgroundColor: 'rgba(15, 15, 35, 0.85)', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, zIndex: 90 },
  pausedText: { fontSize: 24, fontWeight: '700', color: '#ffab00', letterSpacing: 4 },
  primaryBtn: { marginTop: 24, backgroundColor: '#00d4ff', paddingHorizontal: 36, paddingVertical: 12, borderRadius: 8 },
  primaryBtnText: { fontSize: 18, fontWeight: '700', color: '#0f0f23' },
  statsLine: { fontSize: 16, color: '#aabbcc', marginTop: 8 },
  statsDetail: { fontSize: 13, color: '#667788', marginTop: 4 },
});
