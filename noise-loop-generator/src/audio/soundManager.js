// src/audio/soundManager.js
// Manages start/stop/gain for all catalog sounds.
// Noise sounds use AudioWorkletNode. Sample sounds use AudioBufferSourceNode.
// Phase 4 export will re-use these same factories with OfflineAudioContext.

import { ensureRunning } from './AudioEngine.js';
import { catalog } from '../data/catalog.js';

const activeNodes = new Map(); // id -> { source, gain, filter? }
const workletReady = new Map(); // id -> boolean (tracks addModule completion)
const sampleBuffers = new Map(); // id -> AudioBuffer (cached after first fetch)

const DEFAULT_GAIN = 0.8;

/**
 * Starts a sound by id. For noise types, registers the AudioWorklet (once) and
 * creates an AudioWorkletNode. For sample types, fetches and decodes the WAV
 * (once), then creates a looping AudioBufferSourceNode.
 * No-op if the sound is already playing.
 */
export async function startSound(id) {
  if (activeNodes.has(id)) return;

  const ctx = await ensureRunning();
  const entry = catalog.find(e => e.id === id);
  if (!entry) throw new Error(`Unknown sound id: ${id}`);

  const gainNode = ctx.createGain();
  gainNode.gain.value = DEFAULT_GAIN;
  gainNode.connect(ctx.destination);

  if (entry.type === 'noise') {
    await startNoise(ctx, entry, gainNode);
  } else if (entry.type === 'sample') {
    await startSample(ctx, entry, gainNode);
  }
}

async function startNoise(ctx, entry, gainNode) {
  const workletUrl = `/worklets/${entry.id}-noise-processor.js`;

  // Register worklet module once per id
  if (!workletReady.has(entry.id)) {
    await ctx.audioWorklet.addModule(workletUrl);
    workletReady.set(entry.id, true);
  }

  const processorName = `${entry.id}-noise-processor`;
  const source = new AudioWorkletNode(ctx, processorName);

  // Grey noise: insert A-weighting IIR filter between source and gain
  if (entry.id === 'grey') {
    const feedforward = [0.234999, -0.469998, -0.234999, 0.939997, -0.234999, -0.469998, 0.234999];
    const feedback = [1, -0.791732, -1.833498, 1.320396, 0.562088, -0.294095, -0.007868];
    const filterNode = ctx.createIIRFilter(feedforward, feedback);
    source.connect(filterNode);
    filterNode.connect(gainNode);
    activeNodes.set(entry.id, { source, gain: gainNode, filter: filterNode });
  } else {
    source.connect(gainNode);
    activeNodes.set(entry.id, { source, gain: gainNode });
  }
}

async function startSample(ctx, entry, gainNode) {
  const sampleUrl = `/samples/${entry.id}.wav`;

  // Fetch and decode once, cache the AudioBuffer
  if (!sampleBuffers.has(entry.id)) {
    const response = await fetch(sampleUrl);
    if (!response.ok) throw new Error(`Failed to fetch ${sampleUrl}: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    sampleBuffers.set(entry.id, audioBuffer);
  }

  const source = ctx.createBufferSource();
  source.buffer = sampleBuffers.get(entry.id);
  source.loop = true;
  source.connect(gainNode);
  source.start(0);
  activeNodes.set(entry.id, { source, gain: gainNode });
}

/**
 * Stops a sound by id. Disconnects and removes all nodes.
 * No-op if the sound is not playing.
 */
export function stopSound(id) {
  const nodes = activeNodes.get(id);
  if (!nodes) return;

  try {
    nodes.source.disconnect();
    if (nodes.filter) nodes.filter.disconnect();
    nodes.gain.disconnect();
    // AudioBufferSourceNode requires stop(); AudioWorkletNode does not
    if (nodes.source.stop) nodes.source.stop();
  } catch (e) {
    // Ignore errors from already-stopped nodes
  }

  activeNodes.delete(id);
}

/**
 * Sets gain (volume) for a currently-playing sound.
 * @param {string} id - catalog sound id
 * @param {number} value - 0.0 to 1.0
 */
export function setGain(id, value) {
  const nodes = activeNodes.get(id);
  if (!nodes) return;
  nodes.gain.gain.value = Math.max(0, Math.min(1, value));
}

/**
 * Returns true if the sound is currently playing.
 */
export function isPlaying(id) {
  return activeNodes.has(id);
}
