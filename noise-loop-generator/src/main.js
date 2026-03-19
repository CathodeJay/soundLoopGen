// src/main.js
// Entry point: wires the Start overlay to the AudioEngine bootstrap.
// Source: MDN Autoplay Guide pattern + ARCHITECTURE.md Pattern 2
//
// The Start button is the ONLY valid user gesture entry point for AudioContext
// initialization. Do not call ensureRunning() from any other top-level path.

import { ensureRunning } from './audio/AudioEngine.js';

const startBtn = document.getElementById('start-btn');
const startOverlay = document.getElementById('start-overlay');
const app = document.getElementById('app');

startBtn.addEventListener('click', async () => {
  try {
    const ctx = await ensureRunning();
    console.log('[main] AudioContext state after resume:', ctx.state);
    startOverlay.remove();
    app.style.display = '';
    // Phase 2+: initialize sound nodes here, after ensureRunning() resolves
  } catch (err) {
    console.error('[main] AudioContext failed to start:', err);
    // ENG-01 error state: no in-UI message in Phase 1 (see VALIDATION.md).
    // Error is surfaced via console only.
  }
});
