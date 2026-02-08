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
  /** Size of the timer ring (default 52) */
  size?: number;
  /** Stroke width (default 4) */
  strokeWidth?: number;
}

const DEFAULT_SIZE = 52;
const DEFAULT_STROKE_WIDTH = 4;

function getColor(elapsed: number, duration: number): string {
  const ratio = elapsed / duration;
  if (ratio < 0.6) return '#00e676';   // Green: 0-60% (reflex zone)
  return '#ffab00';                     // Amber: 60-100% (hesitation zone)
}

export default function CountdownTimer({
  running,
  onTimeout,
  frozenTime = null,
  duration = 2000,
  resumeFrom = null,
  strokeColor,
  hideText = false,
  size = DEFAULT_SIZE,
  strokeWidth = DEFAULT_STROKE_WIDTH,
}: CountdownTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;
  const timedOutRef = useRef(false);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

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
  const dashOffset = circumference * progress;
  const color = strokeColor ?? getColor(elapsed, duration);

  // Only show time text when frozen at an actual elapsed time (not 0)
  const showTime = frozenTime != null && frozenTime > 0 && !hideText;
  const timeText = showTime ? `${(frozenTime / 1000).toFixed(1)}s` : '';

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#1e2a3a"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress circle — drains counterclockwise */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
        {showTime && (
          <SvgText
            x={size / 2}
            y={size / 2}
            fill="#ffffff"
            fontSize={size * 0.21}
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
