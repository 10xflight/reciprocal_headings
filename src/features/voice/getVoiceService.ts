import { Platform } from 'react-native';
import { VoiceRecognitionService } from './VoiceRecognitionService';

let instance: VoiceRecognitionService | null = null;

export function getVoiceService(): VoiceRecognitionService {
  if (instance) return instance;

  if (Platform.OS === 'web') {
    const { WebVoiceService } = require('./WebVoiceService');
    instance = new WebVoiceService();
  } else {
    const { NativeVoiceService } = require('./NativeVoiceService');
    instance = new NativeVoiceService();
  }

  return instance!;
}
