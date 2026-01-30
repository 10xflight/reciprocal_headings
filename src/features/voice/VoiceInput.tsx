import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { getVoiceService } from './getVoiceService';
import { parseVoiceResponse, assessConfidence, ParsedResponse } from './ResponseParser';

type VoiceState = 'idle' | 'listening' | 'processing' | 'complete';

interface VoiceInputProps {
  onResult: (response: ParsedResponse, confidence: 'high' | 'low') => void;
  onTimeout: () => void;
  timeLimit: number;
  level: number;
  active: boolean;
}

export default function VoiceInput({
  onResult,
  onTimeout,
  timeLimit,
  level,
  active,
}: VoiceInputProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [partialText, setPartialText] = useState('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const pulse = useSharedValue(0.4);

  useEffect(() => {
    if (voiceState === 'listening') {
      pulse.value = withRepeat(
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      pulse.value = withTiming(0.4, { duration: 200 });
    }
  }, [voiceState, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.85 + pulse.value * 0.15 }],
  }));

  const startListening = useCallback(async () => {
    const service = getVoiceService();
    const available = await service.isAvailable();
    if (!available) {
      onResult({ number: null, direction: null, raw: '' }, 'low');
      return;
    }

    setVoiceState('listening');
    setPartialText('');

    service.onPartialResult = (text) => {
      setPartialText(text);
    };

    await service.start();

    // Timeout
    timeoutRef.current = setTimeout(async () => {
      if (!activeRef.current) return;
      setVoiceState('processing');
      const result = await service.stop();
      if (!activeRef.current) return;

      if (result && result.text) {
        const expectThree = level === 5;
        const parsed = parseVoiceResponse(result.text, expectThree);
        const confidence = assessConfidence(result.confidence, parsed);
        setVoiceState('complete');
        onResult(parsed, confidence);
      } else {
        setVoiceState('complete');
        onTimeout();
      }
    }, timeLimit);
  }, [level, timeLimit, onResult, onTimeout]);

  useEffect(() => {
    if (active) {
      startListening();
    } else {
      // Cleanup
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      const service = getVoiceService();
      service.cancel();
      setVoiceState('idle');
      setPartialText('');
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [active, startListening]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.micContainer, pulseStyle]}>
        <View
          style={[
            styles.micCircle,
            voiceState === 'listening' && styles.micActive,
            voiceState === 'processing' && styles.micProcessing,
          ]}
        />
      </Animated.View>

      <Text style={styles.stateText}>
        {voiceState === 'idle' && 'Ready'}
        {voiceState === 'listening' && 'Listening...'}
        {voiceState === 'processing' && 'Processing...'}
        {voiceState === 'complete' && 'Done'}
      </Text>

      {partialText.length > 0 && (
        <Text style={styles.partialText}>{partialText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  micContainer: {
    marginBottom: 16,
  },
  micCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#333',
  },
  micActive: {
    backgroundColor: '#00d4ff',
  },
  micProcessing: {
    backgroundColor: '#ffab00',
  },
  stateText: {
    fontSize: 14,
    color: '#888',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  partialText: {
    fontSize: 18,
    color: '#aaa',
    marginTop: 12,
    fontStyle: 'italic',
  },
});
