#!/usr/bin/env node

/**
 * Generate placeholder audio files using system text-to-speech.
 *
 * Usage:
 *   node scripts/generatePlaceholderAudio.js
 *
 * Requirements:
 *   - macOS: uses built-in `say` command
 *   - Windows: uses PowerShell `Add-Type -AssemblyName System.Speech`
 *   - Linux: requires `espeak` installed
 *
 * Output:
 *   assets/audio/headings/01.m4a … 36.m4a
 *   assets/audio/answers/01.m4a  … 36.m4a
 *   assets/audio/feedback/success.m4a, warning.m4a, error.m4a
 *
 * NOTE: These are low-quality dev placeholders. Replace with professional
 * recordings before production release.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const HEADINGS_DIR = path.join(ROOT, 'assets', 'audio', 'headings');
const ANSWERS_DIR = path.join(ROOT, 'assets', 'audio', 'answers');
const FEEDBACK_DIR = path.join(ROOT, 'assets', 'audio', 'feedback');

// Direction lookup (same as compassGeometry.ts)
const DIRECTIONS = {
  '01': 'North',       '02': 'North',       '03': 'North East',
  '04': 'North East',  '05': 'North East',  '06': 'North East',
  '07': 'East',        '08': 'East',        '09': 'East',
  '10': 'East',        '11': 'East',        '12': 'South East',
  '13': 'South East',  '14': 'South East',  '15': 'South East',
  '16': 'South',       '17': 'South',       '18': 'South',
  '19': 'South',       '20': 'South',       '21': 'South West',
  '22': 'South West',  '23': 'South West',  '24': 'South West',
  '25': 'West',        '26': 'West',        '27': 'West',
  '28': 'West',        '29': 'West',        '30': 'North West',
  '31': 'North West',  '32': 'North West',  '33': 'North West',
  '34': 'North',       '35': 'North',       '36': 'North',
};

const DIGIT_WORDS = [
  'Zero', 'One', 'Two', 'Three', 'Four',
  'Five', 'Six', 'Seven', 'Eight', 'Nine',
];

function headingToWords(id) {
  return id.split('').map(d => DIGIT_WORDS[parseInt(d)]).join(' ');
}

function reciprocal(id) {
  const n = parseInt(id, 10);
  const r = n <= 18 ? n + 18 : n - 18;
  return r.toString().padStart(2, '0');
}

function speak(text, outputPath) {
  const platform = os.platform();
  try {
    if (platform === 'darwin') {
      // macOS — output AIFF then convert is complex; just create a tiny silent file as placeholder
      execSync(`say -o "${outputPath.replace('.m4a', '.aiff')}" "${text}"`);
      // Convert to m4a
      execSync(`afconvert -d aac -f m4af "${outputPath.replace('.m4a', '.aiff')}" "${outputPath}"`);
      fs.unlinkSync(outputPath.replace('.m4a', '.aiff'));
    } else if (platform === 'win32') {
      // Windows — generate WAV via PowerShell, then just rename (browsers handle WAV fine)
      const wavPath = outputPath.replace('.m4a', '.wav');
      const ps = `
        Add-Type -AssemblyName System.Speech;
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
        $synth.SetOutputToWaveFile('${wavPath.replace(/\\/g, '\\\\')}');
        $synth.Speak('${text.replace(/'/g, "''")}');
        $synth.Dispose();
      `.trim();
      execSync(`powershell -Command "${ps}"`);
      // Rename wav to m4a (for dev purposes — expo-av handles it)
      if (fs.existsSync(wavPath)) {
        fs.renameSync(wavPath, outputPath);
      }
    } else {
      // Linux
      execSync(`espeak "${text}" --stdout > "${outputPath.replace('.m4a', '.wav')}"`);
      fs.renameSync(outputPath.replace('.m4a', '.wav'), outputPath);
    }
    console.log(`  ✓ ${path.basename(outputPath)}`);
  } catch (err) {
    console.log(`  ✗ ${path.basename(outputPath)} — ${err.message}`);
  }
}

// Ensure dirs exist
[HEADINGS_DIR, ANSWERS_DIR, FEEDBACK_DIR].forEach(dir => {
  fs.mkdirSync(dir, { recursive: true });
});

console.log('Generating heading audio files...');
for (let i = 1; i <= 36; i++) {
  const id = i.toString().padStart(2, '0');
  const text = `Heading ${headingToWords(id)}`;
  speak(text, path.join(HEADINGS_DIR, `${id}.m4a`));
}

console.log('\nGenerating answer audio files...');
for (let i = 1; i <= 36; i++) {
  const id = i.toString().padStart(2, '0');
  const recip = reciprocal(id);
  const dir = DIRECTIONS[recip];
  const text = `${headingToWords(recip)}... ${dir}`;
  speak(text, path.join(ANSWERS_DIR, `${id}.m4a`));
}

console.log('\nGenerating feedback audio files...');
speak('Correct', path.join(FEEDBACK_DIR, 'success.m4a'));
speak('Too slow', path.join(FEEDBACK_DIR, 'warning.m4a'));
speak('Incorrect', path.join(FEEDBACK_DIR, 'error.m4a'));

console.log('\nDone!');
