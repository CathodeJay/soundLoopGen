---
phase: 03
slug: mixer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — no test framework installed; Vite SPA tested via browser |
| **Config file** | none |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build` + manual browser verification |
| **Estimated runtime** | ~5 seconds (build) + 2 minutes (manual browser) |

---

## Sampling Rate

- **After every task commit:** Run `npm run build` — verifies no Vite compile errors
- **After every plan wave:** Manual browser test: start app, toggle all 7 sounds, verify audio and visual states
- **Before `/gsd:verify-work`:** All 5 phase success criteria verified manually in browser
- **Max feedback latency:** ~5 seconds (build) per task

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | ENG-10, UI-04 | build + manual | `npm run build` | ✅ | ⬜ pending |
| 03-01-02 | 01 | 1 | ENG-10 | build + manual | `npm run build` | ✅ | ⬜ pending |
| 03-02-01 | 02 | 2 | UI-01, UI-02, UI-03, UI-05 | build + manual | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — no test infrastructure gaps. `npm run build` is the automated gate and requires no setup beyond what's already installed.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All 7 catalog rows render with correct labels | UI-01 | Web Audio + DOM; no headless browser | Start app → count rows → verify White Noise, Pink Noise, Brown Noise, Grey Noise, Rain, Wind, Thunder labels |
| Toggle on starts sound; toggle off stops sound | UI-02 | Web Audio API requires real browser audio context | Click toggle on each sound; verify audio plays; click again; verify silence |
| Per-sound slider adjusts volume live | UI-03 | Web Audio GainNode not testable in JSDOM | Start a sound; drag slider; verify volume changes while dragging |
| Master slider controls overall output | UI-04 | Web Audio GainNode not testable in JSDOM | Start 2+ sounds; drag master to 0; verify silence; drag to 1.0; verify audio |
| Active sounds visually distinct from inactive | UI-05 | Visual state; no visual regression tool installed | Active row: toggle button `#4caf50` bg/border; slider enabled. Inactive: button `#1e1e1e`/`#444` bg/border; slider opacity 0.4 |
| Multiple sounds play simultaneously | ENG-10 | Web Audio API simultaneous playback; JSDOM unsupported | Toggle on White Noise + Rain + Thunder; verify all 3 audible simultaneously |
| Volume remembered across toggle cycles | UI-03 | Requires interaction sequence | Set slider to 0.3; toggle off; toggle on; verify slider still shows 0.3 and audio matches |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
