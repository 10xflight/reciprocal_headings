import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import CompassRose from '../features/compass/CompassRose';
import HeadingDisplay from '../features/stimulus/HeadingDisplay';
import FeedbackOverlay from '../ui/feedback/FeedbackOverlay';
import CountdownTimer from '../ui/CountdownTimer';
import { DeckEngine, MASTER_SEQUENCE, GRID_PAIRS } from '../core/algorithms/trainingEngine';
import { SessionManager } from '../state/sessionManager';
import { useStore } from '../state/store';
import { FeedbackState, TIMING, CompassDirection } from '../core/types';
import { HEADING_PACKETS } from '../core/data/headingPackets';

type SessionPhase = 'dashboard' | 'countdown' | 'active' | 'paused';

const FEEDBACK_HOLD_MS = 1200;

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

export default function LearnModeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const saveDeckProgress = useStore((s) => s.saveDeckProgress);
  const savedProgress = useStore((s) => s.deckProgress);
  const storedTotalReps = useStore((s) => s.deckProgress.totalReps || 0);

  const engineRef = useRef<DeckEngine>(new DeckEngine());
  const sessionRef = useRef<SessionManager>(new SessionManager(engineRef.current));
  const [phase, setPhase] = useState<SessionPhase>('dashboard');
  const phaseRef = useRef<SessionPhase>('dashboard');
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
  const [deckSize, setDeckSize] = useState(1);
  const [unlockedCount, setUnlockedCount] = useState(1);
  const [totalReps, setTotalReps] = useState(0);
  const [gridKey, setGridKey] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    if (heading && phase === 'active') {
      setShowHeading(true);
    }
  }, [repKey]);

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
    setFeedback(null);
    setHighlightWedge(undefined);
    setHighlightColor(undefined);
    setWrongWedge(undefined);
    setTimerRunning(false);
    setFrozenTime(null);
    setMasteredCount(0);
    setDeckSize(1);
    setUnlockedCount(1);
    setTotalReps(0);
    setGridKey(0);
  }, [saveDeckProgress]);

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
    setMasteredCount(engineRef.current.getMasteredCount());
    setDeckSize(engineRef.current.getDeckSize());
    setUnlockedCount(engineRef.current.getUnlockedCount());
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
  }, [savedProgress]);

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

  const stopSession = useCallback(() => {
    setPhase('dashboard');
    phaseRef.current = 'dashboard';
    setFeedback(null);
    setHighlightWedge(undefined);
    setHighlightColor(undefined);
    setWrongWedge(undefined);
    setDisabled(false);
    setTimerRunning(false);
    setFrozenTime(null);
    saveProgress(engineRef.current);
  }, [saveProgress]);

  // Intercept back: active → dashboard, dashboard → pop
  usePreventRemove(phase !== 'dashboard', () => {
    stopSession();
  });

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
      saveProgress(engine);
      setPhase('dashboard');
      phaseRef.current = 'dashboard';
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
  }, [saveProgress]);

  const handleTimeout = useCallback(() => {
    if (disabled || phase !== 'active') return;
    setDisabled(true);
    setTimerRunning(false);
    setFrozenTime(TIMING.LEVEL1_LIMIT);

    const { result, engineResult } = sessionRef.current.submitResponseDeck(-1, TIMING.LEVEL1_LIMIT);
    const correctWedge = HEADING_PACKETS[heading]?.wedgeId;
    setHighlightWedge(correctWedge);
    setHighlightColor('green');
    setWedgeOutlineOnly(true);
    setWedgeFillColor(undefined);
    setArrowFill('filled-green');
    setRadialFlash(heading);
    updateStats();

    if (engineResult.newHeadingUnlocked) {
      saveProgress(engineRef.current);
    }

    setTimeout(() => {
      clearFeedbackAndAdvance();
    }, FEEDBACK_HOLD_MS);
  }, [disabled, heading, phase, updateStats, clearFeedbackAndAdvance, saveProgress]);

  const handleWedgeTap = useCallback(
    (wedgeId: number) => {
      if (disabled || phase !== 'active') return;
      setDisabled(true);

      const sinceLast = sessionRef.current.getTimeElapsed();
      const totalElapsed = sinceLast + resumeFromRef.current;
      setTimerRunning(false);
      setFrozenTime(totalElapsed);

      const { result, engineResult } = sessionRef.current.submitResponseDeck(wedgeId, totalElapsed);
      const correctWedge = HEADING_PACKETS[heading]?.wedgeId;

      setHighlightWedge(correctWedge);
      setHighlightColor('green');
      setArrowFill('filled-green');

      if (engineResult.feedbackColor === 'red') {
        if (wedgeId !== correctWedge) {
          setWrongWedge(wedgeId);
        }
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

      if (engineResult.newHeadingUnlocked) {
        saveProgress(engineRef.current);
      }

      setTimeout(() => {
        clearFeedbackAndAdvance();
      }, FEEDBACK_HOLD_MS);
    },
    [disabled, heading, phase, updateStats, clearFeedbackAndAdvance, saveProgress],
  );

  const handleFeedbackComplete = useCallback(() => {
    setFeedback(null);
    clearFeedbackAndAdvance();
  }, [clearFeedbackAndAdvance]);

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
      <View style={styles.container}>
        <Text style={styles.title}>Learn Mode</Text>
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

        <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('PracticeHome')}>
          <Text style={styles.secondaryBtnText}>Back</Text>
        </Pressable>

        <Pressable style={styles.resetBtn} onPress={() => setShowResetConfirm(true)}>
          <Text style={styles.resetBtnText}>Reset</Text>
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
        ) : (
          <>
            {showHeading ? (
              <HeadingDisplay heading={heading} />
            ) : (
              <View style={styles.headingPlaceholder} />
            )}
          </>
        )}
      </View>

      <View style={styles.gridPositioner}>
        <ProgressGrid key={gridKey} engine={engineRef.current} />
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
  progressCol: { alignItems: 'center', marginBottom: 4 },
  progressText: { fontSize: 13, color: '#00d4ff', fontWeight: '600', marginBottom: 4 },
  progressSubText: { fontSize: 11, color: '#667788', marginTop: 3 },
  progressBarBg: { width: 120, height: 6, backgroundColor: '#1e2a3a', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: 6, backgroundColor: '#00d4ff', borderRadius: 3 },
  headingArea: { height: 136, width: '100%', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' },
  compassRow: { position: 'relative', alignSelf: 'center' },
  gridPositioner: { position: 'absolute', left: 12, top: 60, zIndex: 10 },
  compassWrap: { position: 'relative' },
  compassCenter: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -26 }, { translateY: -26 }], zIndex: 50 },
  headingPlaceholder: { height: 136 },
  getReady: { fontSize: 24, color: '#ffab00', fontWeight: '700' },
  gridContainer: { gap: 1 },
  gridRow: { flexDirection: 'row', gap: 1 },
  gridCell: { width: 28, height: 20, borderWidth: 1, borderRadius: 2, justifyContent: 'center', alignItems: 'center' },
  gridCellText: { fontSize: 8, fontWeight: '700', fontVariant: ['tabular-nums'] },
  confirmOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  confirmCard: { backgroundColor: '#1a1a2e', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 24, alignItems: 'center', borderWidth: 1, borderColor: '#3a4a5a' },
  confirmTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff', marginBottom: 10 },
  confirmMessage: { fontSize: 14, color: '#aabbcc', textAlign: 'center', marginBottom: 24 },
  confirmBtnRow: { flexDirection: 'row', gap: 16 },
  confirmBtnNo: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#3a4a5a' },
  confirmBtnNoText: { fontSize: 15, fontWeight: '600', color: '#aabbcc' },
  confirmBtnYes: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, backgroundColor: '#ff5555' },
  confirmBtnYesText: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  resetBtn: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#ff5555', borderRadius: 6, zIndex: 20 },
  resetBtnText: { color: '#ff5555', fontSize: 13, fontWeight: '600' },
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
  secondaryBtn: { marginTop: 12, borderWidth: 1, borderColor: '#3a4a5a', paddingHorizontal: 28, paddingVertical: 10, borderRadius: 8 },
  secondaryBtnText: { color: '#aabbcc', fontSize: 15, fontWeight: '600' },
  statsLine: { fontSize: 16, color: '#aabbcc', marginTop: 8 },
  statsDetail: { fontSize: 13, color: '#667788', marginTop: 4 },
  endGrid: { marginTop: 20, marginBottom: 12, gap: 4 },
  endGridRow: { flexDirection: 'row', gap: 4 },
  endGridCell: { width: 48, height: 40, borderWidth: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  endGridHeading: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  endGridReps: { fontSize: 9, color: '#667788', fontVariant: ['tabular-nums'] },
});
