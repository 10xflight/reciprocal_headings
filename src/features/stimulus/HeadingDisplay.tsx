import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

interface HeadingDisplayProps {
  heading: string;
  size?: 'normal' | 'large';
}

export default function HeadingDisplay({ heading, size = 'normal' }: HeadingDisplayProps) {
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 150 });
  }, [heading, scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const fontSize = size === 'large' ? 96 : 72;

  return (
    <View style={styles.container}>
      <Animated.View style={animStyle}>
        <Text style={[styles.heading, { fontSize }]}>{heading}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  heading: {
    fontWeight: 'bold',
    color: '#ffffff',
    fontVariant: ['tabular-nums'],
    letterSpacing: 8,
  },
});
