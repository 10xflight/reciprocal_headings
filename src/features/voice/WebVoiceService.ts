import { VoiceRecognitionService, VoiceResult } from './VoiceRecognitionService';

type SpeechRecognitionType = typeof window extends { SpeechRecognition: infer T } ? T : any;

export class WebVoiceService implements VoiceRecognitionService {
  private recognition: any = null;
  private resolveStop: ((result: VoiceResult | null) => void) | null = null;
  onPartialResult?: (text: string) => void;

  async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    return !!SR;
  }

  async start(): Promise<void> {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) throw new Error('Web Speech API not available');

    this.recognition = new SR();
    this.recognition.lang = 'en-US';
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event: any) => {
      const last = event.results[event.results.length - 1];
      const text = last[0].transcript;
      const confidence = last[0].confidence;

      if (!last.isFinal && this.onPartialResult) {
        this.onPartialResult(text);
      }

      if (last.isFinal && this.resolveStop) {
        this.resolveStop({ text, confidence, isFinal: true });
        this.resolveStop = null;
      }
    };

    this.recognition.onerror = (event: any) => {
      if (this.resolveStop) {
        if (event.error === 'no-speech') {
          this.resolveStop({ text: '', confidence: 0, isFinal: true });
        } else {
          this.resolveStop(null);
        }
        this.resolveStop = null;
      }
    };

    this.recognition.onend = () => {
      if (this.resolveStop) {
        this.resolveStop({ text: '', confidence: 0, isFinal: true });
        this.resolveStop = null;
      }
    };

    this.recognition.start();
  }

  async stop(): Promise<VoiceResult | null> {
    return new Promise((resolve) => {
      this.resolveStop = resolve;
      if (this.recognition) {
        this.recognition.stop();
      } else {
        resolve(null);
      }
    });
  }

  cancel(): void {
    this.resolveStop = null;
    if (this.recognition) {
      this.recognition.abort();
      this.recognition = null;
    }
  }
}
