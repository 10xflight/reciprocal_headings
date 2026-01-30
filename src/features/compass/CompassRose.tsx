import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Text as SvgText, G } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { FeedbackState } from '../../core/types';

const DIRECTION_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const FEEDBACK_COLORS: Record<FeedbackState, string> = {
  green: '#00e676',
  amber: '#ffab00',
  red: '#ff1744',
};

const WEDGE_FILL = '#1e2a3a';
const WEDGE_STROKE = '#3a4a5a';

interface CompassRoseProps {
  onWedgeTap: (wedgeId: number) => void;
  highlightedWedge?: number;
  highlightColor?: FeedbackState;
  disabled?: boolean;
  size?: number;
}

/**
 * Build an SVG arc path for a wedge.
 * center = (cx, cy), from startAngle to endAngle (degrees, 0 = top/north, clockwise).
 */
function wedgePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

/** Midpoint angle for label placement. */
function labelPos(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const mid = (startDeg + endDeg) / 2;
  const rad = ((mid - 90) * Math.PI) / 180;
  return { x: cx + r * 0.62 * Math.cos(rad), y: cy + r * 0.62 * Math.sin(rad) };
}

// Wedge angular spans (degrees). North straddles 0, so it goes 337.5–22.5 etc.
// Using 8 equal 45° wedges, but offset so North is centered on 0°.
const WEDGE_ANGLES: { start: number; end: number }[] = [
  { start: 337.5, end: 382.5 }, // North (wraps around 360)
  { start: 22.5, end: 67.5 },   // NE
  { start: 67.5, end: 112.5 },  // E
  { start: 112.5, end: 157.5 }, // SE
  { start: 157.5, end: 202.5 }, // S
  { start: 202.5, end: 247.5 }, // SW
  { start: 247.5, end: 292.5 }, // W
  { start: 292.5, end: 337.5 }, // NW
];

const AnimatedView = Animated.createAnimatedComponent(View);

export default function CompassRose({
  onWedgeTap,
  highlightedWedge,
  highlightColor,
  disabled = false,
  size = 300,
}: CompassRoseProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(
    (wedgeId: number) => {
      if (disabled) return;
      scale.value = withSequence(withTiming(0.96, { duration: 60 }), withTiming(1, { duration: 100 }));
      onWedgeTap(wedgeId);
    },
    [disabled, onWedgeTap, scale],
  );

  return (
    <AnimatedView style={[styles.container, { width: size, height: size }, animStyle]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {WEDGE_ANGLES.map((angles, i) => {
          // North wedge wraps around 360; split into two arcs
          const isHighlighted = highlightedWedge === i;
          const fill = isHighlighted && highlightColor ? FEEDBACK_COLORS[highlightColor] : WEDGE_FILL;

          let d: string;
          if (i === 0) {
            // North: draw two arcs (337.5→360 and 0→22.5) combined
            const d1 = wedgePath(cx, cy, r, 337.5, 360);
            const d2 = wedgePath(cx, cy, r, 0, 22.5);
            d = d1; // Use single path with full span
            // Actually easier: treat 337.5 → 382.5 and let trig handle it
            d = wedgePath(cx, cy, r, 337.5, 382.5);
          } else {
            d = wedgePath(cx, cy, r, angles.start, angles.end);
          }

          const lbl = labelPos(
            cx,
            cy,
            r,
            i === 0 ? -22.5 : angles.start,
            i === 0 ? 22.5 : angles.end,
          );

          return (
            <G key={i} onPress={() => handlePress(i)}>
              <Path
                d={d}
                fill={fill}
                stroke={WEDGE_STROKE}
                strokeWidth={1.5}
                opacity={disabled ? 0.4 : isHighlighted ? 0.9 : 0.7}
              />
              <SvgText
                x={lbl.x}
                y={lbl.y}
                fill="#ffffff"
                fontSize={size * 0.05}
                fontWeight="bold"
                textAnchor="middle"
                alignmentBaseline="central"
              >
                {DIRECTION_LABELS[i]}
              </SvgText>
            </G>
          );
        })}

        {/* Center dot */}
        <Path
          d={`M ${cx - 3} ${cy} a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0`}
          fill="#ffffff"
          opacity={0.5}
        />
      </Svg>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
  },
});
