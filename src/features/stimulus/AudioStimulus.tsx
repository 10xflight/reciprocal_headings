import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface AudioStimulusProps {
  heading: string;
  onPlayComplete: () => void;
}

/**
 * Level 4: Dark screen with a subtle listening indicator.
 * The parent is responsible for triggering audio playback;
 * this component just provides the visual.
 */
export default function AudioStimulus({ heading, onPlayComplete }: AudioStimulusProps) {
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);

  // Simulate audio completion for now — real implementation will use AudioManager
  useEffect(() => {
    const timer = setTimeout(onPlayComplete, 1200);
    return () => clearTimeout(timer);
  }, [heading, onPlayComplete]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.8 + pulse.value * 0.2 }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.indicator, pulseStyle]}>
        <View style={styles.circle} />
      </Animated.View>
      <Text style={styles.listeningText}>Listening...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    marginBottom: 24,
  },
  circle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00d4ff',
  },
  listeningText: {
    fontSize: 14,
    color: '#555',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
