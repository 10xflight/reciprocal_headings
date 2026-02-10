import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Text, PanResponder, GestureResponderEvent, Platform } from 'react-native';
import Svg, { Circle, Path, G, Text as SvgText, Line } from 'react-native-svg';

// Types
export interface CircularInputProps {
  heading: string;
  onAnswer: (digit1: string, digit2: string, wedgeId: number) => void;
  disabled?: boolean;
  timerProgress: number; // 0-1, for the timer ring
  timerColor: string;
  feedbackState?: {
    numbersCorrect: boolean | null;
    numbersFast: boolean | null;
    wedgeCorrect: boolean | null;
    wedgeFast: boolean | null;
  };
  showFeedback?: boolean;
  centerText?: string; // Optional text to show in center instead of heading (e.g., "Ready")
  correctAnswer?: string; // Optional correct answer to show below heading during feedback
}

// Constants
const SIZE = 340;
const CENTER = SIZE / 2;

// Ring dimensions
const HEADING_RADIUS = 45;
const TIMER_RING_WIDTH = 8;
const NUMPAD_INNER = 60;
const NUMPAD_OUTER = 115;
const COMPASS_INNER = 120;
const COMPASS_OUTER = 165;

// Colors matching Level 1 CompassRose
const WEDGE_FILL = '#1e2a3a';
const WEDGE_FILL_TAPPED = '#3a5068';
const WEDGE_STROKE = '#3a4a5a';
const NUMPAD_FILL = '#0d1520';
const NUMPAD_STROKE = '#3a4a5a';
const FEEDBACK_COLORS = {
  green: '#00e676',
  amber: '#ffab00',
  red: '#ff1744',
};

// Digits 0-9, starting at top (0), going clockwise
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const DIGIT_ANGLE = 360 / 10; // 36 degrees per digit

// Compass directions
const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const DIRECTION_LABELS: Record<string, string> = {
  'N': 'North',
  'NE': 'North East',
  'NW': 'North West',
  'S': 'South',
  'SE': 'South East',
  'SW': 'South West',
  'E': 'East',
  'W': 'West',
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

// Get segment index from angle
function getDigitFromAngle(angle: number): number {
  // Normalize angle to 0-360
  let normalized = ((angle % 360) + 360) % 360;
  // Each digit spans 36 degrees, centered on its position
  // Digit 0 is at top (0 degrees), centered from -18 to +18
  const shifted = (normalized + DIGIT_ANGLE / 2) % 360;
  return Math.floor(shifted / DIGIT_ANGLE);
}

function getWedgeFromAngle(angle: number): number {
  // Normalize angle to 0-360
  let normalized = ((angle % 360) + 360) % 360;
  // Each wedge spans 45 degrees, centered on its position
  // Wedge 0 (N) is at top (0 degrees), centered from -22.5 to +22.5
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

// Determine which ring a point is in
function getRing(distance: number): 'center' | 'numpad' | 'compass' | 'outside' {
  if (distance < NUMPAD_INNER) return 'center';
  if (distance < NUMPAD_OUTER) return 'numpad';
  if (distance < COMPASS_OUTER) return 'compass';
  return 'outside';
}

// Get radial endpoint from center at a given wedge index
function radialEndpoint(cx: number, cy: number, r: number, wedgeIndex: number) {
  const compassDeg = wedgeIndex * WEDGE_ANGLE;
  const rad = ((compassDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Build a swept-back dart arrowhead path (matching Level 1)
function dartArrowPath(cx: number, cy: number, r: number, wedgeIndex: number): string {
  const compassDeg = wedgeIndex * WEDGE_ANGLE;
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

export default function CircularInput({
  heading,
  onAnswer,
  disabled = false,
  timerProgress,
  timerColor,
  feedbackState,
  showFeedback = false,
  centerText,
  correctAnswer,
}: CircularInputProps) {
  const svgContainerRef = useRef<View>(null);
  const [containerLayout, setContainerLayout] = useState({ x: 0, y: 0, width: SIZE, height: SIZE });

  // Input state
  const [digit1, setDigit1] = useState<string | null>(null);
  const [digit2, setDigit2] = useState<string | null>(null);
  const [selectedWedge, setSelectedWedge] = useState<number | null>(null); // The wedge that was submitted
  const [submittedAnswer, setSubmittedAnswer] = useState<string>(''); // Full answer text after submission
  const [hoveredDigit, setHoveredDigit] = useState<number | null>(null);
  const [hoveredWedge, setHoveredWedge] = useState<number | null>(null);
  const [flashingDigit, setFlashingDigit] = useState<number | null>(null); // For brief flash effect
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const hasMovedRef = useRef(false);
  const isSwipingRef = useRef(false);
  const lastWedgeRef = useRef<number | null>(null); // Track last wedge for swipe-through
  // Track selected digits in refs for swipe mode (to avoid stale closure issues)
  const digit1Ref = useRef<string | null>(null);
  const digit2Ref = useRef<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => { digit1Ref.current = digit1; }, [digit1]);
  useEffect(() => { digit2Ref.current = digit2; }, [digit2]);

  // Reset input when heading changes
  useEffect(() => {
    setDigit1(null);
    setDigit2(null);
    setSelectedWedge(null);
    setSubmittedAnswer('');
    setHoveredDigit(null);
    setHoveredWedge(null);
    setFlashingDigit(null);
    digit1Ref.current = null;
    digit2Ref.current = null;
    isSwipingRef.current = false;
    startPosRef.current = null;
    hasMovedRef.current = false;
    lastWedgeRef.current = null;
  }, [heading]);

  // Also reset when feedback ends (showFeedback goes from true to false)
  const prevShowFeedback = useRef(showFeedback);
  useEffect(() => {
    if (prevShowFeedback.current && !showFeedback) {
      // Feedback just ended, reset input state
      setDigit1(null);
      setDigit2(null);
      setSelectedWedge(null);
      setSubmittedAnswer('');
      setHoveredDigit(null);
      setHoveredWedge(null);
      setFlashingDigit(null);
      digit1Ref.current = null;
      digit2Ref.current = null;
      isSwipingRef.current = false;
      lastWedgeRef.current = null;
    }
    prevShowFeedback.current = showFeedback;
  }, [showFeedback]);

  // Keyboard support for web - type numbers 0-9
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (disabled || showFeedback) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      // Check if it's a digit
      if (key >= '0' && key <= '9') {
        const digitIndex = parseInt(key, 10);
        // Highlight the digit
        setHoveredDigit(digitIndex);

        // Select the digit
        if (digit1 === null) {
          setDigit1(key);
        } else if (digit2 === null) {
          setDigit2(key);
        }

        // Clear hover after short delay
        setTimeout(() => setHoveredDigit(null), 150);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, showFeedback, digit1, digit2]);

  // Get position relative to SVG center
  const getRelativePosition = useCallback((pageX: number, pageY: number) => {
    const x = pageX - containerLayout.x - CENTER;
    const y = pageY - containerLayout.y - CENTER;
    return { x, y };
  }, [containerLayout]);

  const handlePointerDown = useCallback((pageX: number, pageY: number) => {
    if (disabled || showFeedback) return;

    const { x, y } = getRelativePosition(pageX, pageY);
    startPosRef.current = { x, y };
    hasMovedRef.current = false;
    isSwipingRef.current = false;

    const { angle, distance } = getAngleAndDistance(x, y, 0, 0);
    const ring = getRing(distance);

    if (ring === 'numpad') {
      const digitIndex = getDigitFromAngle(angle);
      setHoveredDigit(digitIndex);
    } else if (ring === 'compass') {
      const wedgeIndex = getWedgeFromAngle(angle);
      setHoveredWedge(wedgeIndex);
    }
  }, [disabled, showFeedback, getRelativePosition]);

  const handlePointerMove = useCallback((pageX: number, pageY: number) => {
    if (disabled || showFeedback || !startPosRef.current) return;

    const { x, y } = getRelativePosition(pageX, pageY);

    // Check if moved enough to be a swipe
    const dx = x - startPosRef.current.x;
    const dy = y - startPosRef.current.y;
    const moveDistance = Math.sqrt(dx * dx + dy * dy);

    if (moveDistance > 10) {
      hasMovedRef.current = true;
      isSwipingRef.current = true;
    }

    const { angle, distance } = getAngleAndDistance(x, y, 0, 0);
    const ring = getRing(distance);

    if (ring === 'numpad') {
      const digitIndex = getDigitFromAngle(angle);
      setHoveredDigit(digitIndex);
      setHoveredWedge(null);
      lastWedgeRef.current = null;

      // In swipe mode, auto-select digits as we pass over them
      if (isSwipingRef.current) {
        const digit = DIGITS[digitIndex];
        if (digit1Ref.current === null) {
          setDigit1(digit);
          digit1Ref.current = digit;
        } else if (digit2Ref.current === null && digit !== digit1Ref.current) {
          setDigit2(digit);
          digit2Ref.current = digit;
        }
      }
    } else if (ring === 'compass') {
      const wedgeIndex = getWedgeFromAngle(angle);
      setHoveredWedge(wedgeIndex);
      setHoveredDigit(null);
      lastWedgeRef.current = wedgeIndex;
    } else if (ring === 'outside') {
      // Swiped outside the compass - if we were in a wedge with digits entered, submit!
      if (isSwipingRef.current && lastWedgeRef.current !== null &&
          digit1Ref.current !== null && digit2Ref.current !== null) {
        const wedgeIndex = lastWedgeRef.current;
        setSelectedWedge(wedgeIndex);
        setSubmittedAnswer(`${digit1Ref.current}${digit2Ref.current} ${DIRECTION_LABELS[DIRECTIONS[wedgeIndex]]}`);
        onAnswer(digit1Ref.current, digit2Ref.current, wedgeIndex);
        // Reset swipe state
        isSwipingRef.current = false;
        startPosRef.current = null;
        hasMovedRef.current = false;
        lastWedgeRef.current = null;
      }
      setHoveredDigit(null);
      setHoveredWedge(null);
    } else {
      setHoveredDigit(null);
      setHoveredWedge(null);
      lastWedgeRef.current = null;
    }
  }, [disabled, showFeedback, getRelativePosition, onAnswer]);

  const handlePointerUp = useCallback((pageX: number, pageY: number) => {
    if (disabled || showFeedback) return;

    const { x, y } = getRelativePosition(pageX, pageY);
    const { angle, distance } = getAngleAndDistance(x, y, 0, 0);
    const ring = getRing(distance);

    if (!hasMovedRef.current) {
      // TAP mode
      if (ring === 'numpad') {
        const digitIndex = getDigitFromAngle(angle);
        const digit = DIGITS[digitIndex];

        // Flash the digit briefly
        setFlashingDigit(digitIndex);
        setTimeout(() => setFlashingDigit(null), 150);

        if (digit1 === null) {
          setDigit1(digit);
        } else if (digit2 === null) {
          setDigit2(digit);
        }
      } else if (ring === 'compass' && digit1 !== null && digit2 !== null) {
        // Tap on wedge with both digits entered - submit
        const wedgeIndex = getWedgeFromAngle(angle);
        setSelectedWedge(wedgeIndex);
        // Save the full answer text
        setSubmittedAnswer(`${digit1}${digit2} ${DIRECTION_LABELS[DIRECTIONS[wedgeIndex]]}`);
        onAnswer(digit1, digit2, wedgeIndex);
      }
    } else {
      // SWIPE mode - must end on a wedge to submit
      if (ring === 'compass' && digit1 !== null && digit2 !== null) {
        const wedgeIndex = getWedgeFromAngle(angle);
        setSelectedWedge(wedgeIndex);
        // Save the full answer text
        setSubmittedAnswer(`${digit1}${digit2} ${DIRECTION_LABELS[DIRECTIONS[wedgeIndex]]}`);
        onAnswer(digit1, digit2, wedgeIndex);
      }
      // If swipe didn't end on wedge, keep current state (don't reset)
    }

    // Reset hover states
    setHoveredDigit(null);
    setHoveredWedge(null);
    isSwipingRef.current = false;
    startPosRef.current = null;
    hasMovedRef.current = false;
    lastWedgeRef.current = null;
  }, [disabled, showFeedback, getRelativePosition, digit1, digit2, onAnswer]);

  // Measure SVG container position (not the outer container which has answerDisplay)
  const onLayout = useCallback(() => {
    if (svgContainerRef.current) {
      (svgContainerRef.current as any).measure?.(
        (_x: number, _y: number, width: number, height: number, pageX: number, pageY: number) => {
          setContainerLayout({ x: pageX, y: pageY, width, height });
        }
      );
    }
  }, []);

  // Use refs for handlers to avoid stale closures in PanResponder
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
        setHoveredDigit(null);
        setHoveredWedge(null);
        isSwipingRef.current = false;
        startPosRef.current = null;
        hasMovedRef.current = false;
        lastWedgeRef.current = null;
      },
    })
  ).current;

  // Timer ring
  const timerRadius = HEADING_RADIUS + TIMER_RING_WIDTH / 2 + 2;
  const timerCircumference = 2 * Math.PI * timerRadius;
  const timerOffset = timerCircumference * timerProgress;

  // Get colors for digits - only flash on press/hover, no persistent selection
  const getDigitFill = (index: number) => {
    // Flash effect (cyan like focus tiles)
    if (flashingDigit === index) {
      return 'rgba(0, 212, 255, 0.4)';
    }
    // Hover effect
    if (hoveredDigit === index) {
      return 'rgba(0, 212, 255, 0.2)';
    }
    return NUMPAD_FILL;
  };

  const getDigitStroke = (index: number) => {
    // Flash effect
    if (flashingDigit === index) {
      return '#00d4ff';
    }
    // Hover effect
    if (hoveredDigit === index) {
      return '#00d4ff';
    }
    return NUMPAD_STROKE;
  };

  const getDigitStrokeWidth = (index: number) => {
    if (flashingDigit === index || hoveredDigit === index) return 3;
    return 2;
  };

  // Get answer box style based on feedback
  const getAnswerBoxStyle = () => {
    if (!showFeedback || !feedbackState) {
      return null; // Hide box during input
    }

    const isCorrect = feedbackState.numbersCorrect && feedbackState.wedgeCorrect;
    const isFast = feedbackState.numbersFast && feedbackState.wedgeFast;

    if (isCorrect && isFast) {
      // Green + fast
      return {
        borderColor: FEEDBACK_COLORS.green,
        backgroundColor: 'rgba(0, 230, 118, 0.2)',
        textColor: FEEDBACK_COLORS.green,
      };
    } else if (isCorrect) {
      // Green + slow (amber fill)
      return {
        borderColor: FEEDBACK_COLORS.green,
        backgroundColor: 'rgba(255, 171, 0, 0.2)',
        textColor: FEEDBACK_COLORS.amber,
      };
    } else {
      // Wrong - show correct answer in red
      return {
        borderColor: FEEDBACK_COLORS.red,
        backgroundColor: 'rgba(255, 23, 68, 0.2)',
        textColor: FEEDBACK_COLORS.red,
      };
    }
  };

  // Get colors for wedges - only color the selected wedge
  const getWedgeFill = (index: number) => {
    const isSelected = selectedWedge === index;
    const isHovered = hoveredWedge === index;

    if (showFeedback && feedbackState && isSelected) {
      // Only color the selected wedge during feedback - use semi-transparent so radial line shows
      if (feedbackState.wedgeCorrect === true) {
        return feedbackState.wedgeFast ? 'rgba(0, 230, 118, 0.5)' : 'rgba(255, 171, 0, 0.5)';
      } else if (feedbackState.wedgeCorrect === false) {
        return 'rgba(255, 23, 68, 0.5)';
      }
    }

    if (isHovered) {
      return WEDGE_FILL_TAPPED;
    }
    return WEDGE_FILL;
  };

  const getWedgeStroke = (index: number) => {
    const isSelected = selectedWedge === index;
    const isHovered = hoveredWedge === index;

    if (showFeedback && feedbackState && isSelected) {
      if (feedbackState.wedgeCorrect === true) {
        return FEEDBACK_COLORS.green;
      } else if (feedbackState.wedgeCorrect === false) {
        return FEEDBACK_COLORS.red;
      }
    }

    if (isHovered || isSelected) {
      return '#8aaace';
    }
    return WEDGE_STROKE;
  };

  const getWedgeStrokeWidth = (index: number) => {
    const isSelected = selectedWedge === index;
    const isHovered = hoveredWedge === index;
    if (isSelected || isHovered) return 3;
    return 2;
  };

  // Answer feedback display - only shows after submission
  const getFeedbackDisplay = () => {
    if (!showFeedback) return null;

    // Show the submitted answer during feedback
    if (submittedAnswer) {
      return submittedAnswer;
    }
    // Fallback for timeout (no answer submitted)
    if (correctAnswer) {
      return correctAnswer;
    }
    return null;
  };

  const feedbackDisplay = getFeedbackDisplay();

  const answerBoxStyle = getAnswerBoxStyle();

  // Determine what to show in feedback box (correct answer if wrong, submitted answer if right)
  const feedbackText = showFeedback && feedbackState
    ? (feedbackState.numbersCorrect && feedbackState.wedgeCorrect ? submittedAnswer : correctAnswer)
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
        // Placeholder to maintain layout spacing
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
          {/* Layer 1: Compass wedge fills */}
          <G>
            {DIRECTIONS.map((dir, i) => {
              const startAngle = i * WEDGE_ANGLE - WEDGE_ANGLE / 2;
              const endAngle = startAngle + WEDGE_ANGLE;
              const path = createArcPath(CENTER, CENTER, COMPASS_INNER, COMPASS_OUTER, startAngle, endAngle);

              return (
                <Path
                  key={`wedge-${dir}`}
                  d={path}
                  fill={getWedgeFill(i)}
                  stroke={getWedgeStroke(i)}
                  strokeWidth={getWedgeStrokeWidth(i)}
                />
              );
            })}
          </G>

          {/* Layer 2: Numpad segment fills */}
          <G>
            {DIGITS.map((digit, i) => {
              const startAngle = i * DIGIT_ANGLE - DIGIT_ANGLE / 2;
              const endAngle = startAngle + DIGIT_ANGLE;
              const path = createArcPath(CENTER, CENTER, NUMPAD_INNER, NUMPAD_OUTER, startAngle, endAngle);

              return (
                <Path
                  key={`numpad-${digit}`}
                  d={path}
                  fill={getDigitFill(i)}
                  stroke={getDigitStroke(i)}
                  strokeWidth={getDigitStrokeWidth(i)}
                />
              );
            })}
          </G>

          {/* Layer 3: Radial line + arrow (on top of fills, under text) */}
          {selectedWedge !== null && (() => {
            const end = radialEndpoint(CENTER, CENTER, COMPASS_OUTER, selectedWedge);
            const arrowD = dartArrowPath(CENTER, CENTER, COMPASS_OUTER, selectedWedge);
            const arrowColor = showFeedback && feedbackState
              ? (feedbackState.wedgeCorrect ? FEEDBACK_COLORS.green : FEEDBACK_COLORS.red)
              : FEEDBACK_COLORS.green;
            return (
              <>
                <Line
                  x1={CENTER}
                  y1={CENTER}
                  x2={end.x}
                  y2={end.y}
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
          })()}

          {/* Layer 4: Wedge direction labels (on top of radial) */}
          <G>
            {DIRECTIONS.map((dir, i) => {
              const midAngle = i * WEDGE_ANGLE;
              const labelPos = polarToCartesian(CENTER, CENTER, (COMPASS_INNER + COMPASS_OUTER) / 2, midAngle);

              return (
                <SvgText
                  key={`label-${dir}`}
                  x={labelPos.x}
                  y={labelPos.y}
                  fill="#ffffff"
                  fontSize={14}
                  fontWeight="600"
                  textAnchor="middle"
                  alignmentBaseline="central"
                >
                  {dir}
                </SvgText>
              );
            })}
          </G>

          {/* Layer 5: Numpad digit labels */}
          <G>
            {DIGITS.map((digit, i) => {
              const midAngle = i * DIGIT_ANGLE;
              const labelPos = polarToCartesian(CENTER, CENTER, (NUMPAD_INNER + NUMPAD_OUTER) / 2, midAngle);

              return (
                <SvgText
                  key={`digit-${digit}`}
                  x={labelPos.x}
                  y={labelPos.y}
                  fill="#ffffff"
                  fontSize={18}
                  fontWeight="700"
                  textAnchor="middle"
                  alignmentBaseline="central"
                >
                  {digit}
                </SvgText>
              );
            })}
          </G>

          {/* Layer 6: Solid mask behind timer/center (hides radial in center) */}
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={NUMPAD_INNER}
            fill="#0d1520"
          />

          {/* Layer 7: Timer ring background */}
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={timerRadius}
            stroke="#1e2a3a"
            strokeWidth={TIMER_RING_WIDTH}
            fill="transparent"
          />

          {/* Layer 8: Timer ring progress */}
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

          {/* Layer 9: Center circle border */}
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={HEADING_RADIUS}
            fill="#0d1520"
            stroke="#3a4a5a"
            strokeWidth={2}
          />

          {/* Layer 10: Center text - split layout */}
          {centerText ? (
            // Countdown "Ready" text
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
            <>
              {/* Top half: Presented heading */}
              <SvgText
                x={CENTER}
                y={CENTER - 12}
                fill="#ffffff"
                fontSize={26}
                fontWeight="700"
                textAnchor="middle"
                alignmentBaseline="central"
              >
                {heading}
              </SvgText>
              {/* Divider line */}
              <Line
                x1={CENTER - 30}
                y1={CENTER + 2}
                x2={CENTER + 30}
                y2={CENTER + 2}
                stroke="#3a4a5a"
                strokeWidth={1}
                opacity={0.6}
              />
              {/* Bottom half: User's number entry - color based on feedback */}
              <SvgText
                x={CENTER}
                y={CENTER + 18}
                fill={
                  showFeedback && feedbackState
                    ? (feedbackState.numbersCorrect && feedbackState.wedgeCorrect
                        ? (feedbackState.numbersFast && feedbackState.wedgeFast ? FEEDBACK_COLORS.green : FEEDBACK_COLORS.amber)
                        : FEEDBACK_COLORS.red)
                    : '#00d4ff'
                }
                fontSize={18}
                fontWeight="600"
                textAnchor="middle"
                alignmentBaseline="central"
              >
                {digit1 !== null ? (digit2 !== null ? `${digit1}${digit2}` : `${digit1}_`) : '_ _'}
              </SvgText>
            </>
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
    // @ts-ignore - web only, prevent text selection during drag
    userSelect: 'none',
    // @ts-ignore - webkit prefix
    WebkitUserSelect: 'none',
  },
});
