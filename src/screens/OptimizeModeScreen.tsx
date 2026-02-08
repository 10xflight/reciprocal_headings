import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import CompassRose from '../features/compass/CompassRose';
import HeadingDisplay from '../features/stimulus/HeadingDisplay';
import FeedbackOverlay from '../ui/feedback/FeedbackOverlay';
import CountdownTimer from '../ui/CountdownTimer';
import { MASTER_SEQUENCE, GRID_PAIRS } from '../core/algorithms/trainingEngine';
import { FocusDeckEngine } from '../core/algorithms/focusDeckEngine';
import { SessionManager } from '../state/sessionManager';
import { useStore, HeadingPerformance, MasteryHeadingResult } from '../state/store';
import { FeedbackState, TIMING, CompassDirection } from '../core/types';
import { HEADING_PACKETS } from '../core/data/headingPackets';

type SessionPhase = 'dashboard' | 'countdown' | 'active' | 'paused' | 'complete';

const FEEDBACK_HOLD_MS = 1200;

/**
 * Build a weighted sequence: weakest → front, strongest → back.
 */
function buildWeightedSequence(
  practiceData: Record<string, HeadingPerformance>,
  masteryResults: Record<string, MasteryHeadingResult>,
): string[] {
  // Score each heading: higher = weaker
  const scored = MASTER_SEQUENCE.map((h) => {
    const pd = practiceData[h];
    const mr = masteryResults[h];
    let score = 5000; // default: no data = medium-weak
    if (pd) {
      score = pd.avgTime + pd.mistakes * 500;
    } else if (mr) {
      score = mr.status === 'red' ? 8000 : mr.status === 'amber' ? 5000 : 500;
    }
    return { heading: h, score };
  });

  // Sort weakest (highest score) first
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.heading);
}

function ProgressGrid({ engine, practiceData: pd }: { engine: FocusDeckEngine; practiceData: Record<string, HeadingPerformance> }) {
  const mastered = engine.getMasteredHeadings();

  const renderCell = (h: string) => {
    const isMastered = mastered.has(h);
    const perf = pd[h];
    // If mastered in session → green; otherwise use practice data color
    let cellColor: string;
    let bgColor = 'transparent';
    if (isMastered) {
      cellColor = '#00e676';
      bgColor = 'rgba(0,230,118,0.12)';
    } else if (perf) {
      cellColor = perf.status === 'green' ? '#00e676' : perf.status === 'amber' ? '#ffab00' : '#ff5555';
      if (perf.status === 'green') bgColor = 'rgba(0,230,118,0.12)';
      else if (perf.status === 'amber') bgColor = 'rgba(255,171,0,0.08)';
      else bgColor = 'rgba(255,85,85,0.08)';
    } else {
      cellColor = '#334455';
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

export default function OptimizeModeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const practiceData = useStore((s) => s.practiceData);
  const masteryResults = useStore((s) => s.masteryResults);
  const batchUpdatePracticeData = useStore((s) => s.batchUpdatePracticeData);
  const practiceDataUpdatedAt = useStore((s) => s.practiceDataUpdatedAt);
  const resetPracticeData = useStore((s) => s.resetPracticeData);

  const formatDate = (timestamp: number | null): string => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${mm}-${dd}-${yy}`;
  };

  const weightedSequence = useMemo(
    () => buildWeightedSequence(practiceData, masteryResults),
    [practiceData, masteryResults],
  );

  const engineRef = useRef<FocusDeckEngine>(FocusDeckEngine.restoreAllUnlocked(weightedSequence));
  const sessionRef = useRef<SessionManager>(new SessionManager(engineRef.current));
  const sessionDataRef = useRef<{ heading: string; time: number; isCorrect: boolean }[]>([]);

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
  const [totalReps, setTotalReps] = useState(0);
  const [gridKey, setGridKey] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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

  const startSession = useCallback(() => {
    engineRef.current = FocusDeckEngine.restoreAllUnlocked(weightedSequence);
    sessionRef.current = new SessionManager(engineRef.current);
    sessionDataRef.current = [];
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
  }, [weightedSequence]);

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
    saveSessionData();
  }, [saveSessionData]);

  usePreventRemove(phase !== 'dashboard' && phase !== 'complete', () => {
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
      saveSessionData();
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
  }, [saveSessionData]);

  const handleTimeout = useCallback(() => {
    if (disabled || phase !== 'active') return;
    setDisabled(true);
    setTimerRunning(false);
    setFrozenTime(TIMING.LEVEL1_LIMIT);

    const { result, engineResult } = sessionRef.current.submitResponseFocusDeck(-1, TIMING.LEVEL1_LIMIT);
    sessionDataRef.current.push({ heading, time: TIMING.LEVEL1_LIMIT, isCorrect: false });
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
      sessionDataRef.current.push({ heading, time: totalElapsed, isCorrect: result.isCorrect });
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

  // Dashboard
  if (phase === 'dashboard') {
    const gridRows: string[][] = [];
    for (let i = 0; i < MASTER_SEQUENCE.length; i += 6) {
      gridRows.push(MASTER_SEQUENCE.slice(i, i + 6));
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Optimize Mode</Text>
        <Text style={styles.subtitle}>
          Based on Practice Data{practiceDataUpdatedAt ? ` • Updated ${formatDate(practiceDataUpdatedAt)}` : ''}
        </Text>

        <View style={styles.endGrid}>
          {gridRows.map((row, ri) => (
            <View key={ri} style={styles.endGridRow}>
              {row.map((h, ci) => {
                const pd = practiceData[h];
                const color = pd
                  ? pd.status === 'green' ? '#00e676' : pd.status === 'amber' ? '#ffab00' : '#ff5555'
                  : '#556677';
                return (
                  <View key={h} style={[styles.endGridCell, { borderColor: color, backgroundColor: pd?.status === 'green' ? 'rgba(0,230,118,0.12)' : 'transparent' }, (ci === 2 || ci === 4) && { marginLeft: 16 }]}>
                    <Text style={[styles.endGridHeading, { color }]}>{h}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <Pressable style={styles.primaryBtn} onPress={startSession}>
          <Text style={styles.primaryBtnText}>Start Optimizing</Text>
        </Pressable>

        <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('PracticeHome')}>
          <Text style={styles.secondaryBtnText}>Back</Text>
        </Pressable>

        <Pressable style={styles.resetBtn} onPress={() => setShowResetConfirm(true)}>
          <Text style={styles.resetBtnText}>Reset Practice Data</Text>
        </Pressable>

        {showResetConfirm && (
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Reset Practice Data?</Text>
              <Text style={styles.confirmMessage}>This will lock Optimize until you complete a Mastery Challenge.</Text>
              <View style={styles.confirmBtnRow}>
                <Pressable style={styles.confirmBtnNo} onPress={() => setShowResetConfirm(false)}>
                  <Text style={styles.confirmBtnNoText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.confirmBtnYes} onPress={() => { setShowResetConfirm(false); resetPracticeData(); navigation.navigate('PracticeHome'); }}>
                  <Text style={styles.confirmBtnYesText}>Reset</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }

  // Complete
  if (phase === 'complete') {
    const engine = engineRef.current;
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          {engine.isComplete() ? 'All 36 Mastered!' : 'Session Saved'}
        </Text>
        <Text style={styles.statsLine}>
          Mastered: {engine.getMasteredCount()}/36
        </Text>
        <Text style={styles.statsDetail}>{totalReps} reps this session</Text>
        <Text style={styles.statsDetail}>Practice data updated</Text>

        <Pressable style={styles.primaryBtn} onPress={startSession}>
          <Text style={styles.primaryBtnText}>Try Again</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => { setPhase('dashboard'); phaseRef.current = 'dashboard'; }}>
          <Text style={styles.secondaryBtnText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  // Active / Countdown / Paused
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
        <ProgressGrid key={gridKey} engine={engineRef.current} practiceData={practiceData} />
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
  subtitle: { fontSize: 13, color: '#667788', marginBottom: 16 },
  resetBtn: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#ff5555', borderRadius: 6, zIndex: 20 },
  resetBtnText: { color: '#ff5555', fontSize: 13, fontWeight: '600' },
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
  endGrid: { marginTop: 20, marginBottom: 12, gap: 4 },
  endGridRow: { flexDirection: 'row', gap: 4 },
  endGridCell: { width: 48, height: 40, borderWidth: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  endGridHeading: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  confirmOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  confirmCard: { backgroundColor: '#1a1a2e', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 24, alignItems: 'center', borderWidth: 1, borderColor: '#3a4a5a' },
  confirmTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff', marginBottom: 10 },
  confirmMessage: { fontSize: 14, color: '#aabbcc', textAlign: 'center', marginBottom: 24 },
  confirmBtnRow: { flexDirection: 'row', gap: 16 },
  confirmBtnNo: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#3a4a5a' },
  confirmBtnNoText: { fontSize: 15, fontWeight: '600', color: '#aabbcc' },
  confirmBtnYes: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, backgroundColor: '#ff5555' },
  confirmBtnYesText: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
});
