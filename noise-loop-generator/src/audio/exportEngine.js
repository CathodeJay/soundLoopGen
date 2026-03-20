// src/audio/exportEngine.js
// Offline rendering pipeline: generates noise/samples in OfflineAudioContext,
// applies tail crossfade for gapless looping, encodes 16-bit PCM WAV, triggers download.
//
// NOTE: AudioWorkletNode is NOT used in OfflineAudioContext — unreliable across browsers.
// Noise is generated directly into Float32Array using the same algorithms as the worklets.

import { getContext } from './AudioEngine.js';
import audioBufferToWav from 'audiobuffer-to-wav';

const CROSSFADE_SEC = 3;

const FILENAMES = {
  30: 'noise-mix-30s.wav',
  60: 'noise-mix-1min.wav',
  120: 'noise-mix-2min.wav',
};

// ---------------------------------------------------------------------------
// Noise generation functions
// Each mirrors the corresponding AudioWorklet processor algorithm exactly.
// ---------------------------------------------------------------------------

function generateWhiteNoise(totalSamples) {
  const data = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return data;
}

function generatePinkNoise(totalSamples) {
  const data = new Float32Array(totalSamples);
  const b = [0, 0, 0, 0, 0, 0, 0]; // Voss-McCartney state
  for (let i = 0; i < totalSamples; i++) {
    const white = Math.random() * 2 - 1;
    b[0] = 0.99886 * b[0] + white * 0.0555179;
    b[1] = 0.99332 * b[1] + white * 0.0750759;
    b[2] = 0.96900 * b[2] + white * 0.1538520;
    b[3] = 0.86650 * b[3] + white * 0.3104856;
    b[4] = 0.55000 * b[4] + white * 0.5329522;
    b[5] = -0.7616 * b[5] - white * 0.0168980;
    data[i] = (b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + white * 0.5362) / 10;
    b[6] = white * 0.115926;
  }
  return data;
}

function generateBrownNoise(totalSamples) {
  const data = new Float32Array(totalSamples);
  let lastOut = 0;
  for (let i = 0; i < totalSamples; i++) {
    const white = Math.random() * 2 - 1;
    lastOut = lastOut * 0.998 + white * 0.02;
    data[i] = lastOut * 3.5;
  }
  return data;
}

// ---------------------------------------------------------------------------
// exportMix — main export function
// ---------------------------------------------------------------------------

/**
 * Renders the active mix offline, applies tail crossfade, encodes as 16-bit PCM WAV,
 * and triggers a browser file download.
 *
 * @param {Object} params
 * @param {Array<{id: string, type: string}>} params.activeSounds - Currently playing sounds
 * @param {Map<string, number>} params.gains - Per-sound gain values (from volumeMap in main.js)
 * @param {number} params.masterGainValue - Current master gain (from getMasterGain().gain.value)
 * @param {number} params.durationSec - Export duration: 30, 60, or 120
 */
export async function exportMix({ activeSounds, gains, masterGainValue, durationSec }) {
  const sampleRate = getContext().sampleRate; // 44100
  const totalSec = durationSec + CROSSFADE_SEC;
  const totalSamples = Math.ceil(sampleRate * totalSec);
  const offlineCtx = new OfflineAudioContext(1, totalSamples, sampleRate);

  // Offline master gain node — mirrors live master gain value
  const offlineMaster = offlineCtx.createGain();
  offlineMaster.gain.value = masterGainValue;
  offlineMaster.connect(offlineCtx.destination);

  // Build audio graph for each active sound
  for (const { id, type } of activeSounds) {
    const gainNode = offlineCtx.createGain();
    gainNode.gain.value = gains.get(id) ?? 1;
    gainNode.connect(offlineMaster);

    if (type === 'noise') {
      await addNoiseSource(offlineCtx, id, totalSamples, sampleRate, gainNode);
    } else if (type === 'sample') {
      await addSampleSource(offlineCtx, id, gainNode);
    }
  }

  // Render the full duration + crossfade window
  const renderedBuffer = await offlineCtx.startRendering();

  // Apply tail crossfade for gapless looping
  const durationSamples = Math.ceil(sampleRate * durationSec);
  const crossfadeSamples = Math.ceil(sampleRate * CROSSFADE_SEC);
  const data = renderedBuffer.getChannelData(0);

  for (let i = 0; i < crossfadeSamples; i++) {
    // Equal-power crossfade (sin/cos): maintains constant perceived loudness throughout.
    // Linear fades create a -3 dB dip at the midpoint that is audible on noise.
    const theta = (i / crossfadeSamples) * (Math.PI / 2);
    const headFade = Math.sin(theta);   // 0.0 → 1.0  (head fades in)
    const tailFade = Math.cos(theta);   // 1.0 → 0.0  (tail fades out)
    data[i] = data[durationSamples + i] * tailFade + data[i] * headFade;
  }

  // Create trimmed buffer at exact export duration
  const trimmed = new AudioBuffer({
    numberOfChannels: 1,
    length: durationSamples,
    sampleRate,
  });
  trimmed.copyToChannel(data.slice(0, durationSamples), 0);

  // Encode as 16-bit PCM WAV (default — maximum video editor compatibility)
  const wavArrayBuffer = audioBufferToWav(trimmed);

  // Trigger browser download
  const filename = FILENAMES[durationSec] ?? `noise-mix-${durationSec}s.wav`;
  const blob = new Blob([wavArrayBuffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function addNoiseSource(offlineCtx, id, totalSamples, sampleRate, gainNode) {
  const noiseBuffer = offlineCtx.createBuffer(1, totalSamples, sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);

  let generated;
  if (id === 'white') {
    generated = generateWhiteNoise(totalSamples);
  } else if (id === 'pink') {
    generated = generatePinkNoise(totalSamples);
  } else if (id === 'brown') {
    generated = generateBrownNoise(totalSamples);
  } else if (id === 'grey') {
    // Grey noise = white noise + low-shelf BiquadFilter at 800 Hz / +10 dB
    generated = generateWhiteNoise(totalSamples);
  } else {
    generated = generateWhiteNoise(totalSamples);
  }

  noiseData.set(generated);

  const src = offlineCtx.createBufferSource();
  src.buffer = noiseBuffer;

  if (id === 'grey') {
    // Match soundManager.js grey noise filter exactly
    const filterNode = offlineCtx.createBiquadFilter();
    filterNode.type = 'lowshelf';
    filterNode.frequency.value = 800;
    filterNode.gain.value = 10;
    src.connect(filterNode);
    filterNode.connect(gainNode);
  } else {
    src.connect(gainNode);
  }

  src.start(0);
}

async function addSampleSource(offlineCtx, id, gainNode) {
  // AudioBuffers are context-specific — must re-decode for OfflineAudioContext
  const response = await fetch(`/samples/${id}.wav`);
  if (!response.ok) throw new Error(`Failed to fetch /samples/${id}.wav: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);

  const src = offlineCtx.createBufferSource();
  src.buffer = audioBuffer;
  src.loop = true;
  src.connect(gainNode);
  src.start(0);
}
