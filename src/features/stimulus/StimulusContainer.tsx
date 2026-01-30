import React from 'react';
import HeadingDisplay from './HeadingDisplay';
import AudioStimulus from './AudioStimulus';

interface StimulusContainerProps {
  level: number;
  heading: string;
  onAudioPlayComplete?: () => void;
}

/**
 * Renders the appropriate stimulus display based on the current level.
 * - Levels 1-3, 5: Visual heading text
 * - Level 4: Audio-only with dark screen
 */
export default function StimulusContainer({
  level,
  heading,
  onAudioPlayComplete,
}: StimulusContainerProps) {
  if (level === 4) {
    return (
      <AudioStimulus heading={heading} onPlayComplete={onAudioPlayComplete ?? (() => {})} />
    );
  }

  return <HeadingDisplay heading={heading} size={level === 5 ? 'large' : 'normal'} />;
}
