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
- **Effect module contract** (`src/effects/`): each effect is a folder `<slug>/` with `meta.ts` (static `EffectMeta`, safe for server pages) and `Effect.tsx` (client R3F component receiving `{ hub, quality, video, notify, bus }`; `notify(msg)` shows a short message on the player bar, call it only on events). `Effect.tsx` may also export an `Overlay` DOM component (rendered by Player above the Canvas, never mirrored); the R3F effect and its Overlay live in different React renderers, so they talk only through `bus` (`src/core/bus.ts`: `set`/`subscribe` for low-rate UI state, `send`/`onCommand` for button commands). See `aether/`. Registering a new effect requires adding its meta to `registry.ts` and a dynamic loader to `loaders.ts`. Server pages must import only `registry.ts`/`types.ts`, never `loaders.ts` or `Effect.tsx`.
- **Data flow at runtime** (`src/ui/Player.tsx`): state machine idle → requesting camera → loading (TrackerHub + effect chunk in parallel) → running. `TrackerHub` instantiates only the trackers listed in `meta.trackers`, runs inference on `requestVideoFrameCallback` independently of rendering, and stores the latest results in `hub.results`. Effects read `hub.results` inside `useFrame` — do not push per-frame tracker data into React state.
- **Coordinate setup**: the `<video>` and the transparent R3F `<Canvas>` share one `.frame` element sized to the video's aspect ratio (CSS `--ar`, "cover", so parts can be off-screen on phones) and mirrored together for the front camera. The Canvas camera uses fov 63 at the origin so MediaPipe's facial transformation matrices (cm units) can be applied directly. Effects that draw a full scene with text (e.g. `tiem-giat`) set `meta.selfMirror` so the frame is not CSS-mirrored, and mirror the video themselves.
- **Video colors**: sampling a `VideoTexture` tagged `SRGBColorSpace` inside a custom `ShaderMaterial` came out double-encoded (too bright). `tiem-giat/scene.ts` and `aether/render/EnergyComposer.ts` use `NoColorSpace` and write the sample out without `colorspace_fragment`.
- **Self-rendering effects**: an effect can take over rendering with `useFrame(cb, 1)` (as `aether` does: FX scene → half-float target → `UnrealBloomPass` → full-screen composite with the mirrored video). Create such runtimes inside `useEffect`, not `useMemo`, or React StrictMode's mount–unmount–mount in dev leaves you with a disposed runtime.
- **GLSL gotchas (seen on Windows/ANGLE)**: `pow(x, y)` with negative `x` returns NaN and reversed `smoothstep(edge0 > edge1, …)` is undefined — both produced large wedge artifacts. Square with `x * x`, clamp bases with `max(0.0, …)`, and write `1.0 - smoothstep(lo, hi, x)`.
- **Trying effects without a camera**: the in-app browser pane blocks `getUserMedia`. A throwaway client page that feeds `Effect` a `canvas.captureStream()` video and a fake `hub` (`{ results }`) renders the real scene; delete it before building or committing (and remove its stale `.next/types/app/<page>` folder, or `tsc` fails). The pane is usually hidden, so `requestAnimationFrame` is throttled and screenshots show stale frames: to inspect a timed animation, have the page patch `performance.now` so the test can freeze time and step it forward before each screenshot. For R3F, `<Canvas frameloop="never">` plus `useThree(s => s.advance)` steps frames deterministically; the canvas only gets its size after one screenshot forces the hidden pane to paint. Thin lines (1 px lightning) vanish in downscaled screenshots — copy a crop of the canvas into an `<img>` (needs `preserveDrawingBuffer`) to inspect at native resolution.
- **UI styling**: pastel design tokens (cream `--bg`, ink, mint/pink/lavender backgrounds with matching dark `*-ink` text colors) live in `:root` of `app/globals.css`; fonts are Lexend (display) + Be Vietnam Pro (body) via `next/font`. Pastels are backgrounds only — text and buttons use the `*-ink` shades for contrast. The AETHER overlay block at the end of `globals.css` stays dark/cinematic on purpose (it sits on the camera feed). The canvas design lives in the "Lăng Kính — Giao diện Pastel" Claude Design artifact.
- **Performance**: `PerfMonitor` (`src/core/perf.ts`) downgrades quality high → medium → low after 2 s below 24 FPS; effects must scale their cost by the `quality` prop, and low quality also sets `hub.stride = 2` (inference every other frame).
- **Privacy constraints (hard rules from the plan)**: only call `getUserMedia` from a user click; stop all tracks on exit/`visibilitychange`; never upload frames, landmarks or masks; `src/core/telemetry.ts` may only send event names plus coarse aggregate props (e.g. `fpsBucket`).
