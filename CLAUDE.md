# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Lăng Kính" — a Vietnamese-language WebAR art site: a gallery of camera effects (face/hand/pose/segmentation) that run fully on-device in the browser. The product plan (scope, roadmap, KPIs, privacy rules) is in `docs/KE-HOACH.md`. UI copy is Vietnamese.

## Commands

```bash
npm run dev          # next dev on :3000 (predev downloads MediaPipe models first)
npm run dev:https    # HTTPS dev server — needed to test the camera from a phone on the LAN
npm run build        # static export to out/ (prebuild also fetches models)
npm run preview      # serve out/ on :3000
npm run lint         # eslint (flat config, next/core-web-vitals + next/typescript)
npm run typecheck    # tsc --noEmit
npm run models       # copy MediaPipe WASM + download .task/.tflite models into public/mediapipe/
```

`npm run build` and `npm run dev` share `.next/`: running a build while the dev server is up corrupts it (500s, `__webpack_modules__[moduleId] is not a function`). Stop dev, `rm -rf .next`, restart.

No test runner yet. `spike/index.html` is a standalone MediaPipe FPS benchmark page (serve with `npx serve spike -l 5173`); record results in `spike/RESULTS.md`.

## Architecture

- **Next.js App Router with `output: "export"`** — everything is prerendered static HTML for Cloudflare Pages; there is no server/API. Dynamic routes must use `generateStaticParams` with `dynamicParams = false`. `/play/[slug]` only exists for effects with `status: "ready"`.
- **MediaPipe is self-hosted**: `scripts/fetch-models.mjs` populates `public/mediapipe/{wasm,models}` (gitignored). `src/core/tracker-hub.ts` loads from those paths; never point it at a third-party CDN.
- **Effect module contract** (`src/effects/`): each effect is a folder `<slug>/` with `meta.ts` (static `EffectMeta`, safe for server pages) and `Effect.tsx` (client R3F component receiving `{ hub, quality, video, notify }`; `notify(msg)` shows a short message on the player bar, call it only on events). Registering a new effect requires adding its meta to `registry.ts` and a dynamic loader to `loaders.ts`. Server pages must import only `registry.ts`/`types.ts`, never `loaders.ts` or `Effect.tsx`.
- **Data flow at runtime** (`src/ui/Player.tsx`): state machine idle → requesting camera → loading (TrackerHub + effect chunk in parallel) → running. `TrackerHub` instantiates only the trackers listed in `meta.trackers`, runs inference on `requestVideoFrameCallback` independently of rendering, and stores the latest results in `hub.results`. Effects read `hub.results` inside `useFrame` — do not push per-frame tracker data into React state.
- **Coordinate setup**: the `<video>` and the transparent R3F `<Canvas>` share one `.frame` element sized to the video's aspect ratio (CSS `--ar`, "cover", so parts can be off-screen on phones) and mirrored together for the front camera. The Canvas camera uses fov 63 at the origin so MediaPipe's facial transformation matrices (cm units) can be applied directly. Effects that draw a full scene with text (e.g. `tiem-giat`) set `meta.selfMirror` so the frame is not CSS-mirrored, and mirror the video themselves.
- **Video colors**: sampling a `VideoTexture` tagged `SRGBColorSpace` inside a custom `ShaderMaterial` came out double-encoded (too bright). `tiem-giat/scene.ts` uses `NoColorSpace` and writes the sample out without `colorspace_fragment`.
- **Trying effects without a camera**: the in-app browser pane blocks `getUserMedia`. A throwaway client page that feeds `Effect` a `canvas.captureStream()` video and a fake `hub` (`{ results }`) renders the real scene; delete it before building or committing (and remove its stale `.next/types/app/<page>` folder, or `tsc` fails). The pane is usually hidden, so `requestAnimationFrame` is throttled and screenshots show stale frames: to inspect a timed animation, have the page patch `performance.now` so the test can freeze time and step it forward before each screenshot.
- **Performance**: `PerfMonitor` (`src/core/perf.ts`) downgrades quality high → medium → low after 2 s below 24 FPS; effects must scale their cost by the `quality` prop, and low quality also sets `hub.stride = 2` (inference every other frame).
- **Privacy constraints (hard rules from the plan)**: only call `getUserMedia` from a user click; stop all tracks on exit/`visibilitychange`; never upload frames, landmarks or masks; `src/core/telemetry.ts` may only send event names plus coarse aggregate props (e.g. `fpsBucket`).
