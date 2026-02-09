import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, usePreventRemove, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import HeadingDisplay from '../features/stimulus/HeadingDisplay';
import CountdownTimer from '../ui/CountdownTimer';
import { GRID_PAIRS } from '../core/algorithms/trainingEngine';
import { FocusDeckEngine } from '../core/algorithms/focusDeckEngine';
import { SessionManager } from '../state/sessionManager';
import { useStore } from '../state/store';
import { FeedbackState, TIMING } from '../core/types';
import { calculateReciprocal } from '../core/algorithms/reciprocal';
import { HEADING_PACKETS } from '../core/data/headingPackets';

type SessionPhase = 'countdown' | 'active' | 'paused' | 'complete';

const FEEDBACK_HOLD_MS = 1200;
const LEVEL3_LIMIT = TIMING.VERBAL_LIMIT; // 1500ms

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
  const [feedbackColor, setFeedbackColor] = useState<FeedbackState | undefined>(undefined);
  const [showCorrect, setShowCorrect] = useState<string | undefined>(undefined);
  const [showDirection, setShowDirection] = useState<string | undefined>(undefined);

  const [masteredCount, setMasteredCount] = useState(0);
  const [totalReps, setTotalReps] = useState(0);
  const [gridKey, setGridKey] = useState(0);

  // Voice simulation state
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');

  useEffect(() => {
    // Start countdown immediately
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
  }, []);

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
    setPhase('complete');
    phaseRef.current = 'complete';
    setDisabled(false);
    setTimerRunning(false);
    setFrozenTime(null);
    setIsListening(false);
    saveSessionData();
  }, [saveSessionData]);

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

  const clearFeedbackAndAdvance = useCallback(() => {
    if (phaseRef.current !== 'active') return;

    setFeedbackColor(undefined);
    setShowCorrect(undefined);
    setShowDirection(undefined);
    setShowHeading(false);
    setRecognizedText('');

    const engine = engineRef.current;
    if (engine.isComplete()) {
      saveSessionData();
      setPhase('complete');
      phaseRef.current = 'complete';
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
  }, [saveSessionData]);

  const processAnswer = useCallback((spokenReciprocal: string, spokenDirection: string, timeMs: number) => {
    const expectedReciprocal = calculateReciprocal(heading);
    const expectedDirection = HEADING_PACKETS[heading]?.direction || '';

    const isCorrect = spokenReciprocal === expectedReciprocal &&
      spokenDirection.toLowerCase() === expectedDirection.toLowerCase();

    const engine = engineRef.current;
    const engineResult = engine.recordResult(heading, timeMs, isCorrect);

    sessionDataRef.current.push({ heading, time: timeMs, isCorrect });

    setFeedbackColor(engineResult.feedbackColor);
    updateStats();

    if (!isCorrect) {
      setShowCorrect(expectedReciprocal);
      setShowDirection(expectedDirection);
    }

    setTimeout(() => {
      setShowCorrect(undefined);
      setShowDirection(undefined);
      clearFeedbackAndAdvance();
    }, FEEDBACK_HOLD_MS);
  }, [heading, updateStats, clearFeedbackAndAdvance]);

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

    sessionDataRef.current.push({ heading, time: LEVEL3_LIMIT, isCorrect: false });

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

  // Simulate voice input
  const handleMicTap = useCallback(() => {
    if (disabled || phase !== 'active') return;
    setDisabled(true);

    const sinceLast = sessionRef.current.getTimeElapsed();
    const totalElapsed = sinceLast + resumeFromRef.current;
    setTimerRunning(false);
    setFrozenTime(totalElapsed);
    setIsListening(false);

    // Simulate correct answer
    const expectedReciprocal = calculateReciprocal(heading);
    const expectedDirection = HEADING_PACKETS[heading]?.direction || '';
    setRecognizedText(`${expectedReciprocal} ${expectedDirection}`);

    processAnswer(expectedReciprocal, expectedDirection, totalElapsed);
  }, [disabled, heading, phase, processAnswer]);

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
  const expectedReciprocal = heading ? calculateReciprocal(heading) : '';
  const expectedDirection = heading ? (HEADING_PACKETS[heading]?.direction || '') : '';

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
  container: { flex: 1, backgroundColor: '#0f0f23', alignItems: 'center', paddingTop: 20 },
  activeContainer: { flex: 1, backgroundColor: '#0f0f23' },
  activeScrollView: { flex: 1 },
  activeScrollContent: { flexGrow: 1, paddingBottom: 40 },
  activeInner: { flex: 1, alignItems: 'center', paddingTop: 12 },
  title: { fontSize: 22, color: '#00c896', fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
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
    borderColor: '#00c896',
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
  primaryBtn: { marginTop: 24, backgroundColor: '#00c896', paddingHorizontal: 36, paddingVertical: 12, borderRadius: 8 },
  primaryBtnText: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  statsLine: { fontSize: 16, color: '#aabbcc', marginTop: 8 },
  statsDetail: { fontSize: 13, color: '#667788', marginTop: 4 },
});
