import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

interface CountdownTimerProps {
  running: boolean;
  onTimeout: () => void;
  frozenTime?: number | null;
  duration?: number;
  /** Set to resume the timer from a specific elapsed value (e.g. after pause) */
  resumeFrom?: number | null;
  /** Override the stroke color (bypasses time-based color logic) */
  strokeColor?: string;
  /** Hide the seconds text display (ring still shows) */
  hideText?: boolean;
}

const SIZE = 52;
const STROKE_WIDTH = 4;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function getColor(elapsed: number, duration: number): string {
  const ratio = elapsed / duration;
  if (ratio < 0.5) return '#00e676';   // Green: 0-50% (fast zone)
  return '#ffab00';                     // Yellow: 50-100% (slow zone)
}

export default function CountdownTimer({
  running,
  onTimeout,
  frozenTime = null,
  duration = 2000,
  resumeFrom = null,
  strokeColor,
  hideText = false,
}: CountdownTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;
  const timedOutRef = useRef(false);

  useEffect(() => {
    if (frozenTime != null) {
      setElapsed(frozenTime);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    if (!running) {
      setElapsed(0);
      timedOutRef.current = false;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    timedOutRef.current = false;
    // If resuming from a specific time, offset the start accordingly
    const offset = resumeFrom != null ? resumeFrom : 0;
    startRef.current = Date.now() - offset;

    const tick = () => {
      const now = Date.now();
      const e = now - startRef.current;
      setElapsed(e);

      if (e >= duration) {
        if (!timedOutRef.current) {
          timedOutRef.current = true;
          onTimeoutRef.current();
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [running, frozenTime, duration, resumeFrom]);

  const progress = Math.min(elapsed / duration, 1);
  const dashOffset = CIRCUMFERENCE * progress;
  const color = strokeColor ?? getColor(elapsed, duration);

  // Only show time text when frozen at an actual elapsed time (not 0)
  const showTime = frozenTime != null && frozenTime > 0 && !hideText;
  const timeText = showTime ? `${(frozenTime / 1000).toFixed(1)}s` : '';

  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Background circle */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="#1e2a3a"
          strokeWidth={STROKE_WIDTH}
          fill="#0f0f23"
        />
        {/* Progress circle — drains counterclockwise */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          fill="transparent"
          strokeDasharray={`${CIRCUMFERENCE}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
        {showTime && (
          <SvgText
            x={SIZE / 2}
            y={SIZE / 2}
            fill="#ffffff"
            fontSize={11}
            fontWeight="bold"
            textAnchor="middle"
            alignmentBaseline="central"
          >
            {timeText}
          </SvgText>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
});
