# Stack Research

**Domain:** Browser-based audio synthesis and export app (local-only)
**Researched:** 2026-03-18
**Confidence:** HIGH (core stack verified against current sources)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vite | 8.x | Dev server + build tool | Framework-agnostic, first-class `--template vanilla` support, sub-second HMR, Rolldown-based build is 10-30x faster than Webpack; Node 20.19+ required (MEDIUM — version from WebSearch, npm release confirmed 5 days before research date) |
| Vanilla JS / TypeScript | ES2022+ | Application language | No framework overhead needed for this scope; Web Audio API nodes map cleanly to plain JS objects; TypeScript optional but improves AudioNode type safety |
| Web Audio API | Browser-native | Real-time audio synthesis and routing | The only viable in-browser audio graph API; handles synthesis, mixing, scheduling, and gapless looping without any library (HIGH — MDN official) |
| AudioWorklet | Browser-native | Noise generation on audio thread | Runs in dedicated audio rendering thread — mandatory replacement for deprecated `ScriptProcessorNode`; enables glitch-free pink/brown noise generation via IIR filter chains (HIGH — MDN official) |
| OfflineAudioContext | Browser-native | WAV export rendering | Renders the full audio graph faster-than-realtime to an `AudioBuffer` without touching device hardware; the standard approach for deterministic audio export from any Web Audio graph (HIGH — MDN official) |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@breezystack/lamejs` | latest | MP3 encoding from AudioBuffer | Use when MP3 output is desired; this is the ESM fork of the original `lamejs` with TypeScript types — the original `lamejs` package is unmaintained and has a known `MPEGMode` ReferenceError in some environments (MEDIUM — WebSearch verified) |
| `audiobuffer-to-wav` | 1.0.0 | WAV encoding from AudioBuffer | Use for WAV export; tiny (adapter of Recorder.js), zero dependencies, stable — last published 10 years ago but WAV format is frozen so staleness is not a concern; alternatively inline 30 lines of PCM header code to eliminate the dependency entirely (MEDIUM — npm verified) |
| `@mediabunny/mp3-encoder` | latest | WASM-based MP3 encoding | Use instead of lamejs if encoding performance becomes a bottleneck; benchmarks show ~90ms for 5s of audio vs lamejs's ~6.5s for 132s; actively maintained as of March 2026 (LOW — WebSearch only, no Context7 verification) |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite 8 | Dev server + bundler | `npm create vite@latest -- --template vanilla`; run `npm run dev` for localhost; no backend required |
| ESLint | Linting | Optional for a personal tool but catches AudioNode misuse early |
| Prettier | Formatting | Optional; include if codebase will be shared |

## Installation

```bash
# Scaffold
npm create vite@latest noise-loop-generator -- --template vanilla
cd noise-loop-generator

# WAV export
npm install audiobuffer-to-wav

# MP3 export (choose one)
npm install @breezystack/lamejs
# OR (higher performance, actively maintained)
npm install @mediabunny/mp3-encoder

# TypeScript types (if using TS template)
npm install -D @types/audiobuffer-to-wav
```

## Audio Export Architecture

This is the most nuanced part of the stack. Two export paths exist:

### Path A: WAV Export (Recommended for v1)

```
AudioContext (live preview)
    ↓
Reconstruct identical graph in OfflineAudioContext
    ↓
offlineCtx.startRendering() → AudioBuffer (PCM data)
    ↓
audiobuffer-to-wav(buffer) → ArrayBuffer
    ↓
Blob → URL.createObjectURL() → <a download> trigger
```

**Why WAV first:** WAV produces mathematically perfect gapless loops. MP3 encoding adds silence at the beginning/end of the file, which breaks seamless loops in video editors. For the stated use case (drop audio into video editor for looping), WAV is strictly superior.

**Critical constraint:** `OfflineAudioContext` does NOT support `createMediaElementSource()` — this was removed from the spec. All audio sources in the export graph must use `AudioBufferSourceNode` (decoded samples loaded into memory) or synthesized nodes (AudioWorklet, OscillatorNode, BiquadFilterNode). This is fine for this project since all sources are either synthesized or short loaded samples.

### Path B: MP3 Export (v2 enhancement)

```
Same OfflineAudioContext render → AudioBuffer
    ↓
Extract Float32Array from each channel
    ↓
@breezystack/lamejs Mp3Encoder (channels, sampleRate, 128kbps)
    ↓
Encode in 1152-sample chunks → flush() → Blob → download
```

**Pitfall:** Always pass `audioBuffer.sampleRate` to `Mp3Encoder` — never hardcode 44100. Mismatched sample rates cause silent or distorted output.

### Noise Synthesis (AudioWorklet)

Pink, brown, and grey noise cannot use the built-in `OscillatorNode` (sine/square/sawtooth only). The correct approach:

1. AudioWorklet generates white noise (random Float32 samples per 128-frame block)
2. Route through `IIRFilterNode` or `BiquadFilterNode` to color:
   - White → no filter
   - Pink → IIR pinking filter (-3 dB/oct, 7-coefficient approximation)
   - Brown → lowpass filter (heavy roll-off, ~6 dB/oct)
   - Grey → equal-loudness inverse filter (A-weighting inverse)

**Do not use `ScriptProcessorNode`** — it is deprecated, runs on the main thread, and causes audio glitches under UI load.

### Sample Playback (Rain, Wind, Fire, Fan)

```
fetch('samples/rain.wav') → arrayBuffer()
    ↓
AudioContext.decodeAudioData(arrayBuffer) → AudioBuffer
    ↓
AudioBufferSourceNode(loop: true, loopStart: X, loopEnd: Y)
    ↓
GainNode (per-sound volume control)
    ↓
AudioContext.destination
```

Load all samples at startup. Store decoded `AudioBuffer` objects in memory. The project deals with short ambient loops (30s–2min source files at most), so memory is not a concern.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Vanilla JS + Vite | React/Vue + Vite | If the UI grows complex with many interacting components — for this scope, a simple DOM manipulation approach is sufficient |
| AudioWorklet for noise | `ScriptProcessorNode` | Never — deprecated, causes glitches |
| `OfflineAudioContext` for export | `MediaRecorder` | Only if recording a live session (not reconstructable from graph); MediaRecorder outputs WebM/Ogg — requires a decode/re-encode step that adds complexity and quality loss |
| `@breezystack/lamejs` | original `lamejs` | Never use the original npm package — known ReferenceError bug and no ESM support |
| WAV export | In-browser MP3 export | MP3 adds silence at file boundaries, breaking gapless loops; defer MP3 to v2 as a convenience option only |
| Freesound.org CC0 samples | Licensed commercial samples | Only if CC0 options are insufficient quality — but Freesound has thousands of CC0 rain/wind/fire recordings |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `ScriptProcessorNode` | Deprecated, runs on main thread, causes audio dropouts under any UI activity | `AudioWorkletProcessor` |
| `<audio loop>` element for preview | Introduces an audible gap at loop boundary — browser bug unfixed for 15+ years | `AudioBufferSourceNode` with `loop: true` |
| `MediaRecorder` for export | Outputs codec-compressed WebM/Ogg, not PCM; requires extra decode step for WAV/MP3; non-deterministic timing | `OfflineAudioContext` + `audiobuffer-to-wav` |
| `ffmpeg.js` / `@ffmpeg/ffmpeg` | 20MB+ WASM bundle for a personal tool; massive overkill; slow cold start | `audiobuffer-to-wav` (WAV) + `@breezystack/lamejs` (MP3) |
| Tone.js | Useful for musical apps with scheduling; adds ~200KB bundle for features (transport, instruments, effects) not needed here; noise synthesis is 30 lines of AudioWorklet code | Raw Web Audio API + AudioWorklet |
| original `lamejs` npm package | Known `MPEGMode` ReferenceError bug in modern bundlers; no ESM; unmaintained since 2024 | `@breezystack/lamejs` |

## Stack Patterns by Variant

**If WAV-only export is sufficient (MVP):**
- Skip all MP3 encoder dependencies entirely
- `audiobuffer-to-wav` is the only audio-specific library needed
- Total non-dev dependencies: 1 package

**If MP3 export is added (v2):**
- Add `@breezystack/lamejs` for compatibility + small bundle
- Or `@mediabunny/mp3-encoder` for performance (verify API stability before use — LOW confidence)

**If synthesis complexity grows (v2+):**
- Consider Tone.js only if scheduling, musical sequencing, or complex effect chains are added
- Do not introduce it for noise synthesis alone

**If samples need to be bundled with the app:**
- Store `.wav` files in `public/samples/` — Vite serves them as static assets
- Avoid `.mp3` for source samples (decode artifacts can affect loop edit points)
- Use 44100 Hz / 16-bit WAV as the source format for maximum OfflineAudioContext compatibility

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Vite 8.x | Node.js 20.19+ or 22.12+ | Node 18 is EOL; Vite 8 requires the newer Node ranges |
| Web Audio API | All evergreen browsers (Chrome 66+, Firefox 76+, Safari 14.1+) | AudioWorklet is fully supported across all modern browsers |
| `audiobuffer-to-wav@1.0.0` | Any AudioBuffer from Web Audio API | Float32 and 16-bit PCM modes; API has been stable for 10 years |
| `@breezystack/lamejs` | Browsers with TypedArray support | ESM build; works with Vite import pipeline |
| OfflineAudioContext | All evergreen browsers | Does NOT support `createMediaElementSource()` — use `AudioBufferSourceNode` for all sources in export graph |

## Sources

- [MDN Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) — AudioContext, OfflineAudioContext, AudioWorklet capabilities (HIGH)
- [MDN AudioWorkletProcessor](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor) — AudioWorklet pattern (HIGH)
- [MDN OfflineAudioContext constructor](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext/OfflineAudioContext) — Export rendering API (HIGH)
- [Vite 8 announcement](https://vite.dev/blog/announcing-vite8) — Current version, Node requirements (HIGH)
- [Generating Pink Noise for Audio Worklets — Ryosuke, 2025](https://whoisryosuke.com/blog/2025/generating-pink-noise-for-audio-worklets/) — AudioWorklet pink noise patterns (MEDIUM)
- [Creating Audio on the Web Is Easy—Until It's Time to Export — Daniel Barta](https://danielbarta.com/export-audio-on-the-web/) — OfflineAudioContext limitations, MediaElementSource removal (MEDIUM)
- [How to Seamlessly Loop Sound with Web Audio API](https://www.codestudy.net/blog/how-to-seamlessly-loop-sound-with-web-audio-api/) — AudioBufferSourceNode gapless looping (MEDIUM)
- [audiobuffer-to-wav npm](https://www.npmjs.com/package/audiobuffer-to-wav) — Version 1.0.0, stable (MEDIUM)
- [@breezystack/lamejs npm](https://www.npmjs.com/package/@breezystack/lamejs) — ESM fork of lamejs (MEDIUM — WebSearch only)
- [@mediabunny/mp3-encoder npm](https://www.npmjs.com/package/@mediabunny/mp3-encoder) — WASM MP3 encoder, active maintenance (LOW — WebSearch only)
- [lamejs Snyk health analysis](https://snyk.io/advisor/npm-package/lamejs) — Inactive maintenance status (MEDIUM)
- [Converting WAV to MP3 with lamejs — Scribbler, Dec 2024](https://scribbler.live/2024/12/05/Coverting-Wav-to-Mp3-in-JavaScript-Using-Lame-js.html) — lamejs usage pattern, sample rate pitfall (MEDIUM)
- [Freesound CC0 library](https://freesound.org/browse/tags/cc0/) — CC0 ambient sound availability (HIGH)
- [MP3 loop silence — gapless loop discussion](https://forums.tumult.com/t/looping-audio-without-gap/6428) — WAV superior for gapless (MEDIUM)

---
*Stack research for: Browser-based noise loop generator*
*Researched: 2026-03-18*
