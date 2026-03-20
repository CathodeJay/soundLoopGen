# Architecture Research

**Domain:** Browser-based audio synthesis and mixing app (local, no backend)
**Researched:** 2026-03-18
**Confidence:** HIGH (Web Audio API architecture verified against MDN official docs; patterns confirmed through multiple sources)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                          UI LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  Sound       │  │  Channel     │  │  Export                │ │
│  │  Catalog UI  │  │  Strip UI    │  │  Controls UI           │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬─────────────┘ │
└─────────┼─────────────────┼────────────────────-┼───────────────┘
          │ user events     │ volume/mute          │ export trigger
          ▼                 ▼                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                       STATE LAYER                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  AppState { channels[], masterVolume, isPlaying }        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────┬────────────────────────────┘
                                      │ state → audio sync
                                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                       AUDIO ENGINE LAYER                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    AudioContext (live)                   │    │
│  │                                                          │    │
│  │  Noise Sources                Sample Sources             │    │
│  │  ┌──────────────────┐         ┌──────────────────┐       │    │
│  │  │ AudioWorkletNode │         │ AudioBufferSource│       │    │
│  │  │ (white/pink/     │         │ Node (loop:true) │       │    │
│  │  │  brown/grey)     │         │ (rain/fire/fan…) │       │    │
│  │  └────────┬─────────┘         └────────┬─────────┘       │    │
│  │           │                            │                  │    │
│  │           ▼                            ▼                  │    │
│  │  ┌────────────────┐          ┌─────────────────┐          │    │
│  │  │ IIRFilterNode  │          │    GainNode     │          │    │
│  │  │ (color filter) │          │  (per-channel)  │          │    │
│  │  └────────┬───────┘          └────────┬────────┘          │    │
│  │           │                           │                   │    │
│  │           ▼                           │                   │    │
│  │  ┌────────────────┐                   │                   │    │
│  │  │    GainNode    │                   │                   │    │
│  │  │  (per-channel) │                   │                   │    │
│  │  └────────┬───────┘                   │                   │    │
│  │           │                           │                   │    │
│  │           └──────────────┬────────────┘                   │    │
│  │                          ▼                                │    │
│  │               ┌──────────────────┐                        │    │
│  │               │  DynamicsCompressor (optional, anti-clip) │    │
│  │               └────────┬─────────┘                        │    │
│  │                        ▼                                  │    │
│  │               ┌──────────────────┐                        │    │
│  │               │   Master GainNode│                        │    │
│  │               └────────┬─────────┘                        │    │
│  │                        ▼                                  │    │
│  │               AudioContext.destination                    │    │
│  └─────────────────────────────────────────────────────────-─┘    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │           OfflineAudioContext (export, on-demand)        │    │
│  │  Reconstructed graph with same nodes → startRendering()  │    │
│  │  → AudioBuffer → audiobuffer-to-wav → Blob → download    │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────────┐
│                       ASSET LAYER                                │
│  ┌─────────────────────────┐    ┌───────────────────────────┐   │
│  │  AudioWorklet modules   │    │  Sample buffers (decoded) │   │
│  │  /worklets/noise-*.js   │    │  public/samples/*.wav     │   │
│  └─────────────────────────┘    └───────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| Sound Catalog UI | Render available sounds, trigger add/remove | AppState (dispatch events) |
| Channel Strip UI | Render per-channel volume slider + mute button | AppState (subscribe to channel state) |
| Export Controls UI | Trigger export, show progress, offer download | ExportService, AppState |
| AppState | Single source of truth for mixer state (channels, volumes, muted, master volume) | All UI components (read); AudioEngine (sync on change) |
| AudioEngine | Own the live `AudioContext`, create/destroy nodes, keep graph in sync with state | AppState (driven by); SampleLoader (reads decoded buffers); WorkletLoader (loads processors) |
| SampleLoader | Fetch `.wav` files, decode via `decodeAudioData`, cache `AudioBuffer` objects | AudioEngine (provides buffers) |
| WorkletLoader | Register AudioWorklet processor modules on the `AudioContext` | AudioEngine (called once at startup) |
| NoiseNode wrapper | Create `AudioWorkletNode` + `IIRFilterNode` chain for a given noise type | AudioEngine (created/destroyed by) |
| SampleNode wrapper | Create `AudioBufferSourceNode` with `loop: true`, `loopStart`/`loopEnd` | AudioEngine (created/destroyed by) |
| ExportService | Reconstruct the graph in `OfflineAudioContext`, call `startRendering()`, encode to WAV | AudioEngine (reads current state to reconstruct), WAV encoder |

## Recommended Project Structure

```
noise-loop-generator/
├── public/
│   ├── samples/                  # Static .wav files served by Vite
│   │   ├── rain.wav
│   │   ├── fire.wav
│   │   ├── fan.wav
│   │   └── wind.wav
│   └── worklets/                 # AudioWorklet processor scripts
│       └── noise-processor.js    # Single worklet for all noise types
├── src/
│   ├── main.js                   # Entry point: init, wire everything
│   ├── state/
│   │   └── AppState.js           # Plain JS state object + pub/sub
│   ├── audio/
│   │   ├── AudioEngine.js        # Owns AudioContext, builds/tears down graph
│   │   ├── WorkletLoader.js      # audioContext.audioWorklet.addModule()
│   │   ├── SampleLoader.js       # fetch + decodeAudioData + cache
│   │   ├── NoiseNode.js          # AudioWorkletNode + IIRFilterNode wrapper
│   │   └── SampleNode.js         # AudioBufferSourceNode wrapper (loop logic)
│   ├── export/
│   │   └── ExportService.js      # OfflineAudioContext graph rebuild + WAV encode
│   ├── ui/
│   │   ├── CatalogPanel.js       # Sound catalog DOM component
│   │   ├── ChannelStrip.js       # Per-channel DOM component (slider, mute)
│   │   └── ExportPanel.js        # Export button, progress, download link
│   └── catalog.js                # Static data: sound definitions, types, paths
├── index.html
├── vite.config.js
└── package.json
```

### Structure Rationale

- **public/worklets/**: Worklet scripts must be served from an HTTP origin (not inlined via import); Vite copies `public/` as-is to the build output.
- **public/samples/**: Static assets loaded via `fetch()` at runtime; Vite serves them directly in dev mode without processing.
- **src/audio/**: The audio graph subsystem is entirely isolated. Nothing outside this folder touches `AudioContext` directly.
- **src/state/**: Single module for state prevents scattered mutation. UI reads state; AudioEngine is a subscriber that syncs the graph when state changes.
- **src/export/**: Export is intentionally isolated from the live `AudioEngine`. It constructs a parallel, independent `OfflineAudioContext` graph and has no side effects on live playback.
- **src/ui/**: Each UI component subscribes to the state and manages its own DOM subtree only.

## Architectural Patterns

### Pattern 1: One AudioContext, Persisted for the Session

**What:** Create a single `AudioContext` at app startup (after a user gesture) and keep it for the entire session. Never destroy and recreate it.

**When to use:** Always, for this app.

**Trade-offs:** AudioContext has no teardown cost once created; recreating it is expensive and breaks all existing node references. Safari requires a user gesture to resume the context — call `audioContext.resume()` on the first UI interaction.

**Example:**
```javascript
// AudioEngine.js
let ctx = null;

export function getContext() {
  if (!ctx) {
    ctx = new AudioContext();
  }
  return ctx;
}

// Call on first user interaction
export async function ensureRunning() {
  const ctx = getContext();
  if (ctx.state === 'suspended') await ctx.resume();
}
```

### Pattern 2: Channel Object — Pair of (AudioNode chain, State entry)

**What:** Each active sound corresponds to both a JS state entry (volume, muted, id) and a live audio node chain (source node → filter if applicable → per-channel GainNode → master gain). These are kept in sync, not merged.

**When to use:** Every time a sound is added or removed from the mix.

**Trade-offs:** Slight indirection between state and audio nodes, but it is the only safe way to keep UI state (serializable) separate from audio node handles (non-serializable Web API objects).

**Example:**
```javascript
// AppState.js — serializable
const state = {
  channels: [
    { id: 'rain-1', type: 'sample', src: 'rain.wav', volume: 0.8, muted: false },
    { id: 'pink-1', type: 'noise', noiseType: 'pink', volume: 0.5, muted: false },
  ],
  masterVolume: 1.0
};

// AudioEngine.js — non-serializable node handles, keyed by channel id
const nodeMap = new Map(); // id → { sourceNode, gainNode }
```

### Pattern 3: AudioWorklet for Noise, AudioBufferSourceNode for Samples

**What:** Use different node types for the two source categories. Synthesized noise (white, pink, brown, grey) uses `AudioWorkletNode` backed by an `AudioWorkletProcessor` in `/public/worklets/noise-processor.js`. Sample-based sounds use `AudioBufferSourceNode` with `loop: true`.

**When to use:** Always — this is the correct architecture for this project. Do not use `<audio>` elements or `ScriptProcessorNode` for either source type.

**Trade-offs:** Worklet modules must be registered before any `AudioWorkletNode` can be instantiated. This requires an async initialization step before the audio engine is ready. Worth it: glitch-free noise generation on the audio rendering thread.

**Example:**
```javascript
// WorkletLoader.js
export async function loadWorklets(ctx) {
  await ctx.audioWorklet.addModule('/worklets/noise-processor.js');
}

// NoiseNode.js — builds the source → color filter → gain chain
export function createNoiseChain(ctx, noiseType, destination) {
  const workletNode = new AudioWorkletNode(ctx, 'noise-processor');
  workletNode.port.postMessage({ type: noiseType }); // e.g. 'pink'

  const filter = buildColorFilter(ctx, noiseType); // IIRFilterNode
  const gainNode = ctx.createGain();

  workletNode.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(destination);

  return { sourceNode: workletNode, gainNode };
}
```

### Pattern 4: Export via Graph Reconstruction in OfflineAudioContext

**What:** When the user requests export, `ExportService` reads the current `AppState`, creates a new `OfflineAudioContext` of the desired duration, and reconstructs an equivalent audio graph — re-registering worklets, re-creating source nodes from the cached `AudioBuffer` objects, and re-wiring all gain values. It then calls `startRendering()`, encodes the result as WAV, and offers it as a download.

**When to use:** On user-triggered export only.

**Trade-offs:** Requires that all source material is available as `AudioBuffer` (decoded samples) or regeneratable from an `AudioWorklet` — which is already guaranteed by the rest of the architecture. The key constraint: `OfflineAudioContext` does NOT support `createMediaElementSource()`. Since this app never uses `<audio>` elements as audio sources, this is a non-issue.

**Example:**
```javascript
// ExportService.js
export async function exportWav(state, sampleCache, durationSeconds, sampleRate = 44100) {
  const offlineCtx = new OfflineAudioContext(2, sampleRate * durationSeconds, sampleRate);

  // Re-register worklets in the offline context
  await offlineCtx.audioWorklet.addModule('/worklets/noise-processor.js');

  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = state.masterVolume;
  masterGain.connect(offlineCtx.destination);

  for (const channel of state.channels) {
    if (channel.muted) continue;
    const chain = channel.type === 'noise'
      ? createOfflineNoiseChain(offlineCtx, channel, masterGain)
      : createOfflineSampleChain(offlineCtx, channel, sampleCache, masterGain);
  }

  const audioBuffer = await offlineCtx.startRendering();
  const wavArrayBuffer = audioBufferToWav(audioBuffer);
  triggerDownload(wavArrayBuffer, 'mix.wav');
}
```

## Data Flow

### Live Playback Flow

```
User interaction (slider, mute toggle, add sound)
    ↓
UI Component dispatches state update
    ↓
AppState mutates + notifies subscribers
    ↓
AudioEngine subscriber receives change
    ↓
AudioEngine syncs graph:
  - Volume change → gainNode.gain.setTargetAtTime(value, ctx.currentTime, 0.05)
  - Mute toggle   → gainNode.gain.setTargetAtTime(0 or value, ctx.currentTime, 0.05)
  - Add sound     → createNoiseChain() or createSampleChain(), store in nodeMap
  - Remove sound  → sourceNode.stop(), disconnect all nodes, delete from nodeMap
    ↓
Audio renders to speakers in real-time
```

### Export Flow

```
User clicks "Export" → specifies duration
    ↓
ExportService.exportWav(state, sampleCache, duration)
    ↓
new OfflineAudioContext(2, sampleRate * duration, sampleRate)
    ↓
offlineCtx.audioWorklet.addModule('/worklets/noise-processor.js')
    ↓
Reconstruct node graph from state:
  - For each active (unmuted) channel:
      noise  → AudioWorkletNode + IIRFilterNode + GainNode
      sample → AudioBufferSourceNode (from cache) + GainNode
  - All channel gains → DynamicsCompressorNode (optional) → MasterGainNode → destination
    ↓
offlineCtx.startRendering() → AudioBuffer (PCM)
    ↓
audioBufferToWav(audioBuffer) → ArrayBuffer
    ↓
Blob → URL.createObjectURL() → <a download="mix.wav"> .click()
```

### Sample Looping Flow

```
App startup (after first user gesture)
    ↓
SampleLoader.preload(catalog)
  → fetch('public/samples/rain.wav')
  → audioContext.decodeAudioData(arrayBuffer)
  → store AudioBuffer in cache Map keyed by id
    ↓
When channel added (type: sample)
    ↓
SampleNode.create(ctx, audioBuffer, destination)
  → AudioBufferSourceNode
  → node.loop = true
  → node.loopStart = 0          (or trim point for the sample)
  → node.loopEnd = buffer.duration
  → node.connect(channelGain)
  → node.start()
    ↓
Source loops seamlessly at sample boundaries (no gap, no HTML Audio element)
```

### State Management Pattern

```
AppState (plain object + pub/sub)
         │
         ├── subscribe(AudioEngine.onStateChange)
         ├── subscribe(CatalogPanel.onStateChange)
         ├── subscribe(ChannelStrip.onStateChange)
         └── subscribe(ExportPanel.onStateChange)

User action → dispatch({ type, payload })
           → AppState updates internal object
           → notifies all subscribers with new state snapshot
           → AudioEngine adjusts live graph (imperative side effect)
           → UI components re-render affected DOM (imperative DOM update)
```

State is a plain JS object — no library required. The pattern is a minimal pub/sub: one `subscribe(fn)` method, one `dispatch(action)` method, one `getState()` getter.

## Build Order (Phase Implications)

Build in this dependency order — each step unblocks the next:

1. **AppState + catalog data** — no dependencies; defines the shape of all data
2. **WorkletLoader + noise-processor.js** — depends on nothing except the browser AudioWorklet API; build and test noise generation in isolation
3. **SampleLoader** — depends only on `fetch` + `decodeAudioData`; can load and verify samples independently
4. **AudioEngine (live playback)** — depends on WorkletLoader, SampleLoader, and AppState; wires everything into a live mix
5. **UI layer** — depends on AppState and AudioEngine; build sliders/mute/catalog after audio engine is verified
6. **ExportService** — depends on AppState, SampleLoader (cache), and WorkletLoader; build last since it reuses all existing pieces in a new context

This order means a working audio mix exists before any UI is built, and export is the final integration step.

## Anti-Patterns

### Anti-Pattern 1: Using `<audio loop>` for Preview

**What people do:** Set an `<audio>` element's `loop` attribute and route it through `createMediaElementSource()`.

**Why it's wrong:** The `<audio>` element has a persistent, unfixed gap at the loop boundary across all browsers (15+ year-old bug). The gap makes loops unusable for ambient/ambient video use cases. Additionally, `createMediaElementSource()` is explicitly banned in `OfflineAudioContext`, forcing a separate code path for export.

**Do this instead:** Always use `AudioBufferSourceNode` with `loop: true`. Load samples once at startup via `decodeAudioData` and store the resulting `AudioBuffer`. This provides sample-accurate gapless looping and works identically in both live `AudioContext` and `OfflineAudioContext`.

### Anti-Pattern 2: Recreating AudioContext or Source Nodes for Volume Changes

**What people do:** Stop and recreate the source node every time the user adjusts a slider, or destroy and recreate the `AudioContext` when the mix changes.

**Why it's wrong:** `AudioBufferSourceNode` instances are one-use — they can only be `start()`-ed once — but `AudioContext` and `GainNode` persist and are reusable. Recreating nodes causes audible clicks and gaps. Recreating the context loses all audio state and is expensive.

**Do this instead:** Keep one `GainNode` per channel for the session lifetime. Update `gainNode.gain.setTargetAtTime(value, ctx.currentTime, 0.015)` to smoothly ramp to the new value (avoids zipper noise). Create new source nodes only when a sound is added to the mix, not when its parameters change.

### Anti-Pattern 3: Using ScriptProcessorNode for Noise Generation

**What people do:** Use `ScriptProcessorNode` with an `onaudioprocess` callback to generate noise samples.

**Why it's wrong:** `ScriptProcessorNode` runs on the main JavaScript thread, not the audio rendering thread. Any UI activity (DOM updates, slider moves) starves the audio callback, causing stuttering and dropouts. It is also formally deprecated and may be removed in future browser versions.

**Do this instead:** Use `AudioWorkletProcessor` in a dedicated worklet module. The worklet runs on the audio rendering thread, isolated from main thread congestion.

### Anti-Pattern 4: Using MediaRecorder for Export

**What people do:** Call `MediaRecorder` on the `AudioContext.destination` stream to capture and save a live recording.

**Why it's wrong:** `MediaRecorder` produces WebM/Ogg (Vorbis or Opus), not PCM WAV. Gapless looping requires byte-perfect WAV with no encoder silence padding at file boundaries. Re-encoding from WebM to WAV introduces generation loss and extra tooling. Export duration also requires waiting in real-time — a 2-minute export takes 2 minutes.

**Do this instead:** Use `OfflineAudioContext.startRendering()` for deterministic, faster-than-realtime rendering directly to PCM `AudioBuffer`, then encode to WAV with `audiobuffer-to-wav`.

### Anti-Pattern 5: Embedding Worklet Code as Blob URLs

**What people do:** Inline the `AudioWorkletProcessor` source code as a string, create a `Blob`, and pass `URL.createObjectURL(blob)` to `addModule()` to avoid a separate file.

**Why it's wrong:** While it technically works, it prevents Vite from processing the worklet file (TypeScript, imports), makes the worklet code harder to maintain, and CSP policies on some browsers block blob-URL worklets.

**Do this instead:** Place worklet scripts in `public/worklets/` so they are served as static files from the same origin. Reference them by path: `ctx.audioWorklet.addModule('/worklets/noise-processor.js')`.

## Integration Points

### Internal Boundaries

| Boundary | Communication Pattern | Notes |
|----------|-----------------------|-------|
| UI ↔ AppState | Dispatch actions (plain objects); subscribe to state snapshots | One-way data flow: UI never mutates state directly |
| AppState ↔ AudioEngine | Subscription callback with full state snapshot | AudioEngine is the only component allowed to touch `AudioContext` |
| AudioEngine ↔ WorkletLoader | Async function call at startup; promise-based | Must complete before any `AudioWorkletNode` is created |
| AudioEngine ↔ SampleLoader | Function call returning `Promise<Map<id, AudioBuffer>>` | Cache is populated once at startup; export reads same cache |
| AudioEngine ↔ ExportService | ExportService reads AppState + SampleLoader cache directly | ExportService has NO dependency on AudioEngine's live nodes |
| AudioWorkletNode ↔ AudioWorkletProcessor | `MessagePort.postMessage` (complex state); `AudioParam` (numeric values, automation) | AudioParam changes are sample-accurate; MessagePort is async |

### No External Service Dependencies

This app is entirely self-contained. All audio synthesis happens in the browser. No network calls during playback or export. The only network activity is the initial `fetch()` of sample `.wav` files from `public/samples/`, which in production is just serving local static files.

## Scaling Considerations

This is a local personal tool — traditional scaling is not applicable. The relevant "scaling" concerns are:

| Concern | At 5 channels (MVP) | At 15+ channels |
|---------|---------------------|-----------------|
| Memory | Negligible — short WAV samples decoded once | Monitor total `AudioBuffer` memory; each 30s/stereo/44kHz sample ≈ 10MB RAM |
| Export render time | Sub-second for 30s mix with OfflineAudioContext | Still fast — OfflineAudioContext renders 10–50x faster than realtime |
| AudioWorklet count | One worklet module shared by all noise channels | One `AudioWorkletNode` per active noise channel is fine; single audio thread handles all |
| DOM complexity | Trivial | Consider virtual list for catalog if > 50 sounds; irrelevant for MVP |

## Sources

- [MDN: Basic concepts behind Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Basic_concepts_behind_Web_Audio_API) — Graph architecture, node types, mixer patterns (HIGH)
- [MDN: Using AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet) — AudioWorkletProcessor/Node architecture, MessagePort, AudioParam communication (HIGH)
- [MDN: AudioBufferSourceNode loop, loopStart, loopEnd](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/loop) — Seamless looping API (HIGH)
- [MDN: OfflineAudioContext](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext) — Export pipeline, rendering to AudioBuffer (HIGH)
- [W3C Web Audio API 1.1 spec](https://www.w3.org/TR/webaudio-1.1/) — Authoritative spec: node graph, summing junctions, modular routing (HIGH)
- [codestudy.net: How to Seamlessly Loop Sound with Web Audio API](https://www.codestudy.net/blog/how-to-seamlessly-loop-sound-with-web-audio-api/) — AudioBufferSourceNode gapless looping patterns (MEDIUM)
- [WebAudio API GitHub issue #74: Demoting AudioContext into OfflineAudioContext](https://github.com/WebAudio/web-audio-api-v2/issues/74) — Graph reconstruction constraints, memory doubling concern (MEDIUM)
- [Google Chrome Labs: AudioWorklet samples](https://googlechromelabs.github.io/web-audio-samples/audio-worklet/) — Practical AudioWorklet implementation examples (MEDIUM)
- [MDN: Using the Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_Web_Audio_API) — Standard setup patterns (HIGH)

---
*Architecture research for: Browser-based noise loop generator (local, no backend)*
*Researched: 2026-03-18*
