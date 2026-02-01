import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import CompassRose from '../features/compass/CompassRose';
import HeadingDisplay from '../features/stimulus/HeadingDisplay';
import FeedbackOverlay from '../ui/feedback/FeedbackOverlay';
import CountdownTimer from '../ui/CountdownTimer';
import { LearningEngine, SETS, STAGES } from '../core/algorithms/trainingEngine';
import { SessionManager } from '../state/sessionManager';
import { useStore } from '../state/store';
import { FeedbackState, TIMING, ValidationResult } from '../core/types';
import { HEADING_PACKETS } from '../core/data/headingPackets';
import { getStageName, getStageSets } from '../core/algorithms/trainingEngine';
import { RootStackParamList } from '../navigation/AppNavigator';

type SessionPhase = 'idle' | 'countdown' | 'active' | 'paused' | 'complete';

const FEEDBACK_HOLD_MS = 1200; // how long wedge highlight + radial show

export default function LearningScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Learning'>>();
  const navigation = useNavigation();
  const stage = route.params.stage;
  const completeStage = useStore((s) => s.completeStage);

  const engineRef = useRef<LearningEngine>(new LearningEngine(stage));
  const sessionRef = useRef<SessionManager>(new SessionManager(engineRef.current));
  const [phase, setPhase] = useState<SessionPhase>('idle');
  const phaseRef = useRef<SessionPhase>('idle');
  const [heading, setHeading] = useState('');
  // Only used for amber "Too Slow" overlay now
  const [feedback, setFeedback] = useState<{
    state: FeedbackState;
    result: ValidationResult;
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
  const [firstTryCount, setFirstTryCount] = useState(0);
  const [radialFlash, setRadialFlash] = useState<string | undefined>(undefined);
  const [masteredCount, setMasteredCount] = useState(0);
  const [totalMistakes, setTotalMistakes] = useState(0);
  const [totalReps, setTotalReps] = useState(0);

  useEffect(() => {
    if (heading && phase === 'active') {
      setShowHeading(true);
    }
  }, [repKey]);

  const updateStats = useCallback(() => {
    const engine = engineRef.current;
    setMasteredCount(engine.getMasteredCount());
    setFirstTryCount(engine.getFirstTryMasteredCount());
    setTotalMistakes(engine.getTotalMistakes());
    setTotalReps((r) => r + 1);
  }, []);

  const startSession = useCallback(() => {
    engineRef.current = new LearningEngine(stage);
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
    setFirstTryCount(0);
    setMasteredCount(0);
    setTotalMistakes(0);
    setTotalReps(0);

    setTimeout(() => {
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
  }, [stage]);

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

  const clearFeedbackAndAdvance = useCallback(() => {
    // If paused or stopped while feedback was showing, don't advance
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
    if (engine.isStageComplete()) {
      completeStage(stage);
      setPhase('complete');
      phaseRef.current = 'complete';
      return;
    }

    // Reset timer to full green circle during inter-rep gap
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
  }, [completeStage, stage]);

  const handleTimeout = useCallback(() => {
    if (disabled || phase !== 'active') return;
    setDisabled(true);
    setTimerRunning(false);
    setFrozenTime(TIMING.LEVEL1_LIMIT);

    const result = sessionRef.current.submitResponse(-1);
    const correctWedge = HEADING_PACKETS[heading]?.wedgeId;
    setHighlightWedge(correctWedge);
    setHighlightColor('green');
    setWedgeOutlineOnly(true);
    setWedgeFillColor(undefined);
    setArrowFill('filled-green');
    setRadialFlash(heading);
    updateStats();

    // Hold feedback then advance
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

      const { result, grade } = sessionRef.current.submitResponse(wedgeId);
      const correctWedge = HEADING_PACKETS[heading]?.wedgeId;

      // Always: green outline on correct wedge + green arrow
      setHighlightWedge(correctWedge);
      setHighlightColor('green');
      setArrowFill('filled-green');

      if (grade === 'wrong' && wedgeId !== correctWedge) {
        setWrongWedge(wedgeId);
        setWedgeOutlineOnly(true);
        setWedgeFillColor(undefined);
      } else if (grade === 'slow') {
        setWedgeOutlineOnly(false);
        setWedgeFillColor('amber');
      } else {
        // Fast: green fill
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
    // Called when amber overlay dismisses
    setFeedback(null);
    clearFeedbackAndAdvance();
  }, [clearFeedbackAndAdvance]);


  const stageName = getStageName(stage);
  const stageSets = getStageSets(stage);
  const engine = engineRef.current;

  if (phase === 'idle') {
    const setIndices = STAGES[stage - 1];
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{stageName}</Text>
        <Text style={styles.setsSubtitle}>{stageSets}</Text>
        <Text style={styles.description}>
          Tap the compass region that correlates{'\n'}to the displayed heading.
        </Text>
        <Text style={styles.subDescription}>Time limit: 2.0s per rep</Text>

        <View style={styles.setList}>
          {setIndices.map((idx) => (
            <View key={idx} style={styles.setRow}>
              <Text style={styles.setLabel}>Set {idx + 1}:</Text>
              <Text style={styles.setHeadings}>{SETS[idx].join('  ')}</Text>
            </View>
          ))}
        </View>

        <Pressable style={styles.primaryBtn} onPress={startSession}>
          <Text style={styles.primaryBtnText}>Start Training</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'complete') {
    const report = engine.getHeadingReport();
    const stageComplete = engine.isStageComplete();

    return (
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{stageName}</Text>
        <Text style={styles.setsSubtitle}>{stageSets}</Text>
        <Text style={[styles.completeText, !stageComplete && { color: '#aabbcc' }]}>
          {stageComplete ? 'Stage Complete!' : 'Session Ended'}
        </Text>
        <Text style={styles.statsLine}>
          First-try mastery: {firstTryCount}/{engine.totalHeadings}
        </Text>
        <Text style={styles.statsDetail}>
          Completed in {totalReps} rep{totalReps === 1 ? '' : 's'}
        </Text>
        {firstTryCount === engine.totalHeadings && (
          <Text style={styles.perfectText}>Perfect run!</Text>
        )}

        <View style={styles.btnRow}>
          <Pressable style={styles.primaryBtn} onPress={startSession}>
            <Text style={styles.primaryBtnText}>Restart</Text>
          </Pressable>
          {stage < 11 && stageComplete && (
            <Pressable
              style={styles.primaryBtn}
              onPress={() => (navigation as any).replace('Learning', { stage: stage + 1 })}
            >
              <Text style={styles.primaryBtnText}>Next Stage</Text>
            </Pressable>
          )}
        </View>
        <Pressable style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryBtnText}>Back to Menu</Text>
        </Pressable>

        {/* Detailed Report */}
        <Text style={styles.reportTitle}>Detailed Report</Text>
        <View style={styles.reportHeader}>
          <Text style={[styles.reportHeaderText, styles.reportColHeading]}>HDG</Text>
          <Text style={[styles.reportHeaderText, styles.reportColStatus]}>Status</Text>
          <Text style={[styles.reportHeaderText, styles.reportColReps]}>Reps</Text>
        </View>
        {report.map((item) => {
          const hasIssues = item.mistakes > 0 || item.slows > 0;
          const statusColor = item.reps === 0
            ? '#555'
            : item.firstTry
              ? '#00e676'
              : item.mistakes > 0
                ? '#ff6b6b'
                : '#ffab00';
          const statusText = item.reps === 0
            ? 'Not seen'
            : item.firstTry
              ? 'First try'
              : item.mistakes > 0 && item.slows > 0
                ? `${item.mistakes} wrong, ${item.slows} slow`
                : item.mistakes > 0
                  ? `${item.mistakes} wrong`
                  : `${item.slows} slow`;

          return (
            <View key={item.heading} style={styles.reportRow}>
              <Text style={[styles.reportCell, styles.reportColHeading, { color: statusColor }]}>
                {item.heading}
              </Text>
              <Text style={[styles.reportCell, styles.reportColStatus, { color: statusColor }]}>
                {statusText}
              </Text>
              <Text style={[styles.reportCell, styles.reportColReps, { color: '#667788' }]}>
                {item.reps > 0 ? `${item.reps}` : '—'}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    );
  }

  // Countdown, Active, and Paused share the same layout so compass doesn't shift
  const isCountdown = phase === 'countdown';
  const isPaused = phase === 'paused';

  return (
    <View style={styles.container}>
      <Text style={styles.topTitle}>{stageName}</Text>
      <Text style={styles.masteredLabel}>
        Mastered: {masteredCount}/{engine.totalHeadings}
      </Text>

      {/* Fixed-height heading area */}
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
        {!isCountdown && (timerRunning || frozenTime != null) && (
          <View style={styles.compassCenter} pointerEvents="none">
            <CountdownTimer
              running={timerRunning}
              onTimeout={handleTimeout}
              frozenTime={frozenTime}
              duration={TIMING.LEVEL1_LIMIT}
              resumeFrom={resumeFrom}
            />
          </View>
        )}
      </View>

      {/* Controls below compass */}
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
        <Pressable style={styles.controlBtn} onPress={startSession}>
          <Text style={styles.controlBtnText}>Restart</Text>
        </Pressable>
        <Pressable style={[styles.controlBtn, styles.stopCtrl]} onPress={stopSession}>
          <Text style={[styles.controlBtnText, styles.stopCtrlText]}>Stop</Text>
        </Pressable>
      </View>

      {/* Paused label over compass */}
      {isPaused && (
        <View style={styles.pausedBadge} pointerEvents="none">
          <Text style={styles.pausedText}>PAUSED</Text>
        </View>
      )}

      {/* Amber overlay only (green/red don't use overlay) */}
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
    fontSize: 22,
    color: '#00d4ff',
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  topTitle: {
    fontSize: 13,
    color: '#00d4ff',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 2,
  },
  masteredLabel: {
    fontSize: 15,
    color: '#00e676',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  headingArea: {
    height: 136,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  compassWrap: {
    position: 'relative',
    alignSelf: 'center',
  },
  compassCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -26 }, { translateY: -26 }],
    zIndex: 50,
  },
  headingPlaceholder: {
    height: 136,
  },
  getReady: {
    fontSize: 24,
    color: '#ffab00',
    fontWeight: '700',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 24,
  },
  controlBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3a4a5a',
  },
  controlBtnText: {
    color: '#aabbcc',
    fontSize: 13,
    fontWeight: '600',
  },
  resumeText: {
    color: '#00e676',
  },
  stopCtrl: {
    borderColor: '#ff5555',
  },
  stopCtrlText: {
    color: '#ff5555',
  },
  pausedBadge: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 15, 35, 0.85)',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    zIndex: 90,
  },
  pausedText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffab00',
    letterSpacing: 4,
  },
  description: {
    fontSize: 16,
    color: '#aabbcc',
    textAlign: 'center',
    marginTop: 60,
    lineHeight: 24,
  },
  setsSubtitle: {
    fontSize: 16,
    color: '#667788',
    fontWeight: '600',
    marginTop: 2,
  },
  subDescription: {
    fontSize: 13,
    color: '#667788',
    marginTop: 12,
  },
  setList: {
    marginTop: 20,
    gap: 8,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setLabel: {
    fontSize: 13,
    color: '#667788',
    fontWeight: '600',
    width: 48,
  },
  setHeadings: {
    fontSize: 14,
    color: '#aabbcc',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  primaryBtn: {
    marginTop: 30,
    backgroundColor: '#00d4ff',
    paddingHorizontal: 36,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f0f23',
  },
  dangerBtn: {
    marginTop: 30,
    borderWidth: 1,
    borderColor: '#ff5555',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
  },
  dangerBtnText: {
    color: '#ff5555',
    fontSize: 18,
    fontWeight: '700',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#3a4a5a',
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 8,
  },
  secondaryBtnText: {
    color: '#aabbcc',
    fontSize: 15,
    fontWeight: '600',
  },
  completeText: {
    fontSize: 22,
    color: '#00e676',
    fontWeight: '700',
    marginTop: 60,
  },
  statsLine: {
    fontSize: 16,
    color: '#aabbcc',
    marginTop: 16,
  },
  perfectText: {
    fontSize: 14,
    color: '#00e676',
    fontWeight: '600',
    marginTop: 4,
  },
  statsDetail: {
    fontSize: 13,
    color: '#667788',
    marginTop: 4,
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  scrollContent: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 40,
  },
  reportTitle: {
    fontSize: 14,
    color: '#667788',
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 28,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  reportHeader: {
    flexDirection: 'row',
    width: 260,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
    marginBottom: 4,
  },
  reportHeaderText: {
    fontSize: 11,
    color: '#556677',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  reportRow: {
    flexDirection: 'row',
    width: 260,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  reportCell: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  reportColHeading: {
    width: 40,
  },
  reportColStatus: {
    flex: 1,
  },
  reportColReps: {
    width: 36,
    textAlign: 'right',
  },
});
