// src/main.js
// Entry point: wires the Start overlay to the AudioEngine bootstrap,
// then renders the full mixer UI (Phase 3).

import { ensureRunning, getMasterGain } from './audio/AudioEngine.js';
import { startSound, stopSound, setGain, isPlaying } from './audio/soundManager.js';
import { catalog } from './data/catalog.js';

const startBtn = document.getElementById('start-btn');
const startOverlay = document.getElementById('start-overlay');
const app = document.getElementById('app');

const DEFAULT_GAIN_NOISE = 0.15;
const DEFAULT_GAIN_SAMPLE = 0.8;
const volumeMap = new Map(); // id -> number, persists volume across toggle cycles

startBtn.addEventListener('click', async () => {
  try {
    const ctx = await ensureRunning();
    console.log('[main] AudioContext state after resume:', ctx.state);
    startOverlay.remove();
    app.style.display = 'block';
    renderMixer();
  } catch (err) {
    console.error('[main] AudioContext failed to start:', err);
  }
});

function renderMixer() {
  // Inject focus-visible style for toggle buttons
  const style = document.createElement('style');
  style.textContent = '.btn-toggle:focus-visible{outline:2px solid #ffffff;outline-offset:3px;}';
  document.head.appendChild(style);

  const list = document.createElement('div');
  list.id = 'sound-list';
  list.style.cssText = 'display:flex;flex-direction:column;gap:0;';

  catalog.forEach(({ id, label, type }) => {
    const defaultVol = type === 'noise' ? DEFAULT_GAIN_NOISE : DEFAULT_GAIN_SAMPLE;
    volumeMap.set(id, defaultVol);

    const row = document.createElement('div');
    row.className = 'sound-row';
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #2a2a2a;';

    // 1. Label
    const lblEl = document.createElement('span');
    lblEl.className = 'sound-label';
    lblEl.textContent = label;
    lblEl.style.cssText = 'color:#ffffff;font-size:16px;font-weight:400;min-width:100px;';

    // 3. Volume slider (created before toggle button so toggle handler can reference it)
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'volume-slider';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.01';
    slider.value = String(defaultVol);
    slider.style.cssText = 'flex:1;';
    slider.disabled = true;
    slider.style.opacity = '0.4';
    slider.style.pointerEvents = 'none';

    slider.addEventListener('input', () => {
      const val = parseFloat(slider.value);
      setGain(id, val);
      volumeMap.set(id, val);
    });

    // 2. Toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn-toggle';

    function setActiveState() {
      toggleBtn.textContent = '\u25A0 Stop';
      toggleBtn.style.cssText = 'background:#4caf50;color:#ffffff;border:1px solid #4caf50;font-size:16px;font-weight:600;min-height:44px;padding:4px 12px;border-radius:4px;cursor:pointer;';
      slider.disabled = false;
      slider.style.opacity = '1';
      slider.style.pointerEvents = 'auto';
      slider.value = String(volumeMap.get(id));
    }

    function setInactiveState() {
      toggleBtn.textContent = '\u25B6 Play';
      toggleBtn.style.cssText = 'background:#1e1e1e;color:#ffffff;border:1px solid #444;font-size:16px;font-weight:600;min-height:44px;padding:4px 12px;border-radius:4px;cursor:pointer;';
      slider.disabled = true;
      slider.style.opacity = '0.4';
      slider.style.pointerEvents = 'none';
    }

    // Initial state based on isPlaying (handles HMR during dev)
    if (isPlaying(id)) {
      setActiveState();
    } else {
      setInactiveState();
    }

    toggleBtn.addEventListener('click', async () => {
      try {
        if (!isPlaying(id)) {
          await startSound(id);
          setGain(id, volumeMap.get(id));
          setActiveState();
        } else {
          stopSound(id);
          setInactiveState();
        }
      } catch (err) {
        console.error(`[main] Failed to start ${id}: ${err.message}`);
      }
    });

    row.append(lblEl, toggleBtn, slider);
    list.appendChild(row);
  });

  app.appendChild(list);

  // Divider between sound rows and master volume
  const divider = document.createElement('div');
  divider.className = 'mixer-divider';
  divider.style.cssText = 'border-top:1px solid #444;margin:16px 0;';
  app.appendChild(divider);

  // Master volume section
  const masterSection = document.createElement('div');
  masterSection.id = 'master-volume';
  masterSection.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 0;';

  const masterLabel = document.createElement('span');
  masterLabel.textContent = 'Master Volume';
  masterLabel.style.cssText = 'font-size:16px;font-weight:600;color:#ffffff;min-width:100px;';

  const masterSlider = document.createElement('input');
  masterSlider.type = 'range';
  masterSlider.id = 'master-slider';
  masterSlider.min = '0';
  masterSlider.max = '1';
  masterSlider.step = '0.01';
  masterSlider.value = '1.0';
  masterSlider.style.cssText = 'flex:1;';

  masterSlider.addEventListener('input', () => {
    getMasterGain().gain.value = parseFloat(masterSlider.value);
  });

  masterSection.append(masterLabel, masterSlider);
  app.appendChild(masterSection);
}
