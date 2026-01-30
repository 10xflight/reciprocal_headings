import Voice, { SpeechResultsEvent, SpeechErrorEvent } from '@react-native-voice/voice';
import { VoiceRecognitionService, VoiceResult } from './VoiceRecognitionService';

export class NativeVoiceService implements VoiceRecognitionService {
  private resolveStop: ((result: VoiceResult | null) => void) | null = null;
  private lastText: string = '';
  private lastConfidence: number = 0;
  onPartialResult?: (text: string) => void;

  constructor() {
    Voice.onSpeechResults = this.handleResults;
    Voice.onSpeechPartialResults = this.handlePartial;
    Voice.onSpeechError = this.handleError;
    Voice.onSpeechEnd = this.handleEnd;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const available = await Voice.isAvailable();
      return !!available;
    } catch {
      return false;
    }
  }

  async start(): Promise<void> {
    this.lastText = '';
    this.lastConfidence = 0;
    await Voice.start('en-US');
  }

  async stop(): Promise<VoiceResult | null> {
    return new Promise((resolve) => {
      this.resolveStop = resolve;
      Voice.stop().catch(() => {
        resolve(null);
        this.resolveStop = null;
      });
    });
  }

  cancel(): void {
    this.resolveStop = null;
    Voice.cancel().catch(() => {});
  }

  destroy(): void {
    Voice.destroy().catch(() => {});
  }

  private handleResults = (e: SpeechResultsEvent) => {
    const text = e.value?.[0] ?? '';
    this.lastText = text;
    this.lastConfidence = 0.9; // Native API doesn't always provide confidence

    if (this.resolveStop) {
      this.resolveStop({ text, confidence: this.lastConfidence, isFinal: true });
      this.resolveStop = null;
    }
  };

  private handlePartial = (e: SpeechResultsEvent) => {
    const text = e.value?.[0] ?? '';
    this.lastText = text;
    this.onPartialResult?.(text);
  };

  private handleError = (_e: SpeechErrorEvent) => {
    if (this.resolveStop) {
      this.resolveStop({ text: '', confidence: 0, isFinal: true });
      this.resolveStop = null;
    }
  };

  private handleEnd = () => {
    if (this.resolveStop) {
      this.resolveStop({
        text: this.lastText,
        confidence: this.lastConfidence,
        isFinal: true,
      });
      this.resolveStop = null;
    }
  };
}
