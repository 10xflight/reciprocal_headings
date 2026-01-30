import { Audio, AVPlaybackSource } from 'expo-av';
import { Platform } from 'react-native';

type SoundKey = string;

class AudioManager {
  private sounds: Map<SoundKey, Audio.Sound> = new Map();
  private isInitialized = false;
  private volume = 1.0;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    // Preload feedback sounds
    await this.loadSound('feedback:success', require('../../../assets/audio/feedback/success.m4a'));
    await this.loadSound('feedback:warning', require('../../../assets/audio/feedback/warning.m4a'));
    await this.loadSound('feedback:error', require('../../../assets/audio/feedback/error.m4a'));

    // Preload heading and answer audio (01–36)
    for (let i = 1; i <= 36; i++) {
      const id = i.toString().padStart(2, '0');
      await this.loadHeadingAudio(id);
      await this.loadAnswerAudio(id);
    }

    this.isInitialized = true;
  }

  /**
   * Attempt to load a sound; silently skip if the asset doesn't exist yet.
   * This lets the app run before audio files are recorded.
   */
  private async loadSound(key: string, source: AVPlaybackSource): Promise<void> {
    try {
      const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: false });
      this.sounds.set(key, sound);
    } catch {
      // Asset missing — skip
    }
  }

  private async loadHeadingAudio(id: string): Promise<void> {
    try {
      // Dynamic require isn't possible in RN, so we use a lookup map.
      // For now, only load if assets exist; placeholder generation script
      // will populate these files.
      const source = HEADING_AUDIO_MAP[id];
      if (source) await this.loadSound(`heading:${id}`, source);
    } catch {
      // skip
    }
  }

  private async loadAnswerAudio(id: string): Promise<void> {
    try {
      const source = ANSWER_AUDIO_MAP[id];
      if (source) await this.loadSound(`answer:${id}`, source);
    } catch {
      // skip
    }
  }

  async playHeading(heading: string): Promise<void> {
    await this.play(`heading:${heading}`);
  }

  async playAnswer(heading: string): Promise<void> {
    await this.play(`answer:${heading}`);
  }

  playFeedback(type: 'success' | 'warning' | 'error'): void {
    this.play(`feedback:${type}`).catch(() => {});
  }

  setVolume(level: number): void {
    this.volume = Math.max(0, Math.min(1, level));
  }

  async stopAll(): Promise<void> {
    const promises: Promise<unknown>[] = [];
    this.sounds.forEach((sound) => {
      promises.push(sound.stopAsync().catch(() => {}));
    });
    await Promise.all(promises);
  }

  async cleanup(): Promise<void> {
    const promises: Promise<unknown>[] = [];
    this.sounds.forEach((sound) => {
      promises.push(sound.unloadAsync().catch(() => {}));
    });
    await Promise.all(promises);
    this.sounds.clear();
    this.isInitialized = false;
  }

  private async play(key: string): Promise<void> {
    const sound = this.sounds.get(key);
    if (!sound) return;
    try {
      await sound.setVolumeAsync(this.volume);
      await sound.setPositionAsync(0);
      await sound.playAsync();
    } catch {
      // playback error — ignore
    }
  }
}

/**
 * Asset maps — React Native requires static requires, so each file must be
 * listed explicitly. These will resolve once the audio assets are created.
 * Entries are intentionally left empty until real or placeholder files exist;
 * AudioManager.loadSound gracefully handles missing assets.
 */
const HEADING_AUDIO_MAP: Record<string, AVPlaybackSource | undefined> = {};
const ANSWER_AUDIO_MAP: Record<string, AVPlaybackSource | undefined> = {};

// Singleton
export const audioManager = new AudioManager();
export default AudioManager;
