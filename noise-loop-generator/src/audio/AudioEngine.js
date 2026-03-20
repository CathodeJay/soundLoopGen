// src/audio/AudioEngine.js
// AudioContext singleton with autoplay-safe bootstrap.
// Source: MDN Web Audio API Best Practices + ARCHITECTURE.md Pattern 1
//
// CRITICAL: Do NOT call new AudioContext() at module load.
// Browsers suspend any context created before a user gesture, with no error.
// getContext() is lazy — it creates the context only when first called
// from within a user gesture handler (the Start button click).

const SAMPLE_RATE = 44100; // Project-wide constant. OfflineAudioContext in Phase 4
                            // reads audioCtx.sampleRate to stay in sync — do not change.

let ctx = null;
let masterGain = null;

/**
 * Returns the AudioContext singleton, creating it lazily on first call.
 * Must only be called from within a user gesture handler to avoid autoplay suspension.
 * @returns {AudioContext}
 */
export function getContext() {
  if (!ctx) {
    ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    ctx.onstatechange = () => {
      console.log('[AudioEngine] state:', ctx.state);
    };
  }
  return ctx;
}

/**
 * Ensures the AudioContext is running, resuming it if suspended.
 * Call this before any audio graph operation.
 * @returns {Promise<AudioContext>} Resolves when context.state === 'running'
 */
export async function ensureRunning() {
  const context = getContext();
  if (context.state === 'suspended') {
    await context.resume();
  }
  return context;
}

/**
 * Returns the master GainNode singleton, creating it lazily on first call.
 * All per-sound gain nodes connect here instead of directly to ctx.destination,
 * enabling a global master volume control.
 * Must only be called after ensureRunning() has been invoked.
 * @returns {GainNode}
 */
export function getMasterGain() {
  if (!masterGain) {
    const ctx = getContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 1.0;
    masterGain.connect(ctx.destination);
  }
  return masterGain;
}
