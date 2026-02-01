import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { FeedbackState } from '../../core/types';

const DIRECTION_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const FEEDBACK_COLORS: Record<FeedbackState, string> = {
  green: '#00e676',
  amber: '#ffab00',
  red: '#ff1744',
};

const WEDGE_FILL = '#1e2a3a';
const WEDGE_FILL_TAPPED = '#3a5068';
const WEDGE_STROKE = '#3a4a5a';

interface CompassRoseProps {
  onWedgeTap: (wedgeId: number) => void;
  highlightedWedge?: number;
  highlightColor?: FeedbackState;
  highlightOutlineOnly?: boolean;
  highlightFillColor?: FeedbackState;
  secondHighlight?: { wedgeId: number; color: FeedbackState };
  disabled?: boolean;
  size?: number;
  radialFlash?: { heading: string };
  arrowStyle?: 'filled-green' | 'filled-yellow' | 'outline';
}

function wedgePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

function labelPos(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const mid = (startDeg + endDeg) / 2;
  const rad = ((mid - 90) * Math.PI) / 180;
  return { x: cx + r * 0.62 * Math.cos(rad), y: cy + r * 0.62 * Math.sin(rad) };
}

const WEDGE_ANGLES: { start: number; end: number }[] = [
  { start: 337.5, end: 382.5 },
  { start: 22.5, end: 67.5 },
  { start: 67.5, end: 112.5 },
  { start: 112.5, end: 157.5 },
  { start: 157.5, end: 202.5 },
  { start: 202.5, end: 247.5 },
  { start: 247.5, end: 292.5 },
  { start: 292.5, end: 337.5 },
];

function getWedgeFromPosition(x: number, y: number, cx: number, cy: number, r: number): number {
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > r || dist < 5) return -1;

  let angleDeg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  if (angleDeg < 0) angleDeg += 360;

  if (angleDeg >= 337.5 || angleDeg < 22.5) return 0;
  if (angleDeg < 67.5) return 1;
  if (angleDeg < 112.5) return 2;
  if (angleDeg < 157.5) return 3;
  if (angleDeg < 202.5) return 4;
  if (angleDeg < 247.5) return 5;
  if (angleDeg < 292.5) return 6;
  return 7;
}

/** Convert heading ID ("04") to degrees (40) */
function headingToDegrees(headingId: string): number {
  return parseInt(headingId, 10) * 10;
}

/** Get line endpoint from center at a given compass degree */
function radialEndpoint(cx: number, cy: number, r: number, compassDeg: number) {
  const rad = ((compassDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * Build a swept-back dart/archery arrowhead path at the tip of the radial.
 * The tip sits at the inner edge of the compass arc, pointing outward.
 * The barbs sweep back along the radial line.
 */
function dartArrowPath(cx: number, cy: number, r: number, compassDeg: number): string {
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  const radAngle = toRad(compassDeg);

  // Unit vectors: outward along radial, and perpendicular (tangent)
  const outX = Math.cos(radAngle);
  const outY = Math.sin(radAngle);
  const perpX = -outY;
  const perpY = outX;

  // Tip at the inner arc edge
  const tipX = cx + r * outX;
  const tipY = cy + r * outY;

  const arrowLen = 12;   // total length of arrowhead back from tip
  const barbWidth = 5;   // half-width of barbs
  const notchDepth = 4;  // how deep the notch cuts back in

  // Barb outer points (swept back from tip)
  const barb1X = tipX - arrowLen * outX + barbWidth * perpX;
  const barb1Y = tipY - arrowLen * outY + barbWidth * perpY;
  const barb2X = tipX - arrowLen * outX - barbWidth * perpX;
  const barb2Y = tipY - arrowLen * outY - barbWidth * perpY;

  // Notch point (center back, indented forward from barbs)
  const notchX = tipX - (arrowLen - notchDepth) * outX;
  const notchY = tipY - (arrowLen - notchDepth) * outY;

  return `M ${tipX} ${tipY} L ${barb1X} ${barb1Y} L ${notchX} ${notchY} L ${barb2X} ${barb2Y} Z`;
}

export default function CompassRose({
  onWedgeTap,
  highlightedWedge,
  highlightColor,
  highlightOutlineOnly = false,
  highlightFillColor,
  disabled = false,
  size = 300,
  secondHighlight,
  radialFlash,
  arrowStyle = 'filled-green',
}: CompassRoseProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const [tappedWedge, setTappedWedge] = useState<number | null>(null);

  // Refs so the DOM click handler always reads current values
  const onTapRef = useRef(onWedgeTap);
  const disabledRef = useRef(disabled);
  useEffect(() => { onTapRef.current = onWedgeTap; }, [onWedgeTap]);
  useEffect(() => { disabledRef.current = disabled; }, [disabled]);

  // Clear tapped state when parent resets highlight
  useEffect(() => {
    if (highlightedWedge === undefined) setTappedWedge(null);
  }, [highlightedWedge]);

  const isWeb = Platform.OS === 'web';
  const overlayAttached = useRef(false);

  // Web: transparent overlay DIV on top of SVG captures all clicks
  const attachOverlay = useCallback(
    (node: View | null) => {
      if (!isWeb || !node || overlayAttached.current) return;
      overlayAttached.current = true;

      const parent = node as unknown as HTMLElement;
      const overlay = document.createElement('div');
      overlay.style.position = 'absolute';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.zIndex = '10';
      overlay.style.cursor = 'pointer';

      overlay.addEventListener('click', (e: MouseEvent) => {
        if (disabledRef.current) return;
        const rect = overlay.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const wedgeId = getWedgeFromPosition(x, y, cx, cy, r);
        if (wedgeId >= 0) {
          setTappedWedge(wedgeId);
          onTapRef.current(wedgeId);
        }
      });

      parent.style.position = 'relative';
      parent.appendChild(overlay);
    },
    [isWeb, cx, cy, r],
  );

  // Native: direct handler
  const handleNativePress = useCallback(
    (wedgeId: number) => {
      if (disabled) return;
      setTappedWedge(wedgeId);
      onWedgeTap(wedgeId);
    },
    [disabled, onWedgeTap],
  );

  return (
    <View ref={attachOverlay} style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {WEDGE_ANGLES.map((angles, i) => {
          const isHighlighted = highlightedWedge === i;
          const isSecondHighlight = secondHighlight?.wedgeId === i;
          const isTapped = tappedWedge === i;
          const isActive = isHighlighted || isSecondHighlight || isTapped;

          let fill = WEDGE_FILL;
          if (isHighlighted && highlightColor && !highlightOutlineOnly) {
            fill = FEEDBACK_COLORS[highlightFillColor || highlightColor];
          } else if (isSecondHighlight) {
            fill = FEEDBACK_COLORS[secondHighlight.color];
          } else if (isTapped) {
            fill = WEDGE_FILL_TAPPED;
          }

          // Highlighted or second-highlight wedge gets its color as stroke
          const hasHighlightStroke = (isHighlighted && highlightColor) || isSecondHighlight;

          const d = i === 0
            ? wedgePath(cx, cy, r, 337.5, 382.5)
            : wedgePath(cx, cy, r, angles.start, angles.end);

          const lbl = labelPos(
            cx, cy, r,
            i === 0 ? -22.5 : angles.start,
            i === 0 ? 22.5 : angles.end,
          );

          return (
            <React.Fragment key={i}>
              <Path
                d={d}
                fill={fill}
                stroke={isSecondHighlight ? FEEDBACK_COLORS[secondHighlight!.color] : hasHighlightStroke ? FEEDBACK_COLORS[highlightColor!] : isActive ? '#8aaace' : WEDGE_STROKE}
                strokeWidth={hasHighlightStroke ? 3 : isActive ? 3 : 2}
                fillOpacity={disabled ? 0.4 : isActive ? 1 : 0.7}
                strokeOpacity={hasHighlightStroke ? 1 : disabled ? 0.4 : isActive ? 1 : 0.7}
                onPress={isWeb ? undefined : () => handleNativePress(i)}
              />
              <SvgText
                x={lbl.x}
                y={lbl.y}
                fill="#ffffff"
                fontSize={size * 0.05}
                fontWeight="bold"
                textAnchor="middle"
                alignmentBaseline="central"
                pointerEvents="none"
              >
                {DIRECTION_LABELS[i]}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Flash radial line + dart arrow for current heading */}
        {radialFlash && (() => {
          const deg = headingToDegrees(radialFlash.heading);
          const end = radialEndpoint(cx, cy, r, deg);
          const arrowD = dartArrowPath(cx, cy, r, deg);
          return (
            <>
              <Line
                x1={cx}
                y1={cy}
                x2={end.x}
                y2={end.y}
                stroke="#00e676"
                strokeWidth={3}
                opacity={0.8}
              />
              <Path
                d={arrowD}
                fill={arrowStyle === 'filled-green' ? '#00e676' : arrowStyle === 'filled-yellow' ? '#ffab00' : 'none'}
                stroke="#00e676"
                strokeWidth={arrowStyle === 'outline' ? 1.5 : 0}
                opacity={0.9}
              />
            </>
          );
        })()}

        <Circle cx={cx} cy={cy} r={3} fill="#ffffff" opacity={0.5} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
  },
});
