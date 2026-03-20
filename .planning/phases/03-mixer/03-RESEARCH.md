# Phase 3: Mixer - Research

**Researched:** 2026-03-19
**Domain:** Vanilla JS DOM UI + Web Audio API master gain routing
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sound list layout**
- Vertical list of rows, one per catalog entry — same order as catalog (noise types first, then weather)
- No grouping headers — 7 sounds is short enough to scan without categories
- Each row contains: sound label + toggle control + volume slider
- No cards, no grid — single-column list is sufficient for a local tool

**Toggle interaction**
- Each row has a dedicated toggle button (not click-on-label) — clearer affordance than an implicit click target
- Active state: row visually distinct (brighter/highlighted) vs inactive (dimmed)
- Toggling off calls `stopSound(id)`; toggling on calls `startSound(id)`
- Volume slider is disabled and visually greyed when the sound is inactive

**Volume slider behavior**
- Slider range: 0.0 to 1.0
- Default value on first enable: use existing defaults from soundManager (`DEFAULT_GAIN_NOISE = 0.15`, `DEFAULT_GAIN_SAMPLE = 0.8`)
- Volume is remembered per sound — toggling off and back on restores the last-set value (hold in a JS state map, don't reset to default on re-enable)
- Slider calls `setGain(id, value)` on `input` event (live update while dragging)

**Master volume**
- Placed below the sound list, separated by a visible divider
- Same slider style as per-sound sliders but labeled "Master Volume"
- Default: 1.0 (full)
- Wired to a single master GainNode inserted between all sound gains and `ctx.destination`
- Range: 0.0 to 1.0

### Claude's Discretion
- Exact CSS styling (colors, spacing, slider appearance) — keep it functional and consistent with existing dark theme (`#1e1e1e` bg, `#ffffff` text)
- How the master GainNode is introduced into the audio graph (likely in AudioEngine.js or a new mixer module)
- State management for per-sound volume memory (simple JS Map in main.js or a new mixer module)
- Whether to inline styles or introduce a CSS file — either is fine; no design system required

### Deferred Ideas (OUT OF SCOPE)

None raised during discussion.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ENG-10 | Multiple sounds can play simultaneously | Confirmed via existing soundManager.js — each sound has its own GainNode; master GainNode insertion routes them all to ctx.destination through a shared bus |
| UI-01 | User sees a catalog of all available sounds with labels | catalog.js 7 entries drive the render loop; UI-SPEC documents exact label text and min-width |
| UI-02 | User can toggle each sound on/off with a play/pause control | Single `btn-toggle` button replaces separate Play/Stop pair; calls startSound/stopSound; state tracked in DOM |
| UI-03 | User can adjust each sound's volume with a slider | Per-sound `<input type="range">` calls `setGain(id, value)` on `input` event; volume Map remembers last value |
| UI-04 | User can control master output volume | Master GainNode (new in Phase 3) created after ensureRunning(); master slider sets masterGain.gain.value directly |
| UI-05 | Active sounds are visually distinct from inactive sounds | Active row: toggle button bg/border `#4caf50`; slider enabled; Inactive: button `#1e1e1e`/`#444`; slider `disabled` + opacity 0.4 |
</phase_requirements>

---

## Summary

Phase 3 replaces the temporary dev test UI in `src/main.js` with a real mixer. The audio layer (soundManager.js, AudioEngine.js, catalog.js) is complete and fully functional — Phase 3 is primarily a UI construction task with one audio graph change: inserting a master GainNode.

The UI is vanilla JS DOM only (no framework, no component library). All styling is inline, matching the existing `index.html` inline pattern. A detailed UI-SPEC (03-UI-SPEC.md) already specifies exact component structure, colors, spacing, copy, and interaction behavior — leaving no design ambiguity for the planner.

The one new audio concern: the existing `soundManager.setGain()` sets `.gain.value` directly, which the Web Audio spec notes can produce audible "zipper noise" when called rapidly from a slider `input` event. This is a known pitfall requiring a 15ms `setTargetAtTime` smooth instead of direct assignment for the live slider path.

**Primary recommendation:** Build in two tasks — (1) wire master GainNode into AudioEngine.js + update soundManager to route through it, then (2) render mixer UI in main.js replacing renderDevTestUI(). Address the zipper-noise pitfall in the setGain path before or alongside the slider wiring.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Audio API | Browser native | GainNode, AudioContext, AudioParam | Already in use; no install needed |
| Vanilla JS DOM | Browser native | UI rendering, event handling | Project constraint — no framework |
| Vite | ^8.0.0 (installed) | Dev server, HMR | Already configured |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| audiobuffer-to-wav | ^1.0.0 (installed) | WAV export (Phase 4 only) | Not needed this phase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline styles (chosen) | External CSS file | Both acceptable per CONTEXT.md; inline matches existing pattern |
| JS Map for volume memory (chosen) | sessionStorage | Map is simpler for a non-persistent local tool |
| setTargetAtTime for gain smoothing | Direct .gain.value | Direct value is simpler but risks zipper noise on rapid slider input — see Pitfalls |

**Installation:** No new packages required. All dependencies already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
noise-loop-generator/src/
├── audio/
│   ├── AudioEngine.js        # Add getMasterGain() export; create master GainNode once
│   └── soundManager.js       # Route per-sound gainNode through masterGain; update setGain smoothing
├── data/
│   └── catalog.js            # No changes — drives mixer render
└── main.js                   # Delete renderDevTestUI(); add renderMixer(); add volumeMap state
```

No new files required. All changes are in AudioEngine.js, soundManager.js, and main.js.

### Pattern 1: Master GainNode Insertion

**What:** Create one GainNode that sits between all per-sound gains and `ctx.destination`. All per-sound gains connect to it; it connects to `ctx.destination`.

**When to use:** Any time you need a global volume control over all sources.

**Implementation approach:**

```javascript
// In AudioEngine.js — add alongside getContext() / ensureRunning()
let masterGain = null;

export function getMasterGain() {
  // Called after ensureRunning() guarantees ctx exists
  if (!masterGain) {
    const ctx = getContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 1.0; // default: full volume
    masterGain.connect(ctx.destination);
  }
  return masterGain;
}
```

```javascript
// In soundManager.js — replace ctx.destination with getMasterGain()
// Line 31: gainNode.connect(ctx.destination);
// Becomes:
import { ensureRunning, getMasterGain } from './AudioEngine.js';
// ...
gainNode.connect(getMasterGain());
```

Source: [MDN GainNode](https://developer.mozilla.org/en-US/docs/Web/API/GainNode), [Web Audio API W3C spec](https://www.w3.org/TR/webaudio/)

### Pattern 2: Mixer UI Render (replaces renderDevTestUI)

**What:** A `renderMixer()` function that builds the full mixer DOM from the catalog array. Called once after the Start overlay is dismissed.

**Structure:**
```javascript
// In main.js — replaces renderDevTestUI()
const volumeMap = new Map(); // Persists per-sound volume across toggle cycles

function renderMixer() {
  const list = document.createElement('div');
  list.id = 'sound-list';
  list.style.cssText = 'display:flex;flex-direction:column;gap:0;';

  catalog.forEach(({ id, label, type }) => {
    const defaultVol = type === 'noise' ? 0.15 : 0.8;
    if (!volumeMap.has(id)) volumeMap.set(id, defaultVol);
    // ... build row with toggle button + slider
  });

  // Divider + master volume section appended after loop
  app.appendChild(list);
}
```

**Key wiring per row:**
- Toggle button click (inactive→active): `await startSound(id)`, update button to active styles, enable slider, set `slider.value = volumeMap.get(id)`, call `setGain(id, volumeMap.get(id))`
- Toggle button click (active→inactive): `stopSound(id)`, update button to inactive styles, disable slider
- Slider `input`: `setGain(id, parseFloat(slider.value))`, `volumeMap.set(id, parseFloat(slider.value))`

### Pattern 3: Master Volume Slider Wiring

**What:** Master slider directly sets the master GainNode's gain value.

```javascript
// After renderMixer() creates the master slider:
const masterSlider = document.createElement('input');
masterSlider.type = 'range';
masterSlider.min = '0'; masterSlider.max = '1'; masterSlider.step = '0.01';
masterSlider.value = '1.0';
masterSlider.addEventListener('input', () => {
  getMasterGain().gain.value = parseFloat(masterSlider.value);
});
```

Master slider uses direct `.gain.value` — this is safe because master volume changes are deliberate slow drags, not the rapid-fire slider events that cause zipper noise on per-sound sliders.

### Pattern 4: Initial State from isPlaying()

**What:** On render, call `isPlaying(id)` to set correct initial toggle state. In Phase 3 all sounds start off, so this will always return false — but is essential for correctness if the function is ever called after sounds are already active (e.g., HMR during dev).

```javascript
const playing = isPlaying(id);
// Set button to active or inactive style based on playing state
// Set slider disabled or enabled based on playing state
```

### Anti-Patterns to Avoid

- **Connecting gainNode to `ctx.destination` directly in soundManager:** The existing line `gainNode.connect(ctx.destination)` must be replaced with `gainNode.connect(getMasterGain())`. Leaving even one sound connected directly to destination bypasses master volume.
- **Resetting slider value to default on toggle-off:** The volumeMap remembers the last set value. When toggling back on, restore `slider.value = volumeMap.get(id)` and call `setGain(id, volumeMap.get(id))` so the audio graph matches the slider position.
- **Setting slider.value without calling setGain on toggle-on:** If the user had the slider at 0.5, toggling off and back on must both restore the visual slider AND apply the gain to the newly-started audio node. `startSound` creates a new gainNode with the default gain — the mixer must immediately call `setGain(id, volumeMap.get(id))` after `await startSound(id)` to override the default.
- **Calling getMasterGain() before ensureRunning():** The AudioContext may not exist yet. getMasterGain() must only be called after the Start button handler calls ensureRunning().

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Master volume control | Custom mixing logic | Single Web Audio GainNode at graph root | GainNode is a single arithmetic multiply — exactly correct for this use case |
| Volume memory persistence | localStorage / IndexedDB | JS Map in main.js | Phase requirement is per-session memory only; persistence is v2 (UI-V2-01) |
| UI components | Custom component system | Plain DOM element creation | No framework; 7-item list needs no abstraction overhead |

**Key insight:** The entire mixer UI is ~100 lines of DOM creation code. The audio graph change is ~5 lines. This phase does not justify any new abstractions.

---

## Common Pitfalls

### Pitfall 1: Zipper Noise on Per-Sound Slider Input

**What goes wrong:** Calling `nodes.gain.gain.value = value` on every `input` event causes audible "zipper noise" — a rapid-fire series of discontinuous gain steps that the ear perceives as distortion or crackling.

**Why it happens:** The Web Audio spec removed browser-side de-zippering. Direct `.gain.value` assignment is a hard instantaneous step. A range slider fires `input` events at ~60fps while dragging. Each step is a discontinuity.

**How to avoid:** In `soundManager.setGain()`, replace direct assignment with a short `setTargetAtTime`:

```javascript
// Current implementation (zipper risk):
nodes.gain.gain.value = Math.max(0, Math.min(1, value));

// Fixed (15ms time constant eliminates zipper, imperceptible delay):
nodes.gain.gain.setTargetAtTime(
  Math.max(0, Math.min(1, value)),
  ctx.currentTime,
  0.015  // 15ms — imperceptible but removes discontinuity
);
```

`setTargetAtTime` interrupts any previous scheduled ramp and starts fresh from the current value, making it safe for rapid slider calls.

**Warning signs:** Audible crackling or distortion when moving the volume slider while sound is playing.

Source: [alemangui.github.io — Web Audio: the ugly click](http://alemangui.github.io/ramp-to-value), [MDN AudioParam.setTargetAtTime](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/setTargetAtTime), [Web Audio API issue #76](https://github.com/WebAudio/web-audio-api/issues/76)

**Confidence:** HIGH — W3C spec explicitly removed de-zippering; MDN and community sources confirm 15ms timeConstant pattern.

### Pitfall 2: New gainNode Default Value After Toggle-On

**What goes wrong:** `startSound(id)` creates a brand-new gainNode with `DEFAULT_GAIN_NOISE` or `DEFAULT_GAIN_SAMPLE`. If the user previously dragged the slider to 0.3, toggled off, then toggled back on — the audio plays at 0.15 (the default) while the slider shows 0.3.

**Why it happens:** `soundManager.startSound()` has no knowledge of the UI's volumeMap. It always initializes the gain to the hardcoded default.

**How to avoid:** After `await startSound(id)` in the toggle click handler, immediately call `setGain(id, volumeMap.get(id))` to sync the new node's gain with the remembered slider position.

**Warning signs:** Volume jumps unexpectedly when re-enabling a sound that was previously set below 0.15 (noise) or 0.8 (sample).

### Pitfall 3: soundManager gainNode Still Connected to ctx.destination

**What goes wrong:** After inserting the master GainNode, if the `gainNode.connect(ctx.destination)` line in `soundManager.js` is not updated, all per-sound outputs bypass the master volume entirely.

**Why it happens:** The refactor touches soundManager.js line 31 — easy to overlook when focused on UI code.

**How to avoid:** The planner should make this a named sub-step in the audio graph task, not a side note. Verify by testing: set master slider to 0 and confirm all sounds go silent.

**Warning signs:** Master volume slider has no effect on playing sounds.

### Pitfall 4: getMasterGain() Called Before AudioContext Exists

**What goes wrong:** If getMasterGain() is called at module initialization (e.g., import-time side effect), it calls getContext() which creates an AudioContext before a user gesture — triggering browser autoplay suspension.

**Why it happens:** AudioEngine.js documents this explicitly: "Do NOT call new AudioContext() at module load." getMasterGain() must follow the same lazy pattern.

**How to avoid:** Only call getMasterGain() inside the startButton click handler or within functions called from it (startSound, the mixer render callback).

---

## Code Examples

Verified patterns from official sources:

### Master GainNode (standard bus pattern)
```javascript
// Source: MDN Web Audio API — GainNode
// https://developer.mozilla.org/en-US/docs/Web/API/GainNode
const masterGain = ctx.createGain();
masterGain.gain.value = 1.0;
masterGain.connect(ctx.destination);
// All sources connect to masterGain, not ctx.destination:
source.connect(perSoundGain);
perSoundGain.connect(masterGain); // not ctx.destination
```

### Gain smoothing for interactive sliders
```javascript
// Source: alemangui.github.io / MDN AudioParam.setTargetAtTime
// Time constant 0.015 = 15ms — imperceptible lag, eliminates zipper noise
gainNode.gain.setTargetAtTime(targetValue, ctx.currentTime, 0.015);
```

### Disabling a range input
```javascript
// Source: HTML spec — disabled attribute on form elements
slider.disabled = true;       // blocks input events
slider.style.opacity = '0.4'; // visual feedback
slider.style.pointerEvents = 'none'; // belt-and-suspenders
```

### Reading slider value
```javascript
// Source: HTML spec — input[type=range] value property
slider.addEventListener('input', () => {
  const value = parseFloat(slider.value); // value is a string — must parse
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Browser de-zippering (automatic) | Developer must use setTargetAtTime | Web Audio API 2013+ | Sliders require explicit smoothing |
| Separate Play/Stop buttons (Phase 2 dev UI) | Single toggle button (Phase 3) | This phase | Simpler affordance, single state |

**Deprecated/outdated:**
- Phase 2 `renderDevTestUI()`: Deleted entirely in Phase 3. The Start overlay wiring in `main.js` (lines 10–24) is retained unchanged.

---

## UI-SPEC Contract (Already Approved)

A full UI design contract already exists at `.planning/phases/03-mixer/03-UI-SPEC.md`. The planner MUST reference it. Key specifics the implementer needs:

| Component | Spec |
|-----------|------|
| `#app` container | `padding: 24px; max-width: 480px;` |
| Sound row | `display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid #2a2a2a;` |
| Sound label | `color:#ffffff; font-size:16px; font-weight:400; min-width:100px;` |
| Toggle button inactive | `background:#1e1e1e; color:#ffffff; border:1px solid #444; font-size:16px; font-weight:600; min-height:44px; padding:4px 12px; border-radius:4px;` |
| Toggle button active | `background:#4caf50; color:#ffffff; border:1px solid #4caf50;` |
| Volume slider | `<input type="range" min="0" max="1" step="0.01" style="flex:1">` |
| Divider | `border-top:1px solid #444; margin:16px 0;` |
| Master volume label | `font-size:16px; font-weight:600; color:#ffffff; min-width:100px;` |
| Master slider | same as volume slider; always enabled; default value 1.0 |
| Focus-visible (toggle) | `outline:2px solid #ffffff; outline-offset:3px;` |

---

## Open Questions

1. **Should `setGain` smoothing be added in this phase or left as-is?**
   - What we know: The existing `soundManager.setGain()` uses direct `.gain.value` assignment. This is technically a zipper-noise risk on rapid slider dragging.
   - What's unclear: Whether the ambient sounds (low-frequency continuous noise/samples) produce noticeable zipper noise at the slider steps produced by an HTML range input at step=0.01.
   - Recommendation: Add the 15ms `setTargetAtTime` fix in Phase 3 as a sub-step of the soundManager audio-graph task. Cost is 1 line. The fix is backward-compatible and eliminates a known audio quality issue.

2. **Which file owns getMasterGain(): AudioEngine.js or a new mixer module?**
   - What we know: CONTEXT.md marks this as "Claude's Discretion." AudioEngine.js already exports getContext/ensureRunning — getMasterGain() follows the same lazy singleton pattern and fits naturally.
   - What's unclear: Nothing — AudioEngine.js is the correct location. A new mixer module would add indirection with no benefit at this scale.
   - Recommendation: Add getMasterGain() to AudioEngine.js. Simple, consistent with existing patterns.

---

## Validation Architecture

`nyquist_validation` is enabled in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | none — no test framework installed |
| Config file | none |
| Quick run command | `npm run dev` (manual browser verification) |
| Full suite command | `npm run build` (Vite build smoke test) |

No automated test runner is present in the project. The `package.json` has no `test` script. The project is a Vite SPA tested entirely through browser interaction.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENG-10 | Multiple sounds play simultaneously | manual-only | — | N/A |
| UI-01 | Catalog renders 7 rows with correct labels | manual-only | — | N/A |
| UI-02 | Toggle on/off calls startSound/stopSound correctly | manual-only | — | N/A |
| UI-03 | Slider adjusts per-sound volume live | manual-only | — | N/A |
| UI-04 | Master slider controls overall output | manual-only | — | N/A |
| UI-05 | Active row visually distinct from inactive | manual-only | — | N/A |

**Manual-only justification:** Web Audio API behavior (audio graph, GainNode, AudioWorklet) cannot be tested without a browser audio context. JSDOM does not implement Web Audio. No test framework is installed and the project has no precedent for automated testing.

### Sampling Rate

- **Per task:** `npm run build` — verifies no Vite compile errors
- **Per wave merge:** Manual browser test: start app, toggle all 7 sounds, verify audio and visual states
- **Phase gate:** All 5 success criteria verified manually before `/gsd:verify-work`

### Wave 0 Gaps

None — no test infrastructure needed. Vite build (`npm run build`) is the only automated gate available and requires no setup.

---

## Sources

### Primary (HIGH confidence)
- [MDN GainNode](https://developer.mozilla.org/en-US/docs/Web/API/GainNode) — GainNode API, gain value behavior
- [MDN AudioParam.setTargetAtTime](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/setTargetAtTime) — smoothing pattern for interactive controls
- [W3C Web Audio API spec](https://www.w3.org/TR/webaudio/) — modular routing, fanout, GainNode spec
- `noise-loop-generator/src/audio/soundManager.js` — existing audio API surface (read directly)
- `noise-loop-generator/src/audio/AudioEngine.js` — singleton pattern to extend (read directly)
- `noise-loop-generator/src/data/catalog.js` — 7 entries driving UI render (read directly)
- `noise-loop-generator/src/main.js` — renderDevTestUI() to replace (read directly)
- `.planning/phases/03-mixer/03-UI-SPEC.md` — approved visual/interaction contract (read directly)

### Secondary (MEDIUM confidence)
- [alemangui.github.io — Web Audio: the ugly click](http://alemangui.github.io/ramp-to-value) — 15ms time constant recommendation, de-zippering explanation
- [Web Audio API issue #76 — De-zippering](https://github.com/WebAudio/web-audio-api/issues/76) — W3C decision to remove browser-side de-zippering

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use; no new dependencies
- Architecture: HIGH — audio graph pattern confirmed from MDN/W3C; UI structure from approved UI-SPEC
- Pitfalls: HIGH — zipper noise documented in W3C spec history and MDN; other pitfalls derived from direct code inspection

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable Web Audio API spec, unlikely to change)
