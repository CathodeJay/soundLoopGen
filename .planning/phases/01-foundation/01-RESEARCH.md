# Phase 1: Foundation - Research

**Researched:** 2026-03-18
**Domain:** Vite project scaffolding + AudioContext initialization (Web Audio API autoplay bootstrap)
**Confidence:** HIGH — all findings verified against MDN official docs and Vite 8 announcement

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

None explicitly locked — user expressed no preference on any implementation area.

### Claude's Discretion

- **Bootstrap trigger**: Recommended approach is a persistent "Start" button overlaying the UI on first load. The button dismisses after click, AudioContext transitions from suspended to running. This is the cleanest pattern for the autoplay constraint (MDN recommended approach).
- **Project structure**: Standard Vite vanilla JS layout:
  - `src/` — main app JS
  - `src/audio/` — AudioEngine, noise node factories
  - `public/worklets/` — AudioWorklet processor files (must be served as static assets, not bundled)
  - `src/data/catalog.js` — sound catalog definition (array of sound descriptors)
- **Package manager**: npm (default, no preference expressed)
- **Node version**: Whatever is current on user's macOS — no hard constraint

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ENG-01 | App initializes AudioContext on first user gesture (no silent autoplay failure) | AudioContext autoplay policy documented in PITFALLS.md; bootstrap pattern via `ensureRunning()` with `ctx.resume()` verified against MDN; Vite 8 scaffold command confirmed in STACK.md |
</phase_requirements>

---

## Summary

Phase 1 is purely a project scaffolding + audio bootstrap problem. The deliverables are: a working Vite 8 vanilla JS project that starts with `npm run dev`, a correct directory structure (with `public/worklets/` as a static-asset directory separate from `src/`), an AudioContext that starts in the `suspended` state and reliably transitions to `running` on the first user click, and a console/DevTools-visible confirmation that the transition happened. No sound is produced, no audio nodes are wired up — just the context lifecycle working correctly.

The biggest risk in this phase is the autoplay trap: if an `AudioContext` is created before a user gesture, or if `resume()` is never called, the context stays `suspended` forever with no error. The fix is three lines of code but must be built into the foundation from the start. The second risk is the Vite/AudioWorklet path mismatch: `public/worklets/` must be created now even though no worklet code runs yet, because getting the directory structure wrong here means a 404 on `addModule()` in Phase 2.

**Primary recommendation:** Scaffold with `npm create vite@latest noise-loop-generator -- --template vanilla`, create the `public/worklets/` directory as a placeholder, and wire an `AudioEngine.js` module with a single `ensureRunning()` function that creates the context lazily on first call and calls `resume()` if suspended. A "Start" overlay button triggers this on click and removes itself from the DOM once the context is running.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vite | 8.x | Dev server + bundler | Framework-agnostic, `--template vanilla`, sub-second HMR, Rolldown-based build; requires Node 20.19+ or 22.12+ |
| Vanilla JS | ES2022+ | Application language | No framework overhead needed; Web Audio API nodes map cleanly to plain JS objects |
| Web Audio API | Browser-native | AudioContext lifecycle management | The only viable in-browser audio API; handles the full audio pipeline this app needs (HIGH — MDN official) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| audiobuffer-to-wav | 1.0.0 | WAV encoding from AudioBuffer | Phase 4 (export) — install now to lock the dependency, use later |

No additional libraries are needed for Phase 1 specifically. `audiobuffer-to-wav` is listed because STACK.md calls it the only non-dev dependency for the MVP and it can be installed at scaffold time.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vanilla JS + Vite | React/Vue + Vite | Only justified if UI grows complex with many interacting components; unnecessary for this scope |
| Lazy AudioContext creation | Create at module load | Module-load creation triggers autoplay suspension; lazy creation is the only correct approach |

**Installation:**
```bash
npm create vite@latest noise-loop-generator -- --template vanilla
cd noise-loop-generator
npm install audiobuffer-to-wav
```

**Version verification:** Vite 8.x confirmed via official Vite blog (https://vite.dev/blog/announcing-vite8). `audiobuffer-to-wav@1.0.0` confirmed on npm (stable for 10 years; WAV format is frozen).

---

## Architecture Patterns

### Recommended Project Structure

```
noise-loop-generator/
├── public/
│   ├── worklets/               # AudioWorklet processor scripts (served as static assets)
│   │   └── .gitkeep            # Placeholder — worklet code added in Phase 2
│   └── samples/                # CC0 .wav sample files (added in Phase 2)
├── src/
│   ├── main.js                 # Entry point: init overlay, wire AudioEngine
│   ├── audio/
│   │   └── AudioEngine.js      # Owns AudioContext singleton, ensureRunning()
│   └── data/
│       └── catalog.js          # Sound catalog array — populated in Phase 2
├── index.html
├── vite.config.js
└── package.json
```

**Why this structure now:** The `public/worklets/` directory must exist before Phase 2 attempts `addModule('/worklets/noise-processor.js')`. Establishing the full directory skeleton in Phase 1 prevents structural refactoring later.

### Pattern 1: Lazy AudioContext Singleton with ensureRunning()

**What:** Create the `AudioContext` only on first user interaction (not at module load). Expose a single `ensureRunning()` async function that creates it if null and calls `resume()` if suspended.

**When to use:** Every path that touches the audio graph calls `ensureRunning()` first. This is the ONLY safe pattern for the autoplay constraint.

**Example:**
```javascript
// src/audio/AudioEngine.js
// Source: MDN Web Audio API Best Practices + Architecture research pattern
let ctx = null;

export function getContext() {
  if (!ctx) {
    ctx = new AudioContext({ sampleRate: 44100 });
  }
  return ctx;
}

export async function ensureRunning() {
  const context = getContext();
  if (context.state === 'suspended') {
    await context.resume();
  }
  return context;
}
```

**Why `sampleRate: 44100`:** Pins the live context to a known rate. The OfflineAudioContext for export (Phase 4) must match this exactly to avoid resampling artifacts. Establishing the rate constant in Phase 1 prevents a hidden mismatch bug later.

### Pattern 2: "Start" Overlay Bootstrap Button

**What:** A full-page overlay with a single "Start" button is displayed on load. On click, `ensureRunning()` is called, the overlay is removed from the DOM, and the main UI is revealed. This is the MDN-recommended approach for handling the autoplay policy cleanly.

**When to use:** Phase 1 only — subsequent phases use `ensureRunning()` directly since the context is already initialized.

**Example:**
```javascript
// src/main.js
import { ensureRunning, getContext } from './audio/AudioEngine.js';

const overlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-btn');

startBtn.addEventListener('click', async () => {
  const ctx = await ensureRunning();
  console.log('AudioContext state:', ctx.state); // should log "running"
  overlay.remove();
  // Phase 2+: initialize sound nodes here
});
```

### Pattern 3: AudioContext State Monitoring for Debugging

**What:** Listen to `onstatechange` on the AudioContext and log transitions. This surfaces the suspended → running → suspended → closed lifecycle visibly during development and is the primary verification for ENG-01.

**Example:**
```javascript
// Inside AudioEngine.js, after ctx is created
ctx.onstatechange = () => {
  console.log('[AudioEngine] state changed to:', ctx.state);
};
```

### Anti-Patterns to Avoid

- **Creating AudioContext at module load:** `const ctx = new AudioContext()` at the top of any module — this triggers the autoplay suspension immediately. The context starts suspended and has no path to resume if no call to `resume()` is wired.
- **Using relative paths for addModule():** `ctx.audioWorklet.addModule('./worklets/noise.js')` — relative paths resolve from the calling module's URL, not the document root, causing subtle 404s in Vite's dev server. Always use `/worklets/noise.js` (absolute from origin).
- **Skipping the `public/worklets/` directory in Phase 1:** If this directory is not established now, Phase 2 implementors may place worklet `.js` files in `src/`, where Vite will try to bundle them — breaking AudioWorklet entirely.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WAV file encoding | Custom PCM header + interleave logic | `audiobuffer-to-wav` | WAV header format has subtle fields (chunk sizes, byte order, format codes); hand-rolled implementations frequently produce files that some tools reject; the library handles both 16-bit PCM and 32-bit float modes |
| AudioContext autoplay bypass | Browser API workarounds | MDN-specified `ctx.resume()` after user gesture | No reliable workaround exists; this is the only spec-compliant path |

**Key insight:** Phase 1 has almost nothing to hand-roll — the hard work is wiring existing browser APIs correctly, not building infrastructure.

---

## Common Pitfalls

### Pitfall 1: AudioContext Created Before User Gesture — Stays Suspended

**What goes wrong:** `new AudioContext()` called at module load time starts suspended. No resume logic = no sound, no error, app appears broken.

**Why it happens:** Browsers enforce an autoplay policy — audio context creation or playback requires a prior user gesture on the document.

**How to avoid:** Create the `AudioContext` inside the first interaction handler OR create lazily (as in `ensureRunning()`) and always call `ctx.resume()` before any playback. Never call `new AudioContext()` at module top level.

**Warning signs:** `audioCtx.state === "suspended"` logged after page load. No output from Chrome's Web Audio Inspector.

### Pitfall 2: AudioWorklet File Placed in `src/` Instead of `public/`

**What goes wrong:** `audioCtx.audioWorklet.addModule('/worklets/noise-processor.js')` returns a 404 because Vite processed the file through its bundler rather than serving it as a static asset.

**Why it happens:** Vite transforms all files imported from `src/` through its pipeline. AudioWorklet modules must be loaded via a URL fetch (not an ES module import), so Vite cannot bundle them. Files in `public/` are copied as-is to the build output and served directly.

**How to avoid:** Keep all `AudioWorkletProcessor` files in `public/worklets/`. Reference them with an absolute origin path: `/worklets/noise-processor.js`. Never import them as ES modules.

**Warning signs:** `DOMException: The AudioWorklet module '/worklets/noise-processor.js' could not be loaded` in the console. A 404 for the worklet file in the Network tab.

### Pitfall 3: Hardcoded Sample Rate in AudioContext

**What goes wrong:** `new AudioContext()` without `{ sampleRate: 44100 }` defaults to the system audio device's native rate (often 48000 Hz on macOS). The OfflineAudioContext in Phase 4 may be created with a different rate, causing resampling artifacts in exported files.

**Why it happens:** Developers defer the sample rate decision and hardcode it later at export time, creating a mismatch.

**How to avoid:** Set `sampleRate: 44100` explicitly in the `AudioContext` constructor in Phase 1. Pin this as a project-wide constant. The OfflineAudioContext in Phase 4 will read `audioCtx.sampleRate` dynamically, so both contexts stay in sync automatically.

**Warning signs:** `AudioContext` created with no options object. Exported WAV plays at wrong speed on a machine with a different native sample rate.

---

## Code Examples

Verified patterns from MDN and project architecture research:

### AudioContext Bootstrap (the ENG-01 implementation)

```javascript
// src/audio/AudioEngine.js
// Source: MDN Web Audio API Best Practices, ARCHITECTURE.md Pattern 1

const SAMPLE_RATE = 44100; // project-wide constant

let ctx = null;

export function getContext() {
  if (!ctx) {
    ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    ctx.onstatechange = () => {
      console.log('[AudioEngine] state:', ctx.state);
    };
  }
  return ctx;
}

export async function ensureRunning() {
  const context = getContext();
  if (context.state === 'suspended') {
    await context.resume();
  }
  return context;
}
```

### Start Overlay (index.html snippet)

```html
<!-- index.html -->
<div id="start-overlay" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#111;z-index:9999">
  <button id="start-btn" style="font-size:1.5rem;padding:1rem 2.5rem;cursor:pointer">
    &#9654; Start
  </button>
</div>
<div id="app" style="display:none">
  <!-- Phase 2+ UI mounts here -->
</div>
```

### Start Overlay Handler (main.js)

```javascript
// src/main.js
// Source: MDN Autoplay Guide pattern

import { ensureRunning, getContext } from './audio/AudioEngine.js';

document.getElementById('start-btn').addEventListener('click', async () => {
  const ctx = await ensureRunning();
  console.log('[main] AudioContext state after resume:', ctx.state);
  document.getElementById('start-overlay').remove();
  document.getElementById('app').style.display = '';
});
```

### Vite Scaffold Command

```bash
# Source: STACK.md — Vite 8 official template
npm create vite@latest noise-loop-generator -- --template vanilla
cd noise-loop-generator
npm install audiobuffer-to-wav
mkdir -p public/worklets public/samples
touch public/worklets/.gitkeep public/samples/.gitkeep
npm run dev
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ScriptProcessorNode` for audio generation | `AudioWorkletProcessor` | Chrome 64 / 2018, now required | ScriptProcessorNode is deprecated; AudioWorklet is mandatory for Phase 2+ |
| `<audio loop>` for sample preview | `AudioBufferSourceNode` with `loop: true` | Web Audio API v1 spec | 15-year-old gap bug in `<audio>` is unfixed; AudioBufferSourceNode is the only gapless path |
| Webpack for Vite apps | Vite 8 with Rolldown | Vite 8 / 2025 | 10-30x faster builds; requires Node 20.19+ |

**Deprecated/outdated:**
- `ScriptProcessorNode`: deprecated in all browsers, causes audio dropouts under UI load — never use
- `audioCtx.createScriptProcessor()`: same as above
- `Vite 5/6/7`: Vite 8 is current as of STACK.md research date; Node 18 is now EOL and incompatible

---

## Open Questions

1. **Node.js version on the user's machine**
   - What we know: Vite 8 requires Node 20.19+ or 22.12+; user is on macOS
   - What's unclear: Whether the user has a compatible Node version installed
   - Recommendation: Include a `node --version` check in the setup task; if below 20.19, surface a clear message. The `.nvmrc` or `engines` field in `package.json` can encode the requirement.

2. **TypeScript vs plain JS**
   - What we know: CONTEXT.md says Claude has full discretion; STACK.md notes "TypeScript optional but improves AudioNode type safety"
   - What's unclear: No user preference expressed
   - Recommendation: Use the `--template vanilla` (plain JS) scaffold for minimum friction. TypeScript can be layered on later if desired. Phase 1 should minimize variables.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — greenfield project |
| Config file | None — see Wave 0 gaps |
| Quick run command | `npm run dev` (manual browser check) |
| Full suite command | No automated test suite in scope for Phase 1 |

Phase 1 success criteria are behavioral and visible (AudioContext state, DevTools, no 404s) rather than unit-testable. Automated unit tests for the audio bootstrap layer are not standard practice because `AudioContext` is a browser API with no Node.js equivalent — mocking it adds more complexity than value for this phase.

The verification approach for ENG-01 is manual:
1. `npm run dev` starts without error
2. Opening the app shows the Start overlay
3. Clicking Start logs `AudioContext state: running` in the console
4. DevTools Web Audio Inspector shows an active context
5. No 404 errors in the Network tab

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENG-01 | AudioContext transitions suspended → running on first user gesture | manual-only | n/a — browser API not testable in Node | ❌ Not applicable |

**Manual-only justification for ENG-01:** `AudioContext` is a browser-native API with no Node.js implementation. Mocking it at the unit level would test the mock, not the behavior. The correct verification is a developer manually loading the page in a browser and observing the state transition, as specified in the phase success criteria.

### Sampling Rate

- **Per task commit:** `npm run dev` — verify app loads without console errors
- **Per wave merge:** Manual browser check (Start button, console log, no 404s)
- **Phase gate:** All four success criteria visible in browser before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `public/worklets/.gitkeep` — placeholder for AudioWorklet directory (prevents Phase 2 404)
- [ ] `public/samples/.gitkeep` — placeholder for sample audio directory
- [ ] Node 20.19+ check — `node --version` to confirm Vite 8 compatibility

*(No test framework installation needed for Phase 1; automated tests are not applicable to this phase's requirements.)*

---

## Sources

### Primary (HIGH confidence)
- MDN Web Audio API Best Practices — AudioContext lifecycle, resume() pattern, autoplay policy
- MDN Autoplay Guide (https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) — Chrome autoplay policy, user gesture requirement
- MDN AudioContext constructor (https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/AudioContext) — sampleRate option
- Vite 8 announcement (https://vite.dev/blog/announcing-vite8) — current version, Node requirements, scaffold command
- `.planning/research/STACK.md` — full stack decisions, verified package versions, Vite setup
- `.planning/research/PITFALLS.md` — AudioContext autoplay trap, AudioWorklet path pitfall (MDN-sourced)
- `.planning/research/ARCHITECTURE.md` — project structure, AudioEngine patterns, ensureRunning() pattern

### Secondary (MEDIUM confidence)
- Chrome Autoplay Policy blog (https://developer.chrome.com/blog/autoplay) — user activation model, auto-resume behavior

### Tertiary (LOW confidence)
- None for Phase 1 scope

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Vite 8 and Web Audio API verified against official sources
- Architecture: HIGH — patterns drawn directly from MDN official docs and project ARCHITECTURE.md
- Pitfalls: HIGH — all three pitfalls directly documented in PITFALLS.md with MDN sources

**Research date:** 2026-03-18
**Valid until:** 2026-09-18 (stable APIs; Vite version may increment but pattern is stable)
