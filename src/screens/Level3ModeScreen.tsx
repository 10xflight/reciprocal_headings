import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import HeadingDisplay from '../features/stimulus/HeadingDisplay';
import CountdownTimer from '../ui/CountdownTimer';
import { DeckEngine, MASTER_SEQUENCE, GRID_PAIRS } from '../core/algorithms/trainingEngine';
import { SessionManager } from '../state/sessionManager';
import { useStore } from '../state/store';
import { FeedbackState, TIMING } from '../core/types';
import { calculateReciprocal } from '../core/algorithms/reciprocal';
import { HEADING_PACKETS } from '../core/data/headingPackets';

type SessionPhase = 'dashboard' | 'countdown' | 'active' | 'paused';

const FEEDBACK_HOLD_MS = 1200;
const LEVEL3_LIMIT = TIMING.VERBAL_LIMIT; // 1500ms

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
  const [showHeading, setShowHeading] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [frozenTime, setFrozenTime] = useState<number | null>(null);
  const [resumeFrom, setResumeFrom] = useState<number | null>(null);
  const resumeFromRef = useRef<number>(0);
  const [feedbackColor, setFeedbackColor] = useState<FeedbackState | undefined>(undefined);
  const [showCorrect, setShowCorrect] = useState<string | undefined>(undefined);
  const [showDirection, setShowDirection] = useState<string | undefined>(undefined);

  const [masteredCount, setMasteredCount] = useState(0);
  const [deckSize, setDeckSize] = useState(1);
  const [unlockedCount, setUnlockedCount] = useState(1);
  const [totalReps, setTotalReps] = useState(0);
  const [gridKey, setGridKey] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Voice simulation state (placeholder)
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');

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
    setFeedbackColor(undefined);
    setShowHeading(false);
    setTimerRunning(false);
    setFrozenTime(null);
    setMasteredCount(engineRef.current.getMasteredCount());
    setDeckSize(engineRef.current.getDeckSize());
    setUnlockedCount(engineRef.current.getUnlockedCount());
    setTotalReps(0);
    setGridKey((k) => k + 1);
    setRecognizedText('');
    setIsListening(false);

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
      setIsListening(true);
    }, 1000);
  }, [savedProgress]);

  const pauseSession = useCallback(() => {
    const sinceLast = sessionRef.current.getTimeElapsed();
    const totalElapsed = sinceLast + resumeFromRef.current;
    setPhase('paused');
    phaseRef.current = 'paused';
    setTimerRunning(false);
    setFrozenTime(totalElapsed);
    setIsListening(false);
  }, []);

  const resumeSession = useCallback(() => {
    setPhase('active');
    phaseRef.current = 'active';
    sessionRef.current.startTimer();
    resumeFromRef.current = frozenTime ?? 0;
    setResumeFrom(frozenTime);
    setTimerRunning(true);
    setFrozenTime(null);
    setIsListening(true);
  }, [frozenTime]);

  const stopSession = useCallback(() => {
    setPhase('dashboard');
    phaseRef.current = 'dashboard';
    setDisabled(false);
    setTimerRunning(false);
    setFrozenTime(null);
    setIsListening(false);
    saveProgress(engineRef.current);
  }, [saveProgress]);

  usePreventRemove(phase !== 'dashboard', () => {
    stopSession();
  });

  const clearFeedbackAndAdvance = useCallback(() => {
    if (phaseRef.current !== 'active') return;

    setFeedbackColor(undefined);
    setShowCorrect(undefined);
    setShowDirection(undefined);
    setShowHeading(false);
    setRecognizedText('');

    const engine = engineRef.current;
    if (engine.isComplete()) {
      saveProgress(engine);
      setPhase('dashboard');
      phaseRef.current = 'dashboard';
      setIsListening(false);
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
      setIsListening(true);
    }, TIMING.INTER_REP_DELAY);
  }, [saveProgress]);

  const processAnswer = useCallback((spokenReciprocal: string, spokenDirection: string, timeMs: number) => {
    const expectedReciprocal = calculateReciprocal(heading);
    const expectedDirection = HEADING_PACKETS[heading]?.direction || '';

    const isCorrect = spokenReciprocal === expectedReciprocal &&
      spokenDirection.toLowerCase() === expectedDirection.toLowerCase();

    const engine = engineRef.current;
    const engineResult = engine.recordResult(heading, timeMs, isCorrect);

    setFeedbackColor(engineResult.feedbackColor);
    updateStats();

    if (engineResult.newHeadingUnlocked) {
      saveProgress(engineRef.current);
    }

    if (!isCorrect) {
      setShowCorrect(expectedReciprocal);
      setShowDirection(expectedDirection);
    }

    setTimeout(() => {
      setShowCorrect(undefined);
      setShowDirection(undefined);
      clearFeedbackAndAdvance();
    }, FEEDBACK_HOLD_MS);
  }, [heading, updateStats, clearFeedbackAndAdvance, saveProgress]);

  const handleTimeout = useCallback(() => {
    if (disabled || phase !== 'active') return;
    setDisabled(true);
    setTimerRunning(false);
    setFrozenTime(LEVEL3_LIMIT);
    setIsListening(false);

    const expectedReciprocal = calculateReciprocal(heading);
    const expectedDirection = HEADING_PACKETS[heading]?.direction || '';

    const engine = engineRef.current;
    engine.recordResult(heading, LEVEL3_LIMIT, false);

    setFeedbackColor('red');
    setShowCorrect(expectedReciprocal);
    setShowDirection(expectedDirection);
    updateStats();

    setTimeout(() => {
      setShowCorrect(undefined);
      setShowDirection(undefined);
      clearFeedbackAndAdvance();
    }, FEEDBACK_HOLD_MS);
  }, [disabled, heading, phase, updateStats, clearFeedbackAndAdvance]);

  // Simulate voice input (placeholder - tap mic to simulate correct answer)
  const handleMicTap = useCallback(() => {
    if (disabled || phase !== 'active') return;
    setDisabled(true);

    const sinceLast = sessionRef.current.getTimeElapsed();
    const totalElapsed = sinceLast + resumeFromRef.current;
    setTimerRunning(false);
    setFrozenTime(totalElapsed);
    setIsListening(false);

    // Simulate correct answer for now
    const expectedReciprocal = calculateReciprocal(heading);
    const expectedDirection = HEADING_PACKETS[heading]?.direction || '';
    setRecognizedText(`${expectedReciprocal} ${expectedDirection}`);

    processAnswer(expectedReciprocal, expectedDirection, totalElapsed);
  }, [disabled, heading, phase, processAnswer]);

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
        <Text style={styles.title}>Level 3 Mode</Text>
        <Text style={styles.subtitle}>Say the Reciprocal + Direction</Text>
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
      </ScrollView>
    );
  }

  const isCountdown = phase === 'countdown';
  const isPaused = phase === 'paused';

  // Get expected answer for display
  const expectedReciprocal = heading ? calculateReciprocal(heading) : '';
  const expectedDirection = heading ? (HEADING_PACKETS[heading]?.direction || '') : '';

  return (
    <View style={styles.activeContainer}>
      <View style={styles.gridPositioner}>
        <ProgressGrid key={gridKey} engine={engineRef.current} />
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

          <View style={styles.voiceArea}>
            <View style={styles.timerRow}>
              <CountdownTimer
                running={timerRunning}
                onTimeout={handleTimeout}
                frozenTime={frozenTime}
                duration={LEVEL3_LIMIT}
                resumeFrom={resumeFrom}
              />
            </View>

            {/* Voice feedback display */}
            <View style={[
              styles.voiceDisplay,
              feedbackColor === 'green' && styles.voiceDisplayGreen,
              feedbackColor === 'amber' && styles.voiceDisplayAmber,
              feedbackColor === 'red' && styles.voiceDisplayRed,
            ]}>
              {showCorrect ? (
                <View style={styles.correctAnswerDisplay}>
                  <Text style={styles.correctReciprocal}>{showCorrect}</Text>
                  <Text style={styles.correctDirection}>{showDirection}</Text>
                </View>
              ) : recognizedText ? (
                <Text style={styles.recognizedText}>{recognizedText}</Text>
              ) : (
                <Text style={styles.voicePlaceholder}>
                  {isListening ? 'Listening...' : 'Tap mic to speak'}
                </Text>
              )}
            </View>

            {/* Microphone button */}
            <Pressable
              style={[
                styles.micButton,
                isListening && styles.micButtonActive,
                (disabled || isCountdown || isPaused) && styles.micButtonDisabled,
              ]}
              onPress={handleMicTap}
              disabled={disabled || isCountdown || isPaused}
            >
              <Text style={styles.micIcon}>🎤</Text>
              <Text style={styles.micLabel}>
                {isListening ? 'Listening' : 'Tap to Speak'}
              </Text>
            </Pressable>

            <Text style={styles.expectedFormat}>
              Say: "{expectedReciprocal} {expectedDirection}"
            </Text>
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
  scrollContainer: { flex: 1, backgroundColor: '#0f0f23' },
  scrollContent: { alignItems: 'center', paddingTop: 20, paddingBottom: 40 },
  activeContainer: { flex: 1, backgroundColor: '#0f0f23' },
  activeScrollView: { flex: 1 },
  activeScrollContent: { flexGrow: 1, paddingBottom: 40 },
  activeInner: { flex: 1, alignItems: 'center', paddingTop: 12 },
  title: { fontSize: 22, color: '#00d4ff', fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  subtitle: { fontSize: 13, color: '#667788', marginBottom: 8 },
  headingAreaCompact: { height: 100, width: '100%', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  headingPlaceholderCompact: { height: 100 },
  getReady: { fontSize: 24, color: '#ffab00', fontWeight: '700' },
  gridContainer: { gap: 1 },
  gridRow: { flexDirection: 'row', gap: 1 },
  gridCell: { width: 28, height: 20, borderWidth: 1, borderRadius: 2, justifyContent: 'center', alignItems: 'center' },
  gridCellText: { fontSize: 8, fontWeight: '700', fontVariant: ['tabular-nums'] },
  gridPositioner: { position: 'absolute', left: 12, top: 12, zIndex: 10 },
  voiceArea: { alignItems: 'center', marginTop: 4, width: '100%' },
  timerRow: { marginBottom: 16 },
  voiceDisplay: {
    width: '80%',
    maxWidth: 300,
    height: 80,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3a4a5a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  voiceDisplayGreen: { borderColor: '#00e676', backgroundColor: 'rgba(0,230,118,0.1)' },
  voiceDisplayAmber: { borderColor: '#ffab00', backgroundColor: 'rgba(255,171,0,0.1)' },
  voiceDisplayRed: { borderColor: '#ff5555', backgroundColor: 'rgba(255,85,85,0.1)' },
  recognizedText: { fontSize: 24, fontWeight: '700', color: '#ffffff' },
  voicePlaceholder: { fontSize: 16, color: '#667788' },
  correctAnswerDisplay: { alignItems: 'center' },
  correctReciprocal: { fontSize: 28, fontWeight: '700', color: '#00e676' },
  correctDirection: { fontSize: 16, color: '#00e676', marginTop: 4 },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a1a2e',
    borderWidth: 3,
    borderColor: '#00d4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  micButtonActive: { backgroundColor: 'rgba(255,149,0,0.2)', borderColor: '#ffab00' },
  micButtonDisabled: { opacity: 0.4, borderColor: '#3a4a5a' },
  micIcon: { fontSize: 32 },
  micLabel: { fontSize: 10, color: '#aabbcc', marginTop: 2 },
  expectedFormat: { fontSize: 12, color: '#556677', marginTop: 8 },
  controlRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 20, marginBottom: 20 },
  controlBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#3a4a5a' },
  controlBtnText: { color: '#aabbcc', fontSize: 13, fontWeight: '600' },
  resumeText: { color: '#00e676' },
  stopCtrl: { borderColor: '#ff5555' },
  stopCtrlText: { color: '#ff5555' },
  pausedBadge: { position: 'absolute', top: '45%', alignSelf: 'center', backgroundColor: 'rgba(15, 15, 35, 0.85)', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, zIndex: 90 },
  pausedText: { fontSize: 24, fontWeight: '700', color: '#ffab00', letterSpacing: 4 },
  primaryBtn: { marginTop: 24, backgroundColor: '#00d4ff', paddingHorizontal: 36, paddingVertical: 12, borderRadius: 8 },
  primaryBtnText: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  secondaryBtn: { marginTop: 12, borderWidth: 1, borderColor: '#3a4a5a', paddingHorizontal: 28, paddingVertical: 10, borderRadius: 8 },
  secondaryBtnText: { color: '#aabbcc', fontSize: 15, fontWeight: '600' },
  statsLine: { fontSize: 16, color: '#aabbcc', marginTop: 8 },
  statsDetail: { fontSize: 13, color: '#667788', marginTop: 4 },
  endGrid: { marginTop: 20, marginBottom: 12, gap: 4 },
  endGridRow: { flexDirection: 'row', gap: 4 },
  endGridCell: { width: 48, height: 40, borderWidth: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  endGridHeading: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  endGridReps: { fontSize: 9, color: '#667788', fontVariant: ['tabular-nums'] },
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
});
