# Pitfalls Research

**Domain:** Browser-based audio synthesis and sound mixer (Web Audio API, OfflineAudioContext, loop export)
**Researched:** 2026-03-18
**Confidence:** HIGH for Web Audio API mechanics (MDN official + spec issues); MEDIUM for licensing nuances (Freesound forums + community sources)

---

## Critical Pitfalls

### Pitfall 1: AudioContext Created Before User Gesture — Suspended Forever

**What goes wrong:**
An `AudioContext` instantiated at module load time (outside any event handler) starts in `"suspended"` state due to browser autoplay policy. No sound plays. The user clicks the play button and nothing happens because the context is suspended and no resume logic exists.

**Why it happens:**
Developers write `const ctx = new AudioContext()` at the top of the module during init, before any user interaction. This is the natural place to put initialization code, but browsers block audio context creation — or immediately suspend them — until the document receives a user gesture (click, keydown, touchstart).

**How to avoid:**
- Create the `AudioContext` inside the first user interaction handler (e.g., the first "Play" button click), OR
- Create it at init but always guard every playback path with:
  ```js
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  ```
- Listen to `audioCtx.onstatechange` to update UI state accordingly.
- Note: calling `.start()` on a connected `AudioBufferSourceNode` or `AudioWorkletNode` will also auto-resume a suspended context in Chrome, but this is not reliable across all browsers — explicit `.resume()` is safer.

**Warning signs:**
- App loads, no errors in console, but clicking play does nothing.
- `audioCtx.state === "suspended"` logged in console.
- No audio output in Chrome's Web Audio Inspector.

**Phase to address:**
Audio engine bootstrap phase (first phase of core audio work). The very first playback path built must handle this correctly — retrofitting it later is painful because it affects every sound trigger.

---

### Pitfall 2: Using `<audio loop>` for Preview — Audible Gap at Loop Point

**What goes wrong:**
Using an `<audio>` element with the `loop` attribute for in-browser preview produces a noticeable gap (50–200ms) at the loop boundary on every browser. This is a 15-year-old unfixed browser limitation. The loop sounds broken even when the audio file itself is perfectly seamless.

**Why it happens:**
The `<audio>` element re-seeks to the start of the file at loop boundary rather than buffering ahead. The seeking latency is audible. Additionally, browsers do not zero-cross-fade at the boundary.

**How to avoid:**
Use `AudioBufferSourceNode` with `loop: true` exclusively for all preview playback:
```js
const source = audioCtx.createBufferSource();
source.buffer = decodedBuffer;
source.loop = true;
source.loopStart = 0;           // seconds
source.loopEnd = buffer.duration; // seconds — omit to loop entire buffer
source.connect(gainNode);
source.start();
```
This is the only way to get gapless looping in the browser. The `loopStart`/`loopEnd` values must be numbers (not strings) and within `[0, buffer.duration]`.

**Warning signs:**
- Preview has a brief silence or stutter every time the loop restarts.
- `<audio>` element visible in DOM or used for playback anywhere in the codebase.

**Phase to address:**
Preview / playback phase. This is a foundational architectural choice — using `AudioBufferSourceNode` from day one avoids any retrofit.

---

### Pitfall 3: `AudioWorkletProcessor.process()` Not Returning `true` — Noise Stops Silently

**What goes wrong:**
The noise generator `AudioWorkletProcessor` (white, pink, brown, grey noise) stops producing audio after a few seconds or when the browser decides the node is inactive — without any error, warning, or console message. The audio graph is still connected; everything looks correct; noise just stops.

**Why it happens:**
The return value of `process()` controls the node's "active source flag." If `process()` returns `undefined`, `false`, or nothing, the browser marks the processor inactive and eventually garbage-collects it. Source nodes (nodes generating their own output with no inputs) must explicitly return `true` to signal they want to keep processing. This is the most commonly missed Web Audio API gotcha for AudioWorklet.

**How to avoid:**
```js
class NoiseProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const output = outputs[0];
    for (let channel = 0; channel < output.length; channel++) {
      for (let i = 0; i < output[channel].length; i++) {
        output[channel][i] = Math.random() * 2 - 1; // white noise
      }
    }
    return true; // CRITICAL: keeps processor alive
  }
}
```
Every noise processor must return `true` unconditionally. Only return `false` when the node should explicitly shut down (e.g., a one-shot sound that has finished).

**Warning signs:**
- Noise plays fine at first, then silently stops after a few seconds.
- `AudioWorkletProcessor` subclass has no explicit `return` statement in `process()`.
- Reducing other activity (switching tabs, minimizing window) seems to stop the noise.

**Phase to address:**
AudioWorklet noise synthesis phase (first audio generation work). Catch this in the AudioWorklet implementation before wiring to the full audio graph.

---

### Pitfall 4: MP3 Export Breaks Seamless Loops — Silent Padding at File Boundaries

**What goes wrong:**
The exported MP3 file has ~576 samples of silent padding prepended by the LAME encoder, plus variable padding at the end. When the video editor loops this file, there is an audible gap at every loop point — the exact problem the project exists to solve. The in-browser WAV preview sounds perfect; the exported MP3 does not.

**Why it happens:**
The MP3 format works in fixed-size frames. The encoder must pad the beginning and end to fill frame boundaries. This is a fundamental property of the MP3 codec, not a bug. LAME stores the padding lengths in a Xing/Info metadata header, but: (1) `@breezystack/lamejs` in-browser does not write this header, (2) video editors may not honor it even if present, and (3) there is no standard across encoders.

**How to avoid:**
- For v1 (MVP): export WAV only. WAV is PCM — no padding, no encoding artifacts, mathematically perfect loop boundaries. WAV is also the best source format for video editors.
- If MP3 is added in v2: make it a secondary convenience format, clearly documented as "not guaranteed gapless." Never offer MP3 as the primary export for loop use cases.
- Never hardcode `44100` in the `Mp3Encoder` constructor — always pass `audioBuffer.sampleRate` to avoid additional sample rate mismatch corruption on top of the padding issue.

**Warning signs:**
- The exported file sounds like it has a "breath" or click at every loop point in the video editor.
- MP3 is the primary or only export format.
- `Mp3Encoder` instantiated with a hardcoded sample rate.

**Phase to address:**
Export phase. The decision to prioritize WAV and defer MP3 must be made at architecture/design time, not retrofitted after discovering the gap problem post-export.

---

### Pitfall 5: OfflineAudioContext Sample Rate Mismatch — Resampling Artifacts on Export

**What goes wrong:**
The exported audio file has subtle pitch artifacts, truncated audio, or quality degradation. The WAV file plays back at the wrong speed or with a degraded high-frequency response. The live preview sounds fine but the export is subtly wrong.

**Why it happens:**
`AudioContext` (live preview) defaults to the system audio device's native sample rate — typically 48000 Hz on modern macOS/Windows. If the `OfflineAudioContext` for export is created with a different sample rate (e.g., hardcoded 44100), the browser must resample all source audio. The 44100↔48000 conversion is non-trivial (non-integer ratio) and quality varies by browser implementation. This also affects decoded sample files: if a rain.wav file is 44100 Hz and the `OfflineAudioContext` is 48000 Hz, decoding resamples it automatically.

**How to avoid:**
```js
// CORRECT: match the live AudioContext's sample rate
const offlineCtx = new OfflineAudioContext(
  2,                          // channels
  audioCtx.sampleRate * durationSeconds, // total sample count
  audioCtx.sampleRate         // match live context rate exactly
);
```
Store all source `.wav` samples at 44100 Hz (or whichever rate you pick) and create the live `AudioContext` with the same explicit rate:
```js
const audioCtx = new AudioContext({ sampleRate: 44100 });
```
This locks both contexts to the same rate, eliminates resampling entirely.

**Warning signs:**
- `OfflineAudioContext` constructor uses a hardcoded sample rate different from `audioCtx.sampleRate`.
- `AudioContext` created without an explicit `sampleRate` option.
- Exported file plays at slightly wrong speed on a different machine (their system rate differs).
- Safari rejecting `OfflineAudioContext` with a `22050` sample rate error.

**Phase to address:**
Export phase — but sample rate must be decided as a project-wide constant in the audio engine bootstrap phase, before any samples are recorded.

---

### Pitfall 6: AudioNode / AudioBufferSourceNode Not Disconnected After Stop — Memory Leak

**What goes wrong:**
Each time a user toggles a sound on/off or changes a preset, new `AudioBufferSourceNode` instances are created and connected but never disconnected. Over a long session, the audio graph accumulates hundreds of nodes. Memory grows continuously. Chrome's audio thread CPU usage climbs. On weaker machines, audio glitches and dropouts appear.

**Why it happens:**
`AudioBufferSourceNode` is a one-shot node — it cannot be restarted after `.stop()` is called. The common pattern is to create a new source node for each play. Developers often forget to call `.disconnect()` on the stopped node, leaving it in the audio graph. The browser's garbage collector may not collect it while it remains connected.

**How to avoid:**
```js
// Pattern: disconnect on ended
function playSound(buffer, gainNode) {
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(gainNode);
  source.start();

  // Store reference for cleanup
  return source;
}

function stopSound(source) {
  source.stop();
  source.disconnect(); // explicitly disconnect
  // source reference can now be nulled
}
```
For looping ambient sounds (which never end naturally), always call `.stop()` then `.disconnect()` when toggling off.

**Warning signs:**
- Sound toggle creates new nodes on every click but never calls `disconnect()`.
- Chrome's Memory panel shows growing `AudioNode` count over a session.
- CPU usage increases the longer the app runs without a page reload.
- No cleanup logic in the sound-off code path.

**Phase to address:**
Playback / mixing phase. Build the stop+disconnect pattern from the first toggle implementation. Retrofitting cleanup across all node types later is error-prone.

---

### Pitfall 7: Using `ScriptProcessorNode` for Noise Synthesis — Main Thread Audio Glitches

**What goes wrong:**
Noise synthesis works initially but produces audible glitches (clicks, dropouts, stuttering) whenever the user interacts with the UI — adjusting sliders, clicking buttons, or any DOM activity. The glitching is worse on slower machines.

**Why it happens:**
`ScriptProcessorNode` runs its audio callback on the main UI thread. Any JavaScript activity — DOM updates, event handlers, framework rendering — competes for the same thread time as audio processing. When the main thread is busy, audio frames are dropped.

**How to avoid:**
Use `AudioWorkletProcessor` exclusively for all noise synthesis. It runs on the browser's dedicated audio rendering thread:
```js
await audioCtx.audioWorklet.addModule('/worklets/noise-processor.js');
const noiseNode = new AudioWorkletNode(audioCtx, 'noise-processor');
```
The `AudioWorklet` module file must be served from the same origin. With Vite, place it in `public/worklets/` and reference it as `/worklets/noise-processor.js`.

`ScriptProcessorNode` is deprecated in the Web Audio API spec. Do not use it for any new code.

**Warning signs:**
- Any use of `audioCtx.createScriptProcessor()` in the codebase.
- Audio glitches correlate with UI interactions (slider moves, button clicks).
- Audio thread and main thread activity shown competing in Chrome's Performance panel.

**Phase to address:**
AudioWorklet noise synthesis phase (before any UI is built). If UI exists before synthesis, it is easy to mistakenly start with `ScriptProcessorNode` and never migrate.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode `sampleRate: 44100` everywhere | Simpler setup, no dynamic queries | Export sounds wrong on systems with different native rates; fix requires touching every `AudioContext` and `OfflineAudioContext` call | Acceptable for MVP if documented as assumption; pin source files to 44100 |
| Skip `.disconnect()` on stopped nodes | Simpler stop logic | Memory leak over long session; audio glitches on low-end machines | Never — the disconnect call is 1 line and always needed |
| Use `<audio>` element for sample preview during early dev | Quick to wire up | Gap at loop boundary; need full rewrite to `AudioBufferSourceNode` | Only acceptable as a throwaway test (not committed code) |
| Defer AudioContext resume handling | One less edge case in MVP | App is silently broken for all users until a click event fires | Never — autoplay handling is 3 lines and must be in v1 |
| Bundle `.mp3` samples instead of `.wav` | Smaller download size | Decode artifacts at loop edit points; potential quality loss during OfflineAudioContext resampling | Never for source samples — use WAV source; MP3 only for final export option |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `OfflineAudioContext` for export | Using `createMediaElementSource()` — removed from spec, throws immediately | Use `AudioBufferSourceNode` for all sample sources in the export graph |
| `@breezystack/lamejs` MP3 encoder | Passing hardcoded `44100` as sample rate | Always pass `audioBuffer.sampleRate` — the live context may be 48000 |
| Freesound CC0 samples | Downloading samples without verifying the individual license (some are CC-BY, not CC0) | Filter Freesound search by license = CC0 explicitly; screenshot the license page at download time |
| Freesound CC0 samples | Assuming CC0 = safe from Content ID claims | Some CC0 sounds have been re-uploaded to commercial libraries and registered with YouTube Content ID; cross-reference across multiple CC0 sources or generate sounds algorithmically where possible |
| AudioWorklet module loading | Importing worklet file via ES module path or relative path | Must use `audioCtx.audioWorklet.addModule('/absolute-path.js')` — relative paths are resolved from the document, not the calling module; place files in `public/worklets/` for Vite |
| Vite dev server + AudioWorklet | Worklet file processed by Vite's module bundler | AudioWorklet files must be in `public/` (served as static assets), not `src/` — Vite cannot bundle a file that must be loaded as a worker script |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Too many `AudioWorkletNode` parameters | Long `AudioWorkletProcessor::Process` execution time despite trivial `process()` body; audio glitches | Keep parameter count minimal — use `MessagePort` for non-realtime parameter changes; only use `AudioParam` for sample-accurate automation | Starts degrading noticeably beyond ~50 parameters across all active worklet nodes |
| Creating new `AudioBufferSourceNode` per toggle without cleanup | Memory grows; CPU rises; eventual glitches | Disconnect stopped nodes immediately; reuse `GainNode` chain, only recreate source | Becomes noticeable after ~50–100 toggle cycles in a session |
| Simultaneous heavy IIR filter chains on multiple noise nodes | Increasing audio thread render capacity percentage | Use simple `BiquadFilterNode` for brown/pink noise; IIR filters are more expensive; profile with Chrome Web Audio Inspector | For this project's 4 noise types + 5 sample tracks this is not a concern at current scope |
| Calling `decodeAudioData` on large files at startup | Startup hang of 1–3 seconds; UI unresponsive before first interaction | All source samples should be short loops (10–30s max); decode at startup is fine at that scale | Not an issue for this project (short samples); would matter for files >10MB |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visual feedback that AudioContext is suspended | User clicks play, nothing happens, no error shown — looks broken | Show a prominent "Click to enable audio" prompt when `audioCtx.state === 'suspended'`; update UI immediately on resume |
| Export completes instantly but file is silent | User downloads file, imports into video editor, discovers it is blank | Validate export: check that `AudioBuffer` has non-zero peak values before triggering download; show waveform preview or peak meter |
| Export progress not indicated | Long exports (2-min loops) feel frozen | Show a progress indicator; `OfflineAudioContext` fires `oncomplete` when done, but for long renders a progress estimate (render time ≈ loop duration / realtime factor) can be shown |
| Volume sliders affect export result unexpectedly | User sets a mix, exports, and the exported mix has different levels from preview | Use the same `GainNode` values for both preview and export graph reconstruction; document that export uses the current slider positions |

---

## "Looks Done But Isn't" Checklist

- [ ] **Seamless loop preview:** Uses `AudioBufferSourceNode` with `loop: true` — NOT an `<audio>` element with `loop` attribute. Verify by listening to loop boundary with headphones.
- [ ] **AudioContext resume:** App checks `audioCtx.state` and calls `.resume()` on first user interaction before attempting any playback. Verify by loading the page in a fresh tab and playing without any prior clicks.
- [ ] **Export sample rate:** `OfflineAudioContext` is created with `audioCtx.sampleRate` (dynamic), not a hardcoded constant. Verify by logging both rates before export.
- [ ] **AudioWorklet `process()` return value:** Every noise `AudioWorkletProcessor` returns `true`. Verify by leaving noise running for 60+ seconds.
- [ ] **Node cleanup on stop:** Every `.stop()` call is followed by `.disconnect()`. Verify with Chrome Memory DevTools — toggle a sound on/off 20 times and check for AudioNode count growth.
- [ ] **CC0 license per sample:** Every sample file in `public/samples/` has a documented CC0 source URL. Verify by checking the asset manifest/readme against Freesound license pages.
- [ ] **WAV export gaplessness:** Import exported WAV into a video editor, set it to loop, and listen to the loop boundary. Any click or silence = loop point not seamless in the source audio.
- [ ] **Export produces non-silent output:** Log `audioBuffer.getChannelData(0)` peak value after `startRendering()` completes — zero peak means the export graph was not wired correctly.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| AudioContext stuck in suspended state (deployed) | LOW | Add `audioCtx.resume()` call in any user interaction handler; deploy fix |
| MP3 export has gaps (after shipping MP3 support) | MEDIUM | Switch primary export to WAV; deprecate MP3 or label it as "compressed (may gap)" |
| Memory leak from undisconnected nodes | MEDIUM | Audit all stop paths; add `.disconnect()` calls; test with Chrome Memory panel |
| `AudioWorkletProcessor` stops generating noise (missing `return true`) | LOW | Add `return true` to `process()` method; no architectural change needed |
| Sample rate mismatch causes wrong-speed export | MEDIUM | Pin `AudioContext` and `OfflineAudioContext` to explicit matching rate; re-export any affected files |
| CC0 sample gets Content ID claimed on YouTube | HIGH | Replace sample with an algorithmically generated equivalent or a different CC0 source; Content ID disputes can take weeks to resolve |
| AudioWorklet `.js` file fails to load (404 in Vite) | LOW | Move file from `src/` to `public/worklets/`; update `addModule` path |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| AudioContext autoplay / suspended state | Phase: Audio engine bootstrap | Test in fresh browser tab before any other interaction |
| `<audio>` element used for looping | Phase: Preview playback | Listen to loop boundary with headphones for any gap |
| `AudioWorkletProcessor` not returning `true` | Phase: Noise synthesis (AudioWorklet) | Let noise run 60+ seconds; confirm no silent stop |
| MP3 silent padding breaks loops | Phase: Export architecture decision | Import exported WAV (not MP3) into video editor and loop-test |
| OfflineAudioContext sample rate mismatch | Phase: Export implementation | Log `audioCtx.sampleRate` vs `offlineCtx.sampleRate` before render |
| AudioNode memory leak (no disconnect) | Phase: Playback / mixing toggle logic | Chrome Memory panel — 20 toggle cycles, check for node count growth |
| `ScriptProcessorNode` main-thread glitches | Phase: Noise synthesis (before UI built) | Move sliders during noise playback; confirm no glitches |
| CC0 sample licensing confusion | Phase: Asset acquisition (before any sample committed) | Per-file license verification checklist |
| Freesound Content ID false claims | Phase: Asset acquisition | Cross-reference samples across multiple CC0 sources; prefer procedural synthesis |
| AudioWorklet file not found in Vite | Phase: Project scaffolding / dev environment setup | `npm run dev` and verify worklet loads without 404 |

---

## Sources

- [MDN Autoplay Guide for Web Audio APIs](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) — AudioContext autoplay policy, resume() pattern (HIGH)
- [MDN Web Audio API Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) — Resume on user gesture, AudioContext lifecycle (HIGH)
- [MDN AudioWorkletProcessor process() method](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process) — Active source flag, return value, keepAlive behavior (HIGH)
- [MDN AudioBufferSourceNode loop property](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/loop) — Gapless looping, loopStart/loopEnd (HIGH)
- [MDN AudioNode disconnect()](https://developer.mozilla.org/en-US/docs/Web/API/AudioNode/disconnect) — Disconnect pattern, memory management (HIGH)
- [MDN OfflineAudioContext constructor](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext/OfflineAudioContext) — Sample rate parameter, required specification (HIGH)
- [Creating Audio on the Web Is Easy—Until It's Time to Export — Daniel Barta](https://danielbarta.com/export-audio-on-the-web/) — OfflineAudioContext limitations, createMediaElementSource removal, graph reconstruction (MEDIUM)
- [How to Seamlessly Loop Sound with Web Audio API — codestudy.net](https://www.codestudy.net/blog/how-to-seamlessly-loop-sound-with-web-audio-api/) — AudioBufferSourceNode gapless loop pattern (MEDIUM)
- [Web Audio API Performance and Debugging Notes — padenot.github.io](https://padenot.github.io/web-audio-perf/) — AudioWorklet parameter count cost, CPU budget per 128-frame block (MEDIUM)
- [Finding + Fixing a AudioWorkletProcessor Performance Pitfall — Casey Primozic](https://cprimozic.net/blog/webaudio-audioworklet-optimization/) — Parameter count as hidden performance bottleneck (MEDIUM)
- [AudioWorkletProcessor active source flag — WebAudio/web-audio-api-v2 Issue #69](https://github.com/WebAudio/web-audio-api-v2/issues/69) — Render Capacity toggling, node lifecycle (MEDIUM)
- [AudioNode stop/disconnect doesn't free memory — WebAudio/web-audio-api Issue #904](https://github.com/WebAudio/web-audio-api/issues/904) — Memory leak pattern, confirmed browser behavior (MEDIUM)
- [LAME gapless decoding issues — SourceForge](https://sourceforge.net/p/lame/bugs/453/) — MP3 encoder delay, 576-sample silence padding (MEDIUM)
- [MP3 loop silence — Doom9 forum archive](https://forum.doom9.org/archive/index.php/t-111580.html) — MP3 encoder/decoder delay explanation (MEDIUM)
- [Why Sample Rate Matters When Building Audio Features in the Browser — DEV Community](https://dev.to/rijultp/why-sample-rate-matters-when-building-audio-features-in-the-browser-4982) — decodeAudioData resampling quality degradation (MEDIUM)
- [decodeAudioData auto-resampling issue — WebAudio/web-audio-api Issue #30](https://github.com/WebAudio/web-audio-api/issues/30) — Long-standing request to disable forced resampling (MEDIUM)
- [Freesound CC0 Attribution FAQ](https://freesound.org/forum/legal-help-and-attribution-questions/35069/) — CC0 requires no attribution, but description text from uploader does not override license (MEDIUM)
- [Freesound CC0 and YouTube monetization](https://freesound.org/forum/legal-help-and-attribution-questions/39864/) — Content ID risk for CC0 sounds re-registered by third parties (MEDIUM)
- [Chrome Autoplay Policy — Chrome Developers Blog](https://developer.chrome.com/blog/autoplay) — User activation model, auto-resume on start() (HIGH)

---
*Pitfalls research for: Browser-based noise loop generator (Web Audio API, OfflineAudioContext, seamless loop export)*
*Researched: 2026-03-18*
