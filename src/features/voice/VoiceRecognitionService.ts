export interface VoiceResult {
  text: string;
  confidence: number;
  isFinal: boolean;
}

export interface VoiceRecognitionService {
  start(): Promise<void>;
  stop(): Promise<VoiceResult | null>;
  cancel(): void;
  isAvailable(): Promise<boolean>;
  onPartialResult?: (text: string) => void;
}
