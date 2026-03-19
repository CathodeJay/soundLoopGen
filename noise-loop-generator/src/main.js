// src/main.js
// Entry point: wires the Start overlay to the AudioEngine bootstrap,
// then renders the Phase 2 dev test UI (Play/Stop per catalog sound).
// Phase 3 replaces the dev test UI entirely with the real mixer.

import { ensureRunning } from './audio/AudioEngine.js';
import { startSound, stopSound, isPlaying } from './audio/soundManager.js';
import { catalog } from './data/catalog.js';

const startBtn = document.getElementById('start-btn');
const startOverlay = document.getElementById('start-overlay');
const app = document.getElementById('app');

startBtn.addEventListener('click', async () => {
  try {
    const ctx = await ensureRunning();
    console.log('[main] AudioContext state after resume:', ctx.state);
    startOverlay.remove();
    app.style.display = '';
    renderDevTestUI();
  } catch (err) {
    console.error('[main] AudioContext failed to start:', err);
  }
});

function renderDevTestUI() {
  const list = document.createElement('div');
  list.id = 'sound-list';
  list.style.cssText = 'display:flex;flex-direction:column;gap:0;';

  catalog.forEach(({ id, label }) => {
    const row = document.createElement('div');
    row.className = 'sound-row';
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #2a2a2a;';

    const lblEl = document.createElement('span');
    lblEl.className = 'sound-label';
    lblEl.textContent = label;
    lblEl.style.cssText = 'color:#ffffff;font-size:16px;font-weight:400;min-width:120px;';

    const playBtn = document.createElement('button');
    playBtn.className = 'btn-play';
    playBtn.textContent = '\u25B6 Play';
    playBtn.style.cssText = 'background:#1e1e1e;color:#ffffff;font-size:24px;font-weight:600;padding:4px 12px;border:1px solid #444;border-radius:4px;cursor:pointer;';

    const stopBtn = document.createElement('button');
    stopBtn.className = 'btn-stop';
    stopBtn.textContent = '\u25A0 Stop';
    stopBtn.disabled = true;
    stopBtn.style.cssText = 'background:#1e1e1e;color:#ffffff;font-size:24px;font-weight:600;padding:4px 12px;border:1px solid #444;border-radius:4px;cursor:not-allowed;opacity:0.4;';

    playBtn.addEventListener('click', async () => {
      try {
        await startSound(id);
        playBtn.style.background = '#4caf50';
        playBtn.style.borderColor = '#4caf50';
        playBtn.disabled = true;
        playBtn.style.opacity = '0.4';
        playBtn.style.cursor = 'not-allowed';
        stopBtn.disabled = false;
        stopBtn.style.opacity = '1';
        stopBtn.style.cursor = 'pointer';
      } catch (err) {
        console.error(`[main] Failed to start ${id}:`, err);
      }
    });

    stopBtn.addEventListener('click', () => {
      stopSound(id);
      playBtn.style.background = '#1e1e1e';
      playBtn.style.borderColor = '#444';
      playBtn.disabled = false;
      playBtn.style.opacity = '1';
      playBtn.style.cursor = 'pointer';
      stopBtn.disabled = true;
      stopBtn.style.opacity = '0.4';
      stopBtn.style.cursor = 'not-allowed';
    });

    row.append(lblEl, playBtn, stopBtn);
    list.appendChild(row);
  });

  app.appendChild(list);
}
