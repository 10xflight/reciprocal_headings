import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  SharedValue,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { CompassDirection, FeedbackState, TIMING } from '../../core/types';

interface FeedbackOverlayProps {
  state: FeedbackState | null;
  correctAnswer?: { reciprocal: string; direction: CompassDirection };
  message?: string;
  onAnimationComplete: () => void;
}

const COLORS: Record<FeedbackState, string> = {
  green: 'rgba(0, 230, 118, 0.25)',
  amber: 'rgba(255, 171, 0, 0.25)',
  red: 'rgba(255, 23, 68, 0.25)',
};

const TEXT_COLORS: Record<FeedbackState, string> = {
  green: '#00e676',
  amber: '#ffab00',
  red: '#ff1744',
};

export default function FeedbackOverlay({
  state,
  correctAnswer,
  message,
  onAnimationComplete,
}: FeedbackOverlayProps) {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (!state) return;

    if (state === 'red') {
      // Shake animation
      translateX.value = withSequence(
        withTiming(12, { duration: 50 }),
        withTiming(-12, { duration: 50 }),
        withTiming(8, { duration: 50 }),
        withTiming(-8, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
    }

    // Fade in, hold, fade out
    const fadeIn = state === 'green' ? 200 : 300;
    const hold = TIMING.INTER_REP_DELAY - fadeIn - 200;

    opacity.value = withSequence(
      withTiming(1, { duration: fadeIn, easing: Easing.out(Easing.ease) }),
      withDelay(hold, withTiming(0, { duration: 200 }, (finished) => {
        if (finished) {
          runOnJS(onAnimationComplete)();
        }
      })),
    );
  }, [state, opacity, translateX, onAnimationComplete]);

  if (!state) return null;

  return (
    <AnimatedOverlay
      opacity={opacity}
      translateX={translateX}
      state={state}
      correctAnswer={correctAnswer}
      message={message}
    />
  );
}

function AnimatedOverlay({
  opacity,
  translateX,
  state,
  correctAnswer,
  message,
}: {
  opacity: SharedValue<number>;
  translateX: SharedValue<number>;
  state: FeedbackState;
  correctAnswer?: { reciprocal: string; direction: CompassDirection };
  message?: string;
}) {
  const bgStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={[styles.overlay, { backgroundColor: COLORS[state] }, bgStyle]}>
      <Animated.View style={[styles.content, contentStyle]}>
        {state === 'green' && <Text style={[styles.icon, { color: TEXT_COLORS.green }]}>✓</Text>}

        {state === 'amber' && (
          <Text style={[styles.message, { color: TEXT_COLORS.amber }]}>
            {message || 'Too Slow'}
          </Text>
        )}

        {state === 'red' && correctAnswer && (
          <View style={styles.answerContainer}>
            <Text style={[styles.answerNumber, { color: TEXT_COLORS.red }]}>
              {correctAnswer.reciprocal}
            </Text>
            <Text style={[styles.answerDirection, { color: TEXT_COLORS.red }]}>
              {correctAnswer.direction}
            </Text>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  content: {
    alignItems: 'center',
  },
  icon: {
    fontSize: 72,
    fontWeight: 'bold',
  },
  message: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  answerContainer: {
    alignItems: 'center',
  },
  answerNumber: {
    fontSize: 56,
    fontWeight: 'bold',
  },
  answerDirection: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: 8,
  },
});
