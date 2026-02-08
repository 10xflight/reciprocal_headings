import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface HeadingDisplayProps {
  heading: string;
  size?: 'normal' | 'large' | 'compact';
}

export default function HeadingDisplay({ heading, size = 'normal' }: HeadingDisplayProps) {
  const fontSize = size === 'large' ? 96 : size === 'compact' ? 48 : 72;
  const paddingVertical = size === 'compact' ? 12 : 24;

  return (
    <View style={[styles.container, { paddingVertical }]}>
      <Text style={[styles.heading, { fontSize }]}>{heading}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontWeight: 'bold',
    color: '#ffffff',
    fontVariant: ['tabular-nums'],
    letterSpacing: 8,
  },
});
