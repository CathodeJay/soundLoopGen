# Phase 4: Export - Research

**Researched:** 2026-03-19
**Domain:** Web Audio API — OfflineAudioContext, WAV encoding, browser file download
**Confidence:** HIGH (core API confirmed via MDN; critical pitfall confirmed via multiple sources)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Export section sits below master volume, separated by a second divider
- Layout: "Export" label row, then single row with duration dropdown + "Export WAV" button side-by-side
- Duration dropdown: 30s / 1min / 2min, default 30s
- OfflineAudioContext for rendering
- Must match live AudioContext sample rate (44100 Hz pinned in AudioEngine.js)
- Tail crossfade for gapless looping: render `duration + overlap`, crossfade tail onto head
- Export button states: enabled (sounds playing), disabled + warning (no sounds), "Rendering..." (during render), silent reset on completion
- No success message after export — download triggers automatically and button resets silently

### Claude's Discretion
- Exact crossfade duration (empirically, 1-2 seconds)
- WAV encoding: 16-bit PCM or Float32 WAV — whichever is more compatible with video editors
- Filename format (e.g. `noise-mix-30s.wav`)
- Whether OfflineAudioContext worklet re-registration needs special handling across multiple exports

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXP-01 | User can export the current mix as a WAV file | OfflineAudioContext.startRendering() → audiobuffer-to-wav → URL.createObjectURL download |
| EXP-02 | User can select export duration before downloading (30s / 1min / 2min) | Duration dropdown value feeds OfflineAudioContext length parameter |
| EXP-03 | Exported WAV file loops gaplessly when imported into a video editor | Tail crossfade pattern: render duration + overlap, add faded tail onto head samples |
| EXP-04 | Export uses the same sample rate as the live AudioContext (no resampling artifacts) | `new OfflineAudioContext(1, sampleRate * totalDuration, sampleRate)` where sampleRate = `getContext().sampleRate` |
</phase_requirements>

---

## Summary

Phase 4 requires rendering the current mix into an `OfflineAudioContext`, applying a tail crossfade for gapless looping, encoding to WAV, and triggering a browser file download. The main technical complexity lies in a critical pitfall: **AudioWorkletNode does not reliably work inside `OfflineAudioContext`**. The worklet-based noise generators (white, pink, brown, grey) cannot simply be replicated in the offline context — instead, noise must be generated directly into `AudioBuffer` Float32Arrays using the same algorithms extracted from the worklet source files.

For sample-based sounds (rain, wind, thunder), `decodeAudioData` must be called again on the OfflineAudioContext — AudioBuffers are context-specific and cannot be reused from `sampleBuffers`. The `audiobuffer-to-wav` package is already installed in the project and handles both 16-bit PCM and 32-bit float encoding. **16-bit PCM is the recommended output format** for maximum video editor compatibility (Premiere Pro, DaVinci Resolve, Final Cut Pro).

The tail crossfade for gapless looping works by rendering `duration + crossfadeDuration` total samples, then adding the faded tail back onto the head of the output buffer before encoding. This avoids any audible click at the loop boundary when the file is looped in a video editor.

**Primary recommendation:** Generate noise directly via JavaScript Float32Array algorithms (not AudioWorkletNode) for the OfflineAudioContext; use AudioBufferSourceNode for samples after re-decoding; encode as 16-bit PCM WAV using `audiobuffer-to-wav`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Audio API — OfflineAudioContext | Browser built-in | Renders audio graph faster-than-realtime to AudioBuffer | Native API, no dependency, correct sample rate matching |
| audiobuffer-to-wav | 1.0.0 (already installed) | AudioBuffer → WAV ArrayBuffer (16-bit PCM or Float32) | Already in package.json; zero additional install cost |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| URL.createObjectURL | Browser built-in | Create a download URL from a Blob | WAV download trigger |
| AudioBuffer.getChannelData() | Browser built-in | Access raw Float32Array samples for crossfade math | Tail crossfade implementation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| audiobuffer-to-wav | Manual WAV encoding | audiobuffer-to-wav is already installed and correct; manual encoding is 40+ lines of brittle byte-level code with no benefit |
| 16-bit PCM WAV | 32-bit float WAV | 32-bit float works in modern Premiere/Resolve but had real-world compatibility issues with older DaVinci Resolve versions; 16-bit PCM is universally safe |

**Installation:** No new packages needed — `audiobuffer-to-wav` is already in `package.json`.

**Version verification:** `audiobuffer-to-wav@1.0.0` confirmed present in `node_modules/`.

---

## Architecture Patterns

### Recommended Project Structure

The export feature adds two new files:

```
src/
├── audio/
│   ├── AudioEngine.js       # existing
│   ├── soundManager.js      # existing
│   └── exportEngine.js      # NEW — offline render + WAV encode + download
├── data/
│   └── catalog.js           # existing — reused for export iteration
└── main.js                  # existing — append export section after master volume
```

### Pattern 1: OfflineAudioContext Render Pipeline

**What:** Create a fresh OfflineAudioContext per export, build the audio graph inside it (noise via Float32Array, samples via decodeAudioData), render, apply crossfade, encode, download.

**When to use:** Every export call — the context is not cached between exports.

```javascript
// Source: MDN OfflineAudioContext
const sampleRate = getContext().sampleRate; // 44100
const crossfadeSec = 1.5; // Claude's discretion
const totalSec = selectedDuration + crossfadeSec;
const offlineCtx = new OfflineAudioContext(1, Math.ceil(sampleRate * totalSec), sampleRate);

// Build graph, connect nodes to offlineCtx.destination
// ...

const renderedBuffer = await offlineCtx.startRendering();
// renderedBuffer.length === Math.ceil(sampleRate * totalSec)
```

### Pattern 2: Noise Generation Without AudioWorklet

**What:** Rather than calling `offlineCtx.audioWorklet.addModule()` and creating AudioWorkletNodes — which is unreliable in OfflineAudioContext — generate noise samples directly into a Float32Array, then play via AudioBufferSourceNode.

**Why:** Multiple sources confirm AudioWorkletNode does not reliably work inside OfflineAudioContext across browsers. The worklet algorithms are simple loops already visible in the processor files.

```javascript
// White noise — mirrors white-noise-processor.js logic
function generateWhiteNoise(offlineCtx, durationSamples) {
  const buffer = offlineCtx.createBuffer(1, durationSamples, offlineCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < durationSamples; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

// Pink noise — mirrors pink-noise-processor.js Voss-McCartney filter
function generatePinkNoise(offlineCtx, durationSamples) {
  const buffer = offlineCtx.createBuffer(1, durationSamples, offlineCtx.sampleRate);
  const data = buffer.getChannelData(0);
  let b = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < durationSamples; i++) {
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
  return buffer;
}

// Brown noise — mirrors brown-noise-processor.js
function generateBrownNoise(offlineCtx, durationSamples) {
  const buffer = offlineCtx.createBuffer(1, durationSamples, offlineCtx.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < durationSamples; i++) {
    const white = Math.random() * 2 - 1;
    lastOut = (lastOut * 0.998 + white * 0.02);
    data[i] = lastOut * 3.5;
  }
  return buffer;
}

// Grey noise = white noise + low-shelf BiquadFilter at 800Hz / +10dB
// Generate white noise buffer, then route through BiquadFilter in the offline graph
// (BiquadFilter IS supported in OfflineAudioContext — it's a native AudioNode)
```

**For grey noise:** The grey noise worklet generates white noise; the low-shelf filter is a BiquadFilter applied main-thread. In the export graph, generate the white noise buffer and connect it through a `offlineCtx.createBiquadFilter()` node configured identically to `soundManager.js` (lowshelf, 800Hz, +10dB).

### Pattern 3: Sample Sounds in OfflineAudioContext

**What:** AudioBuffers from `sampleBuffers` in soundManager cannot be used in a different AudioContext. Must fetch and decode again inside the OfflineAudioContext.

```javascript
// sampleBuffers from soundManager are tied to the live AudioContext — cannot reuse
const response = await fetch(`/samples/${id}.wav`);
const arrayBuffer = await response.arrayBuffer();
const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);

const source = offlineCtx.createBufferSource();
source.buffer = audioBuffer;
source.loop = true;
source.connect(gainNode);
source.start(0); // start at time 0 of the offline context
```

**Optimization note:** If the user exports twice, the fetch will fire again. For v1 this is acceptable — the files are small (40-70MB was for the source files; the actual used samples after resampling are standard WAV). A simple per-export cache (Map inside exportEngine) can skip re-fetching in the same export session if needed, but is not required.

### Pattern 4: Tail Crossfade for Gapless Looping

**What:** Render `duration + crossfadeDuration` samples. The last `crossfadeDuration` seconds form the "tail." Add the tail, with a descending linear fade, onto the first `crossfadeDuration` seconds of the buffer (ascending fade). The output buffer is then trimmed to exactly `duration` samples.

**Why it works:** When the video editor loops the file, the start of loop N+1 immediately follows the end of loop N. The crossfade ensures the energy from the tail is blended onto the head, eliminating the click or silence that would appear at the cut point.

```javascript
function applyTailCrossfade(renderedBuffer, durationSamples, crossfadeSamples) {
  const data = renderedBuffer.getChannelData(0);
  // Blend tail onto head with linear fade
  for (let i = 0; i < crossfadeSamples; i++) {
    const tailSample = data[durationSamples + i];
    const fadeIn  = i / crossfadeSamples;       // 0 → 1 (head gains this)
    const fadeOut = 1 - fadeIn;                  // 1 → 0 (tail loses this)
    data[i] = data[i] * fadeIn + tailSample * fadeOut;
    // Note: head[i] fades up from the tail's level; tail fades to 0
    // Simpler correct formulation:
    // data[i] = data[i] + tailSample * (1 - i / crossfadeSamples)
    // Avoids double-counting: only add the decaying tail onto existing head
  }
  // Return a new AudioBuffer of exactly durationSamples
  // (slice the float32 array, or use copyToChannel on a new buffer)
}
```

**Correct crossfade math** (the simplest form that avoids level errors):
```javascript
for (let i = 0; i < crossfadeSamples; i++) {
  const tailFade = 1 - (i / crossfadeSamples); // 1 → 0
  data[i] += data[durationSamples + i] * tailFade;
}
// Then encode only data[0..durationSamples-1]
```

This "add fading tail onto head" approach preserves the head's full amplitude and blends in the tail energy, which is the correct crossfade for looping audio (as opposed to equal-power crossfade used for DJ mixing).

**Recommended crossfade duration:** 1.5 seconds. This is long enough to smooth brown noise's random walk but short enough to not audibly alter the character of the mix. 1.0s is the minimum; 2.0s is the maximum useful range. Test empirically.

### Pattern 5: WAV Encoding and Browser Download

```javascript
import audioBufferToWav from 'audiobuffer-to-wav';
// Note: audiobuffer-to-wav is CommonJS (module.exports). Vite handles CJS→ESM interop
// automatically; the import statement above works in Vite projects.

// Encode as 16-bit PCM (default — opt.float32 not set)
const wavArrayBuffer = audioBufferToWav(trimmedAudioBuffer);
const blob = new Blob([wavArrayBuffer], { type: 'audio/wav' });
const url = URL.createObjectURL(blob);

const a = document.createElement('a');
a.href = url;
a.download = `noise-mix-${durationLabel}.wav`; // e.g. noise-mix-30s.wav, noise-mix-1min.wav
a.click();

// Clean up object URL after a short delay (URL stays valid for the tab's lifetime
// but releasing it frees memory)
setTimeout(() => URL.revokeObjectURL(url), 10000);
```

**Filename convention:** `noise-mix-30s.wav`, `noise-mix-1min.wav`, `noise-mix-2min.wav`

### Pattern 6: Connecting the Audio Graph in OfflineAudioContext

The live graph is: `noiseWorkletNode/bufferSourceNode → gainNode → masterGainNode → ctx.destination`

The offline graph mirrors this: `offlineAudioBufferSource → gainNode → masterGainNode → offlineCtx.destination`

```javascript
// Create offline master gain mirroring live master gain value
const offlineMaster = offlineCtx.createGain();
offlineMaster.gain.value = getMasterGain().gain.value; // read live value
offlineMaster.connect(offlineCtx.destination);

// For each active sound:
const gainNode = offlineCtx.createGain();
gainNode.gain.value = volumeMap.get(id); // read from main.js volumeMap
gainNode.connect(offlineMaster);

// Connect noise buffer source or sample source to gainNode
```

### Anti-Patterns to Avoid

- **Using AudioWorkletNode in OfflineAudioContext:** Unreliable across browsers. Use direct Float32Array generation instead.
- **Reusing sampleBuffers from soundManager:** AudioBuffers are context-bound. Always call `offlineCtx.decodeAudioData()` separately.
- **Crossfade duration equal to zero:** No crossfade means an audible click at the loop point, especially for brown noise (which has a random DC offset at any given moment).
- **Encoding as mono only:** The live AudioContext appears to be mono (single channel per sound, single channel destination). The offline context should also be mono (1 channel) unless stereo is confirmed. `audiobuffer-to-wav` handles both.
- **Not revoking the object URL:** Minor memory leak — always call `URL.revokeObjectURL` after the download triggers.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WAV byte encoding | Custom RIFF/WAV writer | `audiobuffer-to-wav` (already installed) | WAV header has 11 fields; format codes differ for PCM vs float; easy to get chunk sizes wrong |
| Noise generation in offline context | AudioWorkletNode in OfflineAudioContext | Direct Float32Array generation | AudioWorkletNode unreliable in OfflineAudioContext; worklet algorithms are short and already in source |
| Browser file download | Fetch API or custom download mechanism | `URL.createObjectURL` + anchor `.click()` | Standard pattern; no server required; works in all modern browsers |

**Key insight:** The hardest part of WAV encoding is getting the byte offsets and endianness right. `audiobuffer-to-wav` already handles this correctly for both 16-bit PCM and 32-bit float. Since it's already in package.json, there is zero reason to write custom WAV encoding.

---

## Common Pitfalls

### Pitfall 1: AudioWorkletNode Does Not Reliably Work in OfflineAudioContext

**What goes wrong:** Developer calls `offlineCtx.audioWorklet.addModule(url)` and creates `new AudioWorkletNode(offlineCtx, processorName)`. The addModule() call resolves, but the AudioWorkletNode silently produces no output or errors in some browsers. Safari uses ScriptProcessorNode internally and may fail entirely.

**Why it happens:** `AudioWorklet` is technically available on `OfflineAudioContext` (both inherit from `BaseAudioContext`), but real-world browser implementations have inconsistencies. Community bug reports and the `standardized-audio-context` library's workarounds confirm this is a known ecosystem issue.

**How to avoid:** Do not use AudioWorkletNode in OfflineAudioContext. Generate noise directly via `offlineCtx.createBuffer()` + `getChannelData()` + sample-by-sample algorithm execution in the main thread. The algorithms are identical to those in the worklet processor files.

**Warning signs:** Export produces a silent WAV file despite sounds being active.

### Pitfall 2: AudioBuffers Are Context-Specific

**What goes wrong:** Developer passes `sampleBuffers.get(id)` (decoded against the live `AudioContext`) to an `AudioBufferSourceNode` created on the `OfflineAudioContext`.

**Why it happens:** AudioBuffers hold a reference to the context they were created with. Using them with a different context throws a DOMException ("Wrong AudioContext" or similar).

**How to avoid:** In `exportEngine.js`, always call `offlineCtx.decodeAudioData(arrayBuffer)` for each sample sound. Cache the raw `arrayBuffer` (not the decoded `AudioBuffer`) if re-fetch optimization is desired.

**Warning signs:** `DOMException` thrown when setting `bufferSource.buffer`.

### Pitfall 3: OfflineAudioContext Length Parameter

**What goes wrong:** Developer confuses `length` (sample frames count) with `duration` (seconds).

**Why it happens:** The constructor is `new OfflineAudioContext(channels, length, sampleRate)` where `length` is in sample frames, not seconds.

**How to avoid:** Always compute as `Math.ceil(sampleRate * durationSeconds)`.

```javascript
const sampleRate = getContext().sampleRate; // 44100
const totalDuration = selectedDurationSec + crossfadeSec;
const length = Math.ceil(sampleRate * totalDuration);
const offlineCtx = new OfflineAudioContext(1, length, sampleRate);
```

**Warning signs:** Export renders wrong duration or `DOMException` for invalid length.

### Pitfall 4: audiobuffer-to-wav Is CommonJS, Project Is ESM

**What goes wrong:** `import audioBufferToWav from 'audiobuffer-to-wav'` fails at runtime if the bundler doesn't handle CJS interop.

**Why it happens:** The package uses `module.exports`, not `export default`.

**How to avoid:** Vite handles CJS→ESM interop automatically for packages in `node_modules`. The import statement `import audioBufferToWav from 'audiobuffer-to-wav'` works as-is in Vite. No special configuration required.

**Warning signs:** `SyntaxError: Named export not found` or `audioBufferToWav is not a function`.

### Pitfall 5: CrossFade Adds to, Not Replaces, Head Samples

**What goes wrong:** Developer writes `data[i] = tailSample * tailFade` instead of `data[i] += tailSample * tailFade`, silencing the head during the crossfade period.

**Why it happens:** Confusing "replace with fading tail" vs "add fading tail to existing head."

**How to avoid:** The head samples should play at full volume throughout; only the tail's energy is being blended in, decaying to zero over the crossfade window.

### Pitfall 6: volumeMap Is Local to main.js

**What goes wrong:** `exportEngine.js` cannot access `volumeMap` or master gain value without explicit sharing.

**Why it happens:** `volumeMap` is a `const` declared at the top of `main.js`, not exported.

**How to avoid:** Either export `volumeMap` from a shared module, or pass the current gain values explicitly when calling the export function. The export function signature should accept an object: `{ activeSounds: string[], gains: Map<string, number>, masterGainValue: number }`.

---

## Code Examples

Verified patterns from official sources and existing project code:

### OfflineAudioContext Constructor (MDN confirmed)
```javascript
// Source: MDN OfflineAudioContext
// length = sample frames (not seconds)
const offlineCtx = new OfflineAudioContext(
  1,                                    // channels (mono, matching live context)
  Math.ceil(44100 * totalDuration),     // length in sample frames
  44100                                 // sampleRate — must match live context
);
const renderedBuffer = await offlineCtx.startRendering();
// renderedBuffer is an AudioBuffer
```

### Noise Generation (mirroring worklet algorithms exactly)
```javascript
// White noise (matches white-noise-processor.js)
const buf = offlineCtx.createBuffer(1, totalSamples, offlineCtx.sampleRate);
const data = buf.getChannelData(0);
for (let i = 0; i < totalSamples; i++) data[i] = Math.random() * 2 - 1;

// Play it
const src = offlineCtx.createBufferSource();
src.buffer = buf;
src.connect(gainNode);
src.start(0);
```

### Sample Re-decode Pattern
```javascript
// Source: MDN AudioContext.decodeAudioData
const response = await fetch('/samples/rain.wav');
const arrayBuffer = await response.arrayBuffer();
const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);

const src = offlineCtx.createBufferSource();
src.buffer = audioBuffer;
src.loop = true;
src.connect(gainNode);
src.start(0);
```

### Tail Crossfade Application
```javascript
// After startRendering() resolves with renderedBuffer:
const sampleRate = offlineCtx.sampleRate;
const durationSamples = Math.ceil(sampleRate * selectedDuration);
const crossfadeSamples = Math.ceil(sampleRate * crossfadeSec);

const data = renderedBuffer.getChannelData(0);
for (let i = 0; i < crossfadeSamples; i++) {
  const tailFade = 1 - (i / crossfadeSamples); // linear 1→0
  data[i] += data[durationSamples + i] * tailFade;
}

// Create trimmed AudioBuffer with exactly durationSamples
const trimmed = offlineCtx.createBuffer(1, durationSamples, sampleRate);
trimmed.copyToChannel(data.slice(0, durationSamples), 0);
```

### WAV Encode and Download
```javascript
// Source: audiobuffer-to-wav README + URL.createObjectURL MDN
import audioBufferToWav from 'audiobuffer-to-wav';

const wavArrayBuffer = audioBufferToWav(trimmed); // 16-bit PCM by default
const blob = new Blob([wavArrayBuffer], { type: 'audio/wav' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'noise-mix-30s.wav';
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
setTimeout(() => URL.revokeObjectURL(url), 10000);
```

### Export Section DOM Structure (matching CONTEXT.md layout)
```javascript
// Appended to #app after master volume section, following renderMixer() patterns
const divider2 = document.createElement('div');
divider2.style.cssText = 'border-top:1px solid #444;margin:16px 0;';
app.appendChild(divider2);

const exportSection = document.createElement('div');
exportSection.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

const exportRow = document.createElement('div');
exportRow.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 0;';

const exportLabel = document.createElement('span');
exportLabel.textContent = 'Export';
exportLabel.style.cssText = 'font-size:16px;font-weight:600;color:#ffffff;min-width:100px;';

const durationSelect = document.createElement('select');
// options: 30, 60, 120 seconds — value is numeric seconds
[['30 seconds', 30], ['1 minute', 60], ['2 minutes', 120]].forEach(([label, val]) => {
  const opt = document.createElement('option');
  opt.value = val;
  opt.textContent = label;
  durationSelect.appendChild(opt);
});

const exportBtn = document.createElement('button');
exportBtn.textContent = 'Export WAV';
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ScriptProcessorNode for custom DSP | AudioWorkletNode (live) / Direct Float32Array (offline) | Chrome 66, 2018 | ScriptProcessorNode deprecated; for offline export, direct array generation is more reliable |
| Manual WAV encoding | audiobuffer-to-wav library | 2015+ | Handles header, interleaving, format codes correctly |
| Polling / callbacks for OfflineAudioContext | Promise-based `startRendering()` | Web Audio API spec update | Clean async/await pattern |

**Deprecated/outdated:**
- `ScriptProcessorNode` / `createScriptProcessor()`: Deprecated in all browsers. Do not use.
- `offlineCtx.oncomplete` event: Superseded by Promise returned from `startRendering()`.

---

## Open Questions

1. **OfflineAudioContext AudioWorkletNode in Chrome specifically (2025)**
   - What we know: Multiple sources confirm unreliability across browsers; community workaround is to avoid it
   - What's unclear: Whether modern Chrome (2025) has fixed this for the project's specific use case
   - Recommendation: Do not rely on it. The direct Float32Array approach is simpler, faster, and eliminates the unknown entirely.

2. **Multiple exports in one session — re-registration**
   - What we know: Each export creates a new OfflineAudioContext; worklets would need re-registration on each new context
   - What's unclear: Whether addModule() on subsequent OfflineAudioContext instances causes any issue
   - Recommendation: Moot — since we are not using AudioWorkletNode in OfflineAudioContext at all.

3. **Is the live AudioContext mono or stereo?**
   - What we know: soundManager creates single-channel AudioWorkletNodes (noise); WAV samples may be stereo
   - What's unclear: Whether decoded sample AudioBuffers (rain/wind/thunder) are mono or stereo
   - Recommendation: Use `offlineCtx.createBuffer(1, ...)` for noise; for samples, check `audioBuffer.numberOfChannels` after decode and downmix to mono (sum channels / 2) if stereo — or create the OfflineAudioContext as stereo (2 channels) if any sample is stereo. The live AudioContext output is mono by default unless stereo nodes are in the graph.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected in project |
| Config file | None — see Wave 0 |
| Quick run command | N/A — browser-only audio API; no Node.js test runner |
| Full suite command | Manual browser test |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXP-01 | WAV file downloads on button click | manual | — | N/A |
| EXP-02 | Duration dropdown changes export length | manual | — | N/A |
| EXP-03 | Exported WAV loops gaplessly in video editor | manual | — | N/A |
| EXP-04 | Sample rate in WAV header = 44100 Hz | manual | — | N/A |

**Rationale for manual-only:** All requirements involve browser APIs (`OfflineAudioContext`, `URL.createObjectURL`, audio rendering) and user interaction (file download, video editor loop check). These cannot be automated without a browser environment + headless audio context support. No test framework is installed; adding one for a browser-only project would require significant setup (Vitest + jsdom or Playwright) that is out of scope for Phase 4.

### Sampling Rate
- **Per task commit:** Open browser, click Export WAV, verify file downloads
- **Per wave merge:** Open browser, import WAV into video editor, verify seamless loop
- **Phase gate:** All four EXP requirements verified manually before `/gsd:verify-work`

### Wave 0 Gaps
None — no test infrastructure to create. All validation is manual browser testing.

---

## Sources

### Primary (HIGH confidence)
- MDN Web Docs — OfflineAudioContext: https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext
- MDN Web Docs — BaseAudioContext.audioWorklet: https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/audioWorklet
- MDN Web Docs — BaseAudioContext.createBuffer: https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createBuffer
- `audiobuffer-to-wav` v1.0.0 source: `/node_modules/audiobuffer-to-wav/index.js` (read directly)
- Existing worklet source files: `/public/worklets/*.js` (read directly — algorithms confirmed)
- Existing soundManager.js: algorithm and graph topology confirmed by direct read

### Secondary (MEDIUM confidence)
- standardized-audio-context library documentation: AudioWorkletNode in OfflineAudioContext uses ScriptProcessorNode fallback in Safari — confirms cross-browser unreliability
- DaVinci Resolve Supported Codec List (Blackmagic Design official PDF): WAV 16-bit PCM confirmed supported
- Adobe Premiere Pro community: 16-bit PCM WAV confirmed importable; internally upconverted to 32-bit float

### Tertiary (LOW confidence)
- WebSearch results on AudioWorkletNode + OfflineAudioContext bugs — corroborated by multiple independent sources but not traced to a single official spec bug report

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — audiobuffer-to-wav read directly from node_modules; OfflineAudioContext confirmed via MDN
- Architecture patterns: HIGH — OfflineAudioContext API confirmed; noise algorithms read directly from existing worklet files
- AudioWorklet pitfall: MEDIUM-HIGH — confirmed by multiple independent sources (standardized-audio-context docs, WebSearch community reports); no official Chrome bug tracker link found but corroborated well enough to treat as authoritative
- WAV format compatibility: HIGH — official codec lists from Blackmagic and Adobe community confirm 16-bit PCM

**Research date:** 2026-03-19
**Valid until:** 2026-09-19 (stable APIs; AudioWorklet/OfflineAudioContext spec is mature)
