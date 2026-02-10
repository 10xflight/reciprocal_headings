import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Text, PanResponder, GestureResponderEvent, Platform } from 'react-native';
import Svg, { Circle, Path, G, Text as SvgText, Line } from 'react-native-svg';

// Types
export interface WedgeFirstInputProps {
  heading: string;
  onAnswer: (selectedHeading: string, wedgeId: number, elapsed: number) => void;
  disabled?: boolean;
  timerProgress: number; // 0-1
  timerColor: string;
  feedbackState?: {
    correct: boolean;
    fast: boolean;
  } | null;
  showFeedback?: boolean;
  centerText?: string; // "Ready" during countdown
  correctAnswer?: string; // e.g., "18 South" - shown when wrong
}

// Constants - sized to fit expanded wedges
const SIZE = 450;
const CENTER = SIZE / 2;

// Ring dimensions
const HEADING_RADIUS = 45;
const TIMER_RING_WIDTH = 8;
const CENTER_MASK_RADIUS = 60; // Solid mask behind timer

// Solid wedges (pie slices from center mask to outer edge)
const WEDGE_INNER = CENTER_MASK_RADIUS; // Start just outside center
const WEDGE_OUTER = 165; // Matches CircularInput COMPASS_OUTER

// Expanded wedge has an outer ring for heading buttons
const HEADING_RING_INNER = WEDGE_OUTER; // Outer ring starts where wedge ends
const HEADING_RING_OUTER = 220; // ~1/3 longer than wedge outer

// Colors
const WEDGE_FILL = '#1e2a3a';
const WEDGE_FILL_HOVER = '#3a5068';
const WEDGE_FILL_DIMMED = '#151d28';
const WEDGE_STROKE = '#3a4a5a';
const HEADING_BUTTON_FILL = '#0d1520';
const HEADING_BUTTON_FILL_HOVER = 'rgba(0, 212, 255, 0.3)';
const HEADING_BUTTON_STROKE = '#3a4a5a';
const FEEDBACK_COLORS = {
  green: '#00e676',
  amber: '#ffab00',
  red: '#ff1744',
};

// Direction labels and headings per wedge
const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const DIRECTION_LABELS: Record<string, string> = {
  'N': 'North',
  'NE': 'North East',
  'E': 'East',
  'SE': 'South East',
  'S': 'South',
  'SW': 'South West',
  'W': 'West',
  'NW': 'North West',
};
const WEDGE_HEADINGS: Record<number, string[]> = {
  0: ['34', '35', '36', '01', '02'], // N
  1: ['03', '04', '05', '06'],       // NE
  2: ['07', '08', '09', '10', '11'], // E
  3: ['12', '13', '14', '15'],       // SE
  4: ['16', '17', '18', '19', '20'], // S
  5: ['21', '22', '23', '24'],       // SW
  6: ['25', '26', '27', '28', '29'], // W
  7: ['30', '31', '32', '33'],       // NW
};

const WEDGE_ANGLE = 360 / 8; // 45 degrees per wedge

// Convert polar to cartesian
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

// Create arc path for a ring segment
function createArcPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number
): string {
  const start1 = polarToCartesian(cx, cy, outerR, startAngle);
  const end1 = polarToCartesian(cx, cy, outerR, endAngle);
  const start2 = polarToCartesian(cx, cy, innerR, endAngle);
  const end2 = polarToCartesian(cx, cy, innerR, startAngle);

  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${start1.x} ${start1.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${end1.x} ${end1.y}`,
    `L ${start2.x} ${start2.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${end2.x} ${end2.y}`,
    'Z',
  ].join(' ');
}

// Get wedge index from angle
function getWedgeFromAngle(angle: number): number {
  let normalized = ((angle % 360) + 360) % 360;
  const shifted = (normalized + WEDGE_ANGLE / 2) % 360;
  return Math.floor(shifted / WEDGE_ANGLE);
}

// Get angle and distance from center
function getAngleAndDistance(x: number, y: number, cx: number, cy: number) {
  const dx = x - cx;
  const dy = y - cy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  if (angle < 0) angle += 360;
  return { angle, distance };
}

// Get radial endpoint from center at a given wedge index
function radialEndpoint(cx: number, cy: number, r: number, wedgeIndex: number) {
  const compassDeg = wedgeIndex * WEDGE_ANGLE;
  const rad = ((compassDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Build a swept-back dart arrowhead path
function dartArrowPath(cx: number, cy: number, r: number, headingStr: string): string {
  // Calculate angle based on heading
  const headingNum = parseInt(headingStr, 10);
  const compassDeg = (headingNum * 10) % 360; // Convert heading to degrees
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  const radAngle = toRad(compassDeg);

  const outX = Math.cos(radAngle);
  const outY = Math.sin(radAngle);
  const perpX = -outY;
  const perpY = outX;

  const tipX = cx + r * outX;
  const tipY = cy + r * outY;

  const arrowLen = 12;
  const barbWidth = 5;
  const notchDepth = 4;

  const barb1X = tipX - arrowLen * outX + barbWidth * perpX;
  const barb1Y = tipY - arrowLen * outY + barbWidth * perpY;
  const barb2X = tipX - arrowLen * outX - barbWidth * perpX;
  const barb2Y = tipY - arrowLen * outY - barbWidth * perpY;

  const notchX = tipX - (arrowLen - notchDepth) * outX;
  const notchY = tipY - (arrowLen - notchDepth) * outY;

  return `M ${tipX} ${tipY} L ${barb1X} ${barb1Y} L ${notchX} ${notchY} L ${barb2X} ${barb2Y} Z`;
}

// Get heading button from angle within the outer ring of an expanded wedge
function getHeadingButtonFromAngle(
  angle: number,
  distance: number,
  expandedWedge: number
): string | null {
  // Must be within the outer heading ring
  if (distance < HEADING_RING_INNER - 5 || distance > HEADING_RING_OUTER + 5) {
    return null;
  }

  const headings = WEDGE_HEADINGS[expandedWedge];
  const wedgeStartAngle = expandedWedge * WEDGE_ANGLE - WEDGE_ANGLE / 2;

  // Normalize angle to wedge range
  let normalizedAngle = angle;
  if (normalizedAngle < wedgeStartAngle - 10) normalizedAngle += 360;
  if (normalizedAngle > wedgeStartAngle + WEDGE_ANGLE + 10) normalizedAngle -= 360;

  // Check if within wedge angle bounds
  if (normalizedAngle < wedgeStartAngle || normalizedAngle > wedgeStartAngle + WEDGE_ANGLE) {
    return null;
  }

  // Calculate which heading button based on angle within wedge
  const angleWithinWedge = normalizedAngle - wedgeStartAngle;
  const buttonAngle = WEDGE_ANGLE / headings.length;
  const buttonIndex = Math.floor(angleWithinWedge / buttonAngle);

  if (buttonIndex >= 0 && buttonIndex < headings.length) {
    return headings[buttonIndex];
  }
  return null;
}

export default function WedgeFirstInput({
  heading,
  onAnswer,
  disabled = false,
  timerProgress,
  timerColor,
  feedbackState,
  showFeedback = false,
  centerText,
  correctAnswer,
}: WedgeFirstInputProps) {
  const svgContainerRef = useRef<View>(null);
  const [containerLayout, setContainerLayout] = useState({ x: 0, y: 0, width: SIZE, height: SIZE });

  // State
  const [expandedWedge, setExpandedWedge] = useState<number | null>(null);
  const [hoveredWedge, setHoveredWedge] = useState<number | null>(null);
  const [hoveredHeading, setHoveredHeading] = useState<string | null>(null);
  const [selectedHeading, setSelectedHeading] = useState<string | null>(null);
  const [selectedWedge, setSelectedWedge] = useState<number | null>(null);
  const [submittedAnswer, setSubmittedAnswer] = useState<string>(''); // Full answer text

  // Reset when heading changes
  useEffect(() => {
    setExpandedWedge(null);
    setHoveredWedge(null);
    setHoveredHeading(null);
    setSelectedHeading(null);
    setSelectedWedge(null);
    setSubmittedAnswer('');
  }, [heading]);

  // Reset when feedback ends
  const prevShowFeedback = useRef(showFeedback);
  useEffect(() => {
    if (prevShowFeedback.current && !showFeedback) {
      setExpandedWedge(null);
      setHoveredWedge(null);
      setHoveredHeading(null);
      setSelectedHeading(null);
      setSelectedWedge(null);
      setSubmittedAnswer('');
    }
    prevShowFeedback.current = showFeedback;
  }, [showFeedback]);

  // Get position relative to SVG center
  const getRelativePosition = useCallback((pageX: number, pageY: number) => {
    const x = pageX - containerLayout.x - CENTER;
    const y = pageY - containerLayout.y - CENTER;
    return { x, y };
  }, [containerLayout]);

  const handlePointerDown = useCallback((pageX: number, pageY: number) => {
    if (disabled || showFeedback) return;

    const { x, y } = getRelativePosition(pageX, pageY);
    const { angle, distance } = getAngleAndDistance(x, y, 0, 0);

    if (expandedWedge !== null) {
      // Check if tapping a heading button
      const headingHit = getHeadingButtonFromAngle(angle, distance, expandedWedge);
      if (headingHit) {
        setHoveredHeading(headingHit);
      }
    } else {
      // Check if tapping a wedge
      if (distance >= WEDGE_INNER && distance <= WEDGE_OUTER) {
        const wedgeIndex = getWedgeFromAngle(angle);
        setHoveredWedge(wedgeIndex);
      }
    }
  }, [disabled, showFeedback, getRelativePosition, expandedWedge]);

  const handlePointerMove = useCallback((pageX: number, pageY: number) => {
    if (disabled || showFeedback) return;

    const { x, y } = getRelativePosition(pageX, pageY);
    const { angle, distance } = getAngleAndDistance(x, y, 0, 0);

    if (expandedWedge !== null) {
      const headingHit = getHeadingButtonFromAngle(angle, distance, expandedWedge);
      setHoveredHeading(headingHit);
    } else {
      if (distance >= WEDGE_INNER && distance <= WEDGE_OUTER) {
        const wedgeIndex = getWedgeFromAngle(angle);
        setHoveredWedge(wedgeIndex);
      } else {
        setHoveredWedge(null);
      }
    }
  }, [disabled, showFeedback, getRelativePosition, expandedWedge]);

  const handlePointerUp = useCallback((pageX: number, pageY: number) => {
    if (disabled || showFeedback) return;

    const { x, y } = getRelativePosition(pageX, pageY);
    const { angle, distance } = getAngleAndDistance(x, y, 0, 0);

    if (expandedWedge !== null) {
      // Check if tapping a heading button
      const headingHit = getHeadingButtonFromAngle(angle, distance, expandedWedge);
      if (headingHit) {
        // Submit answer
        setSelectedHeading(headingHit);
        setSelectedWedge(expandedWedge);
        // Build submitted answer text: "18 South"
        const dirLabel = DIRECTION_LABELS[DIRECTIONS[expandedWedge]];
        setSubmittedAnswer(`${headingHit} ${dirLabel}`);
        onAnswer(headingHit, expandedWedge, 0); // elapsed will be calculated by parent
      } else {
        // Tapped outside - collapse without penalty
        setExpandedWedge(null);
      }
    } else {
      // Check if tapping a wedge to expand
      if (distance >= WEDGE_INNER && distance <= WEDGE_OUTER) {
        const wedgeIndex = getWedgeFromAngle(angle);
        setExpandedWedge(wedgeIndex);
      }
    }

    setHoveredWedge(null);
    setHoveredHeading(null);
  }, [disabled, showFeedback, getRelativePosition, expandedWedge, onAnswer]);

  // Measure SVG container position
  const onLayout = useCallback(() => {
    if (svgContainerRef.current) {
      (svgContainerRef.current as any).measure?.(
        (_x: number, _y: number, width: number, height: number, pageX: number, pageY: number) => {
          setContainerLayout({ x: pageX, y: pageY, width, height });
        }
      );
    }
  }, []);

  // Use refs for handlers to avoid stale closures
  const handlersRef = useRef({
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  });
  handlersRef.current = { handlePointerDown, handlePointerMove, handlePointerUp };

  // PanResponder for cross-platform gesture handling
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        handlersRef.current.handlePointerDown(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        handlersRef.current.handlePointerMove(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
      },
      onPanResponderRelease: (evt: GestureResponderEvent) => {
        handlersRef.current.handlePointerUp(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
      },
      onPanResponderTerminate: () => {
        setHoveredWedge(null);
        setHoveredHeading(null);
      },
    })
  ).current;

  // Timer ring
  const timerRadius = HEADING_RADIUS + TIMER_RING_WIDTH / 2 + 2;
  const timerCircumference = 2 * Math.PI * timerRadius;
  const timerOffset = timerCircumference * timerProgress;

  // Render collapsed wedges
  const renderCollapsedWedges = () => {
    return DIRECTIONS.map((dir, i) => {
      const isExpanded = expandedWedge === i;
      const isHovered = hoveredWedge === i;
      const isDimmed = expandedWedge !== null && !isExpanded;

      if (isExpanded) return null; // Don't render collapsed version of expanded wedge

      const startAngle = i * WEDGE_ANGLE - WEDGE_ANGLE / 2;
      const endAngle = startAngle + WEDGE_ANGLE;
      const path = createArcPath(CENTER, CENTER, WEDGE_INNER, WEDGE_OUTER, startAngle, endAngle);

      let fill = WEDGE_FILL;
      if (isDimmed) fill = WEDGE_FILL_DIMMED;
      if (isHovered) fill = WEDGE_FILL_HOVER;

      const midAngle = i * WEDGE_ANGLE;
      const labelPos = polarToCartesian(CENTER, CENTER, (WEDGE_INNER + WEDGE_OUTER) / 2, midAngle);

      return (
        <G key={`wedge-${dir}`}>
          <Path
            d={path}
            fill={fill}
            stroke={WEDGE_STROKE}
            strokeWidth={2}
          />
          <SvgText
            x={labelPos.x}
            y={labelPos.y}
            fill={isDimmed ? '#556677' : '#ffffff'}
            fontSize={14}
            fontWeight="600"
            textAnchor="middle"
            alignmentBaseline="central"
          >
            {dir}
          </SvgText>
        </G>
      );
    });
  };

  // Render expanded wedge with heading buttons in outer ring
  const renderExpandedWedge = () => {
    if (expandedWedge === null) return null;

    const headings = WEDGE_HEADINGS[expandedWedge];
    const dir = DIRECTIONS[expandedWedge];

    const startAngle = expandedWedge * WEDGE_ANGLE - WEDGE_ANGLE / 2;
    const endAngle = startAngle + WEDGE_ANGLE;

    // Base wedge (same as collapsed but highlighted)
    const basePath = createArcPath(CENTER, CENTER, WEDGE_INNER, WEDGE_OUTER, startAngle, endAngle);

    // Heading buttons in outer ring, divided angularly
    const buttonAngle = WEDGE_ANGLE / headings.length;

    return (
      <G>
        {/* Base wedge (highlighted) */}
        <Path
          d={basePath}
          fill={WEDGE_FILL_HOVER}
          stroke="#8aaace"
          strokeWidth={2}
        />

        {/* Direction label in base wedge */}
        {(() => {
          const midAngle = expandedWedge * WEDGE_ANGLE;
          const labelPos = polarToCartesian(CENTER, CENTER, (WEDGE_INNER + WEDGE_OUTER) / 2, midAngle);
          return (
            <SvgText
              x={labelPos.x}
              y={labelPos.y}
              fill="#ffffff"
              fontSize={16}
              fontWeight="700"
              textAnchor="middle"
              alignmentBaseline="central"
            >
              {dir}
            </SvgText>
          );
        })()}

        {/* Heading buttons in outer ring */}
        {headings.map((h, idx) => {
          const btnStart = startAngle + idx * buttonAngle;
          const btnEnd = btnStart + buttonAngle;
          // Buttons are in the outer ring
          const btnPath = createArcPath(CENTER, CENTER, HEADING_RING_INNER, HEADING_RING_OUTER, btnStart, btnEnd);

          const isHovered = hoveredHeading === h;
          const isSelected = selectedHeading === h;

          let btnFill = HEADING_BUTTON_FILL;
          let btnStroke = HEADING_BUTTON_STROKE;
          let textColor = '#ffffff';

          if (isHovered) {
            btnFill = HEADING_BUTTON_FILL_HOVER;
            btnStroke = '#00d4ff';
          }

          if (showFeedback && isSelected && feedbackState) {
            if (feedbackState.correct) {
              btnFill = feedbackState.fast ? 'rgba(0, 230, 118, 0.6)' : 'rgba(255, 171, 0, 0.6)';
              btnStroke = feedbackState.fast ? FEEDBACK_COLORS.green : FEEDBACK_COLORS.amber;
              textColor = feedbackState.fast ? FEEDBACK_COLORS.green : FEEDBACK_COLORS.amber;
            } else {
              btnFill = 'rgba(255, 23, 68, 0.6)';
              btnStroke = FEEDBACK_COLORS.red;
              textColor = FEEDBACK_COLORS.red;
            }
          }

          const btnMidAngle = btnStart + buttonAngle / 2;
          const labelPos = polarToCartesian(CENTER, CENTER, (HEADING_RING_INNER + HEADING_RING_OUTER) / 2, btnMidAngle);

          return (
            <G key={`heading-btn-${h}`}>
              <Path
                d={btnPath}
                fill={btnFill}
                stroke={btnStroke}
                strokeWidth={2}
              />
              <SvgText
                x={labelPos.x}
                y={labelPos.y}
                fill={textColor}
                fontSize={14}
                fontWeight="700"
                textAnchor="middle"
                alignmentBaseline="central"
              >
                {h}
              </SvgText>
            </G>
          );
        })}
      </G>
    );
  };

  // Render radial line + arrow for correct answer (stops at main compass edge)
  const renderRadialArrow = () => {
    if (!showFeedback || !feedbackState || !selectedHeading) return null;

    const headingNum = parseInt(selectedHeading, 10);
    const compassDeg = (headingNum * 10) % 360;
    const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
    const radAngle = toRad(compassDeg);

    const endX = CENTER + WEDGE_OUTER * Math.cos(radAngle);
    const endY = CENTER + WEDGE_OUTER * Math.sin(radAngle);

    const arrowD = dartArrowPath(CENTER, CENTER, WEDGE_OUTER, selectedHeading);
    const arrowColor = feedbackState.correct ? FEEDBACK_COLORS.green : FEEDBACK_COLORS.red;

    return (
      <>
        <Line
          x1={CENTER}
          y1={CENTER}
          x2={endX}
          y2={endY}
          stroke={arrowColor}
          strokeWidth={3}
        />
        <Path
          d={arrowD}
          fill={arrowColor}
          stroke={arrowColor}
          strokeWidth={1}
        />
      </>
    );
  };

  // Get feedback box styling
  const getAnswerBoxStyle = () => {
    if (!showFeedback || !feedbackState) {
      return null;
    }

    if (feedbackState.correct && feedbackState.fast) {
      return {
        borderColor: FEEDBACK_COLORS.green,
        backgroundColor: 'rgba(0, 230, 118, 0.2)',
        textColor: FEEDBACK_COLORS.green,
      };
    } else if (feedbackState.correct) {
      return {
        borderColor: FEEDBACK_COLORS.green,
        backgroundColor: 'rgba(255, 171, 0, 0.2)',
        textColor: FEEDBACK_COLORS.amber,
      };
    } else {
      return {
        borderColor: FEEDBACK_COLORS.red,
        backgroundColor: 'rgba(255, 23, 68, 0.2)',
        textColor: FEEDBACK_COLORS.red,
      };
    }
  };

  const answerBoxStyle = getAnswerBoxStyle();
  // Show submitted answer if correct, correct answer if wrong
  const feedbackText = showFeedback && feedbackState
    ? (feedbackState.correct ? submittedAnswer : correctAnswer)
    : null;

  return (
    <View style={styles.container}>
      {/* Feedback box - only visible after submission */}
      {answerBoxStyle && feedbackText ? (
        <View style={[
          styles.feedbackBox,
          {
            borderColor: answerBoxStyle.borderColor,
            backgroundColor: answerBoxStyle.backgroundColor,
          }
        ]}>
          <Text style={[styles.feedbackText, { color: answerBoxStyle.textColor }]}>
            {feedbackText}
          </Text>
        </View>
      ) : (
        <View style={styles.feedbackPlaceholder} />
      )}

      {/* Main circular interface */}
      <View
        ref={svgContainerRef}
        style={styles.svgContainer}
        onLayout={onLayout}
        {...panResponder.panHandlers}
      >
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Layer 1: Collapsed wedges */}
          <G>{renderCollapsedWedges()}</G>

          {/* Layer 2: Expanded wedge (on top) */}
          {renderExpandedWedge()}

          {/* Layer 3: Radial arrow (feedback) */}
          {renderRadialArrow()}

          {/* Layer 4: Solid mask behind timer/center */}
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={WEDGE_INNER}
            fill="#0f0f23"
          />

          {/* Layer 5: Timer ring background */}
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={timerRadius}
            stroke="#1e2a3a"
            strokeWidth={TIMER_RING_WIDTH}
            fill="transparent"
          />

          {/* Layer 6: Timer ring progress */}
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={timerRadius}
            stroke={timerColor}
            strokeWidth={TIMER_RING_WIDTH}
            fill="transparent"
            strokeDasharray={timerCircumference}
            strokeDashoffset={timerOffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${CENTER}, ${CENTER}`}
          />

          {/* Layer 7: Center circle */}
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={HEADING_RADIUS}
            fill="#0f0f23"
            stroke="#3a4a5a"
            strokeWidth={2}
          />

          {/* Layer 8: Center text (heading or "Ready") */}
          {centerText ? (
            <SvgText
              x={CENTER}
              y={CENTER}
              fill="#ffab00"
              fontSize={18}
              fontWeight="700"
              textAnchor="middle"
              alignmentBaseline="central"
            >
              {centerText}
            </SvgText>
          ) : (
            <SvgText
              x={CENTER}
              y={CENTER}
              fill="#ffffff"
              fontSize={32}
              fontWeight="700"
              textAnchor="middle"
              alignmentBaseline="central"
            >
              {heading}
            </SvgText>
          )}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  feedbackBox: {
    height: 44,
    minWidth: 180,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderRadius: 8,
  },
  feedbackText: {
    fontSize: 22,
    fontWeight: '700',
  },
  feedbackPlaceholder: {
    height: 44,
    marginBottom: 12,
  },
  svgContainer: {
    width: SIZE,
    height: SIZE,
    // @ts-ignore - web only
    cursor: 'pointer',
    // @ts-ignore - web only
    userSelect: 'none',
    // @ts-ignore - webkit prefix
    WebkitUserSelect: 'none',
  },
});
