---
phase: 2
slug: sound-generation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Browser-only manual testing (no automated test runner) |
| **Config file** | None — AudioWorklet and Web Audio API are not testable in Node.js |
| **Quick run command** | `npm run build` (build-time automated checks) |
| **Full suite command** | `npm run dev` → open `http://localhost:5173` → run manual checklist |
| **Estimated runtime** | ~5 min manual checklist |

**Why no automated test runner:** AudioWorklet processors run in a browser-specific audio rendering thread. Node.js has no `AudioContext`, `AudioWorkletNode`, or Web Audio API. Jest/Vitest cannot test these behaviors. Build-time checks are the automated layer; audio behavior is manually verified.

---

## Sampling Rate

- **After every task commit:** Run `npm run build` — confirms no import/reference errors
- **After every plan wave:** Run full manual checklist (all 9 items below)
- **Before `/gsd:verify-work`:** Full checklist must be green
- **Max feedback latency:** ~60s (build) + ~5min (manual checklist)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 0 | ENG-02 | file-exists | `ls public/worklets/white-noise-processor.js` | ❌ Wave 0 | ⬜ pending |
| 2-01-02 | 01 | 0 | ENG-03 | file-exists | `ls public/worklets/pink-noise-processor.js` | ❌ Wave 0 | ⬜ pending |
| 2-01-03 | 01 | 0 | ENG-04 | file-exists | `ls public/worklets/brown-noise-processor.js` | ❌ Wave 0 | ⬜ pending |
| 2-01-04 | 01 | 0 | ENG-05 | file-exists | `ls public/worklets/grey-noise-processor.js` | ❌ Wave 0 | ⬜ pending |
| 2-01-05 | 01 | 1 | ENG-02/03/04/05 | manual | see checklist | ❌ Wave 0 | ⬜ pending |
| 2-01-06 | 01 | 1 | ENG-09 | manual (console) | `gainNodes.get('white').gain.value = 0.1` | ❌ Wave 0 | ⬜ pending |
| 2-01-07 | 01 | 1 | ENG-10 | manual | play 3+ sounds simultaneously | ❌ Wave 0 | ⬜ pending |
| 2-02-01 | 02 | 0 | ENG-06 | file-exists | `ls public/samples/rain.wav` | ❌ Wave 0 | ⬜ pending |
| 2-02-02 | 02 | 0 | ENG-07 | file-exists | `ls public/samples/wind.wav` | ❌ Wave 0 | ⬜ pending |
| 2-02-03 | 02 | 0 | ENG-08 | file-exists | `ls public/samples/thunder.wav` | ❌ Wave 0 | ⬜ pending |
| 2-02-04 | 02 | 1 | ENG-06/07/08 | manual | loop for 2+ cycles, no gap | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `public/worklets/white-noise-processor.js` — covers ENG-02
- [ ] `public/worklets/pink-noise-processor.js` — covers ENG-03
- [ ] `public/worklets/brown-noise-processor.js` — covers ENG-04
- [ ] `public/worklets/grey-noise-processor.js` — covers ENG-05
- [ ] `public/samples/rain.wav` — covers ENG-06 (human-verify checkpoint: user downloads CC0 file)
- [ ] `public/samples/wind.wav` — covers ENG-07 (human-verify checkpoint)
- [ ] `public/samples/thunder.wav` — covers ENG-08 (human-verify checkpoint: must be 44100 Hz)
- [ ] `public/samples/LICENSE.md` — CC0 license documentation for all sample files
- [ ] `src/audio/soundManager.js` — covers ENG-09, ENG-10

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| White noise plays 60+ s without stop | ENG-02 | AudioWorklet thread not testable in Node.js | Click Play (white), wait 60s, confirm audio continues |
| Pink noise audibly distinct | ENG-03 | Perceptual audio quality | Play white then pink — confirm clearly different character |
| Brown noise audibly distinct | ENG-04 | Perceptual audio quality | Play pink then brown — confirm more bass-heavy |
| Grey noise audibly distinct | ENG-05 | Perceptual audio quality | Play white then grey — confirm "fuller" sound |
| Rain loops gaplessly | ENG-06 | Loop boundary at AudioBuffer end | Listen through 2+ cycles with headphones — no click/gap |
| Wind loops gaplessly | ENG-07 | Loop boundary at AudioBuffer end | Listen through 2+ cycles with headphones |
| Thunder loops gaplessly | ENG-08 | Loop boundary, transient character | Listen through 2+ cycles with headphones |
| Gain change audible | ENG-09 | Audio output — no headless equivalent | Console: `gainNodes.get('white').gain.value = 0.1` → audible drop |
| Simultaneous play, no dropout | ENG-10 | CPU scheduling / audio graph | Play 3+ sounds — all heard simultaneously without gaps |
| process() never returns false | ENG-02-05 | Silent failure mode | Run each noise 60+ s — confirms `return true` is present |
| No AudioContext console errors | All | Browser autoplay policy | Open DevTools → Console → no red errors on Start |
| Memory stability | ENG-10 | AudioNode leak detection | Toggle one sound 20× — Chrome Memory panel shows flat heap |

---

## Automated Build-Time Checks

Run after each task commit:

```bash
# Build must pass (catches import errors, missing worklet references)
cd noise-loop-generator && npm run build

# Worklet files must exist
ls noise-loop-generator/public/worklets/white-noise-processor.js
ls noise-loop-generator/public/worklets/pink-noise-processor.js
ls noise-loop-generator/public/worklets/brown-noise-processor.js
ls noise-loop-generator/public/worklets/grey-noise-processor.js

# Sample files must exist (after human-verify checkpoint)
ls noise-loop-generator/public/samples/rain.wav
ls noise-loop-generator/public/samples/wind.wav
ls noise-loop-generator/public/samples/thunder.wav
ls noise-loop-generator/public/samples/LICENSE.md

# Catalog must have 7 entries
node --input-type=module <<'EOF'
import catalog from './noise-loop-generator/src/data/catalog.js';
const count = Array.isArray(catalog) ? catalog.length : catalog.catalog?.length;
if (count !== 7) throw new Error(`Expected 7 catalog entries, got ${count}`);
console.log('✓ Catalog: 7 entries');
EOF
```

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 360s (60s build + 300s manual)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
