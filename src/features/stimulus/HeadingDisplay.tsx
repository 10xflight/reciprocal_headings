import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface HeadingDisplayProps {
  heading: string;
  size?: 'normal' | 'large';
}

export default function HeadingDisplay({ heading, size = 'normal' }: HeadingDisplayProps) {
  const fontSize = size === 'large' ? 96 : 72;

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { fontSize }]}>{heading}</Text>
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
