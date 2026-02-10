import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import WedgeFirstInput from '../ui/WedgeFirstInput';
import { MasteryChallengeEngine, MASTER_SEQUENCE, GRID_PAIRS } from '../core/algorithms/trainingEngine';
import { SessionManager } from '../state/sessionManager';
import { useStore, MasteryHeadingResult } from '../state/store';
import { calculateReciprocal } from '../core/algorithms/reciprocal';
import { HEADING_PACKETS } from '../core/data/headingPackets';

type Phase = 'idle' | 'countdown' | 'active' | 'complete';

const FEEDBACK_HOLD_MS = 1200;
const INTER_REP_DELAY = 1000;

// Level 3 timing: Level 1 thresholds + 1.0s
// Level 1: Green ≤1.0s, Amber 1.0-2.0s, Timeout >2.0s
// Level 3: Green ≤2.0s, Amber 2.0-3.0s, Timeout >3.0s
const GREEN_THRESHOLD = 2000;
const SLOW_THRESHOLD = 3000;
const CHALLENGE_TIME_LIMIT = 3000;

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  if (min > 0) return `${min}:${sec.toString().padStart(2, '0')}.${tenths}`;
  return `${sec}.${tenths}s`;
}

function formatHPM(hpm: number): string {
  return hpm.toFixed(1);
}

function ProgressGrid({ results }: { results: Record<string, MasteryHeadingResult> }) {
  const renderCell = (h: string) => {
    const r = results[h];
    const status = r?.status;
    const cellColor = status === 'green' ? '#00e676' : status === 'amber' ? '#ffab00' : status === 'red' ? '#ff5555' : '#334455';
    const textColor = status === 'green' ? '#00e676' : status === 'amber' ? '#ffab00' : status === 'red' ? '#ff5555' : '#556677';
    const bgColor = status === 'green' ? 'rgba(0,230,118,0.12)' : status === 'amber' ? 'rgba(255,171,0,0.08)' : status === 'red' ? 'rgba(255,85,85,0.08)' : 'transparent';

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

function getSuggestedFocus(results: Record<string, MasteryHeadingResult>): { headings: string[]; tooManyRed: boolean } {
  const red: string[] = [];
  const amber: string[] = [];
  const green: string[] = [];

  for (const h of MASTER_SEQUENCE) {
    const r = results[h];
    if (!r) continue;
    if (r.status === 'red') red.push(h);
    else if (r.status === 'amber') amber.push(h);
    else green.push(h);
  }

  if (red.length > 6 || (red.length === 6 && amber.length > 0)) {
    return { headings: [], tooManyRed: true };
  }

  const total = red.length + amber.length + green.length;
  if (total <= 6) {
    return { headings: [...red, ...amber, ...green], tooManyRed: false };
  }

  const suggested: string[] = [];
  for (const h of red) { if (suggested.length >= 6) break; suggested.push(h); }
  for (const h of amber) { if (suggested.length >= 6) break; suggested.push(h); }
  for (const h of green) { if (suggested.length >= 6) break; suggested.push(h); }

  return { headings: suggested.slice(0, 6), tooManyRed: false };
}

export default function Level3MasteryChallengeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const saveBest = useStore((s) => s.saveLevel3MasteryChallengeBest);
  const existingBest = useStore((s) => s.level3MasteryChallengeBest);
  const previousBestRef = useRef(existingBest);
  const saveMasteryResults = useStore((s) => s.saveLevel3MasteryResults);
  const importMasteryToPractice = useStore((s) => s.importLevel3MasteryToPractice);
  const saveFocusSelection = useStore((s) => s.saveLevel3FocusSelection);
  const resetMasteryResults = useStore((s) => s.resetLevel3MasteryResults);
  const resetMasteryChallengeBest = useStore((s) => s.resetLevel3MasteryChallengeBest);
  const storedMasteryResults = useStore((s) => s.level3MasteryResults);
  const storedElapsed = useStore((s) => s.level3MasteryLastElapsed);
  const storedMistakes = useStore((s) => s.level3MasteryLastMistakes);
  const storedTotalResponses = useStore((s) => s.level3MasteryLastTotalResponses);

  const hasStoredResults = Object.keys(storedMasteryResults).length > 0;

  const engineRef = useRef<MasteryChallengeEngine>(new MasteryChallengeEngine(CHALLENGE_TIME_LIMIT));
  const sessionRef = useRef<SessionManager>(new SessionManager(engineRef.current));
  const resultsRef = useRef<Record<string, MasteryHeadingResult>>(hasStoredResults ? { ...storedMasteryResults } : {});
  const totalMistakesRef = useRef(hasStoredResults ? storedMistakes : 0);
  const storedTotalResponsesRef = useRef(hasStoredResults ? storedTotalResponses : 0);

  const [phase, setPhase] = useState<Phase>(hasStoredResults ? 'complete' : 'idle');
  const phaseRef = useRef<Phase>(hasStoredResults ? 'complete' : 'idle');
  const [heading, setHeading] = useState('');
  const [disabled, setDisabled] = useState(false);
  const [repKey, setRepKey] = useState(0);
  const [showHeading, setShowHeading] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [frozenTime, setFrozenTime] = useState<number | null>(null);
  const [resumeFrom, setResumeFrom] = useState<number | null>(null);
  const resumeFromRef = useRef<number>(0);

  const [completed, setCompleted] = useState(0);
  const [elapsed, setElapsed] = useState(hasStoredResults ? storedElapsed : 0);
  const [gridKey, setGridKey] = useState(0);
  const responseTimeSumRef = useRef(0);
  const totalResponsesRef = useRef(0);

  const [selectedForFocus, setSelectedForFocus] = useState<Set<string>>(new Set());
  const [practiceDataSaved, setPracticeDataSaved] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // WedgeFirstInput feedback state
  const [feedbackState, setFeedbackState] = useState<{ correct: boolean; fast: boolean } | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Timer state
  const [timerProgress, setTimerProgress] = useState(0);
  const [timerColor, setTimerColor] = useState('#00e676');
  const timerStartRef = useRef<number>(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handleTimeoutRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (phase === 'active') {
      setElapsed(responseTimeSumRef.current);
    }
  }, [phase, completed]);

  useEffect(() => {
    if (heading && phase === 'active') {
      setShowHeading(true);
    }
  }, [repKey]);

  // Timer tick function
  const startTimer = useCallback(() => {
    timerStartRef.current = Date.now() - (resumeFromRef.current || 0);
    const initialElapsed = resumeFromRef.current || 0;
    const initialProgress = Math.min(initialElapsed / CHALLENGE_TIME_LIMIT, 1);
    setTimerProgress(initialProgress);

    const tick = () => {
      if (phaseRef.current !== 'active') return;
      const elapsed = Date.now() - timerStartRef.current;
      const progress = Math.min(elapsed / CHALLENGE_TIME_LIMIT, 1);
      setTimerProgress(progress);

      if (elapsed < GREEN_THRESHOLD) {
        setTimerColor('#00e676');
      } else if (elapsed < SLOW_THRESHOLD) {
        setTimerColor('#ffab00');
      } else {
        setTimerColor('#ff1744');
      }

      if (elapsed >= CHALLENGE_TIME_LIMIT) {
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

  const trackResult = useCallback((h: string, timeMs: number, isCorrect: boolean) => {
    responseTimeSumRef.current += timeMs;
    totalResponsesRef.current++;

    const isGreen = isCorrect && timeMs <= GREEN_THRESHOLD;
    const isWrong = !isCorrect;

    const existing = resultsRef.current[h];
    if (!existing) {
      const status: 'green' | 'amber' | 'red' = isWrong ? 'red' : isGreen ? 'green' : 'amber';
      resultsRef.current[h] = { status, time: timeMs, mistakes: isCorrect ? 0 : 1 };
    } else {
      if (isWrong && existing.status !== 'red') {
        existing.status = 'red';
      } else if (!isGreen && existing.status === 'green') {
        existing.status = 'amber';
      }
      existing.mistakes += isCorrect ? 0 : 1;
    }
    if (!isCorrect) {
      totalMistakesRef.current++;
    }
    setGridKey((k) => k + 1);
  }, []);

  const startChallenge = useCallback(() => {
    engineRef.current = new MasteryChallengeEngine(CHALLENGE_TIME_LIMIT);
    sessionRef.current = new SessionManager(engineRef.current);
    resultsRef.current = {};
    totalMistakesRef.current = 0;
    responseTimeSumRef.current = 0;
    totalResponsesRef.current = 0;
    setPhase('countdown');
    phaseRef.current = 'countdown';
    setDisabled(false);
    setFeedbackState(null);
    setShowFeedback(false);
    setShowHeading(false);
    setTimerRunning(false);
    setFrozenTime(null);
    setCompleted(0);
    setElapsed(0);
    setSelectedForFocus(new Set());
    setPracticeDataSaved(false);

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
      startTimer();
    }, 1000);
  }, [startTimer]);

  const clearFeedbackAndAdvance = useCallback(() => {
    if (phaseRef.current !== 'active') return;

    setShowFeedback(false);
    setFeedbackState(null);
    setShowHeading(false);

    const engine = engineRef.current;
    if (engine.isComplete()) {
      stopTimer();
      const totalTime = responseTimeSumRef.current;
      setElapsed(totalTime);
      const accuracy = engine.getAccuracy();
      const totalResponses = totalResponsesRef.current;
      const rawTpm = totalResponses / (totalTime / 60000);
      const finalHpm = rawTpm * accuracy;
      previousBestRef.current = existingBest;
      saveBest(finalHpm, totalTime, accuracy, totalResponses);
      for (const h of MASTER_SEQUENCE) {
        if (!resultsRef.current[h]) {
          resultsRef.current[h] = { status: 'green', time: 0, mistakes: 0 };
        }
      }
      saveMasteryResults(resultsRef.current, totalTime, totalMistakesRef.current, totalResponses);
      storedTotalResponsesRef.current = totalResponses;
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
    }, INTER_REP_DELAY);
  }, [stopTimer, startTimer, saveBest, saveMasteryResults, existingBest]);

  const handleTimeout = useCallback(() => {
    if (disabled || phase !== 'active') return;
    stopTimer();
    setDisabled(true);
    setTimerRunning(false);

    const engine = engineRef.current;
    engine.recordResult(heading, 3000, false);
    setCompleted(36 - engine.getRemaining());
    trackResult(heading, CHALLENGE_TIME_LIMIT, false);

    setFeedbackState({ correct: false, fast: false });
    setShowFeedback(true);

    setTimeout(() => {
      clearFeedbackAndAdvance();
    }, FEEDBACK_HOLD_MS);
  }, [disabled, heading, phase, stopTimer, trackResult, clearFeedbackAndAdvance]);

  // Keep handleTimeoutRef updated
  useEffect(() => {
    handleTimeoutRef.current = handleTimeout;
  }, [handleTimeout]);

  // Handle answer from WedgeFirstInput
  const handleAnswer = useCallback((selectedHeading: string, wedgeId: number) => {
    if (disabled || phase !== 'active') return;
    stopTimer();
    setDisabled(true);

    const elapsed = Date.now() - timerStartRef.current;
    setTimerRunning(false);

    // Check if correct: selected heading must match the RECIPROCAL of the stimulus
    const reciprocal = calculateReciprocal(heading);
    const isCorrect = selectedHeading === reciprocal;
    const isFast = elapsed < GREEN_THRESHOLD;

    // Record result to engine
    const engine = engineRef.current;
    let engineTime: number;
    if (isCorrect && isFast) {
      engineTime = 500;
    } else if (isCorrect) {
      engineTime = 1500;
    } else {
      engineTime = 3000;
    }
    engine.recordResult(heading, engineTime, isCorrect);
    setCompleted(36 - engine.getRemaining());
    trackResult(heading, elapsed, isCorrect);

    setFeedbackState({ correct: isCorrect, fast: isFast });
    setShowFeedback(true);

    setTimeout(() => {
      clearFeedbackAndAdvance();
    }, FEEDBACK_HOLD_MS);
  }, [disabled, heading, phase, stopTimer, trackResult, clearFeedbackAndAdvance]);

  const toggleSelection = useCallback((h: string) => {
    setSelectedForFocus((prev) => {
      const next = new Set(prev);
      if (next.has(h)) next.delete(h);
      else next.add(h);
      return next;
    });
  }, []);

  const handleUpdatePracticeData = useCallback(() => {
    importMasteryToPractice();
    setPracticeDataSaved(true);
  }, [importMasteryToPractice]);

  const handleStartFocus = useCallback(() => {
    const headings = Array.from(selectedForFocus);
    saveFocusSelection(headings);
    setSelectedForFocus(new Set());
    navigation.navigate('Level3Focus', { headings });
  }, [selectedForFocus, navigation, saveFocusSelection]);

  // IDLE or COMPLETE
  if (phase === 'idle' || phase === 'complete') {
    const results = resultsRef.current;
    const resultEntries = Object.values(results);
    const hasResults = resultEntries.length > 0;
    const greenCount = resultEntries.filter((r) => r.status === 'green').length;
    const accuracy = hasResults ? greenCount / resultEntries.length : 0;
    const totalResponses = storedTotalResponsesRef.current || totalResponsesRef.current;
    const rawTpm = elapsed > 0 ? totalResponses / (elapsed / 60000) : 0;
    const hpm = rawTpm * accuracy;
    const isNewBest = hasResults && (!previousBestRef.current || hpm > previousBestRef.current.score || (hpm === previousBestRef.current.score && accuracy > previousBestRef.current.accuracy));
    const canStartFocus = selectedForFocus.size >= 6;

    const suggestionResult = hasResults ? getSuggestedFocus(results) : { headings: [], tooManyRed: false };
    const suggested = suggestionResult.headings;
    const tooManyRed = suggestionResult.tooManyRed;

    const gridRows: string[][] = [];
    for (let i = 0; i < MASTER_SEQUENCE.length; i += 6) {
      gridRows.push(MASTER_SEQUENCE.slice(i, i + 6));
    }

    return (
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Mastery Challenge</Text>

        {hasResults ? (
          <>
            {isNewBest ? (
              <>
                <Text style={styles.newBest}>New Best!</Text>
                <Text style={styles.scoreLine}>Score: {formatHPM(hpm)}</Text>
                <Text style={styles.scoreBreakdown}>
                  {totalResponses} terms / {formatTime(elapsed)} x {Math.round(accuracy * 100)}%
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.scoreLine}>Score: {formatHPM(hpm)}</Text>
                <Text style={styles.scoreBreakdown}>
                  {totalResponses} terms / {formatTime(elapsed)} x {Math.round(accuracy * 100)}%
                </Text>
                {existingBest && (
                  <View style={styles.bestScoreContainer}>
                    <Text style={styles.bestScoreLine}>Best: {formatHPM(existingBest.score)}</Text>
                    <Text style={styles.bestScoreBreakdown}>
                      {existingBest.totalResponses || '?'} terms / {formatTime(existingBest.time)} x {Math.round(existingBest.accuracy * 100)}%
                    </Text>
                  </View>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <Text style={styles.noScoreLine}>No Score Yet</Text>
            <Text style={styles.description}>
              All 36 headings — 1.7s time limit{'\n'}Correct and fast removes it
            </Text>
            {existingBest && (
              <View style={styles.bestScoreContainer}>
                <Text style={styles.bestScore}>
                  Best: {formatHPM(existingBest.score)}
                </Text>
                <Text style={styles.bestScoreBreakdownIdle}>
                  {existingBest.totalResponses || '?'} terms / {formatTime(existingBest.time)} x {Math.round(existingBest.accuracy * 100)}%
                </Text>
              </View>
            )}
          </>
        )}

        <View style={styles.tileGrid}>
          {gridRows.map((row, ri) => (
            <View key={ri} style={styles.tileRow}>
              {row.map((h, ci) => {
                const r = results[h];
                const status = r?.status || 'gray';
                const isSelected = selectedForFocus.has(h);
                const color = isSelected ? '#00d4ff' : status === 'green' ? '#00e676' : status === 'amber' ? '#ffab00' : status === 'red' ? '#ff5555' : '#556677';
                const bgColor = isSelected ? 'rgba(0,212,255,0.15)' : status === 'green' ? 'rgba(0,230,118,0.12)' : status === 'amber' ? 'rgba(255,171,0,0.08)' : status === 'red' ? 'rgba(255,85,85,0.08)' : 'transparent';

                return (
                  <Pressable
                    key={h}
                    style={[
                      styles.tile,
                      { borderColor: color, backgroundColor: bgColor },
                      isSelected && styles.tileSelected,
                      (ci === 2 || ci === 4) && { marginLeft: 16 },
                    ]}
                    onPress={hasResults ? () => toggleSelection(h) : undefined}
                    disabled={!hasResults}
                  >
                    <Text style={[styles.tileText, { color }]}>{h}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {hasResults && (
          <>
            <Pressable
              style={[styles.smallBtn, { marginTop: 12 }, practiceDataSaved && styles.btnSaved]}
              onPress={handleUpdatePracticeData}
              disabled={practiceDataSaved}
            >
              <Text style={[styles.smallBtnText, practiceDataSaved && { color: '#00e676' }]}>
                {practiceDataSaved ? 'Practice Data Saved' : 'Update Practice Data'}
              </Text>
            </Pressable>

            {tooManyRed ? (
              <View style={styles.suggestRow}>
                <Text style={styles.suggestLabel}>Suggested: </Text>
                <Text style={styles.suggestLearnMode}>Return to Learn Mode</Text>
                <Pressable style={styles.acceptBtn} onPress={() => navigation.navigate('Level3Learn')}>
                  <Text style={styles.acceptBtnText}>Go</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.suggestRow}>
                  <Text style={styles.suggestLabel}>Suggested Focus: </Text>
                  {suggested.map((h) => {
                    const r = results[h];
                    const color = r?.status === 'green' ? '#00e676' : r?.status === 'amber' ? '#ffab00' : '#ff5555';
                    return (
                      <Text key={h} style={[styles.suggestHeading, { color }]}>{h}  </Text>
                    );
                  })}
                  <Pressable style={styles.acceptBtn} onPress={selectedForFocus.size > 0 ? () => setSelectedForFocus(new Set()) : () => setSelectedForFocus(new Set(suggested))}>
                    <Text style={styles.acceptBtnText}>{selectedForFocus.size > 0 ? 'Clear' : 'Accept'}</Text>
                  </Pressable>
                </View>

                <Pressable
                  style={[styles.primaryBtn, !canStartFocus && styles.btnDisabled]}
                  onPress={handleStartFocus}
                  disabled={!canStartFocus}
                >
                  <Text style={styles.primaryBtnText}>Start Focus Session</Text>
                  <Text style={styles.primaryBtnHint}>(minimum 6)</Text>
                </Pressable>
              </>
            )}
          </>
        )}

        <Pressable style={styles.primaryBtn} onPress={startChallenge}>
          <Text style={styles.primaryBtnText}>{hasResults ? 'Try Again' : 'Start Challenge'}</Text>
        </Pressable>

        <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('Level3Menu')}>
          <Text style={styles.secondaryBtnText}>Back</Text>
        </Pressable>

        {(hasResults || existingBest) && (
          <Pressable style={styles.resetBtn} onPress={() => setShowResetConfirm(true)}>
            <Text style={styles.resetBtnText}>Reset All</Text>
          </Pressable>
        )}

        {showResetConfirm && (
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Reset Everything?</Text>
              <Text style={styles.confirmMessage}>This will clear your results and best score.</Text>
              <View style={styles.confirmBtnRow}>
                <Pressable style={styles.confirmBtnNo} onPress={() => setShowResetConfirm(false)}>
                  <Text style={styles.confirmBtnNoText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.confirmBtnYes} onPress={() => { setShowResetConfirm(false); resetMasteryResults(); resetMasteryChallengeBest(); resultsRef.current = {}; totalMistakesRef.current = 0; storedTotalResponsesRef.current = 0; setElapsed(0); previousBestRef.current = null; }}>
                  <Text style={styles.confirmBtnYesText}>Reset</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    );
  }

  // ACTIVE / COUNTDOWN
  const isCountdown = phase === 'countdown';

  return (
    <View style={styles.activeContainer}>
      <View style={styles.gridPositioner}>
        <ProgressGrid key={gridKey} results={resultsRef.current} />
      </View>

      <View style={styles.compassWrapCentered}>
        <WedgeFirstInput
          heading={heading}
          onAnswer={handleAnswer}
          disabled={disabled || isCountdown}
          timerProgress={timerProgress}
          timerColor={timerColor}
          feedbackState={feedbackState}
          showFeedback={showFeedback}
          centerText={isCountdown ? 'Ready' : undefined}
          correctAnswer={heading ? `${calculateReciprocal(heading)} ${HEADING_PACKETS[calculateReciprocal(heading)]?.direction || ''}` : ''}
        />
      </View>

      <View style={styles.controlRow}>
        <Pressable
          style={[styles.controlBtn, styles.stopCtrl]}
          onPress={() => {
            stopTimer();
            if (Object.keys(storedMasteryResults).length > 0) {
              resultsRef.current = { ...storedMasteryResults };
              totalMistakesRef.current = storedMistakes;
              setElapsed(storedElapsed);
              setPhase('complete');
              phaseRef.current = 'complete';
            } else {
              setPhase('idle');
              phaseRef.current = 'idle';
            }
          }}
        >
          <Text style={[styles.controlBtnText, styles.stopCtrlText]}>Quit</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23', alignItems: 'center', paddingTop: 20 },
  activeContainer: { flex: 1, backgroundColor: '#0f0f23', alignItems: 'center', paddingTop: 20 },
  compassWrapCentered: { marginTop: 0 },
  scrollContainer: { flex: 1, backgroundColor: '#0f0f23' },
  scrollContent: { alignItems: 'center', paddingTop: 20, paddingBottom: 40 },
  controlRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 32 },
  stopCtrl: { borderColor: '#ff5555' },
  stopCtrlText: { color: '#ff5555' },
  resumeText: { color: '#00e676' },
  title: { fontSize: 22, color: '#00d4ff', fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  description: { fontSize: 16, color: '#aabbcc', textAlign: 'center', marginTop: 40, lineHeight: 24 },
  bestScore: { fontSize: 14, color: '#00e676', fontWeight: '600', marginTop: 16 },
  primaryBtn: { marginTop: 24, backgroundColor: '#00d4ff', paddingHorizontal: 36, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  primaryBtnText: { fontSize: 18, fontWeight: '700', color: '#0f0f23' },
  primaryBtnHint: { fontSize: 11, color: '#ffffff', opacity: 0.6, marginTop: 2 },
  btnDisabled: { opacity: 0.4 },
  btnSaved: { borderColor: '#00e676' },
  secondaryBtn: { marginTop: 12, borderWidth: 1, borderColor: '#3a4a5a', paddingHorizontal: 28, paddingVertical: 10, borderRadius: 8 },
  secondaryBtnText: { color: '#aabbcc', fontSize: 15, fontWeight: '600' },
  timerArea: { marginBottom: 20 },
  headingInRing: { fontSize: 48, fontWeight: '700', color: '#00d4ff', fontVariant: ['tabular-nums'] },
  getReady: { fontSize: 18, color: '#ffab00', fontWeight: '700' },
  newBest: { fontSize: 18, color: '#ffab00', fontWeight: '700', marginBottom: 8 },
  scoreLine: { fontSize: 24, color: '#00e676', fontWeight: '700', marginTop: 8 },
  scoreBreakdown: { fontSize: 13, color: '#aabbcc', marginBottom: 8 },
  noScoreLine: { fontSize: 20, color: '#556677', fontWeight: '600', marginTop: 8, marginBottom: 4 },
  bestScoreContainer: { alignItems: 'center', marginBottom: 8 },
  bestScoreLine: { fontSize: 14, color: '#667788' },
  bestScoreBreakdown: { fontSize: 11, color: '#556677' },
  bestScoreBreakdownIdle: { fontSize: 12, color: '#556677', marginTop: 2 },
  tileGrid: { marginTop: 12, gap: 4 },
  tileRow: { flexDirection: 'row', gap: 4 },
  tile: { width: 48, height: 40, borderWidth: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  tileSelected: { borderWidth: 3 },
  tileText: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  smallBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#00d4ff' },
  smallBtnText: { color: '#00d4ff', fontSize: 12, fontWeight: '600' },
  suggestRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 16, paddingHorizontal: 16 },
  suggestLabel: { fontSize: 14, color: '#aabbcc', fontWeight: '600' },
  suggestHeading: { fontSize: 15, fontWeight: '700' },
  suggestLearnMode: { fontSize: 14, color: '#ff5555', fontWeight: '600' },
  acceptBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#00d4ff', marginLeft: 10 },
  acceptBtnText: { color: '#00d4ff', fontSize: 13, fontWeight: '600' },
  resetBtn: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#ff5555', borderRadius: 6, zIndex: 20 },
  resetBtnText: { color: '#ff5555', fontSize: 13, fontWeight: '600' },
  controlBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#3a4a5a' },
  controlBtnText: { color: '#aabbcc', fontSize: 13, fontWeight: '600' },
  gridContainer: { gap: 1 },
  gridRow: { flexDirection: 'row', gap: 1 },
  gridCell: { width: 28, height: 20, borderWidth: 1, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  gridCellText: { fontSize: 8, fontWeight: '700', fontVariant: ['tabular-nums'] },
  gridPositioner: { position: 'absolute', left: 12, top: 60, zIndex: 10 },
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
  correctAnswer: { fontSize: 24, fontWeight: '700', color: '#00e676' },
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
  micButtonActive: { backgroundColor: 'rgba(0,212,255,0.2)', borderColor: '#00d4ff' },
  micButtonDisabled: { opacity: 0.4, borderColor: '#3a4a5a' },
  micIcon: { fontSize: 32 },
  micLabel: { fontSize: 10, color: '#aabbcc', marginTop: 2 },
  expectedFormat: { fontSize: 12, color: '#556677', marginTop: 8 },
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
