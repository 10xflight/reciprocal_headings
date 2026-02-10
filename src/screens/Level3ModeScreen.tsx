import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import WedgeFirstInput from '../ui/WedgeFirstInput';
import { DeckEngine, MASTER_SEQUENCE, GRID_PAIRS } from '../core/algorithms/trainingEngine';
import { SessionManager } from '../state/sessionManager';
import { useStore } from '../state/store';
import { TIMING } from '../core/types';
import { calculateReciprocal } from '../core/algorithms/reciprocal';
import { HEADING_PACKETS } from '../core/data/headingPackets';

type SessionPhase = 'dashboard' | 'countdown' | 'active' | 'paused';

const FEEDBACK_HOLD_MS = 1200;

// Level 3 timing: Level 1 thresholds + 1.0s
// Level 1: Green ≤1.0s, Amber 1.0-2.0s, Timeout >2.0s
// Level 3: Green ≤2.0s, Amber 2.0-3.0s, Timeout >3.0s
const GREEN_THRESHOLD = 2000;
const SLOW_THRESHOLD = 3000;
const LEVEL3_LIMIT = 3000;

function ProgressGrid({ engine }: { engine: DeckEngine }) {
  const mastered = engine.getMasteredHeadings();
  const deck = engine.getDeckSet();

  const renderCell = (h: string) => {
    const isMastered = mastered.has(h);
    const inDeck = deck.has(h);
    const cellColor = isMastered ? '#00e676' : inDeck ? '#ffab00' : '#334455';
    const textColor = isMastered ? '#00e676' : inDeck ? '#ffab00' : '#556677';

    return (
      <View
        key={h}
        style={[
          styles.gridCell,
          { borderColor: cellColor, backgroundColor: isMastered ? 'rgba(0,230,118,0.12)' : 'transparent' },
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

export default function Level3ModeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const saveDeckProgress = useStore((s) => s.saveLevel3DeckProgress);
  const savedProgress = useStore((s) => s.level3DeckProgress);
  const storedTotalReps = useStore((s) => s.level3DeckProgress.totalReps || 0);

  const engineRef = useRef<DeckEngine>(new DeckEngine());
  const sessionRef = useRef<SessionManager>(new SessionManager(engineRef.current));
  const [phase, setPhase] = useState<SessionPhase>('dashboard');
  const phaseRef = useRef<SessionPhase>('dashboard');
  const [heading, setHeading] = useState('');
  const [disabled, setDisabled] = useState(false);
  const [repKey, setRepKey] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [frozenTime, setFrozenTime] = useState<number | null>(null);
  const [resumeFrom, setResumeFrom] = useState<number | null>(null);
  const resumeFromRef = useRef<number>(0);

  // WedgeFirstInput feedback state
  const [feedbackState, setFeedbackState] = useState<{ correct: boolean; fast: boolean } | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const [masteredCount, setMasteredCount] = useState(0);
  const [deckSize, setDeckSize] = useState(1);
  const [unlockedCount, setUnlockedCount] = useState(1);
  const [totalReps, setTotalReps] = useState(0);
  const [gridKey, setGridKey] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Timer state for CircularInput
  const [timerProgress, setTimerProgress] = useState(0);
  const [timerColor, setTimerColor] = useState('#00e676');
  const timerStartRef = useRef<number>(0);
  const timerRafRef = useRef<number | null>(null);
  const handleTimeoutRef = useRef<() => void>(() => {});

  const saveProgress = useCallback((eng: DeckEngine, incrementReps = false) => {
    saveDeckProgress(
      eng.getUnlockedCount(),
      [...eng.getMasteredHeadings()],
      incrementReps,
      [...eng.getEverMasteredHeadings()],
    );
  }, [saveDeckProgress]);

  const updateStats = useCallback(() => {
    const engine = engineRef.current;
    setMasteredCount(engine.getMasteredCount());
    setDeckSize(engine.getDeckSize());
    setUnlockedCount(engine.getUnlockedCount());
    setTotalReps((r) => r + 1);
    setGridKey((k) => k + 1);
    saveProgress(engine, true);
  }, [saveProgress]);

  const resetSession = useCallback(() => {
    saveDeckProgress(1, [], false, []);
    engineRef.current = new DeckEngine();
    sessionRef.current = new SessionManager(engineRef.current);
    setPhase('dashboard');
    phaseRef.current = 'dashboard';
    setDisabled(false);
    setTimerRunning(false);
    setFrozenTime(null);
    setMasteredCount(0);
    setDeckSize(1);
    setUnlockedCount(1);
    setTotalReps(0);
    setGridKey(0);
  }, [saveDeckProgress]);

  // Timer tick function
  const startTimer = useCallback(() => {
    timerStartRef.current = Date.now() - (resumeFromRef.current || 0);
    // Set initial progress based on resumed time (avoids flash on resume)
    const initialElapsed = resumeFromRef.current || 0;
    const initialProgress = Math.min(initialElapsed / LEVEL3_LIMIT, 1);
    setTimerProgress(initialProgress);

    const tick = () => {
      const elapsed = Date.now() - timerStartRef.current;
      const progress = Math.min(elapsed / LEVEL3_LIMIT, 1);
      setTimerProgress(progress);

      // Update color based on elapsed time
      if (elapsed <= GREEN_THRESHOLD) {
        setTimerColor('#00e676');
      } else if (elapsed <= SLOW_THRESHOLD) {
        setTimerColor('#ffab00');
      } else {
        setTimerColor('#ff5555');
      }

      if (elapsed < LEVEL3_LIMIT) {
        timerRafRef.current = requestAnimationFrame(tick);
      } else {
        // Timeout - use ref to avoid stale closure
        handleTimeoutRef.current();
      }
    };

    timerRafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRafRef.current) {
      cancelAnimationFrame(timerRafRef.current);
      timerRafRef.current = null;
    }
  }, []);

  const startSession = useCallback(() => {
    const saved = savedProgress.unlockedCount;
    const masteredHeadings = savedProgress.masteredHeadings || [];
    const everMasteredHeadings = savedProgress.everMasteredHeadings || masteredHeadings;
    if (saved > 1 || masteredHeadings.length > 0) {
      engineRef.current = DeckEngine.restore(saved, masteredHeadings, everMasteredHeadings);
    } else {
      engineRef.current = new DeckEngine();
    }
    sessionRef.current = new SessionManager(engineRef.current);
    setPhase('countdown');
    phaseRef.current = 'countdown';
    setDisabled(false);
    setFeedbackState(null);
    setShowFeedback(false);
    setTimerRunning(false);
    setFrozenTime(null);
    setMasteredCount(engineRef.current.getMasteredCount());
    setDeckSize(engineRef.current.getDeckSize());
    setUnlockedCount(engineRef.current.getUnlockedCount());
    setTotalReps(0);
    setGridKey((k) => k + 1);

    setTimeout(() => {
      if (phaseRef.current !== 'countdown') return;
      const first = sessionRef.current.getNextHeading();
      setHeading(first);
      setPhase('active');
      phaseRef.current = 'active';
      sessionRef.current.startTimer();
      resumeFromRef.current = 0;
      setTimerRunning(true);
      startTimer();
    }, 1000);
  }, [savedProgress, startTimer]);

  const pauseSession = useCallback(() => {
    const sinceLast = sessionRef.current.getTimeElapsed();
    const totalElapsed = sinceLast + resumeFromRef.current;
    setPhase('paused');
    phaseRef.current = 'paused';
    setTimerRunning(false);
    stopTimer();
    setFrozenTime(totalElapsed);
  }, [stopTimer]);

  const resumeSession = useCallback(() => {
    setPhase('active');
    phaseRef.current = 'active';
    setDisabled(false); // Ensure input is enabled
    sessionRef.current.startTimer();
    resumeFromRef.current = frozenTime ?? 0;
    setResumeFrom(frozenTime);
    setTimerRunning(true);
    setFrozenTime(null);
    startTimer();
  }, [frozenTime, startTimer]);

  const stopSession = useCallback(() => {
    setPhase('dashboard');
    phaseRef.current = 'dashboard';
    setDisabled(false);
    setTimerRunning(false);
    stopTimer();
    setFrozenTime(null);
    saveProgress(engineRef.current);
  }, [saveProgress, stopTimer]);

  usePreventRemove(phase !== 'dashboard', () => {
    stopSession();
  });

  const clearFeedbackAndAdvance = useCallback(() => {
    if (phaseRef.current !== 'active') return;

    setShowFeedback(false);
    setFeedbackState(null);

    const engine = engineRef.current;
    if (engine.isComplete()) {
      saveProgress(engine);
      setPhase('dashboard');
      phaseRef.current = 'dashboard';
      return;
    }

    setTimeout(() => {
      if (phaseRef.current !== 'active') return;
      const next = sessionRef.current.getNextHeading();
      setHeading(next);
      setRepKey((k) => k + 1);
      setDisabled(false);
      sessionRef.current.startTimer();
      resumeFromRef.current = 0;
      setTimerRunning(true);
      startTimer();
    }, TIMING.INTER_REP_DELAY);
  }, [saveProgress, startTimer]);

  const handleAnswer = useCallback((selectedHeading: string, wedgeId: number) => {
    if (disabled || phase !== 'active') return;
    setDisabled(true);
    stopTimer();
    setTimerRunning(false);

    const elapsed = Date.now() - timerStartRef.current;

    // Check if correct: selected heading must match the RECIPROCAL of the stimulus
    const reciprocal = calculateReciprocal(heading);
    const isCorrect = selectedHeading === reciprocal;
    const isFast = elapsed < GREEN_THRESHOLD;

    // Calculate engine time based on grading
    let engineTime: number;
    if (isCorrect && isFast) {
      engineTime = 500; // Green for engine
    } else if (isCorrect) {
      engineTime = 1500; // Amber for engine
    } else {
      engineTime = 3000; // Red for engine
    }

    // Record to engine
    const engine = engineRef.current;
    const engineResult = engine.recordResult(heading, engineTime, isCorrect);
    updateStats();

    if (engineResult.newHeadingUnlocked) {
      saveProgress(engineRef.current);
    }

    setFeedbackState({ correct: isCorrect, fast: isFast });
    setShowFeedback(true);

    // Advance after feedback delay
    setTimeout(() => {
      clearFeedbackAndAdvance();
    }, FEEDBACK_HOLD_MS);
  }, [disabled, phase, heading, stopTimer, updateStats, clearFeedbackAndAdvance, saveProgress]);

  const handleTimeout = useCallback(() => {
    if (disabled || phaseRef.current !== 'active') return;
    setDisabled(true);
    stopTimer();
    setTimerRunning(false);

    // Record timeout as wrong
    const engine = engineRef.current;
    engine.recordResult(heading, 3000, false);
    updateStats();

    setFeedbackState({ correct: false, fast: false });
    setShowFeedback(true);

    setTimeout(() => {
      clearFeedbackAndAdvance();
    }, FEEDBACK_HOLD_MS);
  }, [disabled, heading, stopTimer, updateStats, clearFeedbackAndAdvance]);

  // Keep the ref updated to avoid stale closure in timer
  useEffect(() => {
    handleTimeoutRef.current = handleTimeout;
  }, [handleTimeout]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRafRef.current) {
        cancelAnimationFrame(timerRafRef.current);
      }
    };
  }, []);

  if (phase === 'dashboard') {
    const saved = savedProgress.unlockedCount;
    const masteredHeadings = savedProgress.masteredHeadings || [];
    const everMasteredHeadings = savedProgress.everMasteredHeadings || masteredHeadings;
    const dashEngine = (saved > 1 || masteredHeadings.length > 0)
      ? DeckEngine.restore(saved, masteredHeadings, everMasteredHeadings)
      : new DeckEngine();
    const dashMastered = dashEngine.getMasteredHeadings();
    const dashDeck = dashEngine.getDeckSet();
    const dashReport = dashEngine.getHeadingReport();
    const allComplete = dashEngine.isComplete();
    const hasPriorSession = totalReps > 0;

    const reportMap: Record<string, { reps: number }> = {};
    for (const item of dashReport) {
      reportMap[item.heading] = { reps: item.reps };
    }

    const gridRows: string[][] = [];
    for (let i = 0; i < MASTER_SEQUENCE.length; i += 6) {
      gridRows.push(MASTER_SEQUENCE.slice(i, i + 6));
    }

    const startLabel = allComplete ? 'Train Again' : hasPriorSession ? 'Resume' : 'Start Training';

    return (
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        <Pressable style={styles.resetBtn} onPress={() => setShowResetConfirm(true)}>
          <Text style={styles.resetBtnText}>Reset</Text>
        </Pressable>

        <Text style={styles.title}>Level 3 Learn</Text>
        <Text style={styles.subtitle}>Tap/Swipe: Reciprocal + Direction</Text>
        <Text style={styles.statsLine}>
          Mastered: {dashEngine.getMasteredCount()}/36
        </Text>
        <Text style={styles.statsDetail}>
          {storedTotalReps} reps since last reset
        </Text>
        {hasPriorSession && (
          <Text style={styles.statsDetail}>
            {totalReps} reps this session
          </Text>
        )}

        <View style={styles.endGrid}>
          {gridRows.map((row, ri) => (
            <View key={ri} style={styles.endGridRow}>
              {row.map((h, ci) => {
                const isMastered = dashMastered.has(h);
                const inDeck = dashDeck.has(h);
                const color = isMastered ? '#00e676' : inDeck ? '#ffab00' : '#556677';
                const reps = reportMap[h]?.reps || 0;
                return (
                  <View key={h} style={[styles.endGridCell, { borderColor: color, backgroundColor: isMastered ? 'rgba(0,230,118,0.12)' : 'transparent' }, (ci === 2 || ci === 4) && { marginLeft: 16 }]}>
                    <Text style={[styles.endGridHeading, { color }]}>{h}</Text>
                    <Text style={styles.endGridReps}>{reps > 0 ? reps : '—'}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <Pressable style={styles.primaryBtn} onPress={startSession}>
          <Text style={styles.primaryBtnText}>{startLabel}</Text>
        </Pressable>

        <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('Practice3Home')}>
          <Text style={styles.secondaryBtnText}>Back</Text>
        </Pressable>

        {showResetConfirm && (
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Reset Progress?</Text>
              <Text style={styles.confirmMessage}>Are you sure you want to reset all your progress?</Text>
              <View style={styles.confirmBtnRow}>
                <Pressable style={styles.confirmBtnNo} onPress={() => setShowResetConfirm(false)}>
                  <Text style={styles.confirmBtnNoText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.confirmBtnYes} onPress={() => { setShowResetConfirm(false); resetSession(); }}>
                  <Text style={styles.confirmBtnYesText}>Reset</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    );
  }

  const isCountdown = phase === 'countdown';
  const isPaused = phase === 'paused';

  return (
    <View style={styles.activeContainer}>
      <View style={styles.gridPositioner}>
        <ProgressGrid key={gridKey} engine={engineRef.current} />
      </View>

      <View style={styles.activeInner}>
        <WedgeFirstInput
          heading={heading}
          onAnswer={handleAnswer}
          disabled={disabled || isPaused || isCountdown}
          timerProgress={isCountdown ? 0 : timerProgress}
          timerColor={isCountdown ? '#3a4a5a' : timerColor}
          feedbackState={feedbackState}
          showFeedback={showFeedback}
          centerText={isCountdown ? 'Ready' : undefined}
          correctAnswer={heading ? `${calculateReciprocal(heading)} ${HEADING_PACKETS[calculateReciprocal(heading)]?.direction || ''}` : ''}
        />

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

      {isPaused && (
        <View style={styles.pausedBadge} pointerEvents="none">
          <Text style={styles.pausedText}>PAUSED</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flex: 1, backgroundColor: '#0f0f23' },
  scrollContent: { alignItems: 'center', paddingTop: 20, paddingBottom: 40 },
  activeContainer: { flex: 1, backgroundColor: '#0f0f23' },
  activeInner: { flex: 1, alignItems: 'center', paddingTop: 20 },
  title: { fontSize: 22, color: '#00d4ff', fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  subtitle: { color: '#88ccff', fontSize: 13, marginBottom: 10 },
  statsLine: { color: '#aabbcc', fontSize: 14, marginBottom: 4 },
  statsDetail: { color: '#667788', fontSize: 12, marginBottom: 2 },

  gridContainer: { gap: 4 },
  gridRow: { flexDirection: 'row', gap: 4 },
  gridCell: { width: 32, height: 32, borderRadius: 4, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  gridCellText: { fontSize: 12, fontWeight: '700' },
  gridPositioner: { position: 'absolute', top: 12, left: 12, zIndex: 10 },

  endGrid: { marginVertical: 16 },
  endGridRow: { flexDirection: 'row', marginBottom: 4 },
  endGridCell: { width: 44, height: 44, borderRadius: 6, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginHorizontal: 2 },
  endGridHeading: { fontSize: 14, fontWeight: '700' },
  endGridReps: { fontSize: 9, color: '#667788', marginTop: 1 },

  primaryBtn: { backgroundColor: '#00d4ff', borderRadius: 8, paddingVertical: 14, paddingHorizontal: 48, marginTop: 8 },
  primaryBtnText: { color: '#0f0f23', fontWeight: '700', fontSize: 16 },
  secondaryBtn: { borderColor: '#3a4a5a', borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 32, marginTop: 12 },
  secondaryBtnText: { color: '#88ccff', fontWeight: '600', fontSize: 14 },
  resetBtn: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#ff5555', borderRadius: 6, zIndex: 20 },
  resetBtnText: { color: '#ff5555', fontSize: 13, fontWeight: '600' },

  confirmOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  confirmCard: { backgroundColor: '#1a2636', borderRadius: 12, padding: 24, width: 280 },
  confirmTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  confirmMessage: { color: '#aabbcc', fontSize: 14, marginBottom: 20 },
  confirmBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  confirmBtnNo: { paddingVertical: 8, paddingHorizontal: 16 },
  confirmBtnNoText: { color: '#88ccff', fontWeight: '600' },
  confirmBtnYes: { backgroundColor: '#ff5555', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 16 },
  confirmBtnYesText: { color: '#ffffff', fontWeight: '600' },

  controlRow: { flexDirection: 'row', gap: 16, marginTop: 24, zIndex: 20 },
  controlBtn: { borderColor: '#3a4a5a', borderWidth: 1.5, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 },
  controlBtnText: { color: '#88ccff', fontWeight: '600', fontSize: 14 },
  resumeText: { color: '#00e676' },
  stopCtrl: { borderColor: '#ff5555' },
  stopCtrlText: { color: '#ff5555' },

  pausedBadge: { position: 'absolute', top: '50%', left: 0, right: 0, alignItems: 'center' },
  pausedText: { fontSize: 32, fontWeight: '800', color: 'rgba(255,255,255,0.25)', letterSpacing: 4 },
});
