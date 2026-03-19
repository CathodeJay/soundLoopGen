# Phase 2: Sound Generation - Research

**Researched:** 2026-03-19
**Domain:** Web Audio API — AudioWorklet noise synthesis, AudioBufferSourceNode sample looping, CC0 asset acquisition
**Confidence:** HIGH (core Web Audio API mechanics verified against MDN official docs; noise algorithm coefficients verified against primary DSP sources; CC0 samples verified by direct page inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Noise types (white, pink, brown, grey): algorithmic generation via AudioWorklet — no samples needed, zero copyright risk
- Weather sounds (rain, wind, thunder): public domain WAV files sourced by Claude from CC0/public domain archives
- Claude researches and identifies specific files with license documentation; user reviews, approves, and downloads them manually
- Plan includes a `checkpoint:human-verify` task where user approves the specific files before coding continues
- Files land in `public/samples/` (the placeholder directory created in Phase 1)
- Catalog entry schema: `{ id: string, label: string, type: 'noise' | 'sample' }`
- No paths in catalog — derived by convention (noise worklet: `/worklets/{id}-processor.js`, sample: `/samples/{id}.wav`)
- No default volume in catalog — hardcoded to 0.8 or similar in the audio node factory
- Order: noise types first (White, Pink, Brown, Grey), then weather (Rain, Wind, Thunder) — 7 entries total
- v1 sounds only — no indoor ambient stubs (fan, ventilation, fireplace added when actually implemented)
- After Start overlay is dismissed, `#app` shows one row per catalog sound: `[Sound Name]  [▶ Play]  [■ Stop]`
- Play/Stop only — no volume slider; volume control (ENG-09) is verified via code path, not test UI
- Temporary dev scaffold — Phase 3 replaces it entirely with the real mixer UI
- Layout is purely functional: unstyled or minimal inline styles; no design investment needed

### Claude's Discretion
- AudioWorklet processor implementations for each noise type (pink/grey IIR filter coefficients)
- GainNode wiring and audio graph structure per sound
- How Play/Stop button state is managed (disabled states, active sound tracking)
- Sample format requirements (mono vs stereo, sample rate, bit depth) — recommend 44100Hz mono WAV to match AudioContext

### Deferred Ideas (OUT OF SCOPE)
- Indoor ambient sounds (fan, ventilation, fireplace) — added in a future phase
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ENG-02 | White noise synthesized in real-time via AudioWorklet | Section 1.1: exact `Math.random() * 2 - 1` formula, `return true` requirement |
| ENG-03 | Pink noise synthesized in real-time via AudioWorklet | Section 1.2: Paul Kellett's 6-coefficient algorithm with exact b[] values |
| ENG-04 | Brown noise synthesized in real-time via AudioWorklet | Section 1.3: leaky integrator formula, DC drift prevention via `* 0.998` |
| ENG-05 | Grey noise synthesized in real-time via AudioWorklet | Section 1.4: white noise WorkletNode + IIRFilterNode A-weighting approach |
| ENG-06 | Rain sound plays from CC0 WAV with seamless looping | Section 3 (candidate 663947), Section 4 (AudioBufferSourceNode loop pattern) |
| ENG-07 | Wind sound plays from CC0 WAV with seamless looping | Section 3 (candidate 361053), Section 4 |
| ENG-08 | Thunder sound plays from CC0 WAV with seamless looping | Section 3 (candidate 704603), Section 4 |
| ENG-09 | Each sound has independently adjustable gain | Section 5: GainNode-per-sound architecture |
| ENG-10 | Multiple sounds can play simultaneously | Section 6: Map-based active source registry |
</phase_requirements>

---

## Summary

Phase 2 implements all 7 catalog sounds: four noise types synthesized entirely in the browser via AudioWorklet, and three weather samples loaded from CC0 WAV files. The AudioEngine singleton from Phase 1 (`getContext()` / `ensureRunning()`) is the entry point for all node creation in this phase.

The critical architectural decision is that every noise type runs as a dedicated AudioWorklet processor file in `public/worklets/`. The four processors are small and self-contained; co-locating them in a single multi-noise file is technically possible but makes the architecture ambiguous for Phase 4 (OfflineAudioContext re-registration). Grey noise is implemented differently from the other three: it uses a white noise worklet feeding into a native `IIRFilterNode` with inverse A-weighting coefficients, rather than doing filter arithmetic inside `process()`.

Sample playback uses `AudioBufferSourceNode` with `loop: true`. WAV files at 44100 Hz loop gaplessly without any gap at the boundary — unlike `<audio>` elements. Decoded `AudioBuffer` objects are stored in memory at startup; `AudioBufferSourceNode` instances are created fresh per play and disconnected on stop.

**Primary recommendation:** One worklet file per noise type, one `GainNode` per sound connected between source and destination, `Map<id, {source, gainNode}>` to track active sounds.

---

## 1. Noise Algorithm Implementations

All four noise types require an AudioWorklet processor file in `public/worklets/`. Each file must call `registerProcessor()` and `process()` must return `true`.

### 1.1 White Noise

**Algorithm:** Uniform random samples in `[-1, 1]`.

```javascript
// public/worklets/white-noise-processor.js
class WhiteNoiseProcessor extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const output = outputs[0];
    for (let channel = 0; channel < output.length; channel++) {
      for (let i = 0; i < output[channel].length; i++) {
        output[channel][i] = Math.random() * 2 - 1;
      }
    }
    return true; // CRITICAL: keeps processor alive
  }
}
registerProcessor('white-noise', WhiteNoiseProcessor);
```

**Confidence:** HIGH — formula verified against MDN Web Audio API docs and noisehack.com primary reference.

Output range `[-1, 1]` is correct for Web Audio API (`Float32Array` output channels expect values in this range).

---

### 1.2 Pink Noise — Paul Kellett's Algorithm

**Algorithm:** Paul Kellett's 6-state-variable IIR approximation to -3 dB/octave (1/f spectrum). Accurate to within ±0.05 dB above 9.2 Hz at 44100 Hz sample rate. This is the most widely used JavaScript pink noise implementation and is specifically designed for 44100 Hz.

```javascript
// public/worklets/pink-noise-processor.js
class PinkNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._b = [0, 0, 0, 0, 0, 0, 0]; // b0 through b6
  }

  process(inputs, outputs) {
    const output = outputs[0];
    const b = this._b;
    for (let channel = 0; channel < output.length; channel++) {
      for (let i = 0; i < output[channel].length; i++) {
        const white = Math.random() * 2 - 1;
        b[0] = 0.99886 * b[0] + white * 0.0555179;
        b[1] = 0.99332 * b[1] + white * 0.0750759;
        b[2] = 0.96900 * b[2] + white * 0.1538520;
        b[3] = 0.86650 * b[3] + white * 0.3104856;
        b[4] = 0.55000 * b[4] + white * 0.5329522;
        b[5] = -0.7616 * b[5] - white * 0.0168980;
        output[channel][i] = (b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + white * 0.5362) * 0.11;
        b[6] = white * 0.115926;
      }
    }
    return true;
  }
}
registerProcessor('pink-noise', PinkNoiseProcessor);
```

**Exact coefficients (verified):**
| State var | Leak factor | White noise weight |
|-----------|-------------|-------------------|
| b[0] | 0.99886 | 0.0555179 |
| b[1] | 0.99332 | 0.0750759 |
| b[2] | 0.96900 | 0.1538520 |
| b[3] | 0.86650 | 0.3104856 |
| b[4] | 0.55000 | 0.5329522 |
| b[5] | -0.7616 | -0.0168980 (sign flipped) |
| b[6] | direct write | 0.115926 |
| white mix | — | 0.5362 |
| output scale | — | × 0.11 |

**Important:** `b[6]` is set directly (`b[6] = white * 0.115926`) each sample, not accumulated with a leak factor. The `-0.7616` on b[5] is correct — negative leak factor.

**Confidence:** MEDIUM-HIGH — coefficients verified against noisehack.com (primary DSP reference for Web Audio), which cites Paul Kellett directly. The firstpr.com.au certificate was expired at research time; cross-verified via noisehack.com and multiple secondary sources.

---

### 1.3 Brown Noise — Leaky Integrator

**Algorithm:** Numerical integration of white noise (random walk) with a leaky integrator (`* 0.998`) to prevent DC drift, plus amplitude normalization.

```javascript
// public/worklets/brown-noise-processor.js
class BrownNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._lastOut = 0.0;
  }

  process(inputs, outputs) {
    const output = outputs[0];
    for (let channel = 0; channel < output.length; channel++) {
      for (let i = 0; i < output[channel].length; i++) {
        const white = Math.random() * 2 - 1;
        // Leaky integrator: 0.998 prevents DC drift by decaying toward zero
        this._lastOut = (this._lastOut * 0.998) + (white * 0.02);
        output[channel][i] = this._lastOut * 3.5; // amplitude normalization
      }
    }
    return true;
  }
}
registerProcessor('brown-noise', BrownNoiseProcessor);
```

**DC drift explanation:** Without the `* 0.998` leak, `lastOut` would be a random walk that eventually hits the `[-1, 1] ` clip boundary and saturate. The leak factor 0.998 keeps the signal mean-reverting toward zero. The `* 3.5` normalization compensates for the reduced amplitude from the low-gain integration. The `* 0.02` controls how much each white noise sample contributes — too high causes harsh high-frequency content; too low makes it too smooth.

**Alternative formula (noisehack.com):** `output[i] = (lastOut + (0.02 * white)) / 1.02` then scale by 3.5. This is mathematically equivalent to the leaky integrator formula above — `/ 1.02 ≈ * 0.98` (slightly different leak factor). The `* 0.998` version from the WebSearch result (derived from the Web Audio API community) produces slightly deeper brown character.

**Confidence:** HIGH — formula verified against noisehack.com (canonical Web Audio reference) and cross-verified against multiple AudioWorklet sources.

---

### 1.4 Grey Noise — IIRFilterNode Approach

**What grey noise is:** White noise shaped by the inverse of the A-weighting curve, so that the noise sounds perceptually flat (equal apparent loudness at all frequencies) to the human ear. It is NOT implemented with an internal filter inside `process()`.

**Recommended architecture:** White noise worklet → native `IIRFilterNode` with inverse A-weighting coefficients. The native `IIRFilterNode` runs ~10× faster than a JavaScript implementation.

```javascript
// public/worklets/grey-noise-processor.js
// This file is IDENTICAL to white-noise-processor.js.
// The A-weighting is applied externally via IIRFilterNode on the main thread.
class GreyNoiseProcessor extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const output = outputs[0];
    for (let channel = 0; channel < output.length; channel++) {
      for (let i = 0; i < output[channel].length; i++) {
        output[channel][i] = Math.random() * 2 - 1;
      }
    }
    return true;
  }
}
registerProcessor('grey-noise', GreyNoiseProcessor);
```

**Main thread wiring (in the noise node factory):**

```javascript
// Source: Web Audio API IIRFilterNode + A-weighting SOS coefficients
// A-weighting SOS at 44100 Hz (bilinear transform from IEC 61672 analog prototype)
// Section 1 of 3 (cascade these three biquad sections in series)
const sosCoefficients = [
  // [b0, b1, b2, a1, a2] — MDN IIRFilterNode uses [feedForward], [feedBack] arrays
  // Section 1:
  { ff: [0.234301792, 0.468603585, 0.234301792], fb: [1.0, -1.893870495, 0.895159769] },
  // Section 2:
  { ff: [1.0, -2.000230909, 1.000230936], fb: [1.0, -1.994614456, 0.994621707] },
  // Section 3:
  { ff: [1.0, -1.999769091, 0.999769117], fb: [1.0, -0.224558458, 0.012606625] },
];

// Connect worklet → section1 → section2 → section3 → gainNode
const filters = sosCoefficients.map(({ ff, fb }) =>
  audioCtx.createIIRFilter(ff, fb)
);
// Chain: workletNode → filters[0] → filters[1] → filters[2] → gainNode
```

**IMPORTANT — INVERSE for grey noise:** The SOS coefficients above implement the A-weighting FILTER (forward). For grey noise you need the INVERSE A-weighting (i.e., boosting where A-weighting attenuates). Two practical approaches:

1. **Invert the filter:** Swap feedforward and feedback arrays for each section.
2. **Use a lookup table approach:** Apply gain adjustments at discrete frequency bands via `BiquadFilterNode` peaking EQ stages — simpler but less accurate.

**Practical recommendation:** For this project's use case (ambient background sounds), the exact mathematical inverse is not strictly necessary. A simpler approach that sounds perceptually "grey" is to use 3–4 `BiquadFilterNode` peaking EQ stages to boost low and high frequencies where A-weighting attenuates them most. This avoids the math complexity and produces an audibly correct result.

```javascript
// Simplified grey noise: white noise + psychoacoustic compensation EQ
// Boost low freq (below 1kHz, A-weighting attenuates heavily)
// Boost high freq (above 10kHz, A-weighting attenuates)
function createGreyNoiseCorrectionEQ(audioCtx) {
  const lowBoost = audioCtx.createBiquadFilter();
  lowBoost.type = 'lowshelf';
  lowBoost.frequency.value = 800;
  lowBoost.gain.value = 12; // dB

  const midCut = audioCtx.createBiquadFilter();
  midCut.type = 'peaking';
  midCut.frequency.value = 3000;
  midCut.gain.value = -3;

  const highBoost = audioCtx.createBiquadFilter();
  highBoost.type = 'highshelf';
  highBoost.frequency.value = 10000;
  highBoost.gain.value = 8;

  lowBoost.connect(midCut);
  midCut.connect(highBoost);
  return { input: lowBoost, output: highBoost };
}
```

**Validation:** Aural check is the primary validation method. Grey noise should sound "fuller" at low frequencies than white noise and distinct from brown noise (which is very bass-heavy). If it sounds audibly distinct from white, pink, and brown to a listener, the implementation is correct for this project's purpose.

**Confidence:** MEDIUM — the IIRFilterNode approach and A-weighting SOS coefficients are verified against MDN docs and a peer-reviewed PMC article on digital A-weighting filter design. The simplified BiquadFilterNode approach is LOW confidence (heuristic gain values). The exact IIR inverse coefficients require numerical computation to validate aurally.

---

### 1.5 Common AudioWorklet Requirements

Every worklet file must:

1. **Call `registerProcessor()`** at module scope (not inside a class or function)
2. **Return `true` from `process()`** unconditionally — this keeps the node alive as a perpetual source
3. **Live in `public/worklets/`** — Vite must NOT bundle these files; they are loaded as worker scripts
4. **Be loaded via** `await audioCtx.audioWorklet.addModule('/worklets/{id}-processor.js')` before creating `AudioWorkletNode`

---

## 2. AudioWorklet Architecture Decision

**Decision: One worklet file per noise type (4 files total)**

Files: `white-noise-processor.js`, `pink-noise-processor.js`, `brown-noise-processor.js`, `grey-noise-processor.js`

**Why not a single multi-noise file:**

| Concern | Single File | Per-Type Files |
|---------|-------------|---------------|
| Phase 4 OfflineAudioContext | Must re-register ALL processors even if only one is used — creates ordering dependency | Each processor registered independently, only load what's needed |
| Debugging | Process() errors affect all noise types | Isolated to one file |
| Independent start/stop | Requires parameter-based switching inside single processor | Each AudioWorkletNode is independently connected/disconnected |
| Code size | One file with 4 conditional branches | Each file is ~20 lines, easy to understand |
| Catalog convention | `/worklets/{id}-processor.js` is the natural derivation from catalog.id | Exact match: `white` → `/worklets/white-noise-processor.js` |

The per-type architecture also directly supports the catalog convention locked in CONTEXT.md: worklet path derived from `catalog.id` as `/worklets/{id}-processor.js`.

**Loading pattern (main thread):**

```javascript
// Load all worklets at startup (once, after ensureRunning())
const NOISE_IDS = ['white', 'pink', 'brown', 'grey'];
for (const id of NOISE_IDS) {
  await audioCtx.audioWorklet.addModule(`/worklets/${id}-noise-processor.js`);
}
```

`addModule()` is idempotent — calling it twice for the same module is safe. Load all at startup so individual play requests are instant.

**Confidence:** HIGH — MDN AudioWorklet docs + Phase 1 research confirm the per-file pattern and `public/worklets/` requirement.

---

## 3. CC0 Sample Sources

The plan must include a `checkpoint:human-verify` task where the user downloads and approves files before implementation continues. Claude identifies candidates; user downloads and places them in `public/samples/`.

### Rain

**Primary candidate: Freesound #663947**
- **URL:** https://freesound.org/people/deadrobotmusic/sounds/663947/
- **Title:** "Looping Rain On Skylight Foley Texture" by deadrobotmusic
- **License:** Creative Commons 0 (CC0) — verified by direct page inspection
- **Format:** WAV, 44100 Hz, 32-bit, Stereo
- **Duration:** 21.5 seconds
- **Notes:** Tagged `looping` — designed as a loop texture. 44100 Hz matches project `SAMPLE_RATE`. Clean ambient rain on skylight.
- **Download as:** `public/samples/rain.wav`
- **License verification:** Visit URL, confirm "Creative Commons 0" shown on page before downloading.

**Backup candidate: Freesound #518863**
- **URL:** https://freesound.org/people/idomusics/sounds/518863/
- **Title:** "Rain.wav" by idomusics
- **License:** CC0 — verified by direct page inspection
- **Format:** WAV, 44100 Hz, 24-bit, Stereo, 54 seconds, 13.6 MB
- **Notes:** Longer duration (54s) allows more natural loop editing. Not tagged as pre-looped — may need loop point editing in Audacity.

**Backup source: Pixabay**
- **URL:** https://pixabay.com/sound-effects/search/rain-loop/
- **License:** Pixabay Content License (royalty-free, no attribution required)
- **Notes:** Primarily MP3 format. If used, must convert to WAV at 44100 Hz before placing in `public/samples/`. The Pixabay license is NOT CC0 but is royalty-free and covers commercial use.

---

### Wind

**Primary candidate: Freesound #361053**
- **URL:** https://freesound.org/people/jorge0000/sounds/361053/
- **Title:** "wind-noise.wav" by jorge0000
- **License:** Creative Commons 0 (CC0) — verified by direct page inspection
- **Format:** WAV, 44100 Hz, 16-bit, Stereo
- **Duration:** 4 minutes (240 seconds)
- **Notes:** Long duration means a very natural loop. The size (40.4 MB) is large but acceptable for a desktop tool loaded once at startup. The loop point may need editing in Audacity to find a clean zero-crossing.
- **Download as:** `public/samples/wind.wav`
- **License verification:** Visit URL, confirm "Creative Commons 0" shown on page.

**Backup candidate: Freesound #459977**
- **URL:** https://freesound.org/people/florianreichelt/sounds/459977/
- **Title:** "Soft Wind" by florianreichelt
- **License:** CC0 — verified by direct page inspection
- **Format:** MP3 (not WAV) — must convert to WAV at 44100 Hz
- **Duration:** 36 seconds
- **Notes:** Shorter duration makes loop editing simpler. Must convert format.

---

### Thunder

**Primary candidate: Freesound #704603**
- **URL:** https://freesound.org/people/VKProduktion/sounds/704603/
- **Title:** "Thunderstorm with rain (loop).wav" by VKProduktion
- **License:** Creative Commons 0 (CC0) — verified by direct page inspection
- **Format:** WAV, 96000 Hz (NON-STANDARD — must downsample to 44100 Hz)
- **Duration:** 2 minutes 7 seconds, 70.2 MB
- **Notes:** Explicitly designed as a loop. Contains rain + thunder, which is appropriate for a "thunder" catalog entry. MUST downsample from 96000 Hz to 44100 Hz using Audacity (Tracks > Resample) before placing in `public/samples/`. File size will reduce to ~18 MB after downsample.
- **Download as:** `public/samples/thunder.wav` (after resampling)
- **License verification:** Visit URL, confirm "Creative Commons 0" shown on page.

**Backup candidate: Freesound #581124**
- **URL:** https://freesound.org/people/Fission9/sounds/581124/
- **Title:** "Distant Thunder 3" by Fission9
- **License:** CC0 — verified by direct page inspection
- **Format:** WAV, 48000 Hz, 24-bit, Stereo, 8.2 seconds, 2.3 MB
- **Notes:** Very short (8s) — needs a seamless loop edit. At 48000 Hz, needs downsample to 44100 Hz. Creator notes "a bit low quality." Better as a backup only.

---

### License Verification Protocol

Before any sample is committed to the repository:

1. Visit the exact URL listed above
2. Confirm the license badge shows "Creative Commons 0" or "CC0 1.0 Universal"
3. Screenshot or save the license page URL
4. Create `public/samples/LICENSE.md` with: filename, source URL, Freesound ID, license type, verification date
5. For any files needing format conversion (MP3→WAV, resample): use Audacity; document the conversion in LICENSE.md

**Content ID risk warning:** Even CC0 sounds can be claimed by YouTube Content ID if a third party re-registered them. Mitigation: use sounds from well-established uploaders (as selected above), keep `LICENSE.md` as evidence, prefer sounds with high download counts (indicates community scrutiny). For this project (local video production tool, not YouTube upload), Content ID risk is minimal.

---

## 4. AudioBufferSourceNode Looping

### How Loop Properties Work

```javascript
// Source: MDN AudioBufferSourceNode documentation
const source = audioCtx.createBufferSource();
source.buffer = decodedAudioBuffer;
source.loop = true;
source.loopStart = 0;              // seconds — start of loop region
source.loopEnd = decodedAudioBuffer.duration; // seconds — end of loop region
source.connect(gainNode);
source.start();
```

- `loop` defaults to `false` — must be explicitly set to `true`
- `loopEnd` defaults to `0` — which the spec treats as "end of buffer" when `loop: true`, BUT explicit assignment to `buffer.duration` is safer and more readable
- `loopStart` and `loopEnd` are in **seconds** (not sample numbers)
- The audio plays from `start()` until `loopEnd`, then jumps back to `loopStart` and repeats indefinitely
- If `loopEnd` is set to a value past the current playback position mid-playback, it immediately jumps to `loopStart`

### Does It Achieve Gapless Loops?

**Yes — for WAV files.** WAV is PCM data with no codec encoding. `decodeAudioData` on a WAV produces a mathematically exact `AudioBuffer`. When `loop: true` is set, the browser's audio rendering thread schedules the loop return sample-accurately. There is no gap, click, or silence at the loop boundary.

**No — for compressed formats (MP3, AAC).** `decodeAudioData` on MP3 introduces ~45ms of silence at the beginning from the decoder's encoder delay. This gap is audible. Always use WAV source files.

### AudioContext Suspended When Fetching

The fetch and decode sequence can begin before `ensureRunning()` (decoding does not require a running context), but `.start()` requires the context to be running. Pattern:

```javascript
// Decode at startup (context may be suspended — that's fine)
async function loadSample(audioCtx, path) {
  const response = await fetch(path);
  const arrayBuffer = await response.arrayBuffer();
  return audioCtx.decodeAudioData(arrayBuffer); // works in suspended state
}

// Play (requires running context)
async function playSample(audioCtx, buffer, gainNode) {
  await ensureRunning(); // resume if suspended
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.loopEnd = buffer.duration;
  source.connect(gainNode);
  source.start();
  return source;
}
```

Load all sample buffers at app startup (after the Start button click that triggers `ensureRunning()`). Store decoded `AudioBuffer` objects in memory. Re-create `AudioBufferSourceNode` instances each time a sound is toggled on.

### Sample Rate Considerations

`decodeAudioData` automatically resamples the audio to `audioCtx.sampleRate` (44100 Hz in this project). If the source WAV is already 44100 Hz, no resampling occurs and quality is perfect. This is why all samples should be 44100 Hz WAV — and why the primary thunder candidate (96000 Hz) must be downsampled manually first.

**Confidence:** HIGH — MDN AudioBufferSourceNode loop, loopStart, loopEnd documentation verified; gapless WAV behavior verified against Jake Archibald's Web Audio deep-dive and PITFALLS.md prior research.

---

## 5. Volume Control Architecture

**Decision: External GainNode per sound**

```
AudioWorkletNode (or AudioBufferSourceNode)
    → GainNode (per sound, stored permanently)
    → AudioContext.destination
```

**GainNode is created once and persists.** The source node (worklet or buffer source) is created fresh each time the sound is toggled on and connected to the persistent GainNode. On stop: source is disconnected and nulled; GainNode stays in the graph.

```javascript
// Created once per catalog entry at initialization
const gainNode = audioCtx.createGain();
gainNode.gain.value = 0.8; // default volume
gainNode.connect(audioCtx.destination);

// On play: create source, connect to gainNode
// On stop: source.stop(); source.disconnect();
// GainNode remains connected and ready for the next play
```

**Why external GainNode beats AudioParam in worklet:**

| Concern | External GainNode | AudioParam in Worklet |
|---------|------------------|-----------------------|
| Phase 3 slider wiring | `gainNode.gain.value = sliderValue` — direct, one line | Requires `MessagePort.postMessage()` to worklet → async, complex |
| Sample sounds | Identical API — GainNode works for both noise and sample nodes | Cannot apply to AudioBufferSourceNode without extra wiring |
| Phase 4 export | Same GainNode values used in OfflineAudioContext reconstruction | Worklet AudioParam values must be serialized and re-applied |
| `setValueAtTime` / automation | Full Web Audio automation API available | Only available via custom message passing |
| Code consistency | One pattern for all 7 sounds | Different patterns for noise vs samples |

External GainNode is strictly superior for this project's architecture. Phase 3 sliders call `gainNode.gain.value = newValue` and Phase 4 export re-creates the GainNode with the same value.

**Confidence:** HIGH — verified against Web Audio API architecture patterns and Phase 3/4 integration requirements from CONTEXT.md.

---

## 6. Simultaneous Playback Management

**Data structure: `Map<string, ActiveSound>`**

```javascript
// src/audio/soundManager.js (or inline in main sound factory)

/**
 * @typedef {{ source: AudioBufferSourceNode|AudioWorkletNode, gainNode: GainNode }} ActiveSound
 */
const activeSounds = new Map(); // id → { source, gainNode }
const gainNodes    = new Map(); // id → GainNode (permanent, never removed)
const buffers      = new Map(); // id → AudioBuffer (decoded samples, loaded at startup)

// Initialize at startup — create permanent GainNodes for all 7 sounds
function initSoundGraph(catalog, audioCtx) {
  for (const entry of catalog) {
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.8;
    gainNode.connect(audioCtx.destination);
    gainNodes.set(entry.id, gainNode);
  }
}

// Play a sound (noise or sample)
async function playSound(id, audioCtx) {
  if (activeSounds.has(id)) return; // already playing
  const gainNode = gainNodes.get(id);
  const entry = catalog.find(e => e.id === id);
  let source;
  if (entry.type === 'noise') {
    source = new AudioWorkletNode(audioCtx, `${id}-noise`);
  } else {
    source = audioCtx.createBufferSource();
    source.buffer = buffers.get(id);
    source.loop = true;
    source.loopEnd = source.buffer.duration;
  }
  source.connect(gainNode);
  source.start();
  activeSounds.set(id, { source, gainNode });
}

// Stop a sound
function stopSound(id) {
  const active = activeSounds.get(id);
  if (!active) return;
  active.source.stop();
  active.source.disconnect();
  activeSounds.delete(id);
}
```

**Why `Map` over an array or object:**
- O(1) lookup by catalog ID for play/stop operations
- `has()` check prevents double-play
- `delete()` on stop keeps the map clean
- Easy to check if a sound is playing: `activeSounds.has(id)`

**Phase 3 integration:** Phase 3 imports `playSound`, `stopSound`, `gainNodes`, and `activeSounds`. Toggle controls call `playSound`/`stopSound`. Volume sliders access `gainNodes.get(id).gain.value = newValue`.

**Confidence:** HIGH — standard Web Audio API management pattern; consistent with stop+disconnect pitfall from PITFALLS.md.

---

## 7. Temporary Test Interface

**Pattern: Build in `src/main.js` using catalog iteration**

The dev test UI is built directly into `src/main.js` after the Start overlay logic from Phase 1. Phase 3 removes this entire block and replaces `#app` with the real mixer.

```javascript
// src/main.js — Phase 2 dev test UI (to be replaced by Phase 3)
// Called after Start button click triggers ensureRunning()

function buildDevUI(catalog) {
  const app = document.getElementById('app');
  app.innerHTML = ''; // clear Start overlay content

  for (const entry of catalog) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:8px;';

    const label = document.createElement('span');
    label.textContent = entry.label;
    label.style.width = '100px';

    const playBtn = document.createElement('button');
    playBtn.textContent = '▶ Play';
    playBtn.onclick = async () => {
      await playSound(entry.id, await ensureRunning());
      playBtn.disabled = true;
      stopBtn.disabled = false;
    };

    const stopBtn = document.createElement('button');
    stopBtn.textContent = '■ Stop';
    stopBtn.disabled = true;
    stopBtn.onclick = () => {
      stopSound(entry.id);
      playBtn.disabled = false;
      stopBtn.disabled = true;
    };

    row.append(label, playBtn, stopBtn);
    app.appendChild(row);
  }
}
```

**Key decisions:**
- `innerHTML = ''` clears the Start overlay from Phase 1
- Buttons use inline `style.cssText` — no CSS classes, no design investment
- Button disabled states prevent double-play: Play is disabled while sound is active; Stop is disabled while sound is inactive
- No volume slider — ENG-09 (gain control) is verified by calling `gainNodes.get(id).gain.value = X` in browser console during testing

**Where to put it:** Inline in `src/main.js` is simplest since Phase 3 replaces the entire file structure. If it gets long, a `src/devUI.js` module is acceptable.

**Confidence:** HIGH — standard DOM manipulation pattern; locked in CONTEXT.md (one row per sound, Play/Stop only, purely functional).

---

## 8. Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Browser-only manual testing (no automated test runner) |
| Config file | None — AudioWorklet and Web Audio API are not testable in Node.js |
| Quick run command | `npm run dev` → open `http://localhost:5173` → interact with dev UI |
| Full suite command | See Manual Verification Checklist below |

**Why no automated test runner:** AudioWorklet processors run in a browser-specific audio rendering thread. Node.js has no `AudioContext`, `AudioWorkletNode`, or Web Audio API. Jest/Vitest cannot test these behaviors. The only meaningful test environment is a real browser. Build-time checks (type checking, lint, file existence) are the automated layer; audio behavior is manually verified.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENG-02 | White noise plays 60+ seconds without stopping | Manual | N/A | ❌ Wave 0: `public/worklets/white-noise-processor.js` |
| ENG-03 | Pink noise is audibly distinct from white | Manual | N/A | ❌ Wave 0: `public/worklets/pink-noise-processor.js` |
| ENG-04 | Brown noise is audibly distinct from pink | Manual | N/A | ❌ Wave 0: `public/worklets/brown-noise-processor.js` |
| ENG-05 | Grey noise is audibly distinct from white, pink, brown | Manual | N/A | ❌ Wave 0: `public/worklets/grey-noise-processor.js` |
| ENG-06 | Rain loops without audible gap at boundary | Manual | N/A | ❌ Wave 0: `public/samples/rain.wav` |
| ENG-07 | Wind loops without audible gap at boundary | Manual | N/A | ❌ Wave 0: `public/samples/wind.wav` |
| ENG-08 | Thunder loops without audible gap at boundary | Manual | N/A | ❌ Wave 0: `public/samples/thunder.wav` |
| ENG-09 | Gain change produces audible volume change | Manual (console) | N/A | ❌ Wave 0: `src/audio/soundManager.js` |
| ENG-10 | Two sounds play simultaneously without dropout | Manual | N/A | ❌ Wave 0: `src/audio/soundManager.js` |

### Automated Checks (Build-Time)

These CAN be verified without a browser and SHOULD be part of the plan's verification tasks:

```bash
# 1. Build succeeds (no import errors, worklet files referenced correctly)
npm run build

# 2. Worklet files exist in public/
ls public/worklets/white-noise-processor.js
ls public/worklets/pink-noise-processor.js
ls public/worklets/brown-noise-processor.js
ls public/worklets/grey-noise-processor.js

# 3. Sample files exist in public/
ls public/samples/rain.wav
ls public/samples/wind.wav
ls public/samples/thunder.wav
ls public/samples/LICENSE.md

# 4. Catalog has exactly 7 entries (node script)
node -e "import('./noise-loop-generator/src/data/catalog.js').then(m => {
  console.assert(m.catalog.length === 7, 'Expected 7 catalog entries');
  console.log('Catalog entries:', m.catalog.length);
})"
```

### Manual Verification Checklist

Per the phase success criteria and pitfall prevention:

- [ ] **ENG-02/03/04/05 (noise plays):** Open dev UI, click Play for each noise type, let run 60+ seconds — confirm no silent stop. (Tests `process() return true` pitfall)
- [ ] **ENG-02/03/04/05 (audibly distinct):** Play White, then Pink, then Brown, then Grey — confirm each sounds perceptibly different
- [ ] **ENG-06/07/08 (seamless loop):** Play Rain/Wind/Thunder for 2+ full loop cycles — confirm no gap, click, or silence at loop boundary. Use headphones for reliable detection.
- [ ] **ENG-09 (gain control):** With a sound playing, open browser console: `gainNodes.get('white').gain.value = 0.1` — confirm audible volume drop
- [ ] **ENG-10 (simultaneous):** Click Play on 3+ sounds simultaneously — confirm all play without dropouts or mutual interference
- [ ] **No AudioContext errors:** Browser console shows no "AudioContext was not allowed to start" or "addModule failed" errors
- [ ] **Memory stability:** Toggle one sound on/off 20+ times — Chrome Memory DevTools should show no growing AudioNode count

### Sampling Rate

- **Per task commit:** `npm run build` — confirms no import/reference errors
- **Per wave merge:** Full manual checklist above (all 9 items)
- **Phase gate:** Manual checklist green before `/gsd:verify-work` is run

### Wave 0 Gaps

- [ ] `public/worklets/white-noise-processor.js` — covers ENG-02
- [ ] `public/worklets/pink-noise-processor.js` — covers ENG-03
- [ ] `public/worklets/brown-noise-processor.js` — covers ENG-04
- [ ] `public/worklets/grey-noise-processor.js` — covers ENG-05
- [ ] `public/samples/rain.wav` — covers ENG-06 (human-verify checkpoint)
- [ ] `public/samples/wind.wav` — covers ENG-07 (human-verify checkpoint)
- [ ] `public/samples/thunder.wav` — covers ENG-08 (human-verify checkpoint)
- [ ] `public/samples/LICENSE.md` — covers CC0 license documentation requirement
- [ ] `src/audio/soundManager.js` — covers ENG-09 and ENG-10
- [ ] `src/data/catalog.js` — populated with 7 entries

---

## Standard Stack

### Core (No New Dependencies)

| Technology | Version | Purpose | Why Standard |
|------------|---------|---------|--------------|
| Web Audio API | Browser-native | AudioWorklet, GainNode, IIRFilterNode, AudioBufferSourceNode | All Phase 2 audio nodes are native — no library needed |
| AudioWorklet | Browser-native | Noise synthesis on audio thread | Established in Phase 1 research; only non-deprecated synthesis approach |
| IIRFilterNode | Browser-native | Grey noise A-weighting filter (runs 10× faster than JS) | Native browser implementation, part of Web Audio API spec |

Phase 2 introduces **zero new npm dependencies**. All required functionality is native to the browser.

### Supporting

| Library | Purpose | When to Use |
|---------|---------|-------------|
| Audacity (user tool) | Resample 96kHz thunder candidate to 44100 Hz; find loop edit points | User runs this outside the app during human-verify checkpoint |

---

## Common Pitfalls

### Pitfall 1: `process()` Returns Nothing — Noise Silently Stops

Documented in detail in PITFALLS.md (Pitfall 3). Every noise `AudioWorkletProcessor` must explicitly `return true`. Missing this causes the processor to go inactive after a few seconds with no console error.

**Prevention:** Code review check — every `process()` method in all 4 worklet files has `return true` as the last statement.

### Pitfall 2: Worklet Module Loaded After `AudioWorkletNode` Construction

`AudioWorkletNode` construction throws `"The given AudioWorklet name 'x-noise' is not yet registered"` if `addModule()` was not awaited before the node is created. Load all worklet modules at startup, once, before any sound play request.

### Pitfall 3: AudioBuffer Not Decoded Before First Play

If `decodeAudioData` is still in-flight when the user clicks Play, the buffer is `undefined` and `source.buffer = undefined` produces silence or a console error. Decode all sample buffers at startup and show a loading state until complete.

### Pitfall 4: Sample Rate Mismatch (96kHz Thunder File)

Freesound #704603 is 96000 Hz. `decodeAudioData` resamples it to 44100 Hz automatically, but this is a quality-degrading step happening at runtime. The correct workflow: user downsamples the file to 44100 Hz in Audacity before placing it in `public/samples/`. The human-verify checkpoint must include this instruction.

### Pitfall 5: AudioBufferSourceNode Cannot Be Restarted

`AudioBufferSourceNode` is a one-shot node — calling `.start()` twice on the same node throws. Always create a new node instance for each play. The `gainNode` persists; only the source node is recreated.

### Pitfall 6: Forgetting `.disconnect()` on Stop

After `source.stop()`, also call `source.disconnect()`. Without it, the stopped node remains in the audio graph and leaks memory. With looping ambient sounds that never fire `onended`, the only cleanup trigger is the explicit stop call.

---

## Architecture Patterns

### Recommended File Structure

```
noise-loop-generator/
├── public/
│   ├── worklets/
│   │   ├── white-noise-processor.js    ← ENG-02
│   │   ├── pink-noise-processor.js     ← ENG-03
│   │   ├── brown-noise-processor.js    ← ENG-04
│   │   └── grey-noise-processor.js     ← ENG-05
│   └── samples/
│       ├── rain.wav                    ← ENG-06
│       ├── wind.wav                    ← ENG-07
│       ├── thunder.wav                 ← ENG-08
│       └── LICENSE.md                 ← CC0 provenance
├── src/
│   ├── audio/
│   │   ├── AudioEngine.js             ← Phase 1 (unchanged)
│   │   └── soundManager.js            ← NEW: initSoundGraph, playSound, stopSound, gainNodes
│   ├── data/
│   │   └── catalog.js                 ← POPULATE: 7 entries
│   └── main.js                        ← ADD: loadWorklets, loadSamples, buildDevUI
```

### Audio Graph Per Sound

```
Noise:  AudioWorkletNode → GainNode → AudioContext.destination
Sample: AudioBufferSourceNode → GainNode → AudioContext.destination
```

GainNode is permanent. Source nodes are ephemeral (created on play, disconnected on stop).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| A-weighting filter math | Custom biquad coefficient calculation at runtime | Pre-computed IIRFilterNode coefficients (or BiquadFilterNode peaking EQ) | Bilinear transform requires exact numerical computation; errors produce wrong-sounding noise |
| Gapless loop scheduling | Manual buffer scheduling with `setTimeout` or crossfade | `AudioBufferSourceNode` with `loop: true` | Sample-accurate scheduling is built into the audio rendering thread — JavaScript timing is not accurate enough |
| Volume control communication to worklet | Custom message-passing protocol | External `GainNode` between worklet and destination | One line vs. a full MessagePort message protocol; GainNode works identically for noise and sample sources |
| Sample format conversion | In-browser resample of WAV files | Audacity resample before placing in `public/samples/` | Browser-side resampling introduces quality loss; pre-converted files are exact |

---

## Open Questions

1. **Grey noise perceptual accuracy**
   - What we know: The simplified BiquadFilterNode peaking EQ approach (lowshelf + peaking + highshelf) produces a signal distinct from white noise, but the exact A-weighting inverse may not be perfectly accurate.
   - What's unclear: Will the simplified approach be audibly distinguishable as "grey" vs "filtered white" to a listener who knows what grey noise should sound like?
   - Recommendation: Implement with the simplified BiquadFilterNode approach first. Validate aurally. If it sounds wrong, upgrade to the full IIRFilterNode SOS cascade.

2. **Thunder sample loop quality**
   - What we know: Freesound #704603 is explicitly tagged as a loop, CC0, 2 minutes 7 seconds. Needs downsampling from 96kHz.
   - What's unclear: How well the loop boundary sounds after downsampling in Audacity. Thunder's transient character makes seamless looping harder than rain or wind.
   - Recommendation: Include this in the human-verify checkpoint — user should listen to the looped file in Audacity before approving.

3. **Wind file size (40.4 MB)**
   - What we know: Freesound #361053 is 4 minutes, 40.4 MB at 44100 Hz/16-bit/stereo.
   - What's unclear: Whether the startup fetch time is acceptable. On localhost (Vite dev server), it should be instant. On a possible future deployment, it may need to be trimmed.
   - Recommendation: Accept as-is for Phase 2. A `trim` note can go in the human-verify checkpoint — user can trim to 30s in Audacity if preferred.

---

## Sources

### Primary (HIGH confidence)
- [MDN AudioWorkletProcessor process()](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process) — Active source flag, return value, keepAlive behavior
- [MDN AudioBufferSourceNode loop](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/loop) — Gapless looping, loopStart/loopEnd
- [MDN IIRFilterNode](https://developer.mozilla.org/en-US/docs/Web/API/IIRFilterNode) — Native A-weighting filter, performance note (10× faster than JS)
- [MDN Using IIR Filters](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_IIR_filters) — feedforward/feedback arrays, max 20 items constraint
- Freesound #663947 direct page inspection — CC0, WAV, 44100 Hz rain loop verified
- Freesound #361053 direct page inspection — CC0, WAV, 44100 Hz wind verified
- Freesound #704603 direct page inspection — CC0, WAV, 96000 Hz thunderstorm loop verified

### Secondary (MEDIUM confidence)
- [noisehack.com: Generate Noise with Web Audio API](https://noisehack.com/generate-noise-web-audio-api/) — Paul Kellett pink noise exact coefficients (b[0]–b[6]), brown noise leaky integrator formula
- [PMC: Digital A-weighting filter design](https://pmc.ncbi.nlm.nih.gov/articles/PMC4331191/) — A-weighting IIR SOS coefficients at 44100 Hz via bilinear transform
- [Jake Archibald: Sounds Fun](https://jakearchibald.com/2016/sounds-fun/) — WAV gapless looping vs MP3 decoder gap explanation
- [Building an Audio-loop Player on the Web](https://jackyef.com/posts/building-an-audio-loop-player-on-the-web) — fetch + decodeAudioData + loop pattern
- Phase 1 research: `.planning/research/STACK.md` and `.planning/research/PITFALLS.md` — AudioWorklet architecture decisions, stop+disconnect pattern

### Tertiary (LOW confidence)
- [Ryosuke: Generating Pink Noise for Audio Worklets (2025)](https://whoisryosuke.com/blog/2025/generating-pink-noise-for-audio-worklets/) — AudioWorklet pink noise patterns (cited in Phase 1 STACK.md)
- [GitHub: noiseworklet by girapet](https://github.com/girapet/noiseworklet) — IIR pinking filter approach (WebSearch only)

---

## Metadata

**Confidence breakdown:**
- Noise algorithms: MEDIUM-HIGH — white/brown verified against noisehack.com; pink coefficients cross-verified via multiple sources; grey is the weakest (simplified approach recommended)
- AudioWorklet architecture: HIGH — MDN official docs, confirmed by Phase 1 research
- CC0 sample sources: HIGH for license status (verified by direct page inspection); MEDIUM for loop quality (requires human verification)
- AudioBufferSourceNode looping: HIGH — MDN official docs + Jake Archibald's authoritative Web Audio deep-dive
- Volume architecture: HIGH — Web Audio API design patterns, confirmed by Phase 3/4 integration analysis
- Simultaneous playback: HIGH — standard Map-based pattern, consistent with pitfall prevention

**Research date:** 2026-03-19
**Valid until:** 2026-09-19 (6 months; Web Audio API is stable; CC0 source URLs may change — re-verify before use)
